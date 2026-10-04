/**
 * Translation between the story format and the React Flow graph.
 *
 * The format stays the source of truth: React Flow is only a projection. A
 * single place knows both vocabularies — this one.
 *
 * An edge on the canvas is exactly a `Link` of the story: nothing is hidden in
 * the source node. What is drawn is what is written.
 */

import { MarkerType } from '@xyflow/react';
import type { Edge, Node } from '@xyflow/react';
import type { Link, Scene, SceneId, Story, ValidationIssue } from '@embranche/story-format';

import { kinds, studio } from '@embranche/design-tokens';

import {
  CARD,
  breakAt,
  allCrossings,
  allOverlaps,
  fanShift,
  pointAt,
  polylineLength,
  bracketLine,
  portPoint,
  roundedPath,
  traceOf,
  routeLink,
  sideLength,
} from './edgeGeometry';
import type { Box, Detour, End, Point, Side } from './edgeGeometry';
import { DEFAULT_LAYOUT } from './layout';

/**
 * Where a node stands relative to the selection.
 *
 * A story is read as a path, so the question in front of a graph is never
 * "which node is selected" but "what leads here, and what follows". The two
 * directions are told apart rather than merged: upstream is the past of the
 * reading, downstream its future.
 *
 * `idle` and `unrelated` are two different things, and confusing them dims the
 * whole canvas the moment the author clicks on the background: `idle` means no
 * node is selected, so there is nothing to put forward and everything stays
 * lit; `unrelated` means a node *is* selected and this one is off its path.
 */
export type FocusRole = 'idle' | 'self' | 'upstream' | 'downstream' | 'unrelated';

/** Data carried by a scene node. */
export interface SceneNodeData extends Record<string, unknown> {
  scene: Scene;
  isStart: boolean;
  /** Issues attached to this scene, for the alert ring. */
  issues: ValidationIssue[];
  /** True when this node stops the reading to wait for a player decision. */
  awaitsChoice: boolean;
  /** Position relative to the selection. `idle` when there is none. */
  focus: FocusRole;
  /** True when the node matches the current search. */
  match: boolean;
  /** True when no run can reach this node — see `exploreReachable`. */
  dead: boolean;
}

export type SceneFlowNode = Node<SceneNodeData, 'scene'>;

/** Edge id: `scene:link`, stable and directly decodable. */
export function edgeId(sceneId: SceneId, linkId: string): string {
  return `${sceneId}:${linkId}`;
}

export function parseEdgeId(id: string): { sceneId: SceneId; linkId: string } | null {
  const separator = id.indexOf(':');
  if (separator < 0) return null;
  return { sceneId: id.slice(0, separator), linkId: id.slice(separator + 1) };
}

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------

/**
 * The ports of a node.
 *
 * Top and bottom are the reading direction, and the only two the author can
 * grab: a link is drawn downwards, like the story is read. The four side ports
 * are for routing only — they carry the detours, so a link that climbs back up
 * or runs across a rank no longer crosses the very cards it connects.
 */
export const PORT = {
  in: 'in',
  out: 'out',
  inLeft: 'in-left',
  inRight: 'in-right',
  outLeft: 'out-left',
  outRight: 'out-right',
} as const;

/** Card size, from the stylesheet — enough to tell "below" from "beside". */
const NODE_HEIGHT = 96;

export interface Route {
  sourceHandle: string;
  targetHandle: string;
}

/**
 * Which side each end of a link leaves and enters by.
 *
 * With a single pair of ports every edge starts at a bottom edge and ends at a
 * top one, so a link going back up is drawn *through* both nodes and a link
 * across a rank makes a detour under them. Choosing the side from the relative
 * position of the two cards is what keeps a path followable: falling straight
 * down means going forward, and a bracket on the side means coming back.
 */
export function routeOf(from: { x: number; y: number }, to: { x: number; y: number }): Route {
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  // A node pointing at itself: a small bracket beside it, rather than a loop
  // drawn across its own card.
  if (dx === 0 && dy === 0) return { sourceHandle: PORT.outRight, targetHandle: PORT.inRight };

  // Reading order: the target sits below, the link falls into it.
  if (dy > NODE_HEIGHT * 0.6) return { sourceHandle: PORT.out, targetHandle: PORT.in };

  // The target sits above: the link climbs back. It leaves and comes back by
  // the same side, which draws a bracket walking around both cards.
  if (dy < -NODE_HEIGHT * 0.6) {
    return dx >= 0
      ? { sourceHandle: PORT.outRight, targetHandle: PORT.inRight }
      : { sourceHandle: PORT.outLeft, targetHandle: PORT.inLeft };
  }

  // Side by side: straight across, from one facing side to the other.
  return dx >= 0
    ? { sourceHandle: PORT.outRight, targetHandle: PORT.inLeft }
    : { sourceHandle: PORT.outLeft, targetHandle: PORT.inRight };
}

// ---------------------------------------------------------------------------
// Focus
// ---------------------------------------------------------------------------

