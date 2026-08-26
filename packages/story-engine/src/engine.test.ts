import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  STORY_FORMAT_VERSION,
  clairiereStory,
  findEndings,
  kerlavenStory,
} from '@embranche/story-format';
import type { Story } from '@embranche/story-format';

import { StoryEngine } from './engine.js';
import { EngineError } from './errors.js';
import { createInitialState, deserializeState, inspectState } from './state.js';

/** Frozen but advanceable clock, to check `updatedAt` without flakiness. */
function fakeClock(start = 0) {
  let tick = start;
  return {
    now: () => new Date(1_700_000_000_000 + tick * 1000).toISOString(),
    advance: () => {
      tick += 1;
    },
  };
}

function engine(story: Story = clairiereStory) {
  return new StoryEngine(story, { now: fakeClock().now });
}

/**
 * A full turn from the player's point of view: they press a button, then the
 * story unrolls on its own until the next stop. That is what the UI does, so it
 * is the granularity most of these tests reason at.
 */
function play(e: StoryEngine, linkId: string): void {
  e.choose(linkId);
  for (let steps = 0; steps < 50 && e.advance(); steps += 1);
}

/**
 * Compact story dedicated to condition, effect and inventory tests.
 *
 * Condition and effects sit on the link that leads to the button: pressing that
 * button is what triggers them.
 */
const testStory: Story = {
  formatVersion: STORY_FORMAT_VERSION,
  id: 'test-conditions',
  title: 'Bac a sable',
  version: '1.0.0',
  startSceneId: 'hall',
  variables: { cle: false, or: 0 },
  scenes: {
    hall: {
      id: 'hall',
      kind: 'npc',
      title: 'Le hall',
      position: { x: 0, y: 0 },
      blocks: [{ text: 'Une porte close, un tapis suspect.' }],
      next: [
        {
          id: 'soulever',
          to: 'c-soulever',
          effects: [
            { op: 'set', variable: 'cle', value: true },
            { op: 'addItem', item: 'cle-rouillee' },
            { op: 'inc', variable: 'or', value: 10 },
          ],
        },
        { id: 'ouvrir', to: 'c-ouvrir', condition: { op: 'eq', variable: 'cle', value: true } },
        { id: 'partir', to: 'c-partir' },
      ],
    },
    'c-soulever': {
      id: 'c-soulever',
      kind: 'choice',
      title: 'Soulever le tapis',
      label: 'Soulever le tapis',
      position: { x: -100, y: 100 },
      blocks: [],
      next: [{ id: 'suite', to: 'hall' }],
    },
    'c-ouvrir': {
      id: 'c-ouvrir',
      kind: 'choice',
      title: 'Ouvrir la porte',
      label: 'Ouvrir la porte',
      position: { x: 0, y: 100 },
      blocks: [],
      next: [{ id: 'suite', to: 'salle' }],
    },
    'c-partir': {
      id: 'c-partir',
      kind: 'choice',
      title: 'Repartir',
      label: 'Repartir',
      position: { x: 100, y: 100 },
      blocks: [],
      next: [{ id: 'suite', to: 'dehors' }],
    },
    salle: {
      id: 'salle',
      kind: 'npc',
      title: 'La salle',
      position: { x: 0, y: 200 },
      blocks: [{ text: 'La salle est vide.' }],
      next: [
        {
          id: 'payer',
          to: 'c-payer',
          condition: { op: 'gte', variable: 'or', value: 10 },
          effects: [
            { op: 'dec', variable: 'or', value: 10 },
            { op: 'removeItem', item: 'cle-rouillee' },
          ],
        },
      ],
    },
    'c-payer': {
      id: 'c-payer',
      kind: 'choice',
      title: 'Payer le passeur',
      label: 'Payer le passeur',
      position: { x: 0, y: 300 },
      blocks: [],
      next: [{ id: 'suite', to: 'dehors' }],
    },
    dehors: {
      id: 'dehors',
      kind: 'npc',
      title: 'Dehors',
      position: { x: 0, y: 400 },
      blocks: [{ text: 'Le jour se leve.' }],
      next: [],
      ending: { type: 'Fin', name: 'Dehors', blurb: 'Tu ressors.' },
    },
  },
};

