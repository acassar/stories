/**
 * Automatic graph layout.
 *
 * A story imported from elsewhere — or migrated from format 1, where positions
 * did not exist — arrives as a pile of nodes at the origin. This puts it back
 * into readable shape: reading runs top to bottom, one rank per step of the
 * story, siblings side by side.
 *
 * It is a layered layout (rank, then lanes, then order, then coordinates),
 * written here rather than pulled from `dagre` or `elk` for two reasons: a
 * story graph is small and almost a tree, so the general machinery buys
 * nothing; and the studio would gain a dependency for a hundred lines it can
 * own and test.
 *
 * The layout is deterministic: laying out twice yields the same positions.
 */

import type { SceneId, Story } from '@embranche/story-format';

export interface LayoutOptions {
  /** Horizontal distance between two siblings. */
  columnGap?: number;
  /** Vertical distance between two ranks. */
  rowGap?: number;
  /** Passes of barycenter ordering. More passes, fewer crossings. */
  sweeps?: number;
}

/**
 * The distances the graph is laid out with.
 *
 * A card is 190 wide and about a hundred tall, so these gaps leave more than a
 * card of air on each side. That air is not decoration: it is where the links
 * are drawn. Packed tighter — as the first version was — several links share
 * the same few pixels between two ranks, and a graph one can no longer read is
 * not a graph that is too big, it is one that is too small.
 */
export const DEFAULT_LAYOUT: Required<LayoutOptions> = {
  columnGap: 380,
  rowGap: 260,
  sweeps: 4,
};

/**
 * Prefix of the virtual nodes standing for a long link.
 *
 * Never a scene id, and provably so: the format admits `[A-Za-z0-9_-]` alone,
 * so a `#` collides with nothing an author is able to write. Spelled out rather
 * than hidden in an invisible character — this line used to hold a NUL byte,
 * which made the same promise while telling the reader nothing, and made git
 * treat the whole file as binary.
 */
const LANE = '#lane';

function isLane(id: SceneId): boolean {
  return id.startsWith(LANE);
}

export type Positions = Record<SceneId, { x: number; y: number }>;

/** Returns the story with every node repositioned. Pure: the input is untouched. */
export function arrangeStory(story: Story, options: LayoutOptions = {}): Story {
  const positions = layoutStory(story, options);
  const scenes: Story['scenes'] = {};
  for (const [id, scene] of Object.entries(story.scenes)) {
    const position = positions[id];
    scenes[id] = position ? { ...scene, position } : scene;
  }
  return { ...story, scenes };
}

export function layoutStory(story: Story, options: LayoutOptions = {}): Positions {
  const settings = { ...DEFAULT_LAYOUT, ...options };
  const ids = Object.keys(story.scenes);
  if (ids.length === 0) return {};

  const edges = forwardEdges(story);
  const ranks = rankNodes(story, edges);
  const layers = groupByRank(ids, ranks);
  const routed = openLanes(layers, edges, ranks);

  orderLayers(layers, routed, settings.sweeps);

  // The lanes have said what they had to say about the order; the coordinates
  // are those of the cards alone, laid out along the links of the story itself.
  const cards = layers.map((layer) => layer.filter((id) => !isLane(id)));
  return coordinates(cards, edges, settings);
}

// ---------------------------------------------------------------------------
// 1. Ranking
// ---------------------------------------------------------------------------

interface Edges {
  out: Map<SceneId, SceneId[]>;
  in: Map<SceneId, SceneId[]>;
}

/**
 * Adjacency without the back edges.
 *
 * A story loops — a choice that sends you back to the crossroads is normal
 * writing. Layering needs a DAG, so edges closing a cycle are set aside: they
 * are still drawn on the canvas, they simply do not get a say in what sits
 * above what.
 */
