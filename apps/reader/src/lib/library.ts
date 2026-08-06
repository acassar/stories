/**
 * Reader library and saves.
 *
 * As on the studio side, `localStorage` lives here and nowhere else: the engine
 * knows nothing of persistence, it is injected into it.
 */

import {
  exampleStories,
  migrateStory,
  parseGameState,
  validateStory,
} from '@embranche/story-format';
import type { GameState, Story } from '@embranche/story-format';

const IMPORTED_KEY = 'embranche.reader.stories.v1';
const SAVES_KEY = 'embranche.reader.saves.v1';
const ENDINGS_KEY = 'embranche.reader.endings.v1';

function read<T>(storage: Storage, key: string, fallback: T): T {
  const raw = storage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/**
 * Available stories: those shipped with the app, plus those imported from JSON
 * produced by the studio. An import replaces the sample sharing its id.
 */
export function loadLibrary(storage: Storage = window.localStorage): Story[] {
  // A file imported under an older format stays playable: it is migrated on
  // read rather than left to disappear from the library.
  const imported = read<unknown[]>(storage, IMPORTED_KEY, [])
    .map(migrateStory)
    .filter((candidate): candidate is Story => validateStory(candidate).valid);
  const byId = new Map<string, Story>();
  for (const story of exampleStories) byId.set(story.id, story);
  for (const story of imported) byId.set(story.id, story);
  return [...byId.values()];
}

export function saveImportedStory(story: Story, storage: Storage = window.localStorage): void {
  const imported = read<Story[]>(storage, IMPORTED_KEY, []).filter((item) => item.id !== story.id);
  storage.setItem(IMPORTED_KEY, JSON.stringify([...imported, story]));
}

// --------------------------------------------------------------------- saves

export function loadSave(
  storyId: string,
  storage: Storage = window.localStorage,
): GameState | null {
  const saves = read<Record<string, unknown>>(storage, SAVES_KEY, {});
  const raw = saves[storyId];
  if (!raw) return null;
  try {
    return parseGameState(raw);
  } catch {
    // A save from an older format must not prevent playing again.
    return null;
  }
}

export function writeSave(state: GameState, storage: Storage = window.localStorage): void {
  const saves = read<Record<string, GameState>>(storage, SAVES_KEY, {});
  saves[state.storyId] = state;
  storage.setItem(SAVES_KEY, JSON.stringify(saves));
}

export function clearSave(storyId: string, storage: Storage = window.localStorage): void {
  const saves = read<Record<string, GameState>>(storage, SAVES_KEY, {});
  delete saves[storyId];
  storage.setItem(SAVES_KEY, JSON.stringify(saves));
}

// ------------------------------------------------------------------- record

/** Endings already seen, per story — the "x/y fins" of the library. */
export function loadEndings(storage: Storage = window.localStorage): Record<string, string[]> {
  return read<Record<string, string[]>>(storage, ENDINGS_KEY, {});
}

export function recordEnding(
  storyId: string,
  sceneId: string,
  storage: Storage = window.localStorage,
): Record<string, string[]> {
  const endings = loadEndings(storage);
  const seen = new Set(endings[storyId] ?? []);
  seen.add(sceneId);
  endings[storyId] = [...seen];
  storage.setItem(ENDINGS_KEY, JSON.stringify(endings));
  return endings;
}

/** Number of endings the story offers. */
export function countEndings(story: Story): number {
  return Object.values(story.scenes).filter((scene) => scene.ending).length;
}
