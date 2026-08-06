/**
 * Effect application.
 *
 * Everything is purely functional: `applyEffects` never modifies its input and
 * returns a new state. That is what lets the engine expose one stable reference
 * per state version, and therefore lets `useSyncExternalStore` know exactly
 * when to re-render.
 */

import type {
  Effect,
  GameState,
  ItemId,
  VariableName,
  VariableValue,
} from '@embranche/story-format';

/** The part of the state an effect can touch. */
export interface MutableSlice {
  variables: Record<VariableName, VariableValue>;
  inventory: Record<ItemId, number>;
}

function asNumber(value: VariableValue | undefined): number {
  return typeof value === 'number' ? value : 0;
}

/** Applies one effect to a working copy. */
function applyEffect(slice: MutableSlice, effect: Effect): void {
  switch (effect.op) {
    case 'set':
      slice.variables[effect.variable] = effect.value;
      return;

    case 'inc':
      slice.variables[effect.variable] = asNumber(slice.variables[effect.variable]) + effect.value;
      return;

    case 'dec':
      slice.variables[effect.variable] = asNumber(slice.variables[effect.variable]) - effect.value;
      return;

    case 'toggle': {
      const current = slice.variables[effect.variable];
      // A missing variable counts as false: toggling it sets it to `true`.
      slice.variables[effect.variable] = current === undefined ? true : !current;
      return;
    }

    case 'unset':
      delete slice.variables[effect.variable];
      return;

    case 'addItem':
      slice.inventory[effect.item] = (slice.inventory[effect.item] ?? 0) + (effect.quantity ?? 1);
      return;

    case 'removeItem': {
      const remaining = (slice.inventory[effect.item] ?? 0) - (effect.quantity ?? 1);
      // Quantities never go below zero, and an exhausted item disappears from
      // the inventory rather than lingering at 0.
      if (remaining > 0) slice.inventory[effect.item] = remaining;
      else delete slice.inventory[effect.item];
      return;
    }
  }
}

/**
 * Applies a list of effects in order and returns a new state. Order matters:
 * `inc` then `set` does not yield the same result as `set` then `inc`.
 */
export function applyEffects(state: GameState, effects: readonly Effect[] | undefined): GameState {
  if (!effects || effects.length === 0) return state;

  const slice: MutableSlice = {
    variables: { ...state.variables },
    inventory: { ...state.inventory },
  };
  for (const effect of effects) applyEffect(slice, effect);

  return { ...state, variables: slice.variables, inventory: slice.inventory };
}
