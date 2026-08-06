import { beforeEach, describe, expect, it } from 'vitest';

import { clairiereStory, createEmptyStory, exampleStories } from '@embranche/story-format';

import { createLocalRepository, importStoryFile, seedIfEmpty } from './storage';

/** Minimal `Storage` implementation, to avoid depending on the jsdom global. */
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

  it('saves then reads a story back', () => {
    const repository = createLocalRepository(storage);
    repository.save(clairiereStory);
    expect(repository.list()).toEqual([clairiereStory]);
  });

  it('replaces an existing story rather than stacking it', () => {
    const repository = createLocalRepository(storage);
    repository.save(clairiereStory);
    repository.save({ ...clairiereStory, title: 'Titre revu' });
    const stored = repository.list();
    expect(stored).toHaveLength(1);
    expect(stored[0]?.title).toBe('Titre revu');
  });

  it('deletes', () => {
    const repository = createLocalRepository(storage);
    repository.save(clairiereStory);
    repository.remove(clairiereStory.id);
    expect(repository.list()).toEqual([]);
  });

  it('survives corrupted content rather than bringing the studio down', () => {
    storage.setItem('embranche.studio.stories.v1', 'ceci n’est pas du json');
    expect(createLocalRepository(storage).list()).toEqual([]);
  });

  it('keeps an inconsistent draft: work in progress is never erased', () => {
    const repository = createLocalRepository(storage);
    const draft = createEmptyStory();
    draft.startSceneId = 'pas-encore-ecrite';
    repository.save(draft);
    expect(repository.list()).toHaveLength(1);
  });

  it('seeds the library on first launch, then leaves it alone', () => {
    const repository = createLocalRepository(storage);
    expect(seedIfEmpty(repository)).toHaveLength(exampleStories.length);
    repository.remove(clairiereStory.id);
    expect(seedIfEmpty(repository)).toHaveLength(exampleStories.length - 1);
  });
});

describe('importStoryFile', () => {
  const asFile = (content: string) =>
    new File([content], 'histoire.json', { type: 'application/json' });

  it('accepts a studio export', async () => {
    const result = await importStoryFile(asFile(JSON.stringify(clairiereStory)));
    expect(result.error).toBeUndefined();
    expect(result.story?.id).toBe('clairiere-lucioles');
  });

  it('refuses unreadable JSON', async () => {
    expect((await importStoryFile(asFile('{ oups'))).error).toMatch(/JSON/);
  });

  it('refuses an inconsistent story', async () => {
    const broken = { ...structuredClone(clairiereStory), startSceneId: 'nulle-part' };
    const result = await importStoryFile(asFile(JSON.stringify(broken)));
    expect(result.story).toBeUndefined();
    expect(result.error).toContain('refusée');
  });
});
