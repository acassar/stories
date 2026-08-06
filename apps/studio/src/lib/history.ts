/**
 * Undo / redo stack.
 *
 * The editing operations of `storyDoc` are pure and immutable, so a version of
 * the document is just a reference to keep: no inverse operation to write, no
 * patch to replay. The stack holds whole documents, and undoing is picking the
 * previous one.
 *
 * The one subtlety is granularity. Recording a version per keystroke would make
 * "undo" mean "erase one letter", and dragging a node across the canvas would
 * bury the previous edit under two hundred entries. Consecutive changes of the
 * same nature, close in time, are therefore merged into one — that is what
 * `mergeKey` is for, and `storyChangeKey` computes it by comparing two
 * documents rather than asking every call site to declare its intent.
 */

import type { Scene, Story } from '@embranche/story-format';

/** Beyond this, the oldest versions are dropped. */
export const HISTORY_LIMIT = 80;

/** Two changes further apart than this are never merged, whatever their key. */
export const MERGE_WINDOW_MS = 700;

export interface HistoryStack<T> {
  past: T[];
  present: T;
  future: T[];
  /** Nature of the last recorded change, or `null` when it stands alone. */
  lastKey: string | null;
  lastAt: number;
}

export function createHistory<T>(present: T): HistoryStack<T> {
  return { past: [], present, future: [], lastKey: null, lastAt: 0 };
}

export interface RecordOptions {
  /** Nature of the change; `null` always opens a new entry. */
  key?: string | null;
  now?: number;
  window?: number;
}

/**
 * Records a new version.
 *
 * A change carrying the same key as the previous one, within the merge window,
 * replaces it instead of stacking on top: typing a title is one undo step, not
 * one per letter.
 */
export function record<T>(
  history: HistoryStack<T>,
  present: T,
  options: RecordOptions = {},
): HistoryStack<T> {
  if (present === history.present) return history;

  const now = options.now ?? Date.now();
  const key = options.key ?? null;
  const window = options.window ?? MERGE_WINDOW_MS;
  const merge = key !== null && key === history.lastKey && now - history.lastAt <= window;

  return {
    past: merge ? history.past : trim([...history.past, history.present]),
    present,
    // Any new edit closes the redo branch: the future it led to no longer
    // describes this document.
    future: [],
    lastKey: key,
    lastAt: now,
  };
}

function trim<T>(past: T[]): T[] {
  return past.length > HISTORY_LIMIT ? past.slice(past.length - HISTORY_LIMIT) : past;
}

export function canUndo<T>(history: HistoryStack<T>): boolean {
  return history.past.length > 0;
}

export function canRedo<T>(history: HistoryStack<T>): boolean {
  return history.future.length > 0;
}

export function undo<T>(history: HistoryStack<T>): HistoryStack<T> {
  const previous = history.past[history.past.length - 1];
  if (previous === undefined) return history;
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
    // The next edit must not merge into the entry we just walked out of.
    lastKey: null,
    lastAt: 0,
  };
}

export function redo<T>(history: HistoryStack<T>): HistoryStack<T> {
  const next = history.future[0];
  if (next === undefined) return history;
  return {
    past: trim([...history.past, history.present]),
    present: next,
    future: history.future.slice(1),
    lastKey: null,
    lastAt: 0,
  };
}

// ---------------------------------------------------------------------------
// Grouping edits
// ---------------------------------------------------------------------------

/** Scene fields the author fills in by typing — mergeable letter by letter. */
const TYPED_SCENE_FIELDS = new Set<keyof Scene>(['title', 'label', 'blocks', 'ending']);

/** Story fields the author fills in by typing. */
const TYPED_STORY_FIELDS = new Set<keyof Story>([
  'title',
  'author',
  'blurb',
  'tag',
  'version',
  'narrator',
  'estimatedMinutes',
]);

/**
 * Nature of the change between two documents, or `null` when it deserves an
 * entry of its own.
 *
 * Only two families are merged, and both for the same reason: they arrive as a
 * stream of tiny events that mean one gesture. Everything structural — adding a
 * node, wiring a link, changing a kind — is a step the author must be able to
 * take back on its own.
 */
export function storyChangeKey(previous: Story, next: Story): string | null {
  if (previous === next) return null;

  const previousIds = Object.keys(previous.scenes);
  const nextIds = Object.keys(next.scenes);
  if (previousIds.length !== nextIds.length) return null;

  const changed = nextIds.filter((id) => previous.scenes[id] !== next.scenes[id]);

  if (changed.length === 0) {
    const fields = differingKeys(previous, next, ['scenes']);
    const typed = fields.length > 0 && fields.every((field) => TYPED_STORY_FIELDS.has(field));
    return typed ? `story:${fields.join(',')}` : null;
  }

  // A drag moves every selected node at once: one gesture, one entry.
  const moved = changed.every((id) => {
    const before = previous.scenes[id];
    const after = next.scenes[id];
    return before && after && onlyDiffersBy(before, after, ['position']);
  });
  if (moved) return `move:${[...changed].sort().join(',')}`;

  if (changed.length > 1) return null;
  const id = changed[0] as string;
  const before = previous.scenes[id];
  const after = next.scenes[id];
  if (!before || !after) return null;

  const fields = differingKeys(before, after);
  const typed = fields.length > 0 && fields.every((field) => TYPED_SCENE_FIELDS.has(field));
  return typed ? `type:${id}:${fields.join(',')}` : null;
}

/** Keys whose values differ between two records, ignoring `skip`. */
function differingKeys<T extends object>(a: T, b: T, skip: (keyof T)[] = []): (keyof T)[] {
  const keys = new Set<keyof T>([...Object.keys(a), ...Object.keys(b)] as (keyof T)[]);
  const changed: (keyof T)[] = [];
  for (const key of keys) {
    if (skip.includes(key)) continue;
    if (!Object.is(a[key], b[key])) changed.push(key);
  }
  return changed.sort();
}

function onlyDiffersBy<T extends object>(a: T, b: T, fields: (keyof T)[]): boolean {
  const changed = differingKeys(a, b);
  return changed.length > 0 && changed.every((key) => fields.includes(key));
}
