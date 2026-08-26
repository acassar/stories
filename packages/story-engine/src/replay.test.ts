import { describe, expect, it } from 'vitest';

import { STORY_FORMAT_VERSION, clairiereStory, kerlavenStory } from '@embranche/story-format';
import type { Story } from '@embranche/story-format';

import { StoryEngine } from './engine.js';
import { variablesAlong } from './replay.js';

/** A counter that climbs, so each step is told apart by its value. */
const countingStory: Story = {
  formatVersion: STORY_FORMAT_VERSION,
  id: 'test-replay',
  title: 'Les nuits',
  version: '1.0.0',
  startSceneId: 'nuit',
  variables: { nuit: 1, veilleur: 'personne' },
  scenes: {
    nuit: {
      id: 'nuit',
      kind: 'npc',
      title: 'La nuit',
      position: { x: 0, y: 0 },
      blocks: [{ text: 'Il te reste {{ nuit }} nuits.' }],
      next: [
        { id: 'veiller', to: 'c-veiller', effects: [{ op: 'inc', variable: 'nuit', value: 1 }] },
        { id: 'partir', to: 'c-partir' },
      ],
    },
    'c-veiller': {
      id: 'c-veiller',
      kind: 'choice',
      title: 'Veiller',
      label: 'Veiller encore',
      position: { x: 0, y: 100 },
      blocks: [],
      next: [{ id: 'suite', to: 'nuit' }],
    },
    'c-partir': {
      id: 'c-partir',
      kind: 'choice',
      title: 'Partir',
      label: 'Partir',
      position: { x: 100, y: 100 },
      blocks: [],
      next: [{ id: 'suite', to: 'aube' }],
    },
    aube: {
      id: 'aube',
      kind: 'npc',
      title: "L'aube",
      position: { x: 100, y: 200 },
      blocks: [{ text: 'Le jour se leve.' }],
      next: [],
      ending: { type: 'Fin', name: 'Aube', blurb: 'Tu rentres.' },
    },
  },
};

function play(engine: StoryEngine, linkId: string): void {
  engine.choose(linkId);
  for (let steps = 0; steps < 50 && engine.advance(); steps += 1);
}

describe('variablesAlong', () => {
  it('gives back nothing on a run that has not moved yet', () => {
    const engine = new StoryEngine(countingStory);
    expect(variablesAlong(countingStory, engine.state)).toEqual([]);
  });

  it('hands each step the values that were in force while it was on screen', () => {
    const engine = new StoryEngine(countingStory);
    play(engine, 'veiller');
    play(engine, 'veiller');

    // Four steps walked through, because each choice node counts as one: the
    // first night, the first watch, the second night, the second watch.
    // Today the counter reads 3; the first night was displayed while it read 1.
    expect(engine.state.variables.nuit).toBe(3);
    expect(variablesAlong(countingStory, engine.state).map((v) => v.nuit)).toEqual([1, 2, 2, 3]);
  });

  it('agrees, step by step, with what the engine held at that moment', () => {
    /*
     * The property the whole module rests on, checked against the only oracle
     * that cannot be wrong: the engine itself. Every state it went through is
     * recorded as it happens, then compared with what the replay deduces from
     * the sole history. On the long story, whose links really do carry effects.
     */
    const engine = new StoryEngine(kerlavenStory);
    const asItHappened: Record<string, unknown>[] = [{ ...engine.state.variables }];
    engine.on('state:changed', ({ state }) => {
      asItHappened[state.history.length] = { ...state.variables };
    });

    for (let turn = 0; turn < 8; turn += 1) {
      const choices = engine.getAvailableChoices();
      if (choices.length === 0) break;
      play(engine, choices[turn % choices.length]!.id);
    }

    const replayed = variablesAlong(kerlavenStory, engine.state);
    expect(replayed.length).toBeGreaterThanOrEqual(8);
    replayed.forEach((variables, step) => {
      expect(variables, `etape ${step}`).toEqual(asItHappened[step]);
    });
  });

  it('walks past a link the story no longer holds', () => {
    const engine = new StoryEngine(countingStory);
    play(engine, 'veiller');

    // The author deleted the link under a run in progress.
    const edited: Story = {
      ...countingStory,
      scenes: {
        ...countingStory.scenes,
        nuit: { ...countingStory.scenes.nuit!, next: [] },
      },
    };

    // No effect is applied, and the walk goes on rather than throwing.
    expect(variablesAlong(edited, engine.state).map((v) => v.nuit)).toEqual([1, 1]);
  });

  it('leaves the story alone', () => {
    const engine = new StoryEngine(clairiereStory);
    play(engine, 'vers-arbre');
    variablesAlong(clairiereStory, engine.state);
    expect(clairiereStory.variables).toEqual({ prudent: false });
  });
});
