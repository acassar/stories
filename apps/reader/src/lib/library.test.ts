import { beforeEach, describe, expect, it } from 'vitest';

import { StoryEngine } from '@embranche/story-engine';
import { clairiereStory, createEmptyStory } from '@embranche/story-format';

import {
  clearSave,
  countEndings,
  loadEndings,
  loadLibrary,
  loadSave,
  recordEnding,
  saveImportedStory,
  writeSave,
} from './library';

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key) => map.get(key) ?? null,
    key: (index) => [...map.keys()][index] ?? null,
    removeItem: (key) => void map.delete(key),
    setItem: (key, value) => void map.set(key, value),
  };
}

let storage: Storage;

beforeEach(() => {
  storage = memoryStorage();
});

describe('bibliotheque', () => {
  it('livre les recits d’exemple par defaut', () => {
    expect(loadLibrary(storage).map((story) => story.id)).toEqual([
      'clairiere-lucioles',
      'dossier-verlaine',
      'appel-des-cimes',
      'numero-inconnu',
    ]);
  });

  it('ajoute une histoire importee', () => {
    saveImportedStory(
      createEmptyStory({ id: 'venue-du-studio', title: 'Venue du studio' }),
      storage,
    );
    const titles = loadLibrary(storage).map((story) => story.title);
    expect(titles).toContain('Venue du studio');
    expect(titles).toHaveLength(5);
  });

  it('un import remplace l’exemple de meme identifiant plutot que de le doubler', () => {
    saveImportedStory({ ...structuredClone(clairiereStory), title: 'Version révisée' }, storage);
    const library = loadLibrary(storage);
    expect(library).toHaveLength(4);
    expect(library.find((story) => story.id === 'clairiere-lucioles')?.title).toBe(
      'Version révisée',
    );
  });

  it('ignore une histoire stockee devenue invalide', () => {
    storage.setItem('embranche.reader.stories.v1', JSON.stringify([{ id: 'cassee' }]));
    expect(loadLibrary(storage)).toHaveLength(4);
  });
});

describe('sauvegardes', () => {
  it('enregistre, relit et efface une partie', () => {
    const engine = new StoryEngine(clairiereStory);
    engine.choose('vers-arbre');

    writeSave(engine.state, storage);
    const restored = loadSave('clairiere-lucioles', storage);
    expect(restored).toEqual(engine.state);

    clearSave('clairiere-lucioles', storage);
    expect(loadSave('clairiere-lucioles', storage)).toBeNull();
  });

  it('permet de reprendre exactement ou on s’etait arrete', () => {
    const engine = new StoryEngine(clairiereStory);
    engine.choose('vers-arbre');
    engine.choose('redescendre');
    writeSave(engine.state, storage);

    const saved = loadSave('clairiere-lucioles', storage);
    const resumed = new StoryEngine(clairiereStory, { state: saved! });
    expect(resumed.getCurrentScene().id).toBe('lucioles');
    // Le choix conditionnel obtenu par le detour est toujours la.
    expect(resumed.getAvailableChoices().map((c) => c.id)).toContain('demander-elara');
  });

  it('ignore une sauvegarde illisible plutot que de bloquer le recit', () => {
    storage.setItem(
      'embranche.reader.saves.v1',
      JSON.stringify({ 'clairiere-lucioles': { nawak: true } }),
    );
    expect(loadSave('clairiere-lucioles', storage)).toBeNull();
  });
});

describe('palmares', () => {
  it('accumule les fins vues sans doublon', () => {
    recordEnding('clairiere-lucioles', 'portail', storage);
    recordEnding('clairiere-lucioles', 'portail', storage);
    const endings = recordEnding('clairiere-lucioles', 'attente', storage);
    expect(endings['clairiere-lucioles']).toEqual(['portail', 'attente']);
    expect(loadEndings(storage)).toEqual(endings);
  });

  it('compte les fins du recit', () => {
    expect(countEndings(clairiereStory)).toBe(3);
  });
});
