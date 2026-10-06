import { beforeEach, describe, expect, it } from 'vitest';

import { StoryEngine } from '@embranche/story-engine';
import { createEmptyStory, validateStory } from '@embranche/story-format';
import { clairiereStory, fixtureStories } from '@embranche/story-format/fixtures';

import {
  clearSave,
  countEndings,
  loadEndings,
  loadLibrary,
  loadSave,
  recordEnding,
  removeStory,
  SHIPPED_STORIES,
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

/** A full turn: the player presses, then the story unrolls until it stops. */
function play(engine: StoryEngine, linkId: string): void {
  engine.choose(linkId);
  for (let steps = 0; steps < 50 && engine.advance(); steps += 1);
}

let storage: Storage;

beforeEach(() => {
  storage = memoryStorage();
});

/** The library as it would read with the test stories built into the app. */
const withShipped = () => loadLibrary(storage, fixtureStories);

describe('library', () => {
  it('ships Vaelmont, and nothing else', () => {
    expect(loadLibrary(storage).map((story) => story.id)).toEqual(['vaelmont']);
  });

  it('ships only stories without a single issue', () => {
    for (const story of SHIPPED_STORIES) expect(validateStory(story).issues).toEqual([]);
  });

  it('lists the shipped stories first', () => {
    expect(withShipped().map((story) => story.id)).toEqual(fixtureStories.map((story) => story.id));
  });

  it('adds an imported story', () => {
    saveImportedStory(
      createEmptyStory({ id: 'venue-du-studio', title: 'Venue du studio' }),
      storage,
    );
    const titles = withShipped().map((story) => story.title);
    expect(titles).toContain('Venue du studio');
    expect(titles).toHaveLength(fixtureStories.length + 1);
  });

  it('an import replaces the shipped story sharing its id rather than duplicating it', () => {
    saveImportedStory({ ...structuredClone(clairiereStory), title: 'Version révisée' }, storage);
    const library = withShipped();
    expect(library).toHaveLength(fixtureStories.length);
    expect(library.find((story) => story.id === 'clairiere-lucioles')?.title).toBe(
      'Version révisée',
    );
  });

  it('ignores a stored story that has become invalid', () => {
    storage.setItem('embranche.reader.stories.v1', JSON.stringify([{ id: 'cassee' }]));
    expect(loadLibrary(storage, [])).toEqual([]);
  });
});

describe('saves', () => {
  it('saves, reads back and clears a run', () => {
    const engine = new StoryEngine(clairiereStory);
    engine.choose('vers-arbre');

    writeSave(engine.state, storage);
    const restored = loadSave('clairiere-lucioles', storage);
    expect(restored).toEqual(engine.state);

    clearSave('clairiere-lucioles', storage);
    expect(loadSave('clairiere-lucioles', storage)).toBeNull();
  });

  it('resumes exactly where the run stopped', () => {
    const engine = new StoryEngine(clairiereStory);
    play(engine, 'vers-arbre');
    play(engine, 'vers-redescendre');
    writeSave(engine.state, storage);

    const saved = loadSave('clairiere-lucioles', storage);
    const resumed = new StoryEngine(clairiereStory, { state: saved! });
    expect(resumed.getCurrentScene().id).toBe('lucioles');
    // The conditional choice earned by the detour is still there.
    expect(resumed.getAvailableChoices().map((c) => c.id)).toContain('vers-elara');
  });

  it('ignores an unreadable save rather than blocking the story', () => {
    storage.setItem(
      'embranche.reader.saves.v1',
      JSON.stringify({ 'clairiere-lucioles': { nawak: true } }),
    );
    expect(loadSave('clairiere-lucioles', storage)).toBeNull();
  });
});

describe('record', () => {
  it('accumulates seen endings without duplicates', () => {
    recordEnding('clairiere-lucioles', 'portail', storage);
    recordEnding('clairiere-lucioles', 'portail', storage);
    const endings = recordEnding('clairiere-lucioles', 'attente', storage);
    expect(endings['clairiere-lucioles']).toEqual(['portail', 'attente']);
    expect(loadEndings(storage)).toEqual(endings);
  });

  it('counts the endings of the story', () => {
    expect(countEndings(clairiereStory)).toBe(3);
  });
});

describe('removeStory', () => {
  it('takes a shipped story out of the library, for good', () => {
    expect(withShipped().map((s) => s.id)).toContain('clairiere-lucioles');

    removeStory('clairiere-lucioles', storage);

    // A shipped story comes with the app: without a record of the dismissal it
    // would simply reappear on the next load.
    expect(withShipped().map((s) => s.id)).not.toContain('clairiere-lucioles');
  });

  it('takes the run and the endings found with it', () => {
    const engine = new StoryEngine(clairiereStory);
    play(engine, 'vers-arbre');
    writeSave(engine.state, storage);
    recordEnding('clairiere-lucioles', 'portail', storage);

    removeStory('clairiere-lucioles', storage);

    expect(loadSave('clairiere-lucioles', storage)).toBeNull();
    expect(loadEndings(storage)['clairiere-lucioles']).toBeUndefined();
  });

  it('brings the story back when it is imported again', () => {
    removeStory('clairiere-lucioles', storage);
    saveImportedStory(clairiereStory, storage);

    expect(withShipped().map((s) => s.id)).toContain('clairiere-lucioles');
  });

  it('leaves the other stories alone', () => {
    removeStory('clairiere-lucioles', storage);

    const left = withShipped().map((s) => s.id);
    expect(left).toHaveLength(fixtureStories.length - 1);
    expect(left).not.toContain('clairiere-lucioles');
  });
});