describe('StoryEngine — construction', () => {
  it('starts on the start scene with a fresh state', () => {
    const e = engine();
    expect(e.state.currentSceneId).toBe('start');
    expect(e.state.history).toEqual([]);
    expect(e.state.visited).toEqual(['start']);
    expect(e.getCurrentScene().title).toBe('Le sentier');
  });

  it('copies the initial story variables without touching them', () => {
    const e = new StoryEngine(testStory, { now: fakeClock().now });
    expect(e.state.variables).toEqual({ cle: false, or: 0 });
    play(e, 'soulever');
    expect(testStory.variables).toEqual({ cle: false, or: 0 });
  });

  it('validates the story by default and refuses an inconsistent document', () => {
    const broken = JSON.parse(JSON.stringify(clairiereStory)) as Story;
    broken.startSceneId = 'nulle-part';
    expect(() => new StoryEngine(broken)).toThrow();
  });

  it('accepts an invalid story when validation is disabled', () => {
    const draft = JSON.parse(JSON.stringify(clairiereStory)) as Story;
    draft.scenes.start!.next[0]!.to = 'pas-encore-ecrite';
    expect(() => new StoryEngine(draft, { validate: false })).not.toThrow();
  });

  it('refuses a state belonging to another story', () => {
    const foreign = { ...createInitialState(clairiereStory), storyId: 'autre-recit' };
    expect(() => new StoryEngine(clairiereStory, { state: foreign })).toThrow(EngineError);
  });

  it('fromJson opens a serialized story', () => {
    const e = StoryEngine.fromJson(JSON.stringify(clairiereStory));
    expect(e.story.id).toBe('clairiere-lucioles');
  });
});

describe('StoryEngine — resolved scene', () => {
  it('only exposes choices whose condition is satisfied', () => {
    const e = new StoryEngine(testStory, { now: fakeClock().now });
    expect(e.getAvailableChoices().map((c) => c.id)).toEqual(['soulever', 'partir']);
    expect(e.getCurrentScene().allChoices.map((c) => c.available)).toEqual([true, false, true]);
  });

  it('takes the button label from the target choice node', () => {
    const e = new StoryEngine(testStory, { now: fakeClock().now });
    expect(e.getAvailableChoices().map((c) => c.label)).toEqual(['Soulever le tapis', 'Repartir']);
  });

  it('makes a conditional choice available once its condition holds', () => {
    const e = new StoryEngine(testStory, { now: fakeClock().now });
    play(e, 'soulever');
    expect(e.getAvailableChoices().map((c) => c.id)).toEqual(['soulever', 'ouvrir', 'partir']);
    expect(e.canChoose('ouvrir')).toBe(true);
  });

  it('offers no choice on a terminal scene', () => {
    const e = new StoryEngine(testStory, { now: fakeClock().now });
    play(e, 'partir');
    expect(e.isEnded).toBe(true);
    expect(e.getAvailableChoices()).toEqual([]);
    expect(e.getCurrentScene().ending?.name).toBe('Dehors');
  });

  it('exposes the node kind and who speaks in it', () => {
    const e = engine();
    expect(e.getCurrentScene().kind).toBe('npc');
    expect(e.getCurrentScene().speaker).toBe('narrator');
    e.choose('vers-lucioles');
    expect(e.getCurrentScene().kind).toBe('choice');
    expect(e.getCurrentScene().speaker).toBe('player');
  });

  it('exposes the conditional path of the sample story', () => {
    const e = engine();
    // Without the cautious detour, Elara's shortcut does not exist.
    play(e, 'vers-lucioles');
    expect(e.getAvailableChoices().map((c) => c.id)).toEqual(['vers-franchir', 'vers-attendre']);

    const detour = engine();
    play(detour, 'vers-arbre');
    play(detour, 'vers-redescendre');
    expect(detour.getAvailableChoices().map((c) => c.id)).toEqual([
      'vers-franchir',
      'vers-attendre',
      'vers-elara',
    ]);
  });
});

