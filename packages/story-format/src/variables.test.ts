import { describe, expect, it } from 'vitest';

import { clairiereStory } from './examples.js';
import { createEmptyStory, createLink, createScene } from './factories.js';
import type { Story } from './types.js';
import {
  analyzeStory,
  isDeadWeight,
  isNeverWritten,
  scenesTestedByConditions,
} from './variables.js';

/** A story exercising every corner of the analysis, in as few nodes as possible. */
function storyWithVariables(): Story {
  const story = createEmptyStory({ id: 'vars', title: 'Variables' });
  return {
    ...story,
    variables: { prudent: false, jamaisLue: 3 },
    inventory: { lanterne: 1 },
    scenes: {
      ...story.scenes,
      depart: createScene({
        id: 'depart',
        kind: 'npc',
        title: 'Le seuil',
        blocks: [{ text: 'Ici.' }],
        next: [
          createLink({
            id: 'vers-avancer',
            to: 'avancer',
            condition: { op: 'eq', variable: 'prudent', value: true },
            effects: [
              { op: 'inc', variable: 'tension', value: 1 },
              { op: 'addItem', item: 'clef' },
            ],
          }),
        ],
      }),
      avancer: createScene({
        id: 'avancer',
        kind: 'choice',
        title: 'Avancer',
        label: 'Avancer',
        next: [
          createLink({
            id: 'vers-fin',
            to: 'fin',
            condition: {
              op: 'and',
              conditions: [
                { op: 'hasItem', item: 'lanterne' },
                { op: 'gt', variable: 'tension', value: 0 },
                { op: 'visited', scene: 'depart' },
              ],
            },
          }),
        ],
      }),
    },
  };
}

describe('analyzeStory', () => {
  it('records who writes a variable and who reads it', () => {
    const { variables } = analyzeStory(storyWithVariables());
    const tension = variables.find((entry) => entry.name === 'tension');

    expect(tension?.writes).toEqual([
      {
        sceneId: 'depart',
        sceneTitle: 'Le seuil',
        linkId: 'vers-avancer',
        targetId: 'avancer',
        op: 'inc',
      },
    ]);
    expect(tension?.reads.map((site) => site.sceneId)).toEqual(['avancer']);
  });

  it('marks a declared variable as such, with its starting value', () => {
    const { variables } = analyzeStory(storyWithVariables());
    const prudent = variables.find((entry) => entry.name === 'prudent');
    expect(prudent?.declared).toBe(true);
    expect(prudent?.initial).toBe(false);
  });

  it('flags a variable nobody reads and one nobody writes', () => {
    const { variables } = analyzeStory(storyWithVariables());
    const jamaisLue = variables.find((entry) => entry.name === 'jamaisLue');
    const prudent = variables.find((entry) => entry.name === 'prudent');

    expect(isDeadWeight(jamaisLue!)).toBe(true);
    expect(isNeverWritten(jamaisLue!)).toBe(false); // declared: it has a value
    expect(isNeverWritten(prudent!)).toBe(false);
    expect(isDeadWeight(prudent!)).toBe(false);
  });

  it('analyses items alongside variables, never mixing the two', () => {
    const { items, variables } = analyzeStory(storyWithVariables());
    expect(variables.map((entry) => entry.name)).not.toContain('clef');

    const clef = items.find((entry) => entry.name === 'clef');
    expect(clef?.declared).toBe(false);
    expect(clef?.writes[0]?.op).toBe('addItem');

    const lanterne = items.find((entry) => entry.name === 'lanterne');
    expect(lanterne?.initial).toBe(1);
    expect(lanterne?.reads).toHaveLength(1);
  });

  it('sorts by name so the table never jumps around', () => {
    const names = analyzeStory(storyWithVariables()).variables.map((entry) => entry.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'fr')));
  });

  it('reports nothing on a story without conditions nor effects', () => {
    const usage = analyzeStory(createEmptyStory());
    expect(usage.variables).toEqual([]);
    expect(usage.items).toEqual([]);
  });

  it('holds up on the shipped stories', () => {
    const usage = analyzeStory(clairiereStory);
    expect(usage.variables.length).toBeGreaterThan(0);
    for (const entry of usage.variables) {
      expect(entry.reads.length + entry.writes.length).toBeGreaterThan(0);
    }
  });
});

describe('scenesTestedByConditions', () => {
  it('collects the scenes a visited / notVisited test mentions, through composites', () => {
    expect(scenesTestedByConditions(storyWithVariables())).toEqual(new Set(['depart']));
  });

  it('returns nothing when no condition looks at the walk', () => {
    expect(scenesTestedByConditions(createEmptyStory()).size).toBe(0);
  });
});
