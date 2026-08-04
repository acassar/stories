import { beforeEach, describe, expect, it, vi } from 'vitest';

import { STORY_FORMAT_VERSION, clairiereStory } from '@embranche/story-format';
import type { Story } from '@embranche/story-format';

import { StoryEngine } from './engine.js';
import { EngineError } from './errors.js';
import { createInitialState, deserializeState, inspectState } from './state.js';

/** Horloge figee, puis avancable, pour verifier `updatedAt` sans flakiness. */
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

/** Recit compact dedie aux tests de conditions, effets et inventaire. */
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
      title: 'Le hall',
      position: { x: 0, y: 0 },
      blocks: [{ text: 'Une porte close, un tapis suspect.' }],
      choices: [
        {
          id: 'soulever',
          label: 'Soulever le tapis',
          target: 'hall',
          effects: [
            { op: 'set', variable: 'cle', value: true },
            { op: 'addItem', item: 'cle-rouillee' },
            { op: 'inc', variable: 'or', value: 10 },
          ],
        },
        {
          id: 'ouvrir',
          label: 'Ouvrir la porte',
          target: 'salle',
          condition: { op: 'eq', variable: 'cle', value: true },
        },
        {
          id: 'partir',
          label: 'Repartir',
          target: 'dehors',
        },
      ],
    },
    salle: {
      id: 'salle',
      title: 'La salle',
      position: { x: 0, y: 200 },
      blocks: [{ text: 'La salle est vide.' }],
      choices: [
        {
          id: 'payer',
          label: 'Payer le passeur',
          target: 'dehors',
          condition: { op: 'gte', variable: 'or', value: 10 },
          effects: [
            { op: 'dec', variable: 'or', value: 10 },
            { op: 'removeItem', item: 'cle-rouillee' },
          ],
        },
      ],
    },
    dehors: {
      id: 'dehors',
      title: 'Dehors',
      position: { x: 0, y: 400 },
      blocks: [{ text: 'Le jour se leve.' }],
      choices: [],
      ending: { type: 'Fin', name: 'Dehors', blurb: 'Tu ressors.' },
    },
  },
};

describe('StoryEngine — construction', () => {
  it('demarre sur la scene de depart avec un etat neuf', () => {
    const e = engine();
    expect(e.state.currentSceneId).toBe('start');
    expect(e.state.history).toEqual([]);
    expect(e.state.visited).toEqual(['start']);
    expect(e.getCurrentScene().title).toBe('Le sentier');
  });

  it('recopie les variables initiales du recit sans y toucher', () => {
    const e = new StoryEngine(testStory, { now: fakeClock().now });
    expect(e.state.variables).toEqual({ cle: false, or: 0 });
    e.choose('soulever');
    expect(testStory.variables).toEqual({ cle: false, or: 0 });
  });

  it('valide le recit par defaut et refuse un document incoherent', () => {
    const broken = JSON.parse(JSON.stringify(clairiereStory)) as Story;
    broken.startSceneId = 'nulle-part';
    expect(() => new StoryEngine(broken)).toThrow();
  });

  it('accepte un recit non valide quand la validation est desactivee', () => {
    const draft = JSON.parse(JSON.stringify(clairiereStory)) as Story;
    draft.scenes.start!.choices[0]!.target = 'pas-encore-ecrite';
    expect(() => new StoryEngine(draft, { validate: false })).not.toThrow();
  });

  it('refuse un etat qui appartient a un autre recit', () => {
    const foreign = { ...createInitialState(clairiereStory), storyId: 'autre-recit' };
    expect(() => new StoryEngine(clairiereStory, { state: foreign })).toThrow(EngineError);
  });

  it('fromJson ouvre un recit serialise', () => {
    const e = StoryEngine.fromJson(JSON.stringify(clairiereStory));
    expect(e.story.id).toBe('clairiere-lucioles');
  });
});

describe('StoryEngine — scene resolue', () => {
  it('n’expose que les choix dont la condition est remplie', () => {
    const e = new StoryEngine(testStory, { now: fakeClock().now });
    expect(e.getAvailableChoices().map((c) => c.id)).toEqual(['soulever', 'partir']);
    expect(e.getCurrentScene().allChoices.map((c) => c.available)).toEqual([true, false, true]);
  });

  it('rend le choix conditionnel disponible une fois sa condition satisfaite', () => {
    const e = new StoryEngine(testStory, { now: fakeClock().now });
    e.choose('soulever');
    expect(e.getAvailableChoices().map((c) => c.id)).toEqual(['soulever', 'ouvrir', 'partir']);
    expect(e.canChoose('ouvrir')).toBe(true);
  });

  it('ne propose aucun choix sur une scene terminale', () => {
    const e = new StoryEngine(testStory, { now: fakeClock().now });
    e.choose('partir');
    expect(e.isEnded).toBe(true);
    expect(e.getAvailableChoices()).toEqual([]);
    expect(e.getCurrentScene().ending?.name).toBe('Dehors');
  });

  it('expose le chemin conditionnel du recit d’exemple', () => {
    const e = engine();
    // Sans le detour prudent, le raccourci d'Elara n'existe pas.
    e.choose('vers-lucioles');
    expect(e.getAvailableChoices().map((c) => c.id)).toEqual(['franchir', 'attendre']);

    const detour = engine();
    detour.choose('vers-arbre');
    detour.choose('redescendre');
    expect(detour.getAvailableChoices().map((c) => c.id)).toEqual([
      'franchir',
      'attendre',
      'demander-elara',
    ]);
  });
});