export interface GraphFocus {
  /** Selected nodes. Empty when nothing is selected: the whole graph is lit. */
  selected: Set<SceneId>;
  /** Everything that can lead to the selection. */
  upstream: Set<SceneId>;
  /** Everything the selection can lead to. */
  downstream: Set<SceneId>;
  /** Edge ids lying on a path through the selection, by direction. */
  upstreamEdges: Set<string>;
  downstreamEdges: Set<string>;
}

export const EMPTY_FOCUS: GraphFocus = {
  selected: new Set(),
  upstream: new Set(),
  downstream: new Set(),
  upstreamEdges: new Set(),
  downstreamEdges: new Set(),
};

/**
 * Everything the selected nodes reach, and everything that reaches them.
 *
 * Conditions are ignored on purpose: this answers "how is this node wired into
 * the story", which is a question about the graph. Whether a path can actually
 * be walked is a different question, and `exploreReachable` answers it.
 */
export function focusOn(story: Story, selectedIds: readonly SceneId[]): GraphFocus {
  const selected = new Set(selectedIds.filter((id) => story.scenes[id]));
  if (selected.size === 0) return EMPTY_FOCUS;

  const downstream = new Set<SceneId>();
  const downstreamEdges = new Set<string>();
  const upstream = new Set<SceneId>();
  const upstreamEdges = new Set<string>();

  const parents = parentIndex(story);

  const walkDown = (id: SceneId): void => {
    for (const link of story.scenes[id]?.next ?? []) {
      if (!story.scenes[link.to]) continue;
      downstreamEdges.add(edgeId(id, link.id));
      if (downstream.has(link.to) || selected.has(link.to)) continue;
      downstream.add(link.to);
      walkDown(link.to);
    }
  };

  const walkUp = (id: SceneId): void => {
    for (const { sceneId, linkId } of parents.get(id) ?? []) {
      upstreamEdges.add(edgeId(sceneId, linkId));
      if (upstream.has(sceneId) || selected.has(sceneId)) continue;
      upstream.add(sceneId);
      walkUp(sceneId);
    }
  };

  for (const id of selected) {
    walkDown(id);
    walkUp(id);
  }
  return { selected, upstream, downstream, upstreamEdges, downstreamEdges };
}

/** Incoming links of every scene, indexed by target. */
function parentIndex(story: Story): Map<SceneId, { sceneId: SceneId; linkId: string }[]> {
  const parents = new Map<SceneId, { sceneId: SceneId; linkId: string }[]>();
  for (const scene of Object.values(story.scenes)) {
    for (const link of scene.next) {
      if (!story.scenes[link.to]) continue;
      const list = parents.get(link.to) ?? [];
      list.push({ sceneId: scene.id, linkId: link.id });
      parents.set(link.to, list);
    }
  }
  return parents;
}

function roleOf(focus: GraphFocus, id: SceneId): FocusRole {
  if (focus.selected.size === 0) return 'idle';
  if (focus.selected.has(id)) return 'self';
  if (focus.downstream.has(id)) return 'downstream';
  if (focus.upstream.has(id)) return 'upstream';
  return 'unrelated';
}

// ---------------------------------------------------------------------------
// Projection
// ---------------------------------------------------------------------------

export interface ProjectionOptions {
  /** Focus computed from the selection; `EMPTY_FOCUS` lights the whole graph. */
  focus?: GraphFocus;
  /** Scenes matching the search box. */
  matches?: Set<SceneId>;
  /** Scenes no run can reach, when the analysis is on. */
  dead?: Set<SceneId>;
  /** Links no run can follow, keyed like edge ids. */
  deadLinks?: Set<string>;
  /** Links the author has picked on the canvas, keyed like edge ids. */
  selectedLinks?: Set<string>;
  /**
   * Card sizes React Flow has measured, by scene id.
   *
   * React Flow hides any node whose size it does not know, and it reads that
   * size back from the node object it is handed. This projection builds fresh
   * objects every time, so without the measurements carried over here, a single
   * reprojection blanks the whole canvas — see `Editor`.
   */
  sizes?: Map<SceneId, { width: number; height: number }>;
}

export function toNodes(
  story: Story,
  issues: ValidationIssue[],
  selectedIds: readonly SceneId[],
  options: ProjectionOptions = {},
): SceneFlowNode[] {
  const focus = options.focus ?? EMPTY_FOCUS;
  const selected = new Set(selectedIds);

  return Object.values(story.scenes).map((scene) => ({
    id: scene.id,
    type: 'scene',
    position: scene.position,
    selected: selected.has(scene.id),
    measured: options.sizes?.get(scene.id),
    data: {
      scene,
      isStart: scene.id === story.startSceneId,
      issues: issues.filter((issue) => issue.sceneId === scene.id),
      awaitsChoice: scene.next.some((link) => story.scenes[link.to]?.kind === 'choice'),
      focus: roleOf(focus, scene.id),
      match: options.matches?.has(scene.id) ?? false,
      dead: options.dead?.has(scene.id) ?? false,
    },
  }));
}

