import { describe, expect, it } from 'vitest';

import { StoryEngine } from '@embranche/story-engine';
import { clairiereStory } from '@embranche/story-format';

import { buildTranscript } from './transcript';

function engine() {
  return new StoryEngine(clairiereStory);
}

describe('buildTranscript', () => {
  it('n’affiche que les messages deja reveles de la scene courante', () => {
    const e = engine();
    expect(buildTranscript(clairiereStory, e.state, e.getCurrentScene(), { revealed: 0 })).toEqual(
      [],
    );
    const partial = buildTranscript(clairiereStory, e.state, e.getCurrentScene(), { revealed: 1 });
    expect(partial).toHaveLength(1);
    expect(partial[0]?.text).toContain('fougères');
  });

  it('intercale la replique du joueur entre deux scenes', () => {
    const e = engine();
    e.choose('vers-lucioles');
    const messages = buildTranscript(clairiereStory, e.state, e.getCurrentScene(), { revealed: 2 });

    // 2 messages du sentier + la replique + 2 messages des lucioles
    expect(messages).toHaveLength(5);
    expect(messages[2]).toMatchObject({ text: 'Suivre les lucioles', fromPlayer: true });
    expect(messages[3]?.fromPlayer).toBe(false);
  });

  it('respecte un bloc attribue au joueur', () => {
    const story = structuredClone(clairiereStory);
    story.scenes.start!.blocks[1]!.speaker = 'player';
    const e = new StoryEngine(story);
    const messages = buildTranscript(story, e.state, e.getCurrentScene(), { revealed: 2 });
    expect(messages.map((m) => m.fromPlayer)).toEqual([false, true]);
  });

  it('donne a chaque message une cle unique, meme si le texte se repete', () => {
    const e = engine();
    e.choose('vers-arbre');
    e.choose('redescendre');
    const messages = buildTranscript(clairiereStory, e.state, e.getCurrentScene(), { revealed: 2 });
    expect(new Set(messages.map((m) => m.key)).size).toBe(messages.length);
  });
});
