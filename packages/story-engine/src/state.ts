/**
 * Creation and serialization of the game state.
 *
 * No I/O here: the engine produces and consumes objects or text, and the app
 * decides where to put them (localStorage, file, server...).
 */

import { parseGameState, waitMinutesOf } from '@embranche/story-format';
import type { GameState, Story } from '@embranche/story-format';

/** Injectable clock — tests replace it to stay deterministic. */
export type Clock = () => string;

export const systemClock: Clock = () => new Date().toISOString();

/**
 * Records the wait of the scene the state has just arrived on — and clears any
 * pending one when the new scene has none.
 *
 * It is stamped on *arrival*, not when the wait runs out: a run put away in the
 * middle of a silence must find that silence where it left it. `waitsDone` is
 * filled at the same moment and for the same reason — undoing a choice must not
 * make the player sit through a night they have already lived.
 */
export function enterScene(story: Story, state: GameState, now: Clock = systemClock): GameState {
  const scene = story.scenes[state.currentSceneId];
  const already = (state.waitsDone ?? []).includes(state.currentSceneId);

  if (!scene || waitMinutesOf(scene) <= 0 || already) {
    if (!state.awaitingSince) return state;
    const { awaitingSince, ...rest } = state;
    return rest;
  }

  return {
    ...state,
    awaitingSince: now(),
    waitsDone: [...(state.waitsDone ?? []), state.currentSceneId],
  };
}

/** Fresh state, positioned on the start scene of the story. */
export function createInitialState(story: Story, now: Clock = systemClock): GameState {
  const timestamp = now();
  // Through `enterScene`, so that a story opening on a silence opens on it here
  // too rather than only from the second scene onwards.
  return enterScene(
    story,
    {
      storyId: story.id,
      storyVersion: story.version,
      currentSceneId: story.startSceneId,
      variables: { ...(story.variables ?? {}) },
      inventory: { ...(story.inventory ?? {}) },
      history: [],
      visited: [story.startSceneId],
      startedAt: timestamp,
      updatedAt: timestamp,
    },
    now,
  );
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