// ---------------------------------------------------------------------------
// Edges
// ---------------------------------------------------------------------------

/** Side of a card each port sits on. */
const SIDE_OF: Record<string, Side> = {
  [PORT.in]: 'top',
  [PORT.out]: 'bottom',
  [PORT.inLeft]: 'left',
  [PORT.inRight]: 'right',
  [PORT.outLeft]: 'left',
  [PORT.outRight]: 'right',
};

/** Distance between two brackets walking around the same side of a card. */
const BRACKET_LANE = 22;

/** Distance between two corridors of the band separating two ranks. */
const CHANNEL_STEP = 20;

/** Room left between the last corridor and the cards on either side. */
const CHANNEL_MARGIN = 16;

/**
 * Corridors tried before giving up.
 *
 * A band only holds so many, and past its edge the offset is clamped — every
 * further corridor lands on the same line as the last. Rather than search for a
 * place that no longer exists, the link is drawn where it falls: a graph that
 * dense has bigger problems than two lines sharing a stretch.
 */
const MAX_CHANNELS = 24;

/** How far the two ends of a self-link are pulled apart, so it draws a bracket. */
const SELF_SPREAD = 15;

/** How far a falling link leans towards the side it is heading for. */
const LEAN = 9;

/** Stands in for the label position of a link that carries no label. */
const ORIGIN: Point = { x: 0, y: 0 };

