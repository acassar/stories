import { useCallback, useEffect, useRef, useState } from 'react';

/** Pace at which messages arrive, in milliseconds. */
export const REVEAL_TIMING = {
  /** Typing time before the very first message of a scene. */
  first: 600,
  /** Typing time before the following ones. */
  next: 700,
  /** Silence between a displayed message and the start of the next typing. */
  pause: 320,
} as const;

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
export function useReveal(sceneId: string, total: number, animate = true): Reveal {
  const [revealed, setRevealed] = useState(animate ? 0 : total);
  const [typing, setTyping] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

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
          index === 0 ? REVEAL_TIMING.first : REVEAL_TIMING.next,
        ),
      );
    };
    step(0);

    return clearTimers;
  }, [sceneId, total, animate, clearTimers]);

  return { revealed, typing, done: revealed >= total, skip };
}
