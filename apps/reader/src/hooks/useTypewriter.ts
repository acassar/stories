import { useCallback, useEffect, useRef, useState } from 'react';

/** Pace at which a book writes itself, in milliseconds. */
export const WRITING_TIMING = {
  /** Time per character. */
  perCharacter: 22,
  /** Extra breath after the end of a sentence. */
  sentence: 180,
  /** Extra breath after a comma, a colon, a dash. */
  clause: 70,
  /** Between two lines. */
  line: 240,
} as const;

/** How long the pen rests after a character, punctuation included. */
export function characterDelay(character: string): number {
  if (/[.!?…]/.test(character)) return WRITING_TIMING.perCharacter + WRITING_TIMING.sentence;
  if (/[,;:—]/.test(character)) return WRITING_TIMING.perCharacter + WRITING_TIMING.clause;
  return WRITING_TIMING.perCharacter;
}

export interface Writing {
  /** Number of lines of the current scene written in full. */
  revealed: number;
  /** Characters already written of the line in progress — the one at `revealed`. */
  written: number;
  /** True once the whole scene is on the page — choices may be displayed. */
  done: boolean;
  /** Writes the whole scene at once. */
  skip: () => void;
}

/**
 * Writes the lines of a scene letter by letter, as if the story were writing
 * itself — the book's counterpart of `useReveal`.
 *
 * There is no one on the other end of a book, so nothing announces the next
 * line and nothing waits for an answer: the only time spent is the time the
 * text takes to be written. Turning the animation off (`animate = false`, or a
 * reduced-motion preference) puts the scene on the page in one go, changing
 * nothing to the game.
 *
 * Characters are counted as code points, so an accented letter or an emoji is
 * never written in halves.
 */
export function useTypewriter(sceneId: string, texts: readonly string[], animate = true): Writing {
  const total = texts.length;
  const [progress, setProgress] = useState({
    sceneId,
    revealed: animate ? 0 : total,
    written: 0,
  });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Read through a ref, as in `useReveal`: a caller rebuilding its array on
  // every render must not restart the writing halfway through a line.
  const textsRef = useRef(texts);
  textsRef.current = texts;

  const stop = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const skip = useCallback(() => {
    stop();
    setProgress({ sceneId, revealed: total, written: 0 });
  }, [stop, sceneId, total]);

  useEffect(() => {
    stop();
    if (!animate || total === 0) {
      setProgress({ sceneId, revealed: total, written: 0 });
      return;
    }

    let line = 0;
    let written = 0;
    setProgress({ sceneId, revealed: 0, written: 0 });

    const tick = () => {
      const characters = Array.from(textsRef.current[line] ?? '');
      if (written < characters.length) {
        written += 1;
        setProgress({ sceneId, revealed: line, written });
        timer.current = setTimeout(tick, characterDelay(characters[written - 1] ?? ''));
        return;
      }
      line += 1;
      written = 0;
      setProgress({ sceneId, revealed: line, written: 0 });
      if (line < total) timer.current = setTimeout(tick, WRITING_TIMING.line);
    };
    timer.current = setTimeout(tick, WRITING_TIMING.perCharacter);

    return stop;
  }, [sceneId, total, animate, stop]);

  /*
   * Progress belongs to the scene it was made on. The effect that restarts the
   * pen only runs after the new scene is painted, and until then the state
   * still holds the previous scene's count: read as is, it would put the new
   * lines on the page — and its choices under them — for a frame before the
   * writing starts over.
   */
  const current =
    progress.sceneId === sceneId ? progress : { revealed: animate ? 0 : total, written: 0 };

  return {
    revealed: current.revealed,
    written: current.written,
    done: current.revealed >= total,
    skip,
  };
}
