/**
 * `@embranche/story-engine` — the Embranche story engine.
 *
 * Pure TypeScript: no React, no DOM, no disk or network access. It exposes a
 * state, transitions and events; wiring a UI onto it takes a few lines, and
 * swapping that UI does not affect this package.
 */

export { StoryEngine } from './engine.js';
export type {
  EngineEvents,
  EngineSnapshot,
  ResolvedChoice,
  ResolvedScene,
  StoryEngineOptions,
} from './engine.js';

export { Emitter } from './emitter.js';
export type { Listener, Unsubscribe } from './emitter.js';

export { EngineError } from './errors.js';
export type { EngineErrorCode } from './errors.js';

export { contextFromState, evaluateCondition, isSatisfied } from './conditions.js';
export type { ConditionContext } from './conditions.js';

export { applyEffects, applyEffectsToSlice } from './effects.js';
export type { MutableSlice } from './effects.js';

export { DEFAULT_MAX_STATES, exploreReachable, findDeadScenes, linkKey } from './reachability.js';
export type { ReachabilityOptions, ReachabilityReport } from './reachability.js';

export {
  createInitialState,
  deserializeState,
  inspectState,
  serializeState,
  systemClock,
} from './state.js';
export type { Clock } from './state.js';
