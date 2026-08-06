import { describe, expect, it } from 'vitest';

import { cimesStory, clairiereStory, exampleStories } from './examples.js';
import { createEmptyStory, createScene, slugify } from './factories.js';
import {
  StoryFormatError,
  collectConditionVariables,
  collectStoryVariables,
  findUnreachableScenes,
  issuesForScene,
  parseStory,
  parseStoryJson,
  validateStory,
  validateStoryShape,
} from './validate.js';
import type { Story } from './types.js';

/** Copie profonde : les tests ne doivent jamais abimer les exemples partages. */
function clone(story: Story): Story {
  return JSON.parse(JSON.stringify(story)) as Story;
}

describe('validateStoryShape', () => {
  it('accepte un document bien forme', () => {
    expect(validateStoryShape(clairiereStory).valid).toBe(true);
  });

  it('rejette un document qui n’est pas un objet', () => {
    const result = validateStoryShape('pas une histoire');
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.code).toBe('schema');
  });

  it('rejette un champ obligatoire manquant et pointe le chemin fautif', () => {
    const story = clone(clairiereStory) as Partial<Story>;
    delete story.startSceneId;
    const result = validateStoryShape(story);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.path === 'startSceneId')).toBe(true);
  });

  it('rejette un identifiant de scene contenant des caracteres interdits', () => {
    const story = clone(clairiereStory);
    story.scenes['scene invalide'] = createScene({ id: 'scene invalide', kind: 'npc' });
    expect(validateStoryShape(story).valid).toBe(false);
  });

  it('rejette un type de noeud hors vocabulaire', () => {
    const story = clone(clairiereStory);
    // @ts-expect-error — on injecte volontairement un type inconnu
    story.scenes.start.kind = 'narrateur';
    expect(validateStoryShape(story).valid).toBe(false);
  });

  it('rejette une condition dont l’operateur est inconnu', () => {
    const story = clone(clairiereStory);
    // @ts-expect-error — on injecte volontairement un operateur hors vocabulaire
    story.scenes.start.next[0].condition = { op: 'eval', code: 'process.exit()' };
    expect(validateStoryShape(story).valid).toBe(false);
  });
});

describe('validateStory — coherence du graphe', () => {
  it('valide les quatre recits d’exemple sans erreur', () => {
    for (const story of exampleStories) {
      const result = validateStory(story);
      const errors = result.issues.filter((i) => i.severity === 'error');
      expect(errors, `${story.title} : ${errors.map((e) => e.message).join(' | ')}`).toEqual([]);
      expect(result.valid).toBe(true);
    }
  });

  it('valide le recit produit par createEmptyStory', () => {
    expect(validateStory(createEmptyStory()).valid).toBe(true);
  });

  it('signale une scene de depart inexistante', () => {
    const story = clone(clairiereStory);
    story.startSceneId = 'nulle-part';
    const result = validateStory(story);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === 'missing-start-scene')).toBe(true);
  });

  it('signale un lien vers une scene inexistante', () => {
    const story = clone(clairiereStory);
    story.scenes.start!.next[0]!.to = 'fantome';
    const result = validateStory(story);
    expect(result.valid).toBe(false);
    const issue = result.issues.find((i) => i.code === 'dangling-link-target');
    expect(issue?.sceneId).toBe('start');
    expect(issue?.linkId).toBe('vers-lucioles');
  });

  it('signale une cle de dictionnaire qui ne correspond pas a l’id de la scene', () => {
    const story = clone(clairiereStory);
    story.scenes.egaree = createScene({ id: 'autre-id', kind: 'npc' });
    const result = validateStory(story);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === 'scene-id-mismatch')).toBe(true);
  });

  it('signale deux liens partageant le meme identifiant', () => {
    const story = clone(clairiereStory);
    const scene = story.scenes.start!;
    scene.next.push({ ...scene.next[0]!, to: 'c-arbre' });
    const result = validateStory(story);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === 'duplicate-link-id')).toBe(true);
  });

  it('signale un noeud de choix sans libelle : le bouton serait vide', () => {
    const story = clone(clairiereStory);
    delete story.scenes['c-lucioles']!.label;
    const result = validateStory(story);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === 'choice-without-label')).toBe(true);
  });

  it('refuse un noeud qui melange choix et enchainement', () => {
    const story = clone(clairiereStory);
    // `start` propose deja deux choix ; on y ajoute un lien direct vers un npc.
    story.scenes.start!.next.push({ id: 'raccourci', to: 'arbre' });
    const result = validateStory(story);
    expect(result.valid).toBe(false);
    const issue = result.issues.find((i) => i.code === 'mixed-links');
    expect(issue?.sceneId).toBe('start');
  });

  it('refuse une boucle d’enchainements que le joueur ne pourrait pas rompre', () => {
    const story = clone(clairiereStory);
    // `prudence` enchaine deja seul ; on le fait boucler sur lui-meme.
    story.scenes.prudence!.next = [{ id: 'boucle', to: 'prudence' }];
    const result = validateStory(story);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === 'auto-loop' && i.sceneId === 'prudence')).toBe(
      true,
    );
  });

  it('accepte une boucle qui repasse par un choix — le joueur peut en sortir', () => {
    // `c-repartir` ramene a `sommet`, deja visite : c'est legitime.
    expect(validateStory(cimesStory).issues.some((i) => i.code === 'auto-loop')).toBe(false);
  });

  it('avertit quand tous les liens d’un enchainement sont conditionnels', () => {
    const story = clone(clairiereStory);
    story.scenes.prudence!.next[0]!.condition = { op: 'eq', variable: 'prudent', value: true };
    const issue = validateStory(story).issues.find((i) => i.code === 'no-default-link');
    expect(issue?.severity).toBe('warning');
    expect(issue?.sceneId).toBe('prudence');
  });

  it('avertit — sans bloquer — sur une scene orpheline', () => {
    const story = clone(clairiereStory);
    story.scenes.oubliee = createScene({
      id: 'oubliee',
      kind: 'npc',
      blocks: [{ text: 'Personne ne vient jamais ici.' }],
      ending: { type: 'Fin', name: 'Oubli', blurb: 'Fin.' },
    });
    const result = validateStory(story);
    expect(result.valid).toBe(true);
    const issue = result.issues.find((i) => i.code === 'orphan-scene');
    expect(issue?.severity).toBe('warning');
    expect(issue?.sceneId).toBe('oubliee');
  });

  it('avertit sur un cul-de-sac : ni suite ni fin', () => {
    const story = clone(clairiereStory);
    delete story.scenes.portail!.ending;
    const result = validateStory(story);
    expect(result.valid).toBe(true);
    expect(result.issues.some((i) => i.code === 'dead-end' && i.sceneId === 'portail')).toBe(true);
  });

  it('avertit sur une fin qui garde des liens sortants', () => {
    const story = clone(clairiereStory);
    story.scenes.portail!.next.push({ id: 'apres-la-fin', to: 'start' });
    const result = validateStory(story);
    expect(result.issues.some((i) => i.code === 'ending-with-links')).toBe(true);
  });

  it('avertit sur un lien qui boucle sur son propre noeud', () => {
    const story = clone(clairiereStory);
    story.scenes.prudence!.next[0]!.to = 'prudence';
    expect(validateStory(story).issues.some((i) => i.code === 'self-loop')).toBe(true);
  });

  it('avertit sur un recit sans aucune fin', () => {
    const story = clone(clairiereStory);
    for (const scene of Object.values(story.scenes)) delete scene.ending;
    expect(validateStory(story).issues.some((i) => i.code === 'no-ending')).toBe(true);
  });

  it('avertit sur une condition lisant une variable jamais ecrite', () => {
    const story = clone(clairiereStory);
    story.scenes.start!.next[0]!.condition = { op: 'gt', variable: 'karma', value: 3 };
    const issue = validateStory(story).issues.find((i) => i.code === 'unknown-variable');
    expect(issue?.severity).toBe('warning');
    expect(issue?.message).toContain('karma');
  });

  it('n’avertit pas quand la variable est ecrite par un effet ailleurs', () => {
    // `prudent` est initialisee par le recit et posee par un effet : rien a signaler.
    const result = validateStory(clairiereStory);
    expect(result.issues.some((i) => i.code === 'unknown-variable')).toBe(false);
  });
});

