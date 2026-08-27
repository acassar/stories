import { describe, expect, it } from 'vitest';

import { createEmptyStory, createLink, createScene } from '@embranche/story-format';
import type { GameState, Story } from '@embranche/story-format';

import { createInitialState } from './state.js';
import { REAL_TIME, waitStatus } from './waiting.js';

const T0 = Date.parse('2026-01-01T00:00:00.000Z');
const clock = () => new Date(T0).toISOString();

/** A story whose second scene keeps the reader waiting an hour. */
function story(minutes = 60): Story {
  const base = createEmptyStory({ id: 'attente' });
  return {
    ...base,
    scenes: {
      ...base.scenes,
      silence: createScene({
        id: 'silence',
        kind: 'npc',
        title: 'Le silence',
        blocks: [{ text: 'Me revoilà.' }],
        waitMinutes: minutes,
        next: [createLink({ to: 'fin' })],
      }),
    },
  };
}

function waitingOn(scene: string, minutes = 60): { story: Story; state: GameState } {
  const built = story(minutes);
  return {
    story: built,
    state: {
      ...createInitialState(built, clock),
      currentSceneId: scene,
      awaitingSince: clock(),
    },
  };
}

describe('waitStatus', () => {
  it('reports no wait when nothing is pending', () => {
    const built = story();
    const status = waitStatus(built, createInitialState(built, clock), REAL_TIME, T0);
    expect(status.waiting).toBe(false);
    expect(status.remainingMs).toBe(0);
  });

  it('counts the declared minutes down in real time', () => {
    const { story: s, state } = waitingOn('silence', 60);
    expect(waitStatus(s, state, REAL_TIME, T0).remainingMs).toBe(3_600_000);
    expect(waitStatus(s, state, REAL_TIME, T0 + 3_599_000).waiting).toBe(true);
    expect(waitStatus(s, state, REAL_TIME, T0 + 3_600_000).waiting).toBe(false);
  });

  /*
   * The point of storing the start rather than the deadline: the same state,
   * read at the same instant, answers differently once the pace moves. Nothing
   * is rewritten, nothing is rescheduled.
   */
  it('divides the wait by the pace, without touching the state', () => {
    const { story: s, state } = waitingOn('silence', 60);
    const before = JSON.stringify(state);

    expect(waitStatus(s, state, 2, T0).remainingMs).toBe(1_800_000);
    expect(waitStatus(s, state, 10, T0).remainingMs).toBe(360_000);
    expect(waitStatus(s, state, Infinity, T0).waiting).toBe(false);

    expect(JSON.stringify(state)).toBe(before);
  });

  it('is already over when the app comes back after the deadline', () => {
    const { story: s, state } = waitingOn('silence', 720);
    const status = waitStatus(s, state, REAL_TIME, T0 + 999 * 3_600_000);
    expect(status.waiting).toBe(false);
    expect(status.remainingMs).toBe(0);
  });

  it('never traps a reader on a broken timestamp or an absurd pace', () => {
    const { story: s, state } = waitingOn('silence', 60);
    expect(waitStatus(s, { ...state, awaitingSince: 'hier' }, REAL_TIME, T0).waiting).toBe(false);
    // A pace of zero or less would mean an endless silence: read as real time.
    expect(waitStatus(s, state, 0, T0).remainingMs).toBe(3_600_000);
    expect(waitStatus(s, state, -4, T0).remainingMs).toBe(3_600_000);
  });

  it('ignores a wait declared on a scene that no longer carries one', () => {
    const { story: s, state } = waitingOn('depart', 60);
    expect(waitStatus(s, state, REAL_TIME, T0).waiting).toBe(false);
  });
});