/** A card, as something a link would rather not be drawn behind. */
interface Obstacle {
  id: SceneId;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

function obstaclesOf(
  story: Story,
  sizes?: Map<SceneId, { width: number; height: number }>,
): Obstacle[] {
  return Object.values(story.scenes).map((scene) => {
    const box = boxOf(scene, sizes);
    return {
      id: scene.id,
      left: box.x,
      right: box.x + box.width,
      top: box.y,
      bottom: box.y + box.height,
    };
  });
}

/**
 * True when a straight run would be drawn across a card.
 *
 * The two cards the link joins are left out: a link starts on the edge of its
 * source and ends on the edge of its target, and touching them is the whole
 * point rather than a fault.
 */
function behindACard(
  obstacles: Obstacle[],
  upright: boolean,
  at: number,
  from: number,
  to: number,
  own: readonly SceneId[],
): boolean {
  return obstacles.some((card) => {
    if (own.includes(card.id)) return false;
    const across = upright ? card.left < at && at < card.right : card.top < at && at < card.bottom;
    if (!across) return false;
    return upright ? card.top < to && from < card.bottom : card.left < to && from < card.right;
  });
}

/** Distance between two vertical stretches running down the same column. */
const COLUMN_STEP = 18;

/** Room kept between the outermost stretch and the edge of its card. */
const COLUMN_MARGIN = 18;

/**
 * A stretch of a link the reader cannot properly see.
 *
 * Two ways of disappearing, one confession. `shared`: another link is drawn on
 * the same pixels, so one of the two is invisible. `behind`: the run passes
 * under a card, and the wiring is drawn beneath the cards on purpose — which
 * makes a long link vanish and reappear with nothing to say it is the same one.
 */
export interface Obscured {
  path: string;
  /** Middle of the stretch, to bring it into view. */
  at: Point;
  why: 'shared' | 'behind';
}

/** What a link hands to `LinkEdge`: its drawing, already computed. */
export interface LinkEdgeData extends Record<string, unknown> {
  /**
   * The visible pieces of the link.
   *
   * One piece when nothing crosses it, several when it runs underneath other
   * links: the breaks are the crossings, and they are already cut out here.
   */
  pieces: string[];
  /**
   * Stretches this link shares with another, drawn on the same pixels.
   *
   * Normally empty: the corridors keep the links apart. What is left is where
   * they ran out of room, and it is marked rather than hidden — one line
   * carrying two is the one thing on this canvas that lies.
   *
   * Each carries where it is as well as how to draw it: on a graph thirty
   * thousand pixels tall, a mark nobody can reach is a mark nobody has seen.
   */
  obscured: Obscured[];
  /** The whole path, uncut — the invisible ribbon that catches the clicks. */
  hit: string;
  /** Middle of the link, where the label sits. */
  label: Point;
  /** True when the link is off the path of the selection. */
  dim: boolean;
}

export type LinkFlowEdge = Edge<LinkEdgeData, 'link'>;

/** A link with everything needed to draw it, before the crossings are known. */
interface Draft {
  edge: Omit<LinkFlowEdge, 'data'>;
  points: Point[];
  dim: boolean;
  /** The two cards it joins: the ones it is meant to touch. */
  own: readonly SceneId[];
}

/** The box React Flow will lay the card out in — measured if it already has. */
function boxOf(scene: Scene, sizes?: Map<SceneId, { width: number; height: number }>): Box {
  const measured = sizes?.get(scene.id);
  return {
    x: scene.position.x,
    y: scene.position.y,
    width: measured?.width ?? CARD.width,
    height: measured?.height ?? CARD.height,
  };
}

/**
 * One edge per link.
 *
 * The edge does not carry the choice text — a choice is a node of its own and
 * displays it itself. The edge only says what the node cannot: which way it
 * goes, that it is conditional, and what it changes. Its color is that of the
 * kind it targets, so the nature of a transition reads before reaching its end.
 *
 * Its thickness says how far it is from the selection: the links touching the
 * selected node are drawn heavier than the rest of its cone. On a long story
 * the cone covers almost the whole graph, and lighting it evenly says little
 * more than "everything is connected".
 *
 * The drawing itself is computed here rather than left to React Flow, in four
 * passes, each needing the one before: where every link leaves and lands, once
 * the links sharing a side are counted and spread; which corridor each one
 * takes between two ranks, so no two run along the same line; the polyline of
 * each; and finally which links cross, which no single edge could ever work out
 * on its own.
 */
export function toEdges(
  story: Story,
  issues: ValidationIssue[],
  options: ProjectionOptions = {},
): LinkFlowEdge[] {
  const focus = options.focus ?? EMPTY_FOCUS;
  const focusing = focus.selected.size > 0;
  // Two piles instead of one: see the return.
  const dimmed: Draft[] = [];
  const drafts: Draft[] = [];

  const wires = wiresOf(story, options.sizes);
  const obstacles = obstaclesOf(story, options.sizes).sort((one, other) => one.top - other.top);
  const slots = assignCorridors(wires, obstacles);

  for (const scene of Object.values(story.scenes)) {
    for (const link of scene.next) {
      const target = story.scenes[link.to];
      if (!target) continue; // dangling target: reported on the node
      const id = edgeId(scene.id, link.id);
      const wire = wires.get(id);
      if (!wire) continue;

      const broken = issues.some(
        (issue) =>
          issue.linkId === link.id && issue.sceneId === scene.id && issue.severity === 'error',
      );
      const conditional = Boolean(link.condition);
      const dead = options.deadLinks?.has(id) ?? false;

      const role: FocusRole = !focusing
        ? 'idle'
        : focus.downstreamEdges.has(id)
          ? 'downstream'
          : focus.upstreamEdges.has(id)
            ? 'upstream'
            : 'unrelated';
      const lit = role !== 'unrelated';

      const stroke = broken
        ? studio.danger
        : dead
          ? studio.muted
          : role === 'downstream'
            ? studio.selected
            : role === 'upstream'
              ? studio.edgeBack
              : kinds[target.kind].border;

      // Directly attached to the selection: the first step of the path, told
      // apart from the rest of the cone.
      const direct = focus.selected.has(scene.id) || focus.selected.has(link.to);

      const points = routeLink(wire.from, wire.to, detourOf(wire, slots.get(id) ?? 0));

      (lit ? drafts : dimmed).push({
        points,
        dim: !lit,
        own: wire.own,
        edge: {
          id,
          source: scene.id,
          target: link.to,
          sourceHandle: wire.sourceHandle,
          targetHandle: wire.targetHandle,
          /*
           * React Flow is controlled here: an edge is selected because the
           * projection says so, not because it was clicked. Without this the
           * click never took, and the delete key had nothing to remove — a link
           * could only be cut from the panel of the node that owns it.
           */
          selected: options.selectedLinks?.has(id) ?? false,
          label: edgeLabel(link),
          type: 'link',
          animated: conditional && lit && !dead,
          /*
           * Under the cards, never over them.
           *
           * React Flow puts a node at `z-index: 0` and gives every edge a layer
           * of its own, so any positive z-index lifts the whole wiring above the
           * text of the scenes — which is what turned a dense graph into a
           * scribble. Flat at zero, the edges fall back behind the cards, and
           * which edge covers which is settled by the drawing order instead.
           */
          zIndex: 0,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 16,
            height: 16,
            color: stroke,
          },
          style: {
            stroke,
            strokeWidth: direct ? 3.2 : role === 'downstream' || role === 'upstream' ? 2.4 : 2,
            strokeDasharray: conditional ? '5 6' : undefined,
            opacity: lit ? 1 : 0.16,
          },
        },
      });
    }
  }

  // Dimmed first: sharing one layer, the edges are drawn in the order they are
  // given, so the ones on the path of the selection come last and cover the
  // others rather than being buried under them.
  return draw([...dimmed, ...drafts], obstacles);
}

/**
 * Turns the drafts into edges, breaking each one where it passes underneath.
 *
 * The drawing order settles who is on top: an edge covers the ones handed over
 * before it. So a link is cut at its crossings with everything that comes after
 * it in the list, and never at the ones with what comes before — which already
 * broke for it. Every crossing is therefore marked exactly once, on the link
 * that runs under.
 */
