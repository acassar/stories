import { describe, expect, it } from 'vitest';

import { clairiereStory } from '@embranche/story-format';
import type { Story } from '@embranche/story-format';

import {
  HISTORY_LIMIT,
  canRedo,
  canUndo,
  createHistory,
  record,
  redo,
  storyChangeKey,
  undo,
} from './history';
import { addScene, moveScene, updateLink, updateScene } from './storyDoc';

function clone(): Story {
  return structuredClone(clairiereStory);
}

describe('history stack', () => {
  it('starts with nothing to undo', () => {
    const history = createHistory('a');
    expect(canUndo(history)).toBe(false);
    expect(canRedo(history)).toBe(false);
  });

  it('walks back and forth through the recorded versions', () => {
    let history = createHistory('a');
    history = record(history, 'b', { key: null });
    history = record(history, 'c', { key: null });

    history = undo(history);
    expect(history.present).toBe('b');
    history = undo(history);
    expect(history.present).toBe('a');
    expect(canUndo(history)).toBe(false);

    history = redo(history);
    expect(history.present).toBe('b');
    expect(canRedo(history)).toBe(true);
  });

  it('ignores a version identical to the current one', () => {
    const history = createHistory('a');
    expect(record(history, 'a', { key: null })).toBe(history);
  });

  it('merges consecutive changes of the same nature', () => {
    let history = createHistory('');
    history = record(history, 'L', { key: 'type:title', now: 1000 });
    history = record(history, 'Le', { key: 'type:title', now: 1100 });
    history = record(history, 'Les', { key: 'type:title', now: 1200 });

    expect(history.past).toHaveLength(1);
    expect(undo(history).present).toBe('');
  });

  it('stops merging once the author pauses', () => {
    let history = createHistory('');
    history = record(history, 'L', { key: 'type:title', now: 1000 });
    history = record(history, 'Le', { key: 'type:title', now: 5000 });
    expect(history.past).toHaveLength(2);
  });

  it('never merges two changes of different natures', () => {
    let history = createHistory('a');
    history = record(history, 'b', { key: 'move:x', now: 1000 });
    history = record(history, 'c', { key: 'type:x', now: 1050 });
    expect(history.past).toHaveLength(2);
  });

  it('closes the redo branch as soon as a new edit is made', () => {
    let history = createHistory('a');
    history = record(history, 'b', { key: null });
    history = undo(history);
    expect(canRedo(history)).toBe(true);

    history = record(history, 'c', { key: null });
    expect(canRedo(history)).toBe(false);
  });

  it('does not merge into the entry it was just taken out of', () => {
    let history = createHistory('a');
    history = record(history, 'b', { key: 'type:x', now: 1000 });
    history = undo(history);
    history = record(history, 'c', { key: 'type:x', now: 1050 });
    expect(undo(history).present).toBe('a');
  });

  it('drops the oldest versions rather than growing forever', () => {
    let history = createHistory(0);
    for (let step = 1; step <= HISTORY_LIMIT + 20; step += 1) {
      history = record(history, step, { key: null });
    }
    expect(history.past.length).toBeLessThanOrEqual(HISTORY_LIMIT + 1);
  });
});

describe('storyChangeKey', () => {
  it('groups the letters of a title into one entry', () => {
    const before = clone();
    const after = updateScene(before, 'start', { title: 'Le sentie' });
    expect(storyChangeKey(before, after)).toBe('type:start:title');
  });

  it('groups a drag, including a drag of several nodes at once', () => {
    const before = clone();
    const one = moveScene(before, 'start', { x: 10, y: 10 });
    expect(storyChangeKey(before, one)).toBe('move:start');

    const two = moveScene(one, 'lucioles', { x: 20, y: 20 });
    expect(storyChangeKey(before, two)).toBe('move:lucioles,start');
  });

  it('gives a structural change an entry of its own', () => {
    const before = clone();
    expect(storyChangeKey(before, addScene(before, 'npc', { x: 0, y: 0 }).story)).toBeNull();
    expect(
      storyChangeKey(before, updateLink(before, 'start', 'vers-lucioles', { to: 'c-arbre' })),
    ).toBeNull();
  });

  it('groups the letters of a story-level field', () => {
    const before = clone();
    expect(storyChangeKey(before, { ...before, title: 'La Clairièr' })).toBe('story:title');
  });

  it('refuses to group two nodes edited at once', () => {
    const before = clone();
    const after = updateScene(updateScene(before, 'start', { title: 'A' }), 'lucioles', {
      title: 'B',
    });
    expect(storyChangeKey(before, after)).toBeNull();
  });
});
