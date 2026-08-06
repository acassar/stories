import { describe, expect, it } from 'vitest';

import { clairiereStory, kerlavenStory, validateStory } from '@embranche/story-format';
import type { Story } from '@embranche/story-format';

import { DEFAULT_LAYOUT, arrangeStory, layoutStory } from './layout';

function clone(story: Story): Story {
  return structuredClone(story);
}

describe('layout', () => {
  it('puts the start scene on the first rank', () => {
    const positions = layoutStory(clairiereStory);
    expect(positions.start?.y).toBe(0);
  });

  it('places a node strictly below what leads to it', () => {
    const positions = layoutStory(clairiereStory);
    expect(positions['c-lucioles']!.y).toBeGreaterThan(positions.start!.y);
    expect(positions.lucioles!.y).toBeGreaterThan(positions['c-lucioles']!.y);
  });

  it('never stacks two nodes of the same rank', () => {
    const positions = layoutStory(clairiereStory);
    const byRank = new Map<number, number[]>();
    for (const { x, y } of Object.values(positions)) {
      byRank.set(y, [...(byRank.get(y) ?? []), x]);
    }
    for (const xs of byRank.values()) {
      const sorted = [...xs].sort((a, b) => a - b);
      for (let i = 1; i < sorted.length; i += 1) {
        expect(sorted[i]! - sorted[i - 1]!).toBeGreaterThanOrEqual(DEFAULT_LAYOUT.columnGap - 1);
      }
    }
  });

  it('is deterministic: laying out twice gives the same graph', () => {
    expect(layoutStory(clairiereStory)).toEqual(layoutStory(clairiereStory));
    expect(arrangeStory(arrangeStory(clairiereStory)).scenes).toEqual(
      arrangeStory(clairiereStory).scenes,
    );
  });

  it('changes nothing but the positions', () => {
    const arranged = arrangeStory(clairiereStory);
    expect(Object.keys(arranged.scenes)).toEqual(Object.keys(clairiereStory.scenes));
    expect(validateStory(arranged).issues).toEqual(validateStory(clairiereStory).issues);
    for (const [id, scene] of Object.entries(arranged.scenes)) {
      expect({ ...scene, position: null }).toEqual({
        ...clairiereStory.scenes[id]!,
        position: null,
      });
    }
  });

  it('leaves the source document untouched', () => {
    const before = structuredClone(clairiereStory.scenes.start!.position);
    arrangeStory(clairiereStory);
    expect(clairiereStory.scenes.start!.position).toEqual(before);
  });

  it('survives a story that loops back on itself', () => {
    const looping = clone(clairiereStory);
    looping.scenes.portail!.next = [{ id: 'recommencer', to: 'start' }];
    delete looping.scenes.portail!.ending;

    const positions = layoutStory(looping);
    expect(Object.keys(positions)).toHaveLength(Object.keys(looping.scenes).length);
    expect(positions.start?.y).toBe(0);
  });

  it('handles a node that points at itself', () => {
    const selfish = clone(clairiereStory);
    selfish.scenes.start!.next.push({ id: 'soi-meme', to: 'start' });
    expect(() => layoutStory(selfish)).not.toThrow();
  });

  it('lays out a story nothing points at, alongside the rest', () => {
    const orphaned = clone(clairiereStory);
    orphaned.scenes.perdu = {
      id: 'perdu',
      kind: 'npc',
      title: 'Nulle part',
      blocks: [],
      next: [],
      position: { x: 0, y: 0 },
    };
    const positions = layoutStory(orphaned);
    expect(positions.perdu).toBeDefined();
    expect(positions.perdu?.y).toBe(0);
  });

  it('gives every node of the long story a distinct spot', () => {
    const positions = layoutStory(kerlavenStory);
    const spots = new Set(Object.values(positions).map(({ x, y }) => `${x}:${y}`));
    expect(spots.size).toBe(Object.keys(kerlavenStory.scenes).length);
  });

  it('returns nothing for a story without a single scene', () => {
    expect(layoutStory({ ...clairiereStory, scenes: {} })).toEqual({});
  });
});
