import { describe, expect, it } from 'vitest';

import { migrateStory } from './migrate.js';
import { awaitsChoice, choiceLabel } from './scenes.js';
import { clairiereStory } from './examples.js';
import { parseStory, validateStory } from './validate.js';
import type { Story } from './types.js';

/**
 * Un recit au format 1 : la transition y etait un champ de la scene source.
 * On le garde ecrit en dur plutot que genere — c'est un document d'archive, il
 * ne doit pas bouger quand le format, lui, bouge.
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

describe('migrateStory — format 1 vers 2', () => {
  const migrated = migrateStory(structuredClone(legacy)) as Story;

  it('produit un document valide', () => {
    const result = validateStory(migrated);
    const errors = result.issues.filter((issue) => issue.severity === 'error');
    expect(errors.map((issue) => issue.message)).toEqual([]);
    expect(migrated.formatVersion).toBe(2);
  });

  it('fait de chaque ancienne scene un noeud personnage', () => {
    expect(migrated.scenes.start!.kind).toBe('npc');
    expect(migrated.scenes.dedans!.kind).toBe('npc');
    expect(migrated.scenes.start!.blocks).toEqual([{ text: 'Tu es devant la porte.' }]);
  });

  it('intercale un noeud de choix entre la scene et sa cible', () => {
    const [entrer] = migrated.scenes.start!.next;
    const choice = migrated.scenes[entrer!.to]!;
    expect(choice.kind).toBe('choice');
    expect(choiceLabel(choice)).toBe('Entrer');
    expect(choice.next.map((link) => link.to)).toEqual(['dedans']);
  });

  it('laisse condition et effets sur le lien qui mene au bouton', () => {
    const partir = migrated.scenes.start!.next[1]!;
    expect(partir.condition).toEqual({ op: 'eq', variable: 'prudent', value: true });
    expect(partir.effects).toEqual([{ op: 'set', variable: 'prudent', value: true }]);
    // Le second saut, lui, n'est qu'un enchainement.
    expect(migrated.scenes[partir.to]!.next[0]!.condition).toBeUndefined();
  });

  it('conserve la semantique : la scene de depart attend toujours un choix', () => {
    expect(awaitsChoice(migrated, migrated.scenes.start!)).toBe(true);
    expect(migrated.scenes.start!.next).toHaveLength(2);
  });

  it('n’ecrase pas un identifiant deja pris', () => {
    const collision = structuredClone(legacy);
    // Un noeud porte deja le nom que la migration voudrait donner au choix.
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

  it('éclate une scène qui changeait de locuteur en cours de route', () => {
    // Le format 1 permettait ceci : trois messages dans une seule scène, dont
    // le deuxième attribué au joueur. Recopié tel quel dans un nœud `npc`, il
    // se serait affiché du côté du joueur en contredisant le type du nœud —
    // et sans aucun moyen de le corriger, le champ ayant disparu.
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

    // Les choix de la scène partent du dernier fragment, pas du premier.
    expect(head.next).toHaveLength(1);
    expect(last.next).toHaveLength(2);
    expect(validateStory(story).valid).toBe(true);
  });

  it('donne la fin au dernier fragment d’une scène éclatée', () => {
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

  it('laisse passer un document deja au format courant, sans le toucher', () => {
    expect(migrateStory(clairiereStory)).toBe(clairiereStory);
  });

  it('répare un document v2 dont les blocs portent encore un « speaker »', () => {
    // Ce que produisait une première version de la migration : le champ avait
    // survécu au passage en v2, et contredisait le type du nœud.
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
    // Les deux choix de la scène sont passés au dernier fragment.
    expect(last.next.map((link) => link.id)).toEqual(['vers-sauter', 'vers-redescendre']);
    expect(validateStory(repaired).valid).toBe(true);
  });

  it('est idempotente : réparer deux fois ne change plus rien', () => {
    const damaged = structuredClone(clairiereStory) as Story;
    damaged.scenes.portail!.blocks = [
      { text: 'Tu franchis le seuil.', speaker: 'player' },
    ] as never;

    const once = migrateStory(damaged);
    expect(migrateStory(once)).toBe(once);
    // La fin est restée attachée, et sur le bon fragment.
    expect((once as Story).scenes.portail!.ending?.name).toBe('Le Royaume Lumière');
  });

  it('rend un fichier d’hier lisible par parseStory', () => {
    expect(parseStory(structuredClone(legacy)).id).toBe('ancien-recit');
  });
});
