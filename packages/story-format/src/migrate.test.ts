import { describe, expect, it } from 'vitest';

import { migrateStory } from './migrate.js';
import { awaitsChoice, choiceLabel } from './scenes.js';
import { clairiereStory } from './examples.js';
import { parseStory, validateStory } from './validate.js';
import type { Story } from './types.js';

/**
 * A format 1 story: the transition was a field of the source scene. It is
 * hand-written rather than generated — this is an archive document, it must not
 * move when the format does.
 */
const legacy: {
  formatVersion: number;
  id: string;
  title: string;
  version: string;
  startSceneId: string;
  variables: Record<string, boolean>;
  scenes: Record<
    string,
    {
      id: string;
      title: string;
      position: { x: number; y: number };
      blocks: { text: string; speaker?: 'narrator' | 'player' }[];
      choices: Record<string, unknown>[];
      ending?: { type: string; name: string; blurb: string };
    }
  >;
} = {
  formatVersion: 1,
  id: 'ancien-recit',
  title: 'Un récit d’avant',
  version: '1.0.0',
  startSceneId: 'start',
  variables: { prudent: false },
  scenes: {
    start: {
      id: 'start',
      title: 'Le seuil',
      position: { x: 0, y: 0 },
      blocks: [{ text: 'Tu es devant la porte.' }],
      choices: [
        { id: 'entrer', label: 'Entrer', target: 'dedans' },
        {
          id: 'partir',
          label: 'Faire demi-tour',
          target: 'dehors',
          condition: { op: 'eq', variable: 'prudent', value: true },
          effects: [{ op: 'set', variable: 'prudent', value: true }],
        },
      ],
    },
    dedans: {
      id: 'dedans',
      title: 'Dedans',
      position: { x: -100, y: 200 },
      blocks: [{ text: 'Il fait chaud.' }],
      choices: [],
      ending: { type: 'Fin', name: 'Dedans', blurb: 'Tu es entré.' },
    },
    dehors: {
      id: 'dehors',
      title: 'Dehors',
      position: { x: 100, y: 200 },
      blocks: [{ text: 'La nuit te reprend.' }],
      choices: [],
      ending: { type: 'Fin', name: 'Dehors', blurb: 'Tu es reparti.' },
    },
  },
};

