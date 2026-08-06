/**
 * Creation and serialization of the game state.
 *
 * No I/O here: the engine produces and consumes objects or text, and the app
 * decides where to put them (localStorage, file, server...).
 */

import { parseGameState } from '@embranche/story-format';
import type { GameState, Story } from '@embranche/story-format';

/** Injectable clock — tests replace it to stay deterministic. */
export type Clock = () => string;

export const systemClock: Clock = () => new Date().toISOString();

/** Fresh state, positioned on the start scene of the story. */
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

/** Reads a save back. Throws `StoryFormatError` when the document is malformed. */
export function deserializeState(json: string): GameState {
  return parseGameState(JSON.parse(json) as unknown);
}

/**
 * A save can be resumed when it targets this story and its current scene still
 * exists. A change of story version does not invalidate the run — it is only
 * reported through `staleVersion`, and it is up to the app to tell the player.
 */
export function inspectState(
  story: Story,
  state: GameState,
): { resumable: boolean; reason?: string; staleVersion: boolean } {
  if (state.storyId !== story.id) {
    return {
      resumable: false,
      reason: 'La sauvegarde appartient a un autre recit.',
      staleVersion: false,
    };
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
