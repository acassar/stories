/**
 * The state a story was in, earlier in the run.
 *
 * A save does not keep the variables step by step — and it does not need to.
 * It keeps the starting values and the ordered list of links taken, and every
 * link carries its own effects. That is a game record, in the sense a chess
 * score is one: the board after the twelfth move is not written down anywhere,
 * it is what replaying the first twelve moves gives you.
 *
 * Which is what this module does, so that a message sent three choices ago can
 * be displayed with the value it was sent with rather than with today's.
 *
 * It rests on one property, and it is worth naming: replaying the same moves
 * yields the same result. No effect draws a random number — and the day one
 * does, its seed will live in the state, which is exactly why that backlog item
 * says *deterministic*.
 */

import type { GameState, Story, VariableName, VariableValue } from '@embranche/story-format';

import { applyEffectsToSlice } from './effects.js';
import type { MutableSlice } from './effects.js';

/**
 * One snapshot per step already walked through, in order: entry `i` holds the
 * variables as they stood while the scene of `state.history[i]` was on screen —
 * that is, before the link recorded there was taken.
 *
 * The variables of the scene being played are not in here: they are the ones
 * the state already carries.
 *
 * A link the story no longer holds — a document edited under a run in progress
 * — applies no effect rather than interrupting the walk: a stale save is worth
 * more read approximately than not read at all.
 */
export function variablesAlong(
  story: Story,
  state: GameState,
): Record<VariableName, VariableValue>[] {
  const snapshots: Record<VariableName, VariableValue>[] = [];
  let slice: MutableSlice = {
    variables: { ...(story.variables ?? {}) },
    inventory: { ...(story.inventory ?? {}) },
  };

  for (const entry of state.history) {
    // Pushed before the effects of the outgoing link: the scene was displayed
    // before it was left. `applyEffectsToSlice` always returns a fresh object,
    // so what has been pushed is never written to afterwards.
    snapshots.push(slice.variables);
    const link = story.scenes[entry.sceneId]?.next.find((item) => item.id === entry.linkId);
    slice = applyEffectsToSlice(slice, link?.effects);
  }

  return snapshots;
}
