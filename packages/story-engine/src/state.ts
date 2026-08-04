/**
 * Creation et serialisation de l'etat de jeu.
 *
 * Aucune I/O ici : le moteur produit et consomme des objets ou du texte, et
 * c'est l'app qui decide ou les ranger (localStorage, fichier, serveur...).
 */

import { parseGameState } from '@embranche/story-format';
import type { GameState, Story } from '@embranche/story-format';

/** Horloge injectable — les tests la remplacent pour rester deterministes. */
export type Clock = () => string;

export const systemClock: Clock = () => new Date().toISOString();

/** Etat neuf, positionne sur la scene de depart du recit. */
export function createInitialState(story: Story, now: Clock = systemClock): GameState {
  const timestamp = now();
  return {
    storyId: story.id,
    storyVersion: story.version,
    currentSceneId: story.startSceneId,
    variables: { ...(story.variables ?? {}) },
    inventory: { ...(story.inventory ?? {}) },
    history: [],
    visited: [story.startSceneId],
    startedAt: timestamp,
    updatedAt: timestamp,
  };
}

export function serializeState(state: GameState): string {
  return JSON.stringify(state);
}

/** Relit une sauvegarde. Leve `StoryFormatError` si le document est mal forme. */
export function deserializeState(json: string): GameState {
  return parseGameState(JSON.parse(json) as unknown);
}

/**
 * Une sauvegarde est reprenable si elle vise ce recit et que sa scene courante
 * existe encore. Un changement de version du recit n'invalide pas la partie —
 * il est juste signale par `staleVersion`, a charge de l'app d'en informer le
 * joueur.
 */
export function inspectState(
  story: Story,
  state: GameState,
): { resumable: boolean; reason?: string; staleVersion: boolean } {
  if (state.storyId !== story.id) {
    return { resumable: false, reason: 'La sauvegarde appartient a un autre recit.', staleVersion: false };
  }
  if (!story.scenes[state.currentSceneId]) {
    return {
      resumable: false,
      reason: `La scene « ${state.currentSceneId} » n'existe plus dans ce recit.`,
      staleVersion: true,
    };
  }
  return { resumable: true, staleVersion: state.storyVersion !== story.version };
}
