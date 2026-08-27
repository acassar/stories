/**
 * Saying how long the correspondent is still away.
 *
 * Pure text, no clock of its own: the instant is handed in, so the countdown
 * shown in the conversation and the one shown on the story sheet can never word
 * the same wait two different ways.
 */

import type { Narrator } from '@embranche/story-format';

const MINUTE = 60_000;

/** What a story says when it has not worded its own absence. */
export const DEFAULT_AWAY = 'hors ligne';

/**
 * « 3 h 12 », « 12 min », « 40 s » — the coarsest unit that still carries
 * information.
 *
 * Always rounded up: a countdown that reaches zero while the wait is still on
 * would make the app look broken to the only person watching it closely.
 */
export function formatRemaining(ms: number): string {
  const left = Math.max(0, ms);
  if (left < MINUTE) return `${Math.ceil(left / 1000)} s`;

  // Rounded to whole minutes before the unit is chosen, so 59 min 59 s reads
  // « 1 h » instead of « 60 min » — the gap that shows up on the very first
  // second of every wait.
  const minutes = Math.ceil(left / MINUTE);
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, '0')}`;
}

/** The line under the correspondent's name while they are away. */
export function awayStatus(narrator: Narrator | undefined, remainingMs: number): string {
  return `${narrator?.awayStatus || DEFAULT_AWAY} · ${formatRemaining(remainingMs)}`;
}

/** The same absence, told from the story sheet, where the name is not on screen. */
export function awaySentence(narrator: Narrator | undefined, remainingMs: number): string {
  const who = narrator?.name ?? 'Ton correspondant';
  return `${who} est ${narrator?.awayStatus || DEFAULT_AWAY} — de retour dans ${formatRemaining(remainingMs)}.`;
}
