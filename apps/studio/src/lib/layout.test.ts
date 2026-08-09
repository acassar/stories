import { describe, expect, it } from 'vitest';

import { clairiereStory, kerlavenStory, validateStory } from '@embranche/story-format';
import type { Story } from '@embranche/story-format';

import { DEFAULT_LAYOUT, arrangeStory, layoutStory } from './layout';

function clone(story: Story): Story {
  return structuredClone(story);
}

/** Card size, from the studio stylesheet. */
const CARD = { width: 190, height: 96 };

/**
 * How many cards a link is drawn over, once the story is laid out.
 *
 * A card counts when it stands wholly between the two ends of a link, inside
 * the band the link spans — which is where the drawing can pass over it.
 */
function linksOverCards(story: Story): number {
  const positions = layoutStory(story);
  let count = 0;

  for (const scene of Object.values(story.scenes)) {
    for (const link of scene.next) {
      const from = positions[scene.id];
      const to = positions[link.to];
      if (!from || !to) continue;

      const top = Math.min(from.y, to.y) + CARD.height;
      const bottom = Math.max(from.y, to.y);
      const left = Math.min(from.x, to.x);
      const right = Math.max(from.x, to.x) + CARD.width;

      for (const [id, spot] of Object.entries(positions)) {
        if (id === scene.id || id === link.to) continue;
        const inside =
          spot.y >= top &&
          spot.y + CARD.height <= bottom &&
          spot.x + CARD.width > left &&
          spot.x < right;
        if (inside) count += 1;
      }
    }
  }
  return count;
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

  it('places the scenes and nothing else — the lanes are scaffolding', () => {
    expect(Object.keys(layoutStory(kerlavenStory)).sort()).toEqual(
      Object.keys(kerlavenStory.scenes).sort(),
    );
  });

  /*
   * A budget, not an exact figure. What makes a large story unreadable is the
   * links drawn over the cards, and the count is the only thing that says
   * whether the ordering still does its job. It was 325 before the long links
   * got a say on the ranks they cross.
   */
  it('keeps the links of the long story off the cards', () => {
    expect(linksOverCards(kerlavenStory)).toBeLessThan(280);
  });

  it('returns nothing for a story without a single scene', () => {
    expect(layoutStory({ ...clairiereStory, scenes: {} })).toEqual({});
  });
});
