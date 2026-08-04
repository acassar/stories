import { beforeEach, describe, expect, it } from 'vitest';

import { clairiereStory, createEmptyStory } from '@embranche/story-format';

import { createLocalRepository, importStoryFile, seedIfEmpty } from './storage';

/** Implementation minimale de `Storage`, pour ne pas dependre du jsdom global. */
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

describe('createLocalRepository', () => {
  let storage: Storage;

  beforeEach(() => {
    storage = memoryStorage();
  });

  it('enregistre puis relit une histoire', () => {
    const repository = createLocalRepository(storage);
    repository.save(clairiereStory);
    expect(repository.list()).toEqual([clairiereStory]);
  });

  it('remplace une histoire existante plutot que de l’empiler', () => {
    const repository = createLocalRepository(storage);
    repository.save(clairiereStory);
    repository.save({ ...clairiereStory, title: 'Titre revu' });
    const stored = repository.list();
    expect(stored).toHaveLength(1);
    expect(stored[0]?.title).toBe('Titre revu');
  });

  it('supprime', () => {
    const repository = createLocalRepository(storage);
    repository.save(clairiereStory);
    repository.remove(clairiereStory.id);
    expect(repository.list()).toEqual([]);
  });

  it('survit a un contenu corrompu plutot que de faire tomber le studio', () => {
    storage.setItem('embranche.studio.stories.v1', 'ceci n’est pas du json');
    expect(createLocalRepository(storage).list()).toEqual([]);
  });

  it('conserve un brouillon incoherent : on n’efface pas le travail en cours', () => {
    const repository = createLocalRepository(storage);
    const draft = createEmptyStory();
    draft.startSceneId = 'pas-encore-ecrite';
    repository.save(draft);
    expect(repository.list()).toHaveLength(1);
  });

  it('amorce la bibliotheque au premier lancement, puis n’y touche plus', () => {
    const repository = createLocalRepository(storage);
    expect(seedIfEmpty(repository)).toHaveLength(4);
    repository.remove(clairiereStory.id);
    expect(seedIfEmpty(repository)).toHaveLength(3);
  });
});

describe('importStoryFile', () => {
  const asFile = (content: string) => new File([content], 'histoire.json', { type: 'application/json' });

  it('accepte un export du studio', async () => {
    const result = await importStoryFile(asFile(JSON.stringify(clairiereStory)));
    expect(result.error).toBeUndefined();
    expect(result.story?.id).toBe('clairiere-lucioles');
  });

  it('refuse un JSON illisible', async () => {
    expect((await importStoryFile(asFile('{ oups'))).error).toMatch(/JSON/);
  });

  it('refuse une histoire incoherente', async () => {
    const broken = { ...structuredClone(clairiereStory), startSceneId: 'nulle-part' };
    const result = await importStoryFile(asFile(JSON.stringify(broken)));
    expect(result.story).toBeUndefined();
    expect(result.error).toContain('refusée');
  });
});
