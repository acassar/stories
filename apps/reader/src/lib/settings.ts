/**
 * What belongs to the reader rather than to any story they read.
 *
 * As in `library.ts`, `localStorage` lives here and nowhere else. And as
 * everywhere else in the app, none of this reaches a save: a run exported and
 * opened on another phone must play at *that* reader's pace, not at the one it
 * was recorded with.
 */

const PACE_KEY = 'embranche.reader.pace.v1';

/**
 * How fast the waits of a story run, as a divisor of the minutes it declares.
 *
 * `1` is what the author wrote — a night lasts a night. `Infinity` removes the
 * waiting entirely, for someone who wants the story and not the vigil. Nothing
 * slower than real time: doubling a twelve-hour silence serves no one, and it
 * would give the scale two ends to defend instead of one.
 */
export const PACES = [1, 2, 3, 5, 10, Infinity] as const;

export type Pace = (typeof PACES)[number];

export const DEFAULT_PACE: Pace = 1;

/** How each pace says itself, in the second person the rest of the app uses. */
export const PACE_LABELS: Record<string, string> = {
  '1': 'Temps réel',
  '2': '2× plus vite',
  '3': '3× plus vite',
  '5': '5× plus vite',
  '10': '10× plus vite',
  Infinity: 'Sans attente',
};

/**
 * What the reader is entitled to.
 *
 * One function, and the only one that will need to change the day some of the
 * scale is paid for. The fast end is what gets held back, never the slow one:
 * real time is the story as its author wrote it, and that must stay free.
 */
export type Plan = 'free' | 'premium';

export function allowedPaces(_plan: Plan = 'free'): readonly Pace[] {
  // Nothing is held back yet, and pretending otherwise here would be inventing
  // a product decision. When the day comes, this line is the whole change:
  // `return _plan === 'premium' ? PACES : PACES.filter((pace) => pace <= 3);`
  return PACES;
}

/**
 * Brings a pace back inside what the plan allows.
 *
 * Called on every read, not only on write: an entitlement can be lost between
 * two visits, and a value left in storage would outlive it.
 */
export function clampPace(pace: number, plan: Plan = 'free'): Pace {
  const allowed = allowedPaces(plan);
  if (allowed.includes(pace as Pace)) return pace as Pace;

  const slowest = allowed[0] ?? DEFAULT_PACE;
  const fastest = allowed[allowed.length - 1] ?? DEFAULT_PACE;
  if (pace <= slowest) return slowest;
  if (pace >= fastest) return fastest;

  // Between two steps: the nearest one *below*. A pace is a permission, and
  // rounding up would hand out one that was never given.
  return [...allowed].reverse().find((step) => step <= pace) ?? slowest;
}

export function loadPace(plan: Plan = 'free', storage: Storage = window.localStorage): Pace {
  const raw = storage.getItem(PACE_KEY);
  if (raw === null) return DEFAULT_PACE;
  // `Number('Infinity')` round-trips, which is the whole reason the value is
  // stored as the string it prints as.
  const parsed = Number(raw);
  if (Number.isNaN(parsed)) return DEFAULT_PACE;
  return clampPace(parsed, plan);
}

export function savePace(pace: Pace, storage: Storage = window.localStorage): void {
  storage.setItem(PACE_KEY, String(pace));
}
