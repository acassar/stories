/**
 * Evaluation des conditions.
 *
 * Le vocabulaire est ferme et les conditions sont des donnees : il n'y a ni
 * `eval`, ni `new Function`, ni interpolation de chaine. Un fichier d'histoire
 * hostile ne peut rien executer — au pire, il decrit une condition fausse.
 */

import type { Condition, GameState, VariableValue } from '@embranche/story-format';

/** Vue en lecture seule de l'etat, suffisante pour evaluer une condition. */
export interface ConditionContext {
  variables: Readonly<Record<string, VariableValue>>;
  inventory: Readonly<Record<string, number>>;
  visited: readonly string[];
}

export function contextFromState(state: GameState): ConditionContext {
  return { variables: state.variables, inventory: state.inventory, visited: state.visited };
}

/**
 * Compare deux valeurs. `eq`/`neq` acceptent tous les types ; les comparaisons
 * d'ordre exigent deux nombres — comparer un nombre a une chaine est une erreur
 * d'ecriture, on renvoie `false` plutot que de bricoler une coercition.
 */
function compare(
  op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte',
  left: VariableValue | undefined,
  right: VariableValue,
): boolean {
  if (op === 'eq') return left === right;
  if (op === 'neq') return left !== right;

  if (typeof left !== 'number' || typeof right !== 'number') return false;
  switch (op) {
    case 'gt':
      return left > right;
    case 'gte':
      return left >= right;
    case 'lt':
      return left < right;
    case 'lte':
      return left <= right;
  }
}

/** Vrai si la condition est satisfaite dans ce contexte. */
export function evaluateCondition(condition: Condition, context: ConditionContext): boolean {
  switch (condition.op) {
    case 'always':
      return true;

    case 'eq':
    case 'neq':
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte':
      return compare(condition.op, context.variables[condition.variable], condition.value);

    case 'hasItem':
      return (context.inventory[condition.item] ?? 0) >= (condition.quantity ?? 1);

    case 'lacksItem':
      return (context.inventory[condition.item] ?? 0) < (condition.quantity ?? 1);

    case 'visited':
      return context.visited.includes(condition.scene);

    case 'notVisited':
      return !context.visited.includes(condition.scene);

    case 'and':
      return condition.conditions.every((child) => evaluateCondition(child, context));

    case 'or':
      return condition.conditions.some((child) => evaluateCondition(child, context));

    case 'not':
      return !evaluateCondition(condition.condition, context);
  }
}

/** Une condition absente vaut « toujours disponible ». */
export function isSatisfied(condition: Condition | undefined, context: ConditionContext): boolean {
  return condition === undefined || evaluateCondition(condition, context);
}
