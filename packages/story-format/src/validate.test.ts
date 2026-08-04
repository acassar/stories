import { describe, expect, it } from 'vitest';

import { clairiereStory, exampleStories } from './examples.js';
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
    story.scenes['scene invalide'] = createScene({ id: 'scene invalide' });
    expect(validateStoryShape(story).valid).toBe(false);
  });

  it('rejette une condition dont l’operateur est inconnu', () => {
    const story = clone(clairiereStory);
    // @ts-expect-error — on injecte volontairement un operateur hors vocabulaire
    story.scenes.start.choices[0].condition = { op: 'eval', code: 'process.exit()' };
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

  it('signale un choix vers une scene inexistante', () => {
    const story = clone(clairiereStory);
    story.scenes.start!.choices[0]!.target = 'fantome';
    const result = validateStory(story);
    expect(result.valid).toBe(false);
    const issue = result.issues.find((i) => i.code === 'dangling-choice-target');
    expect(issue?.sceneId).toBe('start');
    expect(issue?.choiceId).toBe('vers-lucioles');
  });

  it('signale une cle de dictionnaire qui ne correspond pas a l’id de la scene', () => {
    const story = clone(clairiereStory);
    story.scenes.egaree = createScene({ id: 'autre-id' });
    const result = validateStory(story);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === 'scene-id-mismatch')).toBe(true);
  });

  it('signale deux choix partageant le meme identifiant', () => {
    const story = clone(clairiereStory);
    const scene = story.scenes.start!;
    scene.choices.push({ ...scene.choices[0]!, target: 'arbre' });
    const result = validateStory(story);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === 'duplicate-choice-id')).toBe(true);
  });

  it('avertit — sans bloquer — sur une scene orpheline', () => {
    const story = clone(clairiereStory);
    story.scenes.oubliee = createScene({
      id: 'oubliee',
      blocks: [{ text: 'Personne ne vient jamais ici.' }],
      ending: { type: 'Fin', name: 'Oubli', blurb: 'Fin.' },
    });
    const result = validateStory(story);
    expect(result.valid).toBe(true);
    const issue = result.issues.find((i) => i.code === 'orphan-scene');
    expect(issue?.severity).toBe('warning');
    expect(issue?.sceneId).toBe('oubliee');
  });

  it('avertit sur un cul-de-sac : ni choix ni fin', () => {
    const story = clone(clairiereStory);
    delete story.scenes.portail!.ending;
    const result = validateStory(story);
    expect(result.valid).toBe(true);
    expect(result.issues.some((i) => i.code === 'dead-end' && i.sceneId === 'portail')).toBe(true);
  });

  it('avertit sur une fin qui propose encore des choix', () => {
    const story = clone(clairiereStory);
    story.scenes.portail!.choices.push({ id: 'apres-la-fin', label: 'Encore ?', target: 'start' });
    const result = validateStory(story);
    expect(result.issues.some((i) => i.code === 'ending-with-choices')).toBe(true);
  });

  it('avertit sur un choix qui boucle sur sa propre scene', () => {
    const story = clone(clairiereStory);
    story.scenes.start!.choices[0]!.target = 'start';
    expect(validateStory(story).issues.some((i) => i.code === 'self-loop')).toBe(true);
  });

  it('avertit sur un recit sans aucune fin', () => {
    const story = clone(clairiereStory);
    for (const scene of Object.values(story.scenes)) delete scene.ending;
    expect(validateStory(story).issues.some((i) => i.code === 'no-ending')).toBe(true);
  });

  it('avertit sur une condition lisant une variable jamais ecrite', () => {
    const story = clone(clairiereStory);
    story.scenes.start!.choices[0]!.condition = { op: 'gt', variable: 'karma', value: 3 };
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
    story.scenes.start!.choices[0]!.target = 'fantome';
    const result = validateStory(story);
    expect(issuesForScene(result, 'start')).toHaveLength(1);
    expect(issuesForScene(result, 'arbre')).toHaveLength(0);
  });

  it('slugify produit un identifiant accepte par le schema', () => {
    expect(slugify('La Clairière aux Lucioles !')).toBe('la-clairiere-aux-lucioles');
    expect(slugify('   ')).toBe('scene');
  });
});
