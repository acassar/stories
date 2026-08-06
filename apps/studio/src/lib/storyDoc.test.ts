import { describe, expect, it } from 'vitest';

import { clairiereStory, validateStory } from '@embranche/story-format';
import type { Story } from '@embranche/story-format';

import {
  addChild,
  addLink,
  addScene,
  countEndings,
  duplicateScene,
  removeLink,
  removeScene,
  renameSceneId,
  setKind,
  setStartScene,
  soleIncomingLink,
  toggleEnding,
  uniqueSceneId,
  updateLink,
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

  it('ajoute un noeud du type demande, avec un identifiant libre', () => {
    const { story, sceneId } = addScene(clone(), 'player', { x: 10, y: 20 });
    expect(story.scenes[sceneId]?.kind).toBe('player');
    expect(story.scenes[sceneId]?.position).toEqual({ x: 10, y: 20 });
  });

  it('cree un noeud enfant et le lien qui y mene, d’un seul geste', () => {
    const { story, sceneId } = addChild(clone(), 'prudence', 'npc', { x: 0, y: 0 });
    expect(story.scenes.prudence?.next.map((link) => link.to)).toEqual(['lucioles', sceneId]);
    // Le lien nait avec sa cible : jamais de cible pendante.
    expect(validateStory(story).issues.some((issue) => issue.code === 'dangling-link-target')).toBe(
      false,
    );
  });

  it('donne un libelle a un choix cree, sans quoi son bouton serait vide', () => {
    const { story, sceneId } = addScene(clone(), 'choice', { x: 0, y: 0 });
    expect(story.scenes[sceneId]?.label).toBeTruthy();
  });

  it('supprime un noeud et les liens qui y menaient', () => {
    const story = removeScene(clone(), 'c-lucioles');
    expect(story.scenes['c-lucioles']).toBeUndefined();
    expect(story.scenes.start?.next.map((link) => link.to)).toEqual(['c-arbre']);
    // Pas de cible pendante laissee derriere : le recit reste jouable.
    expect(validateStory(story).valid).toBe(true);
  });

  it('deplace la scene de depart si celle-ci est supprimee', () => {
    const story = removeScene(clone(), 'start');
    expect(story.startSceneId).not.toBe('start');
    expect(story.scenes[story.startSceneId]).toBeDefined();
  });

  it('duplique un noeud avec de nouveaux identifiants de liens', () => {
    const { story, sceneId } = duplicateScene(clone(), 'start');
    const copy = story.scenes[sceneId];
    expect(copy?.title).toBe('Le sentier (copie)');
    expect(copy?.next.map((link) => link.id)).not.toEqual(
      clairiereStory.scenes.start?.next.map((link) => link.id),
    );
    // La copie garde les memes cibles : seule son identite change.
    expect(copy?.next.map((link) => link.to)).toEqual(['c-lucioles', 'c-arbre']);
  });

  it('change le type d’un noeud et lui pose un libelle s’il devient un choix', () => {
    const story = setKind(clone(), 'prudence', 'choice');
    expect(story.scenes.prudence?.kind).toBe('choice');
    expect(story.scenes.prudence?.label).toBe('Sans rien brusquer');
  });

  it('bascule un noeud en fin et revient en arriere', () => {
    const marked = toggleEnding(clone(), 'lucioles');
    expect(marked.scenes.lucioles?.ending?.name).toBe('Les lucioles');
    const unmarked = toggleEnding(marked, 'lucioles');
    expect(unmarked.scenes.lucioles?.ending).toBeUndefined();
    // Les liens survivent a l'aller-retour.
    expect(unmarked.scenes.lucioles?.next).toHaveLength(3);
  });

  it('ajoute un lien vers un noeud existant, une seule fois', () => {
    const story = addLink(clone(), 'prudence', 'start');
    expect(story.scenes.prudence?.next.map((link) => link.to)).toEqual(['lucioles', 'start']);
    // Le meme lien deux fois n'ajouterait rien.
    expect(addLink(story, 'prudence', 'start')).toBe(story);
  });

  it('met a jour un lien et nettoie les champs vides', () => {
    const story = updateLink(clone(), 'start', 'vers-lucioles', { to: 'c-arbre', effects: [] });
    const link = story.scenes.start?.next[0];
    expect(link?.to).toBe('c-arbre');
    expect('effects' in (link ?? {})).toBe(false);
  });

  it('supprime un lien', () => {
    const story = removeLink(clone(), 'start', 'vers-arbre');
    expect(story.scenes.start?.next).toHaveLength(1);
  });

  it('retrouve le lien entrant unique d’un choix, pour l’editer depuis le bouton', () => {
    const found = soleIncomingLink(clairiereStory, 'c-elara');
    expect(found?.sceneId).toBe('lucioles');
    expect(found?.link.condition).toEqual({ op: 'eq', variable: 'prudent', value: true });
  });

  it('renonce quand plusieurs chemins mènent au meme noeud', () => {
    // `portail` est atteint par `c-franchir` et par `c-elara`.
    expect(soleIncomingLink(clairiereStory, 'portail')).toBeNull();
  });

  it('change la scene de depart', () => {
    expect(setStartScene(clone(), 'arbre').startSceneId).toBe('arbre');
    // Une cible inconnue ne change rien.
    expect(setStartScene(clone(), 'inconnue').startSceneId).toBe('start');
  });

  it('renomme un noeud en repointant tout ce qui le visait', () => {
    const story = renameSceneId(clone(), 'lucioles', 'Les lucioles dansantes');
    expect(story.scenes['les-lucioles-dansantes']).toBeDefined();
    expect(story.scenes.lucioles).toBeUndefined();
    expect(story.scenes['c-lucioles']?.next[0]?.to).toBe('les-lucioles-dansantes');
    expect(story.scenes.prudence?.next[0]?.to).toBe('les-lucioles-dansantes');
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
