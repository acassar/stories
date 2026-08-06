/**
 * Factories for blank documents. The studio uses them to create a story or a
 * scene without having to know every required field of the format.
 */

import { STORY_FORMAT_VERSION } from './types.js';
import type { Link, Scene, SceneId, SceneKind, Story } from './types.js';

/**
 * Generates a short, readable id that satisfies the schema. `random` is
 * injectable to keep tests deterministic.
 */
export function createId(prefix: string, random: () => number = Math.random): string {
  return `${prefix}-${random().toString(36).slice(2, 8)}`;
}

/** Reduces a free-form title to a stable scene id. */
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

/** Default title of a fresh node, per kind. */
const kindTitles: Record<SceneKind, string> = {
  npc: 'Nouveau message',
  player: 'Nouvelle réplique',
  choice: 'Nouveau choix',
};

export function createScene(overrides: Partial<Scene> & { id: SceneId; kind: SceneKind }): Scene {
  const scene: Scene = {
    title: kindTitles[overrides.kind],
    blocks: [],
    next: [],
    position: { x: 0, y: 0 },
    ...overrides,
  };
  // A choice without a label is a validation error, so give it one up front.
  if (scene.kind === 'choice' && !scene.label) scene.label = scene.title;
  return scene;
}

export function createLink(overrides: Partial<Link> & { to: SceneId }): Link {
  return { id: createId('lien'), ...overrides };
}

/** Minimal yet already valid story: one message, one choice, one ending. */
export function createEmptyStory(overrides: Partial<Story> = {}): Story {
  const startId = 'depart';
  const choiceId = 'avancer';
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
        kind: 'npc',
        title: 'Le seuil',
        blocks: [{ text: 'Tout commence ici.' }],
        position: { x: 320, y: 40 },
        next: [{ id: 'vers-le-choix', to: choiceId }],
      }),
      [choiceId]: createScene({
        id: choiceId,
        kind: 'choice',
        title: 'Avancer',
        label: 'Avancer',
        position: { x: 320, y: 180 },
        next: [{ id: 'vers-la-fin', to: endId }],
      }),
      [endId]: createScene({
        id: endId,
        kind: 'npc',
        title: 'La fin',
        blocks: [{ text: 'Et tout s’arrete la.' }],
        position: { x: 320, y: 320 },
        ending: { type: 'Fin', name: 'La fin', blurb: 'Le recit se referme.' },
      }),
    },
    ...overrides,
  };
}