function draw(drafts: Draft[], obstacles: Obstacle[]): LinkFlowEdge[] {
  const traces = drafts.map((draft) => traceOf(draft.points));

  const cuts: Point[][] = drafts.map(() => []);
  for (const meeting of allCrossings(traces)) {
    // `a` is the one handed over first, so it is the one drawn underneath.
    cuts[meeting.a]?.push(meeting.at);
  }

  /*
   * Where the corridors ran out, two links end up on one line and the lower of
   * the two is simply invisible. The mark therefore goes on the *upper* one —
   * the only one anybody can see, and so the only one able to say that it is
   * not alone there.
   */
  const obscured: Obscured[][] = drafts.map(() => []);
  for (const shared of allOverlaps(traces)) {
    obscured[shared.b]?.push(mark(shared.from, shared.to, 'shared'));
  }

  // And what the corridors could not steer clear of: the cards themselves.
  drafts.forEach((draft, index) => {
    for (const [from, to] of hiddenBehindCards(draft.points, obstacles, draft.own)) {
      obscured[index]?.push(mark(from, to, 'behind'));
    }
  });

  return drafts.map((draft, index) => {
    const whole = roundedPath(draft.points);
    const broken = cuts[index] ?? [];
    return {
      ...draft.edge,
      data: {
        // Most links are crossed by nothing, and theirs is the path in one
        // piece — no reason to draw it a second time to find that out.
        pieces: broken.length === 0 ? [whole] : breakAt(draft.points, broken).map(roundedPath),
        obscured: obscured[index] ?? [],
        hit: whole,
        label: draft.edge.label ? pointAt(draft.points, polylineLength(draft.points) / 2) : ORIGIN,
        dim: draft.dim,
      },
    };
  });
}

// ---------------------------------------------------------------------------
// Where every link leaves and lands
// ---------------------------------------------------------------------------

/** One link, seen as geometry: its two ends and the room it needs. */
interface Wire {
  sourceHandle: string;
  targetHandle: string;
  from: End;
  to: End;
  /** The two cards this link joins: the ones it is allowed to touch. */
  own: readonly SceneId[];
  /**
   * The straight run the link makes between its two turns, before any corridor
   * is assigned. `null` when it makes none — a link falling straight down.
   */
  corridor: Corridor | null;
}

/**
 * A stretch of line a link needs to itself.
 *
 * Whatever its shape, a link is drawn with one long run in the middle: the
 * horizontal jog of a link falling into the rank below, the vertical bar of a
 * bracket climbing back up or of a step across a rank. That run is where links
 * pile up on one another, and it is the only part with any freedom left — both
 * ends are nailed to their ports.
 */
interface Corridor {
  /** Which way the run goes: `y` for a horizontal run, `x` for a vertical one. */
  axis: 'x' | 'y';
  /** The two cards the link joins — the ones its run may touch. */
  own: readonly SceneId[];
  /** Where it would be drawn, left to itself. */
  at: number;
  /** The stretch it takes up along the other axis. */
  from: number;
  to: number;
  /** How far it may be moved before it lands on a card. */
  room: number;
  /** Distance between two neighbouring corridors. */
  step: number;
  /** `0` to move to either side; `±1` for a bracket, which only moves outwards. */
  way: -1 | 0 | 1;
}

/** How many links share each side of each card, and in which order. */
interface Fans {
  count: Map<string, number>;
  rank: Map<string, number>;
}

function fanKey(sceneId: SceneId, side: Side): string {
  return `${sceneId}|${side}`;
}

/**
 * Counts the departures and the arrivals on every side of every card.
 *
 * Done in a pass of its own because a link cannot know on its own how many
 * others leave the card with it — and that count is exactly what decides how
 * far it is moved aside.
 */
function countFans(story: Story): Fans {
  const count = new Map<string, number>();
  const rank = new Map<string, number>();

  for (const scene of Object.values(story.scenes)) {
    for (const link of scene.next) {
      const target = story.scenes[link.to];
      if (!target) continue;
      const route = routeOf(scene.position, target.position);
      const from = fanKey(scene.id, SIDE_OF[route.sourceHandle] as Side);
      const to = fanKey(link.to, SIDE_OF[route.targetHandle] as Side);
      const id = edgeId(scene.id, link.id);
      rank.set(`out:${id}`, count.get(from) ?? 0);
      count.set(from, (count.get(from) ?? 0) + 1);
      rank.set(`in:${id}`, count.get(to) ?? 0);
      count.set(to, (count.get(to) ?? 0) + 1);
    }
  }
  return { count, rank };
}

