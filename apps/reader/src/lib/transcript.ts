/**
 * Building the conversation.
 *
 * The reader has a single reading format: each text block of a node walked
 * through arrives as a message. A player line is not a special case — it is a
 * node like any other, whose kind says which side to display the bubble on.
 * A pure function, so directly testable.
 */

import { interpolate, sceneMessages, speakerOf } from '@embranche/story-format';
import type { GameState, Story } from '@embranche/story-format';
import type { ResolvedScene } from '@embranche/story-engine';

export interface Message {
  /** Stable key: two identical messages at two different moments coexist. */
  key: string;
  text: string;
  fromPlayer: boolean;
}

export interface TranscriptOptions {
  /**
   * Number of messages already revealed for the current scene. Previous scenes
   * are always displayed in full.
   */
  revealed: number;
}

export function buildTranscript(
  story: Story,
  state: GameState,
  scene: ResolvedScene,
  { revealed }: TranscriptOptions,
): Message[] {
  const messages: Message[] = [];

  state.history.forEach((entry, step) => {
    const past = story.scenes[entry.sceneId];
    if (!past) return;
    const fromPlayer = speakerOf(past) === 'player';
    sceneMessages(past).forEach((block, index) => {
      messages.push({
        key: `${step}-${entry.sceneId}-${index}`,
        // Past messages are filled in here — the engine only fills the scene
        // being played. They are given today's values, not those they were
        // sent with, which the state does not keep.
        text: interpolate(block.text, state.variables),
        fromPlayer,
      });
    });
  });

  /*
   * Only the current node is subject to progressive reveal: previous ones have
   * already arrived.
   *
   * Its messages are numbered with the step they are about to occupy — the
   * current length of the history — and not with a marker of their own. When
   * the story moves on, the node falls into the history at exactly that step,
   * so its messages keep the key they already had: they stay the same bubbles
   * rather than being torn down and rebuilt, and their arrival animation does
   * not play a second time.
   */
  scene.blocks.slice(0, revealed).forEach((block, index) => {
    messages.push({
      key: `${state.history.length}-${scene.id}-${index}`,
      text: block.text,
      fromPlayer: scene.speaker === 'player',
    });
  });

  return messages;
}