describe('parseStory', () => {
  it('renvoie l’histoire typee quand elle est valide', () => {
    expect(parseStory(clairiereStory).id).toBe('clairiere-lucioles');
  });

  it('leve StoryFormatError et expose toutes les anomalies', () => {
    const story = clone(clairiereStory);
    story.startSceneId = 'nulle-part';
    try {
      parseStory(story);
      expect.unreachable('parseStory aurait du lever');
    } catch (error) {
      expect(error).toBeInstanceOf(StoryFormatError);
      expect((error as StoryFormatError).issues.length).toBeGreaterThan(0);
    }
  });

  it('accepte un aller-retour JSON complet', () => {
    const parsed = parseStoryJson(JSON.stringify(clairiereStory));
    expect(parsed).toEqual(clairiereStory);
  });

  it('leve sur un JSON syntaxiquement invalide', () => {
    expect(() => parseStoryJson('{ oups')).toThrow(StoryFormatError);
  });
});

describe('utilitaires', () => {
  it('findUnreachableScenes ne renvoie rien sur un recit connexe', () => {
    expect(findUnreachableScenes(clairiereStory)).toEqual([]);
  });

  it('collectConditionVariables descend dans les operateurs composites', () => {
    const names = collectConditionVariables({
      op: 'and',
      conditions: [
        { op: 'eq', variable: 'prudent', value: true },
        { op: 'not', condition: { op: 'gt', variable: 'karma', value: 2 } },
        { op: 'hasItem', item: 'lanterne' },
      ],
    });
    expect([...names].sort()).toEqual(['karma', 'prudent']);
  });

  it('collectStoryVariables reunit les variables lues et ecrites', () => {
    expect([...collectStoryVariables(clairiereStory)]).toEqual(['prudent']);
  });

  it('issuesForScene filtre par scene', () => {
    const story = clone(clairiereStory);
    story.scenes.start!.next[0]!.to = 'fantome';
    const result = validateStory(story);
    expect(issuesForScene(result, 'start')).toHaveLength(1);
    expect(issuesForScene(result, 'arbre')).toHaveLength(0);
  });

  it('slugify produit un identifiant accepte par le schema', () => {
    expect(slugify('La Clairière aux Lucioles !')).toBe('la-clairiere-aux-lucioles');
    expect(slugify('   ')).toBe('scene');
  });
});
