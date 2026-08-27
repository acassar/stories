import { beforeEach, describe, expect, it } from 'vitest';

import { DEFAULT_PACE, PACES, allowedPaces, clampPace, loadPace, savePace } from './settings';

describe('the pace of the waits', () => {
  beforeEach(() => window.localStorage.clear());

  it('starts at real time — the story as its author wrote it', () => {
    expect(DEFAULT_PACE).toBe(1);
    expect(loadPace()).toBe(1);
  });

  it('keeps « sans attente » across a visit, infinity included', () => {
    savePace(Infinity);
    expect(loadPace()).toBe(Infinity);
    savePace(5);
    expect(loadPace()).toBe(5);
  });

  it('falls back rather than trusting what it reads', () => {
    window.localStorage.setItem('embranche.reader.pace.v1', 'vite');
    expect(loadPace()).toBe(DEFAULT_PACE);
  });

  /*
   * The day part of the scale is paid for, a lapsed subscription must not leave
   * a premium pace lying in storage. Clamping happens on read, not only on
   * write, which is what makes that impossible.
   */
  it('brings a pace back inside what the plan allows, on read', () => {
    expect(allowedPaces('free')).toEqual([...PACES]);
    // Never below real time, and never rounded up onto a step not granted.
    expect(clampPace(0.5)).toBe(1);
    expect(clampPace(7)).toBe(5);
    expect(clampPace(1000)).toBe(10);
    expect(clampPace(Infinity)).toBe(Infinity);
  });
});