describe('StoryEngine — automatic chaining', () => {
  it('only awaits a decision in front of choice nodes', () => {
    const e = engine();
    expect(e.getCurrentScene().awaitsChoice).toBe(true);
    expect(e.canAdvance()).toBe(false);

    e.choose('vers-lucioles');
    // On the choice node itself: nothing to decide, the story carries on.
    expect(e.getCurrentScene().awaitsChoice).toBe(false);
    expect(e.canAdvance()).toBe(true);
  });

  it('advances one node at a time, so each one can be displayed', () => {
    const e = engine();
    play(e, 'vers-arbre');
    e.choose('vers-redescendre');

    expect(e.state.currentSceneId).toBe('c-redescendre');
    expect(e.advance()).toBe(true);
    // A line from the player, asking for nothing.
    expect(e.state.currentSceneId).toBe('prudence');
    expect(e.getCurrentScene().kind).toBe('player');
    expect(e.advance()).toBe(true);
    // ...and reaching an npc node without going through a choice.
    expect(e.state.currentSceneId).toBe('lucioles');
    expect(e.advance()).toBe(false);
  });

  it('does not cross a link whose condition is not satisfied', () => {
    const gated: Story = {
      ...testStory,
      id: 'garde',
      startSceneId: 'depart',
      variables: { ouvert: false },
      scenes: {
        depart: {
          id: 'depart',
          kind: 'npc',
          title: 'Depart',
          position: { x: 0, y: 0 },
          blocks: [{ text: 'Hm.' }],
          next: [
            { id: 'ferme', to: 'fin', condition: { op: 'eq', variable: 'ouvert', value: true } },
          ],
        },
        fin: {
          id: 'fin',
          kind: 'npc',
          title: 'Fin',
          position: { x: 0, y: 100 },
          blocks: [{ text: '.' }],
          next: [],
          ending: { type: 'Fin', name: 'Fin', blurb: '.' },
        },
      },
    };
    const e = new StoryEngine(gated, { now: fakeClock().now });
    expect(e.advance()).toBe(false);
    expect(e.state.currentSceneId).toBe('depart');
  });

  it('does not move from an ending', () => {
    const e = new StoryEngine(testStory, { now: fakeClock().now });
    play(e, 'partir');
    expect(e.advance()).toBe(false);
  });

  it('refuses to "choose" a link that is plain chaining', () => {
    const e = engine();
    e.choose('vers-lucioles');
    try {
      e.choose('suite');
      expect.unreachable('chaining is not a choice');
    } catch (error) {
      expect((error as EngineError).code).toBe('not-a-choice');
    }
  });
});

describe('StoryEngine — progression', () => {
  it('advances, applies effects and records the history', () => {
    const e = new StoryEngine(testStory, { now: fakeClock().now });
    e.choose('soulever');

    // The effects belong to the link taken, so they apply on the press.
    expect(e.state.variables).toEqual({ cle: true, or: 10 });
    expect(e.state.inventory).toEqual({ 'cle-rouillee': 1 });
    expect(e.state.history).toEqual([{ sceneId: 'hall', linkId: 'soulever' }]);

    // The chaining from the choice node to its continuation is a separate step.
    e.advance();
    expect(e.state.history).toEqual([
      { sceneId: 'hall', linkId: 'soulever' },
      { sceneId: 'c-soulever', linkId: 'suite' },
    ]);
  });

  it('adds a scene to `visited` only once', () => {
    const e = new StoryEngine(testStory, { now: fakeClock().now });
    play(e, 'soulever');
    play(e, 'soulever');
    expect(e.state.visited).toEqual(['hall', 'c-soulever']);
    expect(e.state.history).toHaveLength(4);
  });

  it('throws on an unknown link', () => {
    const e = engine();
    expect(() => e.choose('inexistant')).toThrow(EngineError);
    try {
      e.choose('inexistant');
    } catch (error) {
      expect((error as EngineError).code).toBe('unknown-choice');
    }
  });

  it('throws on a choice whose condition is not satisfied', () => {
    const e = new StoryEngine(testStory, { now: fakeClock().now });
    try {
      e.choose('ouvrir');
      expect.unreachable('le choix ne devrait pas passer');
    } catch (error) {
      expect((error as EngineError).code).toBe('choice-unavailable');
    }
    // The state has not moved.
    expect(e.state.currentSceneId).toBe('hall');
    expect(e.state.history).toEqual([]);
  });

  it('updates updatedAt on every transition', () => {
    const clock = fakeClock();
    const e = new StoryEngine(testStory, { now: clock.now });
    const before = e.state.updatedAt;
    clock.advance();
    e.choose('soulever');
    expect(e.state.updatedAt).not.toBe(before);
    expect(e.state.startedAt).toBe(before);
  });
});

