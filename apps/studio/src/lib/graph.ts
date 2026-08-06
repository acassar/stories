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

/**
 * One edge per link.
 *
 * The edge does not carry the choice text — a choice is a node of its own and
 * displays it itself. The edge only says what the node cannot: which way it
 * goes, that it is conditional, and what it changes. Its color is that of the
 * kind it targets, so the nature of a transition reads before reaching its end.
 */
export function toEdges(
  story: Story,
  issues: ValidationIssue[],
  options: ProjectionOptions = {},
): Edge[] {
  const focus = options.focus ?? EMPTY_FOCUS;
  const focusing = focus.selected.size > 0;
  const edges: Edge[] = [];

  for (const scene of Object.values(story.scenes)) {
    for (const link of scene.next) {
      const target = story.scenes[link.to];
      if (!target) continue; // dangling target: reported on the node
      const id = edgeId(scene.id, link.id);
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

      edges.push({
        id,
        source: scene.id,
        target: link.to,
        label: edgeLabel(link),
        type: 'smoothstep',
        animated: conditional && lit && !dead,
        // A lit edge is drawn over the dimmed ones, whatever the node order.
        zIndex: lit && focusing ? 2 : 1,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 16,
          height: 16,
          color: stroke,
        },
        style: {
          stroke,
          strokeWidth: role === 'downstream' || role === 'upstream' ? 2.6 : 2,
          strokeDasharray: conditional ? '5 6' : undefined,
          opacity: lit ? 1 : 0.16,
        },
        labelStyle: {
          fontFamily: 'var(--emb-font-ui)',
          fontSize: 11,
          fill: studio.sub,
          opacity: lit ? 1 : 0.2,
        },
        labelBgStyle: { fill: studio.surface, fillOpacity: lit ? 0.92 : 0.2 },
        labelBgPadding: [6, 3],
        labelBgBorderRadius: 6,
      });
    }
  }
  return edges;
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
  return { x: lowest.x, y: lowest.y + 180 };
}

/**
 * Places a child node below its parent, shifted right by the number of
 * siblings — creating three choices in a row must not stack them.
 */
export function childPosition(parent: Scene, siblings: number): { x: number; y: number } {
  return { x: parent.position.x + (siblings - 1) * 130, y: parent.position.y + 170 };
}
