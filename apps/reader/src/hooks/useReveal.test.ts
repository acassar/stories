import { describe, expect, it } from 'vitest';

import { REVEAL_TIMING, typingDelay } from './useReveal';

describe('typingDelay', () => {
  it('takes longer for a longer line', () => {
    const court = typingDelay('Je les suis.');
    const long = typingDelay(
      "Le sentier s'enfonce sous les fougeres plus hautes que toi, et la nuit se referme derriere.",
    );
    expect(long).toBeGreaterThan(court);
  });

  it('starts from the settling time, to which the letters are added', () => {
    expect(typingDelay('')).toBe(REVEAL_TIMING.base);
    expect(typingDelay('Oui.')).toBe(REVEAL_TIMING.base + 4 * REVEAL_TIMING.perCharacter);
  });

  it('stops climbing at the ceiling, so a paragraph never becomes a stall', () => {
    const paragraphe = 'a'.repeat(2000);
    expect(typingDelay(paragraphe)).toBe(REVEAL_TIMING.ceiling);
  });

  it('grows one character at a time between the two', () => {
    const dix = typingDelay('a'.repeat(60));
    const onze = typingDelay('a'.repeat(61));
    expect(onze - dix).toBe(REVEAL_TIMING.perCharacter);
  });

  it('keeps long lines apart instead of flattening them together', () => {
    /*
     * What the ceiling costs when it is set too low: every long line arrives
     * at the same speed as a merely long one, and the delay stops saying
     * anything at all. The shipped stories run up to 167 characters, and the
     * ceiling must stay out of the way well past the ordinary long line.
     */
    expect(typingDelay('a'.repeat(120))).toBeGreaterThan(typingDelay('a'.repeat(60)));
    expect(typingDelay('a'.repeat(120))).toBeLessThan(REVEAL_TIMING.ceiling);
  });

  it('stays within a range a reader will sit through', () => {
    // The whole point of the base and the ceiling: whatever an author writes,
    // the wait stays inside a range a reader will sit through.
    for (const length of [0, 1, 20, 80, 300, 5000]) {
      const delay = typingDelay('a'.repeat(length));
      expect(delay).toBeGreaterThanOrEqual(REVEAL_TIMING.base);
      expect(delay).toBeLessThanOrEqual(REVEAL_TIMING.ceiling);
    }
  });
});