describe('StoryEngine — progression', () => {
  it('avance, applique les effets et enregistre l’historique', () => {
    const e = new StoryEngine(testStory, { now: fakeClock().now });
    e.choose('soulever');

    expect(e.state.variables).toEqual({ cle: true, or: 10 });
    expect(e.state.inventory).toEqual({ 'cle-rouillee': 1 });
    expect(e.state.history).toEqual([
      { sceneId: 'hall', choiceId: 'soulever', label: 'Soulever le tapis' },
    ]);
  });

  it('n’ajoute une scene a `visited` qu’une seule fois', () => {
    const e = new StoryEngine(testStory, { now: fakeClock().now });
    e.choose('soulever');
    e.choose('soulever');
    expect(e.state.visited).toEqual(['hall']);
    expect(e.state.history).toHaveLength(2);
  });

  it('leve sur un choix inconnu', () => {
    const e = engine();
    expect(() => e.choose('inexistant')).toThrow(EngineError);
    try {
      e.choose('inexistant');
    } catch (error) {
      expect((error as EngineError).code).toBe('unknown-choice');
    }
  });

  it('leve sur un choix dont la condition n’est pas remplie', () => {
    const e = new StoryEngine(testStory, { now: fakeClock().now });
    try {
      e.choose('ouvrir');
      expect.unreachable('le choix ne devrait pas passer');
    } catch (error) {
      expect((error as EngineError).code).toBe('choice-unavailable');
    }
    // L'etat n'a pas bouge.
    expect(e.state.currentSceneId).toBe('hall');
    expect(e.state.history).toEqual([]);
  });

  it('met a jour updatedAt a chaque transition', () => {
    const clock = fakeClock();
    const e = new StoryEngine(testStory, { now: clock.now });
    const before = e.state.updatedAt;
    clock.advance();
    e.choose('soulever');
    expect(e.state.updatedAt).not.toBe(before);
    expect(e.state.startedAt).toBe(before);
  });
});

