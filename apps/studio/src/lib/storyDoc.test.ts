import { describe, expect, it } from 'vitest';

import { clairiereStory, validateStory } from '@embranche/story-format';
import type { Story } from '@embranche/story-format';

import {
  addChoice,
  addScene,
  countEndings,
  duplicateScene,
  removeChoice,
  removeScene,
  renameSceneId,
  setStartScene,
  toggleEnding,
  uniqueSceneId,
  updateChoice,
  updateScene,
} from './storyDoc';

function clone(): Story {
  return structuredClone(clairiereStory);
}

describe('storyDoc', () => {
  it('n’altere jamais le document d’origine', () => {
    const story = clone();
    updateScene(story, 'start', { title: 'Autre titre' });
    expect(story.scenes.start?.title).toBe('Le sentier');
  });

  it('ajoute une scene valide et lui donne un identifiant libre', () => {
    const { story, sceneId } = addScene(clone(), { x: 10, y: 20 });
    expect(story.scenes[sceneId]?.position).toEqual({ x: 10, y: 20 });
    expect(validateStory(story).valid).toBe(true);
  });

  it('supprime une scene et les choix qui y menaient', () => {
    const story = removeScene(clone(), 'lucioles');
    expect(story.scenes.lucioles).toBeUndefined();
    expect(story.scenes.start?.choices.map((c) => c.target)).toEqual(['arbre']);
    // Pas de cible pendante laissee derriere : le recit reste jouable.
    expect(validateStory(story).valid).toBe(true);
  });

  it('deplace la scene de depart si celle-ci est supprimee', () => {
    const story = removeScene(clone(), 'start');
    expect(story.startSceneId).not.toBe('start');
    expect(story.scenes[story.startSceneId]).toBeDefined();
  });

  it('duplique une scene avec de nouveaux identifiants de choix', () => {
    const { story, sceneId } = duplicateScene(clone(), 'start');
    const copy = story.scenes[sceneId];
    expect(copy?.title).toBe('Le sentier (copie)');
    expect(copy?.choices.map((c) => c.id)).not.toEqual(
      clairiereStory.scenes.start?.choices.map((c) => c.id),
    );
    // La copie garde les memes cibles : seule son identite change.
    expect(copy?.choices.map((c) => c.target)).toEqual(['lucioles', 'arbre']);
  });

  it('bascule une scene en fin et revient en arriere', () => {
    const marked = toggleEnding(clone(), 'lucioles');
    expect(marked.scenes.lucioles?.ending?.name).toBe('Les lucioles');
    const unmarked = toggleEnding(marked, 'lucioles');
    expect(unmarked.scenes.lucioles?.ending).toBeUndefined();
    // Les choix survivent a l'aller-retour.
    expect(unmarked.scenes.lucioles?.choices).toHaveLength(3);
  });

  it('ajoute un choix visant une autre scene, jamais la scene elle-meme', () => {
    const story = addChoice(clone(), 'start');
    const added = story.scenes.start?.choices.at(-1);
    expect(added?.target).not.toBe('start');
    expect(validateStory(story).valid).toBe(true);
  });

  it('met a jour un choix et nettoie les effets vides', () => {
    const story = updateChoice(clone(), 'start', 'vers-lucioles', {
      label: 'Suivre la lumière',
      effects: [],
    });
    const choice = story.scenes.start?.choices[0];
    expect(choice?.label).toBe('Suivre la lumière');
    expect('effects' in (choice ?? {})).toBe(false);
  });

  it('supprime un choix', () => {
    const story = removeChoice(clone(), 'start', 'vers-arbre');
    expect(story.scenes.start?.choices).toHaveLength(1);
  });

  it('change la scene de depart', () => {
    expect(setStartScene(clone(), 'arbre').startSceneId).toBe('arbre');
    // Une cible inconnue ne change rien.
    expect(setStartScene(clone(), 'inconnue').startSceneId).toBe('start');
  });

  it('renomme une scene en repointant tout ce qui la visait', () => {
    const story = renameSceneId(clone(), 'lucioles', 'Les lucioles dansantes');
    expect(story.scenes['les-lucioles-dansantes']).toBeDefined();
    expect(story.scenes.lucioles).toBeUndefined();
    expect(story.scenes.start?.choices[0]?.target).toBe('les-lucioles-dansantes');
    expect(validateStory(story).valid).toBe(true);
  });

  it('renomme la scene de depart en gardant le pointeur du recit', () => {
    const story = renameSceneId(clone(), 'start', 'ouverture');
    expect(story.startSceneId).toBe('ouverture');
    expect(validateStory(story).valid).toBe(true);
  });

  it('uniqueSceneId evite les collisions', () => {
    const story = clone();
    expect(uniqueSceneId(story, 'start')).toBe('start-2');
    expect(uniqueSceneId(story, 'toute nouvelle')).toBe('toute-nouvelle');
  });

  it('compte les fins', () => {
    expect(countEndings(clairiereStory)).toBe(3);
  });
});
