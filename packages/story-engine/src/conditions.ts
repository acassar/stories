/**
 * Condition evaluation.
 *
 * The vocabulary is closed and conditions are data: there is no `eval`, no
 * `new Function`, no string interpolation. A hostile story file cannot execute
 * anything — at worst it describes a condition that is false.
 */

import type { Condition, GameState, VariableValue } from '@embranche/story-format';

/** Read-only view of the state, enough to evaluate a condition. */
export interface ConditionContext {
  variables: Readonly<Record<string, VariableValue>>;
  inventory: Readonly<Record<string, number>>;
  visited: readonly string[];
}

export function contextFromState(state: GameState): ConditionContext {
  return { variables: state.variables, inventory: state.inventory, visited: state.visited };
}

/**
 * Compares two values. `eq`/`neq` accept every type; ordering comparisons
 * require two numbers — comparing a number to a string is an authoring mistake,
 * so it returns `false` rather than improvising a coercion.
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

/** True when the condition holds in this context. */
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

/** A missing condition means "always available". */
export function isSatisfied(condition: Condition | undefined, context: ConditionContext): boolean {
  return condition === undefined || evaluateCondition(condition, context);
}
