/**
 * How long the correspondent is still away.
 *
 * The whole real-time system is this file, and it is short for one reason: the
 * state records *when a wait started*, never when it ends. The end depends on
 * the pace its reader chose, and that pace is a setting they can move while
 * waiting — a stored deadline would freeze it and there would be nothing left
 * to recompute it from.
 *
 * So the pace never enters the state, the engine, or the format. It arrives
 * here, at the last moment, the way `interpolate` puts variables into a line
 * just before it is displayed.
 *
 * `now` is a parameter rather than a call to `Date.now()`: this module stays
 * pure, and its tests need no fake timers.
 */

import { waitMinutesOf } from '@embranche/story-format';
import type { GameState, Story } from '@embranche/story-format';

/** Real time runs as the story wrote it. */
export const REAL_TIME = 1;

export interface WaitStatus {
  /** True while the correspondent is away and nothing must be displayed yet. */
  waiting: boolean;
  /** Milliseconds left. Zero as soon as the wait is over. */
  remainingMs: number;
  /** Instant the wait ends, for a countdown or a notification. */
  endsAt: number;
  /** Full length of this wait once the pace is applied — zero when there is none. */
  totalMs: number;
}

const OVER = (now: number): WaitStatus => ({
  waiting: false,
  remainingMs: 0,
  endsAt: now,
  totalMs: 0,
});

/**
 * Where the wait of the scene being read stands.
 *
 * `speed` divides the declared duration: 1 is real time, 10 is ten times
 * faster, `Infinity` removes the wait entirely. A pace at or below zero would
 * mean an endless wait, so it is read as real time rather than trapping the
 * reader in a story they can no longer leave.
 *
 * An unreadable `awaitingSince` — a save edited by hand, a clock moved
 * backwards — counts as over. A corrupt timestamp must not be able to lock
 * someone out of their own run.
 */
export function waitStatus(story: Story, state: GameState, speed: number, now: number): WaitStatus {
  if (!state.awaitingSince) return OVER(now);

  const scene = story.scenes[state.currentSceneId];
  const minutes = scene ? waitMinutesOf(scene) : 0;
  if (minutes <= 0) return OVER(now);

  const pace = Number.isFinite(speed) && speed > 0 ? speed : speed === Infinity ? Infinity : 1;
  const totalMs = pace === Infinity ? 0 : (minutes * 60_000) / pace;

  const started = Date.parse(state.awaitingSince);
  if (Number.isNaN(started)) return OVER(now);

  const endsAt = started + totalMs;
  const remainingMs = Math.max(0, endsAt - now);
  return { waiting: remainingMs > 0, remainingMs, endsAt, totalMs };
}