describe('migrateStory — format 1 to 2', () => {
  const migrated = migrateStory(structuredClone(legacy)) as Story;

  it('produces a valid document', () => {
    const result = validateStory(migrated);
    const errors = result.issues.filter((issue) => issue.severity === 'error');
    expect(errors.map((issue) => issue.message)).toEqual([]);
    expect(migrated.formatVersion).toBe(2);
  });

  it('turns each legacy scene into an npc node', () => {
    expect(migrated.scenes.start!.kind).toBe('npc');
    expect(migrated.scenes.dedans!.kind).toBe('npc');
    expect(migrated.scenes.start!.blocks).toEqual([{ text: 'Tu es devant la porte.' }]);
  });

  it('inserts a choice node between the scene and its target', () => {
    const [entrer] = migrated.scenes.start!.next;
    const choice = migrated.scenes[entrer!.to]!;
    expect(choice.kind).toBe('choice');
    expect(choiceLabel(choice)).toBe('Entrer');
    expect(choice.next.map((link) => link.to)).toEqual(['dedans']);
  });

  it('leaves condition and effects on the link that leads to the button', () => {
    const partir = migrated.scenes.start!.next[1]!;
    expect(partir.condition).toEqual({ op: 'eq', variable: 'prudent', value: true });
    expect(partir.effects).toEqual([{ op: 'set', variable: 'prudent', value: true }]);
    // The second hop is plain chaining.
    expect(migrated.scenes[partir.to]!.next[0]!.condition).toBeUndefined();
  });

  it('preserves the semantics: the start scene still awaits a choice', () => {
    expect(awaitsChoice(migrated, migrated.scenes.start!)).toBe(true);
    expect(migrated.scenes.start!.next).toHaveLength(2);
  });

  it('does not overwrite an id that is already taken', () => {
    const collision = structuredClone(legacy);
    // A node already bears the name the migration would give to the choice.
    (collision.scenes as Record<string, unknown>)['start-entrer'] = {
      id: 'start-entrer',
      title: 'Déjà là',
      position: { x: 0, y: 0 },
      blocks: [{ text: 'Je squatte la place.' }],
      choices: [],
      ending: { type: 'Fin', name: 'Squat', blurb: '.' },
    };
    const result = migrateStory(collision) as Story;
    expect(result.scenes['start-entrer']!.title).toBe('Déjà là');
    expect(Object.keys(result.scenes)).toContain('start-entrer-2');
  });

  it('splits a scene that changed speaker halfway through', () => {
    // Format 1 allowed this: three messages in a single scene, the second one
    // attributed to the player. Copied as-is into an `npc` node it would show
    // on the player side, contradicting the node kind.
    const mixed = structuredClone(legacy);
    mixed.scenes.start!.blocks = [
      { text: 'Tu es devant la porte.' },
      { text: 'Je frappe.', speaker: 'player' },
      { text: 'Personne ne répond.' },
    ];
    const story = migrateStory(mixed) as Story;

    const head = story.scenes.start!;
    expect(head.kind).toBe('npc');
    expect(head.blocks).toEqual([{ text: 'Tu es devant la porte.' }]);

    const middle = story.scenes[head.next[0]!.to]!;
    expect(middle.kind).toBe('player');
    expect(middle.blocks).toEqual([{ text: 'Je frappe.' }]);

    const last = story.scenes[middle.next[0]!.to]!;
    expect(last.kind).toBe('npc');
    expect(last.blocks).toEqual([{ text: 'Personne ne répond.' }]);

    // The choices of the scene leave from the last fragment, not the first.
    expect(head.next).toHaveLength(1);
    expect(last.next).toHaveLength(2);
    expect(validateStory(story).valid).toBe(true);
  });

  it('gives the ending to the last fragment of a split scene', () => {
    const mixed = structuredClone(legacy);
    mixed.scenes.dedans!.blocks = [
      { text: 'Il fait chaud.' },
      { text: 'Je referme derrière moi.', speaker: 'player' },
    ];
    const story = migrateStory(mixed) as Story;

    const head = story.scenes.dedans!;
    expect(head.ending).toBeUndefined();
    expect(story.scenes[head.next[0]!.to]!.ending?.name).toBe('Dedans');
  });

  it('lets a document already in the current format through untouched', () => {
    expect(migrateStory(clairiereStory)).toBe(clairiereStory);
  });

  it('repairs a v2 document whose blocks still carry a speaker field', () => {
    // A `speaker` left over on a v2 document contradicts the node kind.
    const damaged = structuredClone(clairiereStory) as Story;
    damaged.scenes.arbre!.blocks = [
      { text: 'Du haut du vieux chêne, un château flotte entre les nuages.' },
      { text: 'Je grimpe encore un peu.', speaker: 'player' },
      { text: "Ses fenêtres sont allumées.'" },
    ] as never;

    const repaired = migrateStory(damaged) as Story;
    const head = repaired.scenes.arbre!;
    expect(head.kind).toBe('npc');
    expect(head.blocks.every((block) => !('speaker' in block))).toBe(true);

    const middle = repaired.scenes[head.next[0]!.to]!;
    expect(middle.kind).toBe('player');

    const last = repaired.scenes[middle.next[0]!.to]!;
    expect(last.kind).toBe('npc');
    // Both choices of the scene moved to the last fragment.
    expect(last.next.map((link) => link.id)).toEqual(['vers-sauter', 'vers-redescendre']);
    expect(validateStory(repaired).valid).toBe(true);
  });

  it('is idempotent: repairing twice changes nothing more', () => {
    const damaged = structuredClone(clairiereStory) as Story;
    damaged.scenes.portail!.blocks = [
      { text: 'Tu franchis le seuil.', speaker: 'player' },
    ] as never;

    const once = migrateStory(damaged);
    expect(migrateStory(once)).toBe(once);
    // The ending stayed attached, and on the right fragment.
    expect((once as Story).scenes.portail!.ending?.name).toBe('Le Royaume Lumière');
  });

  it('makes a legacy file readable by parseStory', () => {
    expect(parseStory(structuredClone(legacy)).id).toBe('ancien-recit');
  });
});
