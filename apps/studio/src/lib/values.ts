/**
 * Input of variable values.
 *
 * The author types free text in a field; the format distinguishes strings,
 * numbers and booleans. This conversion is the only interpretation the studio
 * performs — the JSON it produces stays strictly typed.
 */

import type { Condition, VariableValue } from '@embranche/story-format';

/** `true`/`false` → boolean, a readable number → number, otherwise string. */
export function parseVariableValue(raw: string): VariableValue {
  const trimmed = raw.trim();
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed !== '' && !Number.isNaN(Number(trimmed))) return Number(trimmed);
  return raw;
}

export function formatVariableValue(value: VariableValue): string {
  return String(value);
}

/**
 * A wait, as short as it can be said: « 45 min », « 12 h », « 2 h 30 ».
 *
 * Minutes are what the format stores, because that is what an author thinks in.
 * Hours are what they read back once the number grows, for the same reason.
 */
export function formatWait(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest}`;
}

/** Conditions the structured editor can display line by line. */
export type LeafCondition = Exclude<Condition, { op: 'and' } | { op: 'or' } | { op: 'not' }>;

export function isLeafCondition(condition: Condition): condition is LeafCondition {
  return condition.op !== 'and' && condition.op !== 'or' && condition.op !== 'not';
}

export interface FlatCondition {
  join: 'and' | 'or';
  leaves: LeafCondition[];
}

/**
 * Flattens a condition when it fits the "a list of tests joined by AND or OR"
 * model. Returns `null` for any richer shape (negation, nesting), which the
 * editor then presents as raw JSON rather than rewriting it — an austere field
 * beats a silent loss.
 */
export function flattenCondition(condition: Condition): FlatCondition | null {
  if (isLeafCondition(condition)) return { join: 'and', leaves: [condition] };
  if (condition.op === 'not') return null;
  if (!condition.conditions.every(isLeafCondition)) return null;
  return { join: condition.op, leaves: condition.conditions as LeafCondition[] };
}

export function unflattenCondition(flat: FlatCondition): Condition | undefined {
  if (flat.leaves.length === 0) return undefined;
  if (flat.leaves.length === 1) return flat.leaves[0];
  return { op: flat.join, conditions: flat.leaves };
}

/** Blank row offered when the author adds a test. */
export function defaultLeaf(variable: string | undefined): LeafCondition {
  return { op: 'eq', variable: variable ?? 'variable', value: true };
}

export const CONDITION_OPERATORS: { value: LeafCondition['op']; label: string }[] = [
  { value: 'eq', label: 'variable =' },
  { value: 'neq', label: 'variable ≠' },
  { value: 'gt', label: 'variable >' },
  { value: 'gte', label: 'variable ≥' },
  { value: 'lt', label: 'variable <' },
  { value: 'lte', label: 'variable ≤' },
  { value: 'hasItem', label: 'possède l’objet' },
  { value: 'lacksItem', label: 'n’a pas l’objet' },
  { value: 'visited', label: 'a vu la scène' },
  { value: 'notVisited', label: 'n’a pas vu la scène' },
  { value: 'always', label: 'toujours vrai' },
];

export const EFFECT_OPERATORS = [
  { value: 'set', label: 'poser variable =' },
  { value: 'inc', label: 'ajouter à' },
  { value: 'dec', label: 'retirer de' },
  { value: 'toggle', label: 'inverser' },
  { value: 'unset', label: 'effacer' },
  { value: 'addItem', label: 'donner l’objet' },
  { value: 'removeItem', label: 'reprendre l’objet' },
] as const;
