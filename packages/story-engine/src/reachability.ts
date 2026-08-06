/**
 * Which scenes a player can actually reach — conditions included.
 *
 * `findUnreachableScenes` in `story-format` walks the graph and ignores
 * conditions: it answers "is there an arrow leading here". This module answers
 * the harder question: "is there a *run* leading here". A choice conditioned on
 * a variable no effect ever sets is an arrow that is never followed, and the
 * scene behind it is an orphan the graph alone cannot reveal.
 *
 * The exploration replays the exact semantics of `StoryEngine`: it follows every
 * satisfiable link out of a choice node, but only the *first* satisfiable link
 * out of a chaining node — that is what the engine does, and reporting anything
 * else would lie about the reading.
 *
 * It is a state-space search, so it is bounded. Beyond `maxStates` the report
 * comes back with `exhaustive: false`, and the studio says so instead of
 * presenting a partial answer as a verdict.
 */

import { awaitsChoice, scenesTestedByConditions } from '@embranche/story-format';
import type {
  Effect,
  ItemId,
  SceneId,
  Story,
  VariableName,
  VariableValue,
} from '@embranche/story-format';

import { evaluateCondition } from './conditions.js';
import type { ConditionContext } from './conditions.js';
import { applyEffectsToSlice } from './effects.js';

export interface ReachabilityOptions {
  /**
   * Ceiling on the number of distinct states visited. The default is large
   * enough for the stories the studio produces and small enough to stay
   * instant while typing.
   */
  maxStates?: number;
}

export interface ReachabilityReport {
  /** Scenes at least one run walks through. Always contains the start scene. */
  scenes: Set<SceneId>;
  /** Links at least one run follows, keyed `sceneId:linkId`. */
  links: Set<string>;
  /** False when the search hit its budget: the answer is a lower bound. */
  exhaustive: boolean;
  statesExplored: number;
}

export const DEFAULT_MAX_STATES = 20000;

/** Key of a link in the report — same shape as the studio edge id. */
export function linkKey(sceneId: SceneId, linkId: string): string {
  return `${sceneId}:${linkId}`;
}

interface Walk {
  sceneId: SceneId;
  variables: Record<VariableName, VariableValue>;
  inventory: Record<ItemId, number>;
  /** Only the scenes some condition actually tests — see `trackedScenes`. */
  visited: Set<SceneId>;
}

export function exploreReachable(
  story: Story,
  options: ReachabilityOptions = {},
): ReachabilityReport {
  const budget = options.maxStates ?? DEFAULT_MAX_STATES;
  const report: ReachabilityReport = {
    scenes: new Set<SceneId>(),
    links: new Set<string>(),
    exhaustive: true,
    statesExplored: 0,
  };
  if (!story.scenes[story.startSceneId]) return report;

  /*
   * Carrying the full visit history in the state key would make the search
   * explode combinatorially. Only the scenes a `visited` / `notVisited`
   * condition mentions can ever change an outcome, so only those are tracked —
   * the answer stays exact, the state space stays small.
   */
  const tracked = scenesTestedByConditions(story);

  const start: Walk = {
    sceneId: story.startSceneId,
    variables: { ...(story.variables ?? {}) },
    inventory: { ...(story.inventory ?? {}) },
    visited: tracked.has(story.startSceneId) ? new Set([story.startSceneId]) : new Set(),
  };

  const seen = new Set<string>([keyOf(start)]);
  const queue: Walk[] = [start];
  report.scenes.add(story.startSceneId);

  while (queue.length > 0) {
    const walk = queue.shift() as Walk;
    report.statesExplored += 1;

    const scene = story.scenes[walk.sceneId];
    if (!scene || scene.ending) continue;

    const context: ConditionContext = {
      variables: walk.variables,
      inventory: walk.inventory,
      visited: [...walk.visited],
    };

    // The rule of the format: links to choice nodes are all offered, chaining
    // links are tried in order and the first passable one wins.
    const passable = scene.next.filter(
      (link) =>
        story.scenes[link.to] &&
        (link.condition === undefined || evaluateCondition(link.condition, context)),
    );
    const taken = awaitsChoice(story, scene) ? passable : passable.slice(0, 1);

    for (const link of taken) {
      report.scenes.add(link.to);
      report.links.add(linkKey(scene.id, link.id));

      const next = advanceWalk(walk, link.to, link.effects, tracked);
      const key = keyOf(next);
      if (seen.has(key)) continue;
      if (seen.size >= budget) {
        report.exhaustive = false;
        return report;
      }
      seen.add(key);
      queue.push(next);
    }
  }

  return report;
}

/** Applies the effects of a link and moves to its target. */
function advanceWalk(
  walk: Walk,
  to: SceneId,
  effects: readonly Effect[] | undefined,
  tracked: Set<SceneId>,
): Walk {
  const slice = applyEffectsToSlice(walk, effects);
  const visited =
    tracked.has(to) && !walk.visited.has(to) ? new Set(walk.visited).add(to) : walk.visited;
  return { sceneId: to, variables: slice.variables, inventory: slice.inventory, visited };
}

/**
 * Canonical key of a state. Sorting the entries matters: two states holding the
 * same values written in a different order are the same state.
 */
function keyOf(walk: Walk): string {
  return [
    walk.sceneId,
    stringifySorted(walk.variables),
    stringifySorted(walk.inventory),
    [...walk.visited].sort().join(','),
  ].join('|');
}

function stringifySorted(record: Record<string, VariableValue | number>): string {
  return Object.keys(record)
    .sort()
    .map((key) => `${key}=${String(record[key])}`)
    .join(',');
}

/** Scenes the graph declares but no run ever reaches. */
export function findDeadScenes(story: Story, options?: ReachabilityOptions): SceneId[] {
  const report = exploreReachable(story, options);
  if (!report.exhaustive) return [];
  return Object.keys(story.scenes).filter((id) => !report.scenes.has(id));
}
