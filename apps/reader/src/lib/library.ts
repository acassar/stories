/**
 * Bibliotheque et sauvegardes du lecteur.
 *
 * Comme cote studio, `localStorage` vit ici et nulle part ailleurs : le moteur
 * ignore tout de la persistance, on la lui injecte.
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
 * Recits disponibles : ceux livres avec l'app, plus ceux importes depuis un
 * JSON produit par le studio. Un import remplace l'exemple de meme identifiant.
 */
export function loadLibrary(storage: Storage = window.localStorage): Story[] {
  // Un fichier importe avant un changement de format reste jouable : on le
  // migre a la lecture plutot que de le laisser disparaitre de la bibliotheque.
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

// --------------------------------------------------------------- sauvegardes

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
    // Une sauvegarde d'un ancien format ne doit pas empecher de rejouer.
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

// ------------------------------------------------------------------- palmares

/** Fins deja vues, par recit — c'est le « x/y fins » de la bibliotheque. */
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

/** Nombre de fins que le recit propose. */
export function countEndings(story: Story): number {
  return Object.values(story.scenes).filter((scene) => scene.ending).length;
}
