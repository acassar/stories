/**
 * Application des effets.
 *
 * Tout est purement fonctionnel : `applyEffects` ne modifie jamais son entree
 * et renvoie un nouvel etat. C'est ce qui permet au moteur d'exposer une
 * reference stable par version d'etat, et donc a `useSyncExternalStore` de
 * savoir exactement quand re-rendre.
 */

import type {
  Effect,
  GameState,
  ItemId,
  VariableName,
  VariableValue,
} from '@embranche/story-format';

/** Partie de l'etat qu'un effet peut toucher. */
export interface MutableSlice {
  variables: Record<VariableName, VariableValue>;
  inventory: Record<ItemId, number>;
}

function asNumber(value: VariableValue | undefined): number {
  return typeof value === 'number' ? value : 0;
}

/** Applique un effet a une copie de travail. */
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
      // Une variable absente est consideree comme fausse : la basculer la pose a `true`.
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
      // Les quantites ne descendent jamais sous zero, et un objet epuise
      // disparait de l'inventaire plutot que d'y rester a 0.
      if (remaining > 0) slice.inventory[effect.item] = remaining;
      else delete slice.inventory[effect.item];
      return;
    }
  }
}

/**
 * Applique une liste d'effets dans l'ordre et renvoie un nouvel etat.
 * L'ordre compte : `inc` puis `set` ne donne pas le meme resultat qu'`inversement`.
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