describe('StoryEngine — retour en arriere', () => {
  it('annule exactement les effets en rejouant l’historique', () => {
    const e = new StoryEngine(testStory, { now: fakeClock().now });
    e.choose('soulever');
    e.choose('ouvrir');
    e.choose('payer');

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

  it('annule correctement un toggle, que l’inversion naive casserait', () => {
    const toggleStory: Story = {
      ...testStory,
      id: 'toggle-story',
      startSceneId: 'a',
      variables: { flag: true },
      scenes: {
        a: {
          id: 'a',
          title: 'A',
          position: { x: 0, y: 0 },
          blocks: [{ text: 'A' }],
          choices: [
            { id: 'go', label: 'Aller', target: 'b', effects: [{ op: 'set', variable: 'flag', value: false }] },
          ],
        },
        b: {
          id: 'b',
          title: 'B',
          position: { x: 0, y: 100 },
          blocks: [{ text: 'B' }],
          choices: [],
          ending: { type: 'Fin', name: 'B', blurb: 'B.' },
        },
      },
    };
    const e = new StoryEngine(toggleStory, { now: fakeClock().now });
    e.choose('go');
    expect(e.state.variables.flag).toBe(false);
    e.goBack();
    expect(e.state.variables.flag).toBe(true);
  });

  it('conserve startedAt lors du retour', () => {
    const e = new StoryEngine(testStory, { now: fakeClock().now });
    const started = e.state.startedAt;
    e.choose('soulever');
    e.goBack();
    expect(e.state.startedAt).toBe(started);
  });

  it('leve quand il n’y a rien a annuler', () => {
    const e = engine();
    expect(e.canGoBack()).toBe(false);
    expect(() => e.goBack()).toThrow(EngineError);
  });
});

describe('StoryEngine — reinitialisation et reprise', () => {
  it('reset ramene a la scene de depart et efface l’etat', () => {
    const e = new StoryEngine(testStory, { now: fakeClock().now });
    e.choose('soulever');
    e.reset();
    expect(e.state.currentSceneId).toBe('hall');
    expect(e.state.variables).toEqual({ cle: false, or: 0 });
    expect(e.state.history).toEqual([]);
  });

  it('loadState reprend une partie', () => {
    const source = new StoryEngine(testStory, { now: fakeClock().now });
    source.choose('soulever');
    const saved = source.state;

    const target = new StoryEngine(testStory, { now: fakeClock().now });
    target.loadState(saved);
    expect(target.state).toEqual(saved);
    expect(target.getAvailableChoices().map((c) => c.id)).toContain('ouvrir');
  });

  it('loadState refuse une sauvegarde d’un autre recit', () => {
    const e = new StoryEngine(testStory, { now: fakeClock().now });
    expect(() => e.loadState(createInitialState(clairiereStory))).toThrow(EngineError);
  });

  it('refuse une sauvegarde pointant une scene disparue', () => {
    const saved = { ...createInitialState(testStory), currentSceneId: 'cave' };
    expect(() => new StoryEngine(testStory, { state: saved })).toThrow(EngineError);
  });
});

describe('StoryEngine — serialisation', () => {
  it('fait un aller-retour sans perte', () => {
    const e = new StoryEngine(testStory, { now: fakeClock().now });
    e.choose('soulever');
    e.choose('ouvrir');

    const restored = deserializeState(e.serialize());
    expect(restored).toEqual(e.state);

    const resumed = new StoryEngine(testStory, { state: restored, now: fakeClock().now });
    expect(resumed.getCurrentScene().id).toBe('salle');
    expect(resumed.getAvailableChoices().map((c) => c.id)).toEqual(['payer']);
  });

  it('rejette une sauvegarde mal formee', () => {
    expect(() => deserializeState('{"storyId":"x"}')).toThrow();
    expect(() => deserializeState('pas du json')).toThrow();
  });

  it('inspectState signale un recit different, une scene disparue, une version obsolete', () => {
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

describe('StoryEngine — evenements', () => {
  let e: StoryEngine;

  beforeEach(() => {
    e = new StoryEngine(testStory, { now: fakeClock().now });
  });

  it('previent les abonnes bruts a chaque changement d’etat', () => {
    const listener = vi.fn();
    const unsubscribe = e.subscribe(listener);
    e.choose('soulever');
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    e.choose('soulever');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('expose un instantane dont la reference ne change qu’avec l’etat', () => {
    const first = e.getSnapshot();
    expect(e.getSnapshot()).toBe(first);
    e.choose('soulever');
    expect(e.getSnapshot()).not.toBe(first);
    expect(e.getSnapshot().state).toBe(e.state);
  });

  it('emet scene:changed uniquement quand la scene change vraiment', () => {
    const listener = vi.fn();
    e.on('scene:changed', listener);
    e.choose('soulever'); // hall -> hall
    expect(listener).not.toHaveBeenCalled();
    e.choose('ouvrir'); // hall -> salle
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0]?.[0].previousSceneId).toBe('hall');
  });

  it('emet choice:applied avec le choix, l’origine et la destination', () => {
    const listener = vi.fn();
    e.on('choice:applied', listener);
    e.choose('partir');
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'hall', to: 'dehors' }),
    );
  });

  it('emet story:ended a l’arrivee sur une fin', () => {
    const listener = vi.fn();
    e.on('story:ended', listener);
    e.choose('partir');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0]?.[0].ending.name).toBe('Dehors');
  });

  it('n’emet rien apres dispose', () => {
    const raw = vi.fn();
    const typed = vi.fn();
    e.subscribe(raw);
    e.on('state:changed', typed);
    e.dispose();
    e.choose('soulever');
    expect(raw).not.toHaveBeenCalled();
    expect(typed).not.toHaveBeenCalled();
  });

  it('once ne se declenche qu’une fois', () => {
    const listener = vi.fn();
    e.once('state:changed', listener);
    e.choose('soulever');
    e.choose('soulever');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('supporte qu’un abonne se desabonne pendant l’emission', () => {
    const second = vi.fn();
    const unsubscribeFirst = e.subscribe(() => unsubscribeFirst());
    e.subscribe(second);
    expect(() => e.choose('soulever')).not.toThrow();
    expect(second).toHaveBeenCalledTimes(1);
  });
});

describe('StoryEngine — le coeur reste agnostique', () => {
  it('n’a besoin d’aucun global navigateur', () => {
    // Le moteur tourne ici dans l'environnement `node` de Vitest : si une
    // implementation touchait a `window` ou `localStorage`, ce test casserait.
    expect(typeof globalThis).toBe('object');
    expect('window' in globalThis).toBe(false);
    const e = engine();
    e.choose('vers-arbre');
    expect(e.getCurrentScene().id).toBe('arbre');
  });
});
