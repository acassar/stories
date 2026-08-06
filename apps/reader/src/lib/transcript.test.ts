import { describe, expect, it } from 'vitest';

import { StoryEngine } from '@embranche/story-engine';
import { clairiereStory } from '@embranche/story-format';

import { buildTranscript } from './transcript';

function engine() {
  return new StoryEngine(clairiereStory);
}

/** Un tour complet : le joueur appuie, puis le recit deroule jusqu'a l'arret. */
function play(e: StoryEngine, linkId: string): void {
  e.choose(linkId);
  for (let steps = 0; steps < 50 && e.advance(); steps += 1);
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
    play(e, 'vers-lucioles');
    const messages = buildTranscript(clairiereStory, e.state, e.getCurrentScene(), { revealed: 2 });

    // 2 messages du sentier + la replique du choix + 2 messages des lucioles
    expect(messages).toHaveLength(5);
    expect(messages[2]).toMatchObject({ text: 'Je les suis.', fromPlayer: true });
    expect(messages[3]?.fromPlayer).toBe(false);
  });

  it('range les messages du bon cote selon le type du noeud', () => {
    const e = engine();
    play(e, 'vers-arbre');
    play(e, 'vers-redescendre');
    const messages = buildTranscript(clairiereStory, e.state, e.getCurrentScene(), { revealed: 2 });

    // start ×2 → le choix « grimper » → arbre ×2 → le choix « redescendre »
    // → la replique libre → lucioles ×2
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

  it('envoie le libelle du bouton quand le choix n’a pas de corps', () => {
    const story = structuredClone(clairiereStory);
    story.scenes['c-lucioles']!.blocks = [];
    const e = new StoryEngine(story);
    e.choose('vers-lucioles');
    const messages = buildTranscript(story, e.state, e.getCurrentScene(), { revealed: 1 });
    expect(messages.at(-1)).toMatchObject({ text: 'Suivre les lucioles', fromPlayer: true });
  });

  it('range les messages selon le seul type du noeud, sans exception', () => {
    // Le meme nœud, basculé en « joueur » : tous ses messages changent de côté
    // d'un coup. Aucun message ne peut contredire la couleur de son nœud.
    const story = structuredClone(clairiereStory);
    story.scenes.start!.kind = 'player';
    const e = new StoryEngine(story, { validate: false });
    const messages = buildTranscript(story, e.state, e.getCurrentScene(), { revealed: 2 });
    expect(messages.map((m) => m.fromPlayer)).toEqual([true, true]);
  });

  it('donne a chaque message une cle unique, meme si le texte se repete', () => {
    const e = engine();
    play(e, 'vers-arbre');
    play(e, 'vers-redescendre');
    const messages = buildTranscript(clairiereStory, e.state, e.getCurrentScene(), { revealed: 2 });
    expect(new Set(messages.map((m) => m.key)).size).toBe(messages.length);
  });
});
