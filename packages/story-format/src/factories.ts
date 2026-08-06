/**
 * Fabriques de documents vierges. Le studio s'en sert pour creer un recit ou
 * une scene sans avoir a connaitre chaque champ obligatoire du format.
 */

import { STORY_FORMAT_VERSION } from './types.js';
import type { Link, Scene, SceneId, SceneKind, Story } from './types.js';

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

/** Titre par defaut d'un noeud neuf, selon ce qu'il est. */
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
  // Un choix sans libelle est une erreur de validation : autant en poser un.
  if (scene.kind === 'choice' && !scene.label) scene.label = scene.title;
  return scene;
}

export function createLink(overrides: Partial<Link> & { to: SceneId }): Link {
  return { id: createId('lien'), ...overrides };
}

/** Recit minimal mais deja valide : un message, un choix, une fin. */
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
