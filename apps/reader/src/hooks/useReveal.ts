import { useCallback, useEffect, useRef, useState } from 'react';

/** Pace at which messages arrive, in milliseconds. */
export const REVEAL_TIMING = {
  /** Time to settle in before any line, whatever its length. */
  base: 320,
  /** Time spent per character of the line being written. */
  perCharacter: 26,
  /**
   * A guard against an outlier, not a working value. Set too low it flattens
   * the top of the range — every long line arriving at the same speed as a
   * merely long one, which is the opposite of what the delay is for. On the
   * stories shipped, it catches the longest two percent.
   */
  ceiling: 3800,
  /** Silence between a displayed message and the start of the next typing. */
  pause: 320,
} as const;

/**
 * How long the correspondent is shown writing a given line.
 *
 * A four-word line and a five-line paragraph used to take exactly the same
 * time, which is the one thing a real conversation never does: the length of
 * the silence is what announces the size of what is coming.
 */
export function typingDelay(text: string): number {
  const written = REVEAL_TIMING.base + text.length * REVEAL_TIMING.perCharacter;
  return Math.min(written, REVEAL_TIMING.ceiling);
}

export interface Reveal {
  /** Number of messages already displayed for the current scene. */
  revealed: number;
  /** True while the typing indicator is showing. */
  typing: boolean;
  /** True once the whole scene has arrived — choices may be displayed. */
  done: boolean;
  /** Displays the whole scene immediately. */
  skip: () => void;
}

/**
 * Brings the messages of a scene in one by one, with a typing delay.
 *
 * This is a display decision, not a story one: the engine has already resolved
 * everything. Turning the animation off (`animate = false`, or a system
 * reduced-motion preference) shows the scene in one block, changing nothing to
 * the game.
 */
export function useReveal(sceneId: string, texts: readonly string[], animate = true): Reveal {
  const total = texts.length;
  const [revealed, setRevealed] = useState(animate ? 0 : total);
  const [typing, setTyping] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  /*
   * The lines are read through a ref, so that a caller rebuilding its array on
   * every render — which is what any caller does — cannot restart the arrival
   * of a scene halfway through it.
   */
  const textsRef = useRef(texts);
  textsRef.current = texts;

  const clearTimers = useCallback(() => {
    for (const timer of timers.current) clearTimeout(timer);
    timers.current = [];
  }, []);

  const skip = useCallback(() => {
    clearTimers();
    setRevealed(total);
    setTyping(false);
  }, [clearTimers, total]);

  useEffect(() => {
    clearTimers();

    if (!animate || total === 0) {
      setRevealed(total);
      setTyping(false);
      return;
    }

    setRevealed(0);
    setTyping(true);

    const step = (index: number) => {
      timers.current.push(
        setTimeout(
          () => {
            setTyping(false);
            setRevealed(index + 1);
            if (index + 1 < total) {
              timers.current.push(
                setTimeout(() => {
                  setTyping(true);
                  step(index + 1);
                }, REVEAL_TIMING.pause),
              );
            }
          },
          typingDelay(textsRef.current[index] ?? ''),
        ),
      );
    };
    step(0);

    return clearTimers;
  }, [sceneId, total, animate, clearTimers]);

  return { revealed, typing, done: revealed >= total, skip };
}