describe('StoryEngine — going back', () => {
  it('undoes effects exactly by replaying the history', () => {
    const e = new StoryEngine(testStory, { now: fakeClock().now });
    play(e, 'soulever');
    play(e, 'ouvrir');
    play(e, 'payer');

    expect(e.state.currentSceneId).toBe('dehors');
    expect(e.state.variables.or).toBe(0);
    expect(e.state.inventory).toEqual({});

    e.goBack();
    expect(e.state.currentSceneId).toBe('salle');
    expect(e.state.variables.or).toBe(10);
    expect(e.state.inventory).toEqual({ 'cle-rouillee': 1 });

    e.goBack();
    expect(e.state.currentSceneId).toBe('hall');
    expect(e.state.variables).toEqual({ cle: true, or: 10 });
  });

  it('goes back to the last choice, not the last node walked through', () => {
    // The cautious detour chains choice → line → scene: going back must land
    // in front of the choice, not in the middle of the chain.
    const e = engine();
    play(e, 'vers-arbre');
    play(e, 'vers-redescendre');
    expect(e.state.currentSceneId).toBe('lucioles');

    e.goBack();
    expect(e.state.currentSceneId).toBe('arbre');
    expect(e.getAvailableChoices().map((c) => c.id)).toEqual(['vers-sauter', 'vers-redescendre']);
  });

  it('undoes a set correctly, where naive inversion would break', () => {
    const toggleStory: Story = {
      ...testStory,
      id: 'toggle-story',
      startSceneId: 'a',
      variables: { flag: true },
      scenes: {
        a: {
          id: 'a',
          kind: 'npc',
          title: 'A',
          position: { x: 0, y: 0 },
          blocks: [{ text: 'A' }],
          next: [
            { id: 'go', to: 'c-go', effects: [{ op: 'set', variable: 'flag', value: false }] },
          ],
        },
        'c-go': {
          id: 'c-go',
          kind: 'choice',
          title: 'Aller',
          label: 'Aller',
          position: { x: 0, y: 50 },
          blocks: [],
          next: [{ id: 'suite', to: 'b' }],
        },
        b: {
          id: 'b',
          kind: 'npc',
          title: 'B',
          position: { x: 0, y: 100 },
          blocks: [{ text: 'B' }],
          next: [],
          ending: { type: 'Fin', name: 'B', blurb: 'B.' },
        },
      },
    };
    const e = new StoryEngine(toggleStory, { now: fakeClock().now });
    play(e, 'go');
    expect(e.state.variables.flag).toBe(false);
    e.goBack();
    expect(e.state.variables.flag).toBe(true);
  });

  it('keeps startedAt when going back', () => {
    const e = new StoryEngine(testStory, { now: fakeClock().now });
    const started = e.state.startedAt;
    play(e, 'soulever');
    e.goBack();
    expect(e.state.startedAt).toBe(started);
  });

  it('throws when there is nothing to undo', () => {
    const e = engine();
    expect(e.canGoBack()).toBe(false);
    expect(() => e.goBack()).toThrow(EngineError);
  });
});

describe('StoryEngine — reset and resume', () => {
  it('reset returns to the start scene and clears the state', () => {
    const e = new StoryEngine(testStory, { now: fakeClock().now });
    play(e, 'soulever');
    e.reset();
    expect(e.state.currentSceneId).toBe('hall');
    expect(e.state.variables).toEqual({ cle: false, or: 0 });
    expect(e.state.history).toEqual([]);
  });

  it('loadState resumes a run', () => {
    const source = new StoryEngine(testStory, { now: fakeClock().now });
    play(source, 'soulever');
    const saved = source.state;

    const target = new StoryEngine(testStory, { now: fakeClock().now });
    target.loadState(saved);
    expect(target.state).toEqual(saved);
    expect(target.getAvailableChoices().map((c) => c.id)).toContain('ouvrir');
  });

  it('loadState refuses a save from another story', () => {
    const e = new StoryEngine(testStory, { now: fakeClock().now });
    expect(() => e.loadState(createInitialState(clairiereStory))).toThrow(EngineError);
  });

  it('refuses a save pointing at a scene that is gone', () => {
    const saved = { ...createInitialState(testStory), currentSceneId: 'cave' };
    expect(() => new StoryEngine(testStory, { state: saved })).toThrow(EngineError);
  });
});

