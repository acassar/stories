/**
 * Variables inside the text.
 *
 * `Il te reste {{ nuit }} nuits.` — the reader puts the current value in place
 * of the token when it displays the line. Without this, an author who wants to
 * say three different things has to write three near-identical scenes and gate
 * them behind three conditions; with ten variables that stops being writable.
 *
 * **Substitution, never evaluation.** What sits between the braces is the name
 * of a variable, and nothing else: no expression, no comparison, no function
 * call. A story is a JSON file that may come from anywhere, and opening one
 * must never mean running someone's code. That rule is the whole design of this
 * module, and it is why it is barely twenty lines long.
 */

import type { VariableName, VariableValue } from './types.js';

/**
 * Anything between double braces, so that a misspelled or accented name is
 * still seen as a token — and can therefore be reported to its author — rather
 * than silently passing for ordinary prose.
 */
const TOKEN = /\{\{([^{}]*)\}\}/g;

/** The variable names a text asks for, in order of appearance, without repeats. */
export function textTokens(text: string): VariableName[] {
  const names: VariableName[] = [];
  for (const match of text.matchAll(TOKEN)) {
    const name = match[1]?.trim();
    if (name && !names.includes(name)) names.push(name);
  }
  return names;
}

/**
 * Replaces each token with the value the variable holds right now.
 *
 * An unknown name is left standing as it was written. Blanking it would hide
 * the mistake from the only two people able to see it — the author reading
 * their own story, and the validator that reports it.
 */
export function interpolate(
  text: string,
  variables: Record<VariableName, VariableValue> = {},
): string {
  if (!text.includes('{{')) return text;
  return text.replace(TOKEN, (whole, raw: string) => {
    const name = raw.trim();
    // `in` would walk the prototype chain, and `{{ constructor }}` would print
    // the innards of `Object` into a story. Only what the state itself holds.
    if (!name || !Object.prototype.hasOwnProperty.call(variables, name)) return whole;
    return String(variables[name]);
  });
}