/** The two ends of every link, spread apart from those of its neighbours. */
function wiresOf(
  story: Story,
  sizes?: Map<SceneId, { width: number; height: number }>,
): Map<string, Wire> {
  const fans = countFans(story);
  const obstacles = obstaclesOf(story, sizes);
  obstacles.sort((one, other) => one.top - other.top);
  const wires = new Map<string, Wire>();

  for (const scene of Object.values(story.scenes)) {
    for (const link of scene.next) {
      const target = story.scenes[link.to];
      if (!target) continue;

      const id = edgeId(scene.id, link.id);
      const route = routeOf(scene.position, target.position);
      const sourceSide = SIDE_OF[route.sourceHandle] as Side;
      const targetSide = SIDE_OF[route.targetHandle] as Side;
      const sourceBox = boxOf(scene, sizes);
      const targetBox = boxOf(target, sizes);

      const lane = fans.rank.get(`out:${id}`) ?? 0;
      let sourceShift = fanShift(
        lane,
        fans.count.get(fanKey(scene.id, sourceSide)) ?? 1,
        sideLength(sourceBox, sourceSide),
      );
      let targetShift = fanShift(
        fans.rank.get(`in:${id}`) ?? 0,
        fans.count.get(fanKey(target.id, targetSide)) ?? 1,
        sideLength(targetBox, targetSide),
      );

      // A node pointing at itself leaves and comes back by the same side:
      // without pulling the two ends apart the bracket is drawn flat on itself.
      if (scene.id === target.id && Math.abs(sourceShift - targetShift) < 1) {
        sourceShift -= SELF_SPREAD;
        targetShift += SELF_SPREAD;
      }

      /*
       * A falling link leans towards the side it is heading for, at both ends.
       *
       * Two cards in the same column — which is what « Ranger » produces — put
       * the departure of one link and the arrival of another on the very same
       * vertical line, and the two are then drawn one over the other for the
       * length of the overlap. Leaning tells them apart, and turns what was a
       * shared stretch of line into a plain crossing, which can be marked.
       * A link falling straight down leans nowhere and stays straight.
       */
      if (sourceSide === 'bottom' && targetSide === 'top') {
        const travel =
          portPoint(targetBox, targetSide, targetShift).x -
          portPoint(sourceBox, sourceSide, sourceShift).x;
        const lean = Math.abs(travel) < 1 ? 0 : Math.sign(travel) * LEAN;
        sourceShift += lean;
        targetShift += lean;
      }

      const from: End = { box: sourceBox, side: sourceSide, shift: sourceShift };
      const to: End = { box: targetBox, side: targetSide, shift: targetShift };
      wires.set(id, {
        ...route,
        from,
        to,
        own: [scene.id, target.id],
        corridor: corridorOf(from, to, [scene.id, target.id]),
      });
    }
  }

  spreadColumns(wires, obstacles);
  for (const wire of wires.values()) wire.corridor = corridorOf(wire.from, wire.to, wire.own);
  return wires;
}

/**
 * Moves the ports of the falling links until no two descend along one line.
 *
 * The fan spreads the links sharing a card, and the lean tells a departure from
 * an arrival in the same column. Neither covers the case that costs the most:
 * two *different* cards standing in the same column, each pulling a long link
 * down to the same distant scene. They share no card, so the fan never hears
 * about them, and they travel the same way, so they lean the same way — and
 * then they are drawn one over the other for the whole height of the graph.
 *
 * Both ends of a falling link can slide along their card, so each vertical
 * stretch is placed the way the corridors are: taken from the top down, moved
 * aside by the smallest step that clears everything already placed. The stretch
 * never leaves its card, which is what keeps the link attached to the scene it
 * belongs to; where the card runs out of room, the two stay on top of one
 * another and `draw` marks the place rather than pretending otherwise.
 */
function spreadColumns(wires: Map<string, Wire>, obstacles: Obstacle[]): void {
  interface Stretch {
    x: number;
    top: number;
    bottom: number;
  }
  const placed: Stretch[] = [];

  const clashes = (x: number, top: number, bottom: number): boolean =>
    placed.some(
      (other) =>
        Math.abs(other.x - x) < COLUMN_STEP * 0.8 && other.top < bottom && top < other.bottom,
    );

  /** Slides one end of a link along its card until its stretch is clear. */
  const place = (end: End, own: readonly SceneId[], top: number, bottom: number): void => {
    const room = Math.max(0, end.box.width / 2 - COLUMN_MARGIN);
    const centre = end.box.x + end.box.width / 2;
    let nudge = 0;

    while (Math.abs(nudge) <= room) {
      const shift = clamp(end.shift + nudge, -room, room);
      const x = centre + shift;
      if (!clashes(x, top, bottom) && !behindACard(obstacles, true, x, top, bottom, own)) {
        end.shift = shift;
        break;
      }
      // Tried on one side, then the other, a step further out each time.
      nudge = nudge > 0 ? -nudge : -nudge + COLUMN_STEP;
    }
    placed.push({ x: centre + end.shift, top, bottom });
  };

  const falling = [...wires.values()].filter(
    (wire) => wire.from.side === 'bottom' && wire.to.side === 'top',
  );
  // Top to bottom, so a stretch is only ever weighed against the ones above it.
  falling.sort((a, b) => a.from.box.y - b.from.box.y);

  for (const wire of falling) {
    const own = wire.own;
    const start = portPoint(wire.from.box, 'bottom', wire.from.shift);
    const end = portPoint(wire.to.box, 'top', wire.to.shift);
    // The turn has not been placed yet; it sits at the halfway line, give or
    // take the corridor it will be given.
    const middle = (start.y + end.y) / 2;
    place(wire.from, own, Math.min(start.y, middle), Math.max(start.y, middle));
    place(wire.to, own, Math.min(middle, end.y), Math.max(middle, end.y));
  }
}

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}