describe('StoryEngine — serialization', () => {
  it('round-trips without loss', () => {
    const e = new StoryEngine(testStory, { now: fakeClock().now });
    play(e, 'soulever');
    play(e, 'ouvrir');

    const restored = deserializeState(e.serialize());
    expect(restored).toEqual(e.state);

    const resumed = new StoryEngine(testStory, { state: restored, now: fakeClock().now });
    expect(resumed.getCurrentScene().id).toBe('salle');
    expect(resumed.getAvailableChoices().map((c) => c.id)).toEqual(['payer']);
  });

  it('rejects a malformed save', () => {
    expect(() => deserializeState('{"storyId":"x"}')).toThrow();
    expect(() => deserializeState('pas du json')).toThrow();
  });

  it('inspectState reports another story, a missing scene, a stale version', () => {
    const state = createInitialState(testStory);
    expect(inspectState(testStory, state)).toEqual({ resumable: true, staleVersion: false });

    expect(inspectState(clairiereStory, state).resumable).toBe(false);
    expect(inspectState(testStory, { ...state, currentSceneId: 'cave' }).resumable).toBe(false);
    expect(inspectState(testStory, { ...state, storyVersion: '0.0.1' })).toEqual({
      resumable: true,
      staleVersion: true,
    });
  });
});

describe('StoryEngine — events', () => {
  let e: StoryEngine;

  beforeEach(() => {
    e = new StoryEngine(testStory, { now: fakeClock().now });
  });

  it('notifies raw subscribers on every state change', () => {
    const listener = vi.fn();
    const unsubscribe = e.subscribe(listener);
    e.choose('soulever');
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    e.advance();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('exposes detachable subscribe and getSnapshot, as useSyncExternalStore passes them', () => {
    const { subscribe, getSnapshot } = e;
    const listener = vi.fn();
    subscribe(listener);
    expect(getSnapshot().scene.id).toBe('hall');
    e.choose('soulever');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getSnapshot().state.variables.cle).toBe(true);
  });

  it('exposes a snapshot whose reference only changes with the state', () => {
    const first = e.getSnapshot();
    expect(e.getSnapshot()).toBe(first);
    e.choose('soulever');
    expect(e.getSnapshot()).not.toBe(first);
    expect(e.getSnapshot().state).toBe(e.state);
  });

  it('emits scene:changed only when the scene really changes', () => {
    const listener = vi.fn();
    e.on('scene:changed', listener);
    e.choose('soulever'); // hall -> c-soulever
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0]?.[0].previousSceneId).toBe('hall');
  });

  it('emits link:followed, distinguishing a decision from chaining', () => {
    const listener = vi.fn();
    e.on('link:followed', listener);
    e.choose('partir');
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'hall', to: 'c-partir', chosen: true }),
    );
    e.advance();
    expect(listener).toHaveBeenLastCalledWith(
      expect.objectContaining({ from: 'c-partir', to: 'dehors', chosen: false }),
    );
  });

  it('emits story:ended on arrival at an ending', () => {
    const listener = vi.fn();
    e.on('story:ended', listener);
    play(e, 'partir');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0]?.[0].ending.name).toBe('Dehors');
  });

  it('emits nothing after dispose', () => {
    const raw = vi.fn();
    const typed = vi.fn();
    e.subscribe(raw);
    e.on('state:changed', typed);
    e.dispose();
    e.choose('soulever');
    expect(raw).not.toHaveBeenCalled();
    expect(typed).not.toHaveBeenCalled();
  });

  it('once fires only once', () => {
    const listener = vi.fn();
    e.once('state:changed', listener);
    play(e, 'soulever');
    play(e, 'soulever');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('supports a listener unsubscribing during emission', () => {
    const second = vi.fn();
    const unsubscribeFirst = e.subscribe(() => unsubscribeFirst());
    e.subscribe(second);
    expect(() => e.choose('soulever')).not.toThrow();
    expect(second).toHaveBeenCalledTimes(1);
  });
});