function forwardEdges(story: Story): Edges {
  const out = new Map<SceneId, SceneId[]>();
  const incoming = new Map<SceneId, SceneId[]>();
  for (const id of Object.keys(story.scenes)) {
    out.set(id, []);
    incoming.set(id, []);
  }

  const state = new Map<SceneId, 'open' | 'done'>();
  const walk = (id: SceneId): void => {
    state.set(id, 'open');
    for (const link of story.scenes[id]?.next ?? []) {
      const target = link.to;
      if (!story.scenes[target] || target === id) continue;
      if (state.get(target) === 'open') continue; // back edge: ignored for ranking
      if (!out.get(id)?.includes(target)) {
        out.get(id)?.push(target);
        incoming.get(target)?.push(id);
      }
      if (!state.has(target)) walk(target);
    }
    state.set(id, 'done');
  };

  // Start from the entry point so the reading order drives the layout, then
  // pick up whatever the story left disconnected.
  for (const id of rootsFirst(story)) {
    if (!state.has(id)) walk(id);
  }
  return { out, in: incoming };
}

/** The start scene, then nodes nothing points at, then the rest — stable order. */
function rootsFirst(story: Story): SceneId[] {
  const targeted = new Set<SceneId>();
  for (const scene of Object.values(story.scenes)) {
    for (const link of scene.next) {
      if (link.to !== scene.id) targeted.add(link.to);
    }
  }
  const ids = Object.keys(story.scenes);
  const orphanRoots = ids.filter((id) => id !== story.startSceneId && !targeted.has(id));
  const rest = ids.filter((id) => id !== story.startSceneId && targeted.has(id));
  return [
    ...(story.scenes[story.startSceneId] ? [story.startSceneId] : []),
    ...orphanRoots,
    ...rest,
  ];
}

/**
 * Longest-path ranking: a node sits one rank below its lowest parent, so no
 * forward edge ever points upward.
 */
function rankNodes(story: Story, edges: Edges): Map<SceneId, number> {
  const ranks = new Map<SceneId, number>();
  const resolving = new Set<SceneId>();

  const rankOf = (id: SceneId): number => {
    const known = ranks.get(id);
    if (known !== undefined) return known;
    if (resolving.has(id)) return 0; // defensive: forward edges hold no cycle
    resolving.add(id);

    const parents = edges.in.get(id) ?? [];
    const rank = parents.length === 0 ? 0 : Math.max(...parents.map(rankOf)) + 1;

    resolving.delete(id);
    ranks.set(id, rank);
    return rank;
  };

  for (const id of Object.keys(story.scenes)) rankOf(id);
  return ranks;
}

function groupByRank(ids: SceneId[], ranks: Map<SceneId, number>): SceneId[][] {
  const depth = Math.max(0, ...ids.map((id) => ranks.get(id) ?? 0));
  const layers: SceneId[][] = Array.from({ length: depth + 1 }, () => []);
  for (const id of ids) layers[ranks.get(id) ?? 0]?.push(id);
  return layers;
}

// ---------------------------------------------------------------------------
// 2. Lanes for the long links
// ---------------------------------------------------------------------------

/**
 * Gives a link that skips ranks a say on every rank it crosses.
 *
 * The merge back to a crossroads, the shortcut to an ending: those links jump
 * over several ranks, and the ordering never hears about them — it only looks
 * at the rank above and the rank below. So a long link is cut into one virtual
 * node per crossed rank. Those take part in the ordering like any other node,
 * pulling both ends of the link into the same column, then are dropped before
 * the coordinates are computed.
 *
 * Dropped, not placed: reserving a real corridor for them was tried and made
 * the graph both wider and more tangled — every lane pushes its whole rank
 * rightwards, and the two ends drift apart faster than the lane straightens
 * them. On the long sample story, ordering alone removes a fifth of the links
 * drawn over a card; reserving corridors on top of it added some back.
 */
function openLanes(layers: SceneId[][], edges: Edges, ranks: Map<SceneId, number>): Edges {
  const out = new Map<SceneId, SceneId[]>();
  const incoming = new Map<SceneId, SceneId[]>();

  const declare = (id: SceneId): void => {
    if (!out.has(id)) out.set(id, []);
    if (!incoming.has(id)) incoming.set(id, []);
  };
  const connect = (from: SceneId, to: SceneId): void => {
    declare(from);
    declare(to);
    out.get(from)?.push(to);
    incoming.get(to)?.push(from);
  };

  for (const id of edges.out.keys()) declare(id);

  let serial = 0;
  for (const [from, targets] of edges.out) {
    for (const to of targets) {
      const first = (ranks.get(from) ?? 0) + 1;
      const last = ranks.get(to) ?? 0;
      let previous = from;
      for (let rank = first; rank < last; rank += 1) {
        const lane = `${LANE}-${(serial += 1)}`;
        layers[rank]?.push(lane);
        connect(previous, lane);
        previous = lane;
      }
      connect(previous, to);
    }
  }
  return { out, in: incoming };
}

