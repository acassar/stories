import { describe, expect, it } from 'vitest';

import { awaySentence, awayStatus, formatRemaining } from './away';

describe('formatRemaining', () => {
  it('picks the coarsest unit that still says something', () => {
    expect(formatRemaining(40_000)).toBe('40 s');
    expect(formatRemaining(12 * 60_000)).toBe('12 min');
    expect(formatRemaining(3 * 3_600_000 + 12 * 60_000)).toBe('3 h 12');
  });

  it('rounds up, so the countdown never sits on zero while the wait lasts', () => {
    expect(formatRemaining(1)).toBe('1 s');
    expect(formatRemaining(61_000)).toBe('2 min');
    expect(formatRemaining(0)).toBe('0 s');
  });

  it('never prints « 60 min », at either end of the hour', () => {
    expect(formatRemaining(59 * 60_000 + 59_000)).toBe('1 h');
    expect(formatRemaining(3 * 3_600_000 + 59 * 60_000 + 59_500)).toBe('4 h');
  });
});

describe('the words of an absence', () => {
  it('uses the wording the story chose', () => {
    const narrator = { name: 'Pierre', awayStatus: 'en plongée' };
    expect(awayStatus(narrator, 90 * 60_000)).toBe('en plongée · 1 h 30');
    expect(awaySentence(narrator, 90 * 60_000)).toBe(
      'Pierre est en plongée — de retour dans 1 h 30.',
    );
  });

  it('falls back when the story never worded its own', () => {
    expect(awayStatus(undefined, 60_000)).toBe('hors ligne · 1 min');
    expect(awaySentence({ name: 'Elara' }, 60_000)).toBe(
      'Elara est hors ligne — de retour dans 1 min.',
    );
  });
});
