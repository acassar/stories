import { useCallback, useRef, useState } from 'react';

import type { Story } from '@embranche/story-format';

import {
  canRedo as canRedoStack,
  canUndo as canUndoStack,
  createHistory,
  record,
  redo as redoStack,
  storyChangeKey,
  undo as undoStack,
} from '../lib/history';
import type { HistoryStack } from '../lib/history';

export interface StoryHistory {
  /** Records the new document and pushes it up. Use it instead of `onChange`. */
  commit: (story: Story) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /** Number of steps that can still be taken back — shown in the tooltip. */
  depth: number;
}

/**
 * Undo / redo on the open story.
 *
 * The stack lives here rather than in the shell because it belongs to an
 * editing session: closing a story and opening another starts a fresh one. The
 * component is remounted in that case, which is exactly the reset we want.
 *
 * The mirror ref exists so that two commits within the same tick see each other
 * — the author types faster than React re-renders.
 */
export function useStoryHistory(story: Story, onChange: (story: Story) => void): StoryHistory {
  const [stack, setStack] = useState<HistoryStack<Story>>(() => createHistory(story));
  const mirror = useRef(stack);

  const apply = useCallback(
    (next: HistoryStack<Story>, publish: boolean) => {
      if (next === mirror.current) return;
      mirror.current = next;
      setStack(next);
      if (publish) onChange(next.present);
    },
    [onChange],
  );

  const commit = useCallback(
    (next: Story) => {
      const key = storyChangeKey(mirror.current.present, next);
      apply(record(mirror.current, next, { key }), false);
      onChange(next);
    },
    [apply, onChange],
  );

  const undo = useCallback(() => apply(undoStack(mirror.current), true), [apply]);
  const redo = useCallback(() => apply(redoStack(mirror.current), true), [apply]);

  return {
    commit,
    undo,
    redo,
    canUndo: canUndoStack(stack),
    canRedo: canRedoStack(stack),
    depth: stack.past.length,
  };
}
