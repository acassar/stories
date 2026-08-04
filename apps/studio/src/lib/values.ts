/**
 * Saisie des valeurs de variables.
 *
 * L'auteur tape du texte libre dans un champ ; le format, lui, distingue
 * chaines, nombres et booleens. Cette conversion est la seule interpretation
 * faite cote studio — le JSON produit reste strictement type.
 */

import type { Condition, VariableValue } from '@embranche/story-format';

/** `true`/`false` → booleen, un nombre lisible → nombre, sinon chaine. */
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

/** Conditions que l'editeur structure sait afficher ligne par ligne. */
export type LeafCondition = Exclude<Condition, { op: 'and' } | { op: 'or' } | { op: 'not' }>;

export function isLeafCondition(condition: Condition): condition is LeafCondition {
  return condition.op !== 'and' && condition.op !== 'or' && condition.op !== 'not';
}

export interface FlatCondition {
  join: 'and' | 'or';
  leaves: LeafCondition[];
}

/**
 * Aplatit une condition si elle tient dans le modele « une liste de tests
 * joints par ET ou OU ». Renvoie `null` pour toute forme plus riche (negation,
 * imbrication), que l'editeur presente alors en JSON brut plutot que de la
 * reecrire — mieux vaut un champ austere qu'une perte silencieuse.
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

/** Ligne vierge proposee quand l'auteur ajoute un test. */
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