describe('StoryEngine — the core stays agnostic', () => {
  it('needs no browser global', () => {
    // The engine runs here in Vitest's `node` environment: if an
    // implementation touched `window` or `localStorage`, this test would break.
    expect(typeof globalThis).toBe('object');
    expect('window' in globalThis).toBe(false);
    const e = engine();
    play(e, 'vers-arbre');
    expect(e.getCurrentScene().id).toBe('arbre');
  });
});

/**
 * The long sample story is the only one whose graph is too wide to be read by
 * eye. It is therefore played instead: the walk exercises every conditional
 * link and every convergence at once, and would catch a run that gets stuck on
 * a node offering nothing, or an ending only reachable on paper.
 */
describe('StoryEngine — the long sample story', () => {
  /** Seeded so a failure is reproducible; the walk must not depend on luck. */
  function randomWalk(seed: number): string {
    let state = seed;
    const nextInt = (bound: number): number => {
      state = (state * 1103515245 + 12345) % 2147483648;
      return state % bound;
    };

    const e = new StoryEngine(kerlavenStory, { validate: false });
    for (let steps = 0; steps < 500; steps += 1) {
      const scene = e.getCurrentScene();
      if (scene.isEnding) return scene.id;
      if (scene.awaitsChoice) {
        const open = scene.choices.filter((choice) => choice.available);
        expect(open.length, `aucun choix ouvert sur « ${scene.id} »`).toBeGreaterThan(0);
        e.choose(open[nextInt(open.length)]!.id);
      } else {
        expect(e.advance(), `lecture bloquee sur « ${scene.id} »`).toBe(true);
      }
    }
    throw new Error('la lecture ne se termine pas');
  }

  it('reaches each of its endings, and never gets stuck', () => {
    const reached = new Set<string>();
    for (let seed = 1; seed <= 1000; seed += 1) reached.add(randomWalk(seed));

    const declared = findEndings(kerlavenStory).map((scene) => scene.id);
    expect(declared.filter((id) => !reached.has(id))).toEqual([]);
  }, // A thousand walks through the long story: under coverage instrumentation
  // it runs several times slower than the default allowance.
  20_000);
});

describe('StoryEngine — variables inside the text', () => {
  /** Same sandbox, but writing what it holds instead of describing it. */
  const spokenStory: Story = {
    ...testStory,
    id: 'test-interpolation',
    variables: { cle: false, or: 0 },
    scenes: {
      ...testStory.scenes,
      hall: {
        ...testStory.scenes.hall!,
        blocks: [{ text: 'Tu as {{ or }} pieces.' }],
      },
      'c-payer': {
        ...testStory.scenes['c-payer']!,
        label: 'Payer les {{ or }} pieces',
      },
      dehors: {
        ...testStory.scenes.dehors!,
        ending: {
          type: 'Fin',
          name: 'Dehors avec {{ or }} pieces',
          blurb: 'Tu ressors avec {{ or }} pieces en poche.',
        },
      },
    },
  };

  it('fills the messages of the scene being played', () => {
    const e = new StoryEngine(spokenStory);
    expect(e.getCurrentScene().blocks[0]?.text).toBe('Tu as 0 pieces.');

    play(e, 'soulever');
    expect(e.getCurrentScene().blocks[0]?.text).toBe('Tu as 10 pieces.');
  });

  it('fills the label of a button', () => {
    const e = new StoryEngine(spokenStory);
    play(e, 'soulever');
    play(e, 'ouvrir');

    expect(e.getCurrentScene().choices.map((choice) => choice.label)).toEqual([
      'Payer les 10 pieces',
    ]);
  });

  it('fills the ending, which is read after the last effect has applied', () => {
    const e = new StoryEngine(spokenStory);
    play(e, 'soulever');
    play(e, 'ouvrir');
    play(e, 'payer');

    const scene = e.getCurrentScene();
    expect(scene.ending?.name).toBe('Dehors avec 0 pieces');
    expect(scene.ending?.blurb).toBe('Tu ressors avec 0 pieces en poche.');
  });

  it('does not touch the story it was given', () => {
    const e = new StoryEngine(spokenStory);
    play(e, 'soulever');

    // The document stays the document: only what is handed to the UI is filled.
    expect(spokenStory.scenes.hall?.blocks[0]?.text).toBe('Tu as {{ or }} pieces.');
    expect(e.story.scenes.hall?.blocks[0]?.text).toBe('Tu as {{ or }} pieces.');
  });
});
