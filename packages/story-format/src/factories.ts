/**
 * Fabriques de documents vierges. Le studio s'en sert pour creer un recit ou
 * une scene sans avoir a connaitre chaque champ obligatoire du format.
 */

import { STORY_FORMAT_VERSION } from './types.js';
import type { Choice, Scene, SceneId, Story } from './types.js';

/**
 * Genere un identifiant court, lisible et compatible avec le schema.
 * `random` est injectable pour rendre les tests deterministes.
 */
export function createId(prefix: string, random: () => number = Math.random): string {
  return `${prefix}-${random().toString(36).slice(2, 8)}`;
}

/** Reduit un titre libre en identifiant de scene stable. */
export function slugify(input: string, fallback = 'scene'): string {
  const slug = input
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return slug.length > 0 ? slug : fallback;
}

export function createScene(overrides: Partial<Scene> & { id: SceneId }): Scene {
  return {
    title: 'Nouvelle scene',
    blocks: [],
    choices: [],
    position: { x: 0, y: 0 },
    ...overrides,
  };
}

export function createChoice(overrides: Partial<Choice> & { target: SceneId }): Choice {
  return {
    id: createId('choice'),
    label: 'Nouveau choix',
    ...overrides,
  };
}

/** Recit minimal mais deja valide : une scene de depart et une fin. */
export function createEmptyStory(overrides: Partial<Story> = {}): Story {
  const startId = 'depart';
  const endId = 'fin';
  return {
    formatVersion: STORY_FORMAT_VERSION,
    id: createId('story'),
    title: 'Recit sans titre',
    version: '0.1.0',
    theme: 'night',
    status: 'draft',
    startSceneId: startId,
    scenes: {
      [startId]: createScene({
        id: startId,
        title: 'Le seuil',
        blocks: [{ text: 'Tout commence ici.' }],
        position: { x: 320, y: 40 },
        choices: [createChoice({ id: 'vers-la-fin', label: 'Avancer', target: endId })],
      }),
      [endId]: createScene({
        id: endId,
        title: 'La fin',
        blocks: [{ text: 'Et tout s’arrete la.' }],
        position: { x: 320, y: 280 },
        ending: { type: 'Fin', name: 'La fin', blurb: 'Le recit se referme.' },
      }),
    },
    ...overrides,
  };
}
