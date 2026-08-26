import { describe, expect, it } from 'vitest';

import { StoryEngine } from '@embranche/story-engine';
import { clairiereStory } from '@embranche/story-format';

import { buildTranscript } from './transcript';

function engine() {
  return new StoryEngine(clairiereStory);
}

/** A full turn: the player presses, then the story unrolls until it stops. */
function play(e: StoryEngine, linkId: string): void {
  e.choose(linkId);
  for (let steps = 0; steps < 50 && e.advance(); steps += 1);
}

describe('buildTranscript', () => {
  it('only displays the already revealed messages of the current scene', () => {
    const e = engine();
    expect(buildTranscript(clairiereStory, e.state, e.getCurrentScene(), { revealed: 0 })).toEqual(
      [],
    );
    const partial = buildTranscript(clairiereStory, e.state, e.getCurrentScene(), { revealed: 1 });
    expect(partial).toHaveLength(1);
    expect(partial[0]?.text).toContain('fougères');
  });

  it('inserts the player line between two scenes', () => {
    const e = engine();
    play(e, 'vers-lucioles');
    const messages = buildTranscript(clairiereStory, e.state, e.getCurrentScene(), { revealed: 2 });

    // 2 messages from the path + the choice line + 2 messages from the fireflies
    expect(messages).toHaveLength(5);
    expect(messages[2]).toMatchObject({ text: 'Je les suis.', fromPlayer: true });
    expect(messages[3]?.fromPlayer).toBe(false);
  });

  it('places messages on the right side according to the node kind', () => {
    const e = engine();
    play(e, 'vers-arbre');
    play(e, 'vers-redescendre');
    const messages = buildTranscript(clairiereStory, e.state, e.getCurrentScene(), { revealed: 2 });

    // start ×2 → the "grimper" choice → arbre ×2 → the "redescendre" choice
    // → the free line → lucioles ×2
    expect(messages.map((m) => m.fromPlayer)).toEqual([
      false,
      false,
      true,
      false,
      false,
      true,
      true,
      false,
      false,
    ]);
    expect(messages[6]?.text).toContain('ne rien brusquer');
  });

  it('sends the button label when the choice has no body', () => {
    const story = structuredClone(clairiereStory);
    story.scenes['c-lucioles']!.blocks = [];
    const e = new StoryEngine(story);
    e.choose('vers-lucioles');
    const messages = buildTranscript(story, e.state, e.getCurrentScene(), { revealed: 1 });
    expect(messages.at(-1)).toMatchObject({ text: 'Suivre les lucioles', fromPlayer: true });
  });

  it('places messages by node kind alone, without exception', () => {
    // The same node, switched to "player": all its messages change side at
    // once. No message can contradict the color of its node.
    const story = structuredClone(clairiereStory);
    story.scenes.start!.kind = 'player';
    const e = new StoryEngine(story, { validate: false });
    const messages = buildTranscript(story, e.state, e.getCurrentScene(), { revealed: 2 });
    expect(messages.map((m) => m.fromPlayer)).toEqual([true, true]);
  });

  it('keeps the key of a message when its scene falls into the history', () => {
    const e = engine();
    const before = buildTranscript(clairiereStory, e.state, e.getCurrentScene(), { revealed: 2 });

    play(e, 'vers-lucioles');
    const after = buildTranscript(clairiereStory, e.state, e.getCurrentScene(), { revealed: 2 });

    // Same bubbles, same identity: the arrival animation must not replay on
    // messages that are already on screen.
    expect(after.slice(0, before.length).map((m) => m.key)).toEqual(before.map((m) => m.key));
  });

  it('gives each message a unique key, even when the text repeats', () => {
    const e = engine();
    play(e, 'vers-arbre');
    play(e, 'vers-redescendre');
    const messages = buildTranscript(clairiereStory, e.state, e.getCurrentScene(), { revealed: 2 });
    expect(new Set(messages.map((m) => m.key)).size).toBe(messages.length);
  });
});