/** The run a link makes between its two turns, if it makes one. */
function corridorOf(from: End, to: End, own: readonly SceneId[]): Corridor | null {
  const start = portPoint(from.box, from.side, from.shift);
  const end = portPoint(to.box, to.side, to.shift);

  // Falling into the rank below: the run is the horizontal jog, and it may
  // move up or down inside the band separating the two cards.
  if (from.side === 'bottom' && to.side === 'top') {
    // Two cards in the same column: the link is a straight line and crosses
    // nothing on its way. Giving it a corridor would bend it for nothing.
    if (Math.abs(start.x - end.x) < 1) return null;
    return {
      axis: 'y',
      own,
      at: (start.y + end.y) / 2,
      from: Math.min(start.x, end.x),
      to: Math.max(start.x, end.x),
      room: Math.max(0, Math.abs(end.y - start.y) / 2 - CHANNEL_MARGIN),
      step: CHANNEL_STEP,
      way: 0,
    };
  }

  if (from.side === 'top' || from.side === 'bottom' || to.side === 'top' || to.side === 'bottom') {
    return null;
  }

  const span = { from: Math.min(start.y, end.y), to: Math.max(start.y, end.y) };

  // Climbing back up: the run is the vertical bar of the bracket, and it can
  // only be pushed further away from the cards — never back over them.
  if (from.side === to.side) {
    return {
      axis: 'x',
      own,
      at: bracketLine(from, to),
      ...span,
      room: Number.POSITIVE_INFINITY,
      step: BRACKET_LANE,
      way: from.side === 'right' ? 1 : -1,
    };
  }

  // Stepping across a rank: the run is the vertical bar between the two cards.
  if (Math.abs(start.y - end.y) < 1) return null;
  return {
    axis: 'x',
    own,
    at: (start.x + end.x) / 2,
    ...span,
    room: Math.max(0, Math.abs(end.x - start.x) / 2 - CHANNEL_MARGIN),
    step: CHANNEL_STEP,
    way: 0,
  };
}

// ---------------------------------------------------------------------------
// Corridors
// ---------------------------------------------------------------------------

/**
 * Gives each link a run of its own, rather than the one everybody would take.
 *
 * Left alone, every link between the same two ranks turns at the same height —
 * the halfway line — so their horizontal runs are drawn one on top of another,
 * and every bracket climbing back up walks the same corridor beside the cards.
 * Two links that ought to make a plain X then share a stretch of line instead,
 * and neither the eye nor `crossings` can tell what happened: what is not a
 * crossing cannot be marked as one.
 *
 * So the room between the cards is cut into corridors, and two runs that
 * overlap are never put in the same one. Greedy, links taken in the order they
 * start: the first free corridor is taken, which is the usual answer to this
 * and needs no search. Horizontal and vertical runs are placed apart — they
 * cannot land on one another whatever corridor they are given.
 */
function assignCorridors(wires: Map<string, Wire>, obstacles: Obstacle[]): Map<string, number> {
  const runs = [...wires.entries()]
    .filter((entry): entry is [string, Wire & { corridor: Corridor }] => entry[1].corridor !== null)
    .sort((a, b) => a[1].corridor.from - b[1].corridor.from || a[0].localeCompare(b[0]));

  const slots = new Map<string, number>();
  let taken: { line: number; corridor: Corridor }[] = [];

  for (const [id, wire] of runs) {
    // Taken in the order they start, so a run that has already ended can never
    // clash with what follows: dropping it keeps the sweep from growing into a
    // comparison of every link with every other.
    taken = taken.filter((other) => other.corridor.to > wire.corridor.from);

    let slot = 0;
    // Compared on the line each run ends up on, not on the corridor number: a
    // link skipping several ranks has a band of its own, and its halfway line
    // can still fall right onto a short link's corridor.
    while (slot < MAX_CHANNELS && !clear(taken, obstacles, wire.corridor, slot)) {
      slot += 1;
    }
    slots.set(id, slot);
    taken.push({ line: lineAt(wire.corridor, slot), corridor: wire.corridor });
  }
  return slots;
}

function mark(from: Point, to: Point, why: Obscured['why']): Obscured {
  return {
    path: roundedPath([from, to]),
    at: { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 },
    why,
  };
}

/**
 * The parts of a link that run under a card.
 *
 * Every segment is axis-aligned, so this is a clip against a rectangle and
 * nothing more. Only the cards whose rows a segment actually reaches are
 * weighed: a link falling the height of the graph must not cost a pass over
 * every scene in it.
 */
