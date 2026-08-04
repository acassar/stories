/**
 * `@embranche/story-engine` — le moteur d'histoires Embranche.
 *
 * TypeScript pur : ni React, ni DOM, ni acces disque ou reseau. Il expose un
 * etat, des transitions et des evenements ; brancher une UI dessus est l'affaire
 * de quelques lignes, et en changer n'affecte pas ce paquet.
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

export { applyEffects } from './effects.js';

export {
  createInitialState,
  deserializeState,
  inspectState,
  serializeState,
  systemClock,
} from './state.js';
export type { Clock } from './state.js';
