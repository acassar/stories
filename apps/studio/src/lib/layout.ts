/**
 * Automatic graph layout.
 *
 * A story imported from elsewhere — or migrated from format 1, where positions
 * did not exist — arrives as a pile of nodes at the origin. This puts it back
 * into readable shape: reading runs top to bottom, one rank per step of the
 * story, siblings side by side.
 *
 * It is a layered layout (rank, then order, then coordinates), written here
 * rather than pulled from `dagre` or `elk` for two reasons: a story graph is
 * small and almost a tree, so the general machinery buys nothing; and the
 * studio would gain a dependency for a hundred lines it can own and test.
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

export const DEFAULT_LAYOUT: Required<LayoutOptions> = {
  columnGap: 230,
  rowGap: 165,
  sweeps: 4,
};

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

  orderLayers(layers, edges, settings.sweeps);

  return coordinates(layers, edges, settings);
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
// 2. Ordering within a rank
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
// 3. Coordinates
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