function hiddenBehindCards(
  points: Point[],
  obstacles: Obstacle[],
  own: readonly SceneId[],
): [Point, Point][] {
  const hidden: [Point, Point][] = [];

  for (let index = 1; index < points.length; index += 1) {
    const a = points[index - 1] as Point;
    const b = points[index] as Point;
    const upright = Math.abs(a.x - b.x) < 0.5;
    const low = upright ? Math.min(a.y, b.y) : Math.min(a.x, b.x);
    const high = upright ? Math.max(a.y, b.y) : Math.max(a.x, b.x);
    const at = upright ? a.x : a.y;
    const top = upright ? low : at;
    const bottom = upright ? high : at;

    for (const card of obstacles) {
      // Laid out top to bottom: past the segment, the rest is past it too.
      if (card.top > bottom) break;
      if (card.bottom < top || own.includes(card.id)) continue;
      const across = upright
        ? card.left < at && at < card.right
        : card.top < at && at < card.bottom;
      if (!across) continue;

      const from = Math.max(low, upright ? card.top : card.left);
      const to = Math.min(high, upright ? card.bottom : card.right);
      if (to - from <= 1) continue;

      hidden.push(
        upright
          ? [
              { x: at, y: from },
              { x: at, y: to },
            ]
          : [
              { x: from, y: at },
              { x: to, y: at },
            ],
      );
    }
  }
  return hidden;
}

/**
 * True when a corridor is free of both the other links and the cards.
 *
 * A card is an obstacle like any other, and a cheaper one to avoid than to
 * apologise for: the links are drawn behind the cards, so a run passing under
 * one simply vanishes. Weighing them here costs a comparison and saves the
 * author from following a line that disappears.
 */
function clear(
  taken: { line: number; corridor: Corridor }[],
  obstacles: Obstacle[],
  corridor: Corridor,
  slot: number,
): boolean {
  const line = lineAt(corridor, slot);
  if (!isFree(taken, corridor, line)) return false;
  return !behindACard(
    obstacles,
    corridor.axis === 'x',
    line,
    corridor.from,
    corridor.to,
    corridor.own,
  );
}

/** True when no run already placed shares that line over the same stretch. */
function isFree(
  taken: { line: number; corridor: Corridor }[],
  corridor: Corridor,
  line: number,
): boolean {
  return !taken.some(
    (other) =>
      other.corridor.axis === corridor.axis &&
      Math.abs(other.line - line) < corridor.step * 0.8 &&
      other.corridor.from < corridor.to &&
      corridor.from < other.corridor.to,
  );
}

/**
 * The room a link is told to keep, in the shape `routeLink` expects.
 *
 * A bracket is pushed outwards, which is a distance; anything else is moved off
 * its halfway line, which is a direction as well.
 */
function detourOf(wire: Wire, slot: number): Detour {
  if (!wire.corridor) return {};
  const offset = offsetAt(wire.corridor, slot);
  return wire.corridor.way === 0 ? { shift: offset } : { lane: offset };
}

/** Where a run is drawn, in a given corridor. */
function lineAt(corridor: Corridor, slot: number): number {
  const offset = offsetAt(corridor, slot);
  return corridor.at + (corridor.way === 0 ? offset : corridor.way * offset);
}

/**
 * How far from its natural line a corridor sits.
 *
 * A run free to move either way alternates, so a bundle of links stays centred
 * rather than drifting to one side, and the offset is capped by the room there
 * actually is: a corridor may never be pushed onto a card. A bracket has no
 * such cap — outside the cards there is nothing to run into — but it only ever
 * moves away from them.
 */
function offsetAt(corridor: Corridor, slot: number): number {
  if (slot === 0) return 0;
  if (corridor.way !== 0) return slot * corridor.step;
  const step = Math.ceil(slot / 2) * corridor.step;
  const offset = slot % 2 === 1 ? -step : step;
  return Math.max(-corridor.room, Math.min(corridor.room, offset));
}

/** What an edge has worth saying — nothing, most of the time. */
function edgeLabel(link: Link): string | undefined {
  const marks: string[] = [];
  if (link.condition) marks.push('◇ si…');
  if (link.effects?.length) marks.push(`⚙ ${link.effects.length}`);
  return marks.length > 0 ? marks.join(' ') : undefined;
}

/**
 * Places a new node below the lowest one, rather than at the origin where it
 * would risk overlapping an existing node.
 */
export function nextScenePosition(story: Story): { x: number; y: number } {
  const positions = Object.values(story.scenes).map((scene) => scene.position);
  if (positions.length === 0) return { x: 320, y: 40 };
  const lowest = positions.reduce((a, b) => (b.y > a.y ? b : a));
  return { x: lowest.x, y: lowest.y + DEFAULT_LAYOUT.rowGap };
}

/**
 * Places a child node below its parent, shifted right by the number of
 * siblings — creating three choices in a row must not stack them.
 *
 * The spacing is the one « Ranger » uses, and for the same reason: a story
 * written card by card must not look tighter than the same story tidied up, or
 * the author is made to press the button just to get their air back.
 */
export function childPosition(parent: Scene, siblings: number): { x: number; y: number } {
  return {
    x: parent.position.x + (siblings - 1) * DEFAULT_LAYOUT.columnGap,
    y: parent.position.y + DEFAULT_LAYOUT.rowGap,
  };
}