// ---------------------------------------------------------------------------
// 3. Ordering within a rank
// ---------------------------------------------------------------------------

/**
 * Barycenter sweeps: a node drifts towards the average position of what it is
 * connected to on the neighbouring rank, and the rank is re-sorted. Alternating
 * downward and upward passes is the classic way to untangle crossings without
 * solving anything exactly.
 */
function orderLayers(layers: SceneId[][], edges: Edges, sweeps: number): void {
  for (let pass = 0; pass < sweeps; pass += 1) {
    const downward = pass % 2 === 0;
    const range = downward
      ? layers.map((_, index) => index).slice(1)
      : layers
          .map((_, index) => index)
          .slice(0, -1)
          .reverse();

    for (const index of range) {
      const neighbours = downward ? edges.in : edges.out;
      const reference = indexMap(layers[downward ? index - 1 : index + 1] ?? []);
      const layer = layers[index];
      if (!layer) continue;

      const before = indexMap(layer);
      layers[index] = [...layer].sort((a, b) => {
        const weightA = barycenter(neighbours.get(a) ?? [], reference, before.get(a) ?? 0);
        const weightB = barycenter(neighbours.get(b) ?? [], reference, before.get(b) ?? 0);
        // Ties keep their previous order: the layout stays stable.
        return weightA - weightB || (before.get(a) ?? 0) - (before.get(b) ?? 0);
      });
    }
  }
}

function indexMap(ids: SceneId[]): Map<SceneId, number> {
  return new Map(ids.map((id, index) => [id, index]));
}

/** Average position of the neighbours; a node without any keeps its own. */
function barycenter(
  neighbours: SceneId[],
  reference: Map<SceneId, number>,
  fallback: number,
): number {
  const known = neighbours
    .map((id) => reference.get(id))
    .filter((value): value is number => value !== undefined);
  if (known.length === 0) return fallback;
  return known.reduce((sum, value) => sum + value, 0) / known.length;
}

// ---------------------------------------------------------------------------
// 4. Coordinates
// ---------------------------------------------------------------------------

/**
 * Slots first, then two priority passes that pull each node towards the middle
 * of what it is attached to above and below — a parent ends up centered over
 * its children rather than aligned with the first of them. Overlaps are then
 * pushed apart in order, so the pass can never make two nodes collide.
 */
function coordinates(
  layers: SceneId[][],
  edges: Edges,
  settings: Required<LayoutOptions>,
): Positions {
  const x = new Map<SceneId, number>();
  for (const layer of layers) {
    layer.forEach((id, index) => x.set(id, index * settings.columnGap));
  }

  for (let pass = 0; pass < 2; pass += 1) {
    for (const layer of layers) {
      for (const id of layer) {
        const anchors = [...(edges.in.get(id) ?? []), ...(edges.out.get(id) ?? [])]
          .map((neighbour) => x.get(neighbour))
          .filter((value): value is number => value !== undefined);
        if (anchors.length > 0) {
          x.set(id, anchors.reduce((sum, value) => sum + value, 0) / anchors.length);
        }
      }
      separate(layer, x, settings.columnGap);
    }
  }

  const left = Math.min(...[...x.values()]);
  const positions: Positions = {};
  layers.forEach((layer, rank) => {
    for (const id of layer) {
      positions[id] = {
        x: Math.round((x.get(id) ?? 0) - left),
        y: rank * settings.rowGap,
      };
    }
  });
  return positions;
}

/** Enforces a minimum gap between consecutive nodes of a rank, left to right. */
function separate(layer: SceneId[], x: Map<SceneId, number>, gap: number): void {
  for (let index = 1; index < layer.length; index += 1) {
    const previous = x.get(layer[index - 1] as SceneId) ?? 0;
    const current = x.get(layer[index] as SceneId) ?? 0;
    if (current < previous + gap) x.set(layer[index] as SceneId, previous + gap);
  }
}
