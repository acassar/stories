import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import { WRITING_TIMING, characterDelay, useTypewriter } from './useTypewriter';

describe('characterDelay', () => {
  it('rests longer at the end of a sentence than after a comma, and longer there than mid-word', () => {
    expect(characterDelay('a')).toBe(WRITING_TIMING.perCharacter);
    expect(characterDelay(',')).toBeGreaterThan(characterDelay('a'));
    expect(characterDelay('.')).toBeGreaterThan(characterDelay(','));
  });
});

describe('useTypewriter', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('writes a line letter by letter, then the next one, then is done', () => {
    const { result } = renderHook(() => useTypewriter('s1', ['Oui', 'Non'], true));
    expect(result.current).toMatchObject({ revealed: 0, written: 0, done: false });

    act(() => void vi.advanceTimersByTime(WRITING_TIMING.perCharacter));
    expect(result.current).toMatchObject({ revealed: 0, written: 1 });

    act(() => void vi.advanceTimersByTime(WRITING_TIMING.perCharacter * 3));
    // The first line is whole: the pen moves on, nobody announces anything.
    expect(result.current.revealed).toBe(1);

    act(() => void vi.runAllTimers());
    expect(result.current).toMatchObject({ revealed: 2, done: true });
  });

  /*
   * Every render is recorded, not only the last one: the bug this guards
   * against lasted a single frame — the new scene shown whole, choices
   * included, before the pen went back to its first letter.
   */
  it('never shows a new scene written before its pen has started', () => {
    const seen: { sceneId: string; revealed: number; done: boolean }[] = [];
    const { rerender } = renderHook(
      ({ sceneId, texts }: { sceneId: string; texts: string[] }) => {
        const writing = useTypewriter(sceneId, texts, true);
        seen.push({ sceneId, revealed: writing.revealed, done: writing.done });
        return writing;
      },
      { initialProps: { sceneId: 'a', texts: ['Oui'] } },
    );
    act(() => void vi.runAllTimers());

    rerender({ sceneId: 'b', texts: ['Non', 'Peut-être'] });
    const firstOfB = seen.find((render) => render.sceneId === 'b');
    expect(firstOfB).toMatchObject({ revealed: 0, done: false });
    expect(seen.filter((render) => render.sceneId === 'b' && render.revealed > 0)).toHaveLength(0);
  });

  it('never writes half a character', () => {
    const { result } = renderHook(() => useTypewriter('s1', ['é🌙'], true));
    act(() => void vi.advanceTimersByTime(WRITING_TIMING.perCharacter * 2));
    // Two code points, two steps — the emoji is not split into its halves.
    expect(result.current.written).toBe(2);
  });

  it('puts the whole scene on the page when tapped, or when it must not animate', () => {
    const { result } = renderHook(() => useTypewriter('s1', ['Une ligne assez longue'], true));
    act(() => result.current.skip());
    expect(result.current.done).toBe(true);

    const still = renderHook(() => useTypewriter('s1', ['Une ligne'], false));
    expect(still.result.current).toMatchObject({ revealed: 1, done: true });
  });
});
