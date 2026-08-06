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
  it('never alters the original document', () => {
    const story = clone();
    updateScene(story, 'start', { title: 'Autre titre' });
    expect(story.scenes.start?.title).toBe('Le sentier');
  });

  it('adds a node of the requested kind, with a free id', () => {
    const { story, sceneId } = addScene(clone(), 'player', { x: 10, y: 20 });
    expect(story.scenes[sceneId]?.kind).toBe('player');
    expect(story.scenes[sceneId]?.position).toEqual({ x: 10, y: 20 });
  });

  it('creates a child node and the link leading to it, in one gesture', () => {
    const { story, sceneId } = addChild(clone(), 'prudence', 'npc', { x: 0, y: 0 });
    expect(story.scenes.prudence?.next.map((link) => link.to)).toEqual(['lucioles', sceneId]);
    // The link is born with its target: never a dangling target.
    expect(validateStory(story).issues.some((issue) => issue.code === 'dangling-link-target')).toBe(
      false,
    );
  });

  it('gives a label to a created choice, without which its button would be empty', () => {
    const { story, sceneId } = addScene(clone(), 'choice', { x: 0, y: 0 });
    expect(story.scenes[sceneId]?.label).toBeTruthy();
  });

  it('deletes a node and the links that led to it', () => {
    const story = removeScene(clone(), 'c-lucioles');
    expect(story.scenes['c-lucioles']).toBeUndefined();
    expect(story.scenes.start?.next.map((link) => link.to)).toEqual(['c-arbre']);
    // No dangling target left behind: the story stays playable.
    expect(validateStory(story).valid).toBe(true);
  });

  it('moves the start scene when it is deleted', () => {
    const story = removeScene(clone(), 'start');
    expect(story.startSceneId).not.toBe('start');
    expect(story.scenes[story.startSceneId]).toBeDefined();
  });

  it('duplicates a node with new link ids', () => {
    const { story, sceneId } = duplicateScene(clone(), 'start');
    const copy = story.scenes[sceneId];
    expect(copy?.title).toBe('Le sentier (copie)');
    expect(copy?.next.map((link) => link.id)).not.toEqual(
      clairiereStory.scenes.start?.next.map((link) => link.id),
    );
    // The copy keeps the same targets: only its identity changes.
    expect(copy?.next.map((link) => link.to)).toEqual(['c-lucioles', 'c-arbre']);
  });

  it('changes the kind of a node and sets a label when it becomes a choice', () => {
    const story = setKind(clone(), 'prudence', 'choice');
    expect(story.scenes.prudence?.kind).toBe('choice');
    expect(story.scenes.prudence?.label).toBe('Sans rien brusquer');
  });

  it('toggles a node as an ending and back', () => {
    const marked = toggleEnding(clone(), 'lucioles');
    expect(marked.scenes.lucioles?.ending?.name).toBe('Les lucioles');
    const unmarked = toggleEnding(marked, 'lucioles');
    expect(unmarked.scenes.lucioles?.ending).toBeUndefined();
    // The links survive the round-trip.
    expect(unmarked.scenes.lucioles?.next).toHaveLength(3);
  });

  it('adds a link to an existing node, only once', () => {
    const story = addLink(clone(), 'prudence', 'start');
    expect(story.scenes.prudence?.next.map((link) => link.to)).toEqual(['lucioles', 'start']);
    // The same link twice would add nothing.
    expect(addLink(story, 'prudence', 'start')).toBe(story);
  });

  it('updates a link and cleans up empty fields', () => {
    const story = updateLink(clone(), 'start', 'vers-lucioles', { to: 'c-arbre', effects: [] });
    const link = story.scenes.start?.next[0];
    expect(link?.to).toBe('c-arbre');
    expect('effects' in (link ?? {})).toBe(false);
  });

  it('deletes a link', () => {
    const story = removeLink(clone(), 'start', 'vers-arbre');
    expect(story.scenes.start?.next).toHaveLength(1);
  });

  it('finds the sole incoming link of a choice, to edit it from the button', () => {
    const found = soleIncomingLink(clairiereStory, 'c-elara');
    expect(found?.sceneId).toBe('lucioles');
    expect(found?.link.condition).toEqual({ op: 'eq', variable: 'prudent', value: true });
  });

  it('gives up when several paths lead to the same node', () => {
    // `portail` is reached from `c-franchir` and from `c-elara`.
    expect(soleIncomingLink(clairiereStory, 'portail')).toBeNull();
  });

  it('changes the start scene', () => {
    expect(setStartScene(clone(), 'arbre').startSceneId).toBe('arbre');
    // An unknown target changes nothing.
    expect(setStartScene(clone(), 'inconnue').startSceneId).toBe('start');
  });

  it('renames a node, repointing everything that targeted it', () => {
    const story = renameSceneId(clone(), 'lucioles', 'Les lucioles dansantes');
    expect(story.scenes['les-lucioles-dansantes']).toBeDefined();
    expect(story.scenes.lucioles).toBeUndefined();
    expect(story.scenes['c-lucioles']?.next[0]?.to).toBe('les-lucioles-dansantes');
    expect(story.scenes.prudence?.next[0]?.to).toBe('les-lucioles-dansantes');
    expect(validateStory(story).valid).toBe(true);
  });

  it('renames the start scene, keeping the story pointer', () => {
    const story = renameSceneId(clone(), 'start', 'ouverture');
    expect(story.startSceneId).toBe('ouverture');
    expect(validateStory(story).valid).toBe(true);
  });

  it('uniqueSceneId avoids collisions', () => {
    const story = clone();
    expect(uniqueSceneId(story, 'start')).toBe('start-2');
    expect(uniqueSceneId(story, 'toute nouvelle')).toBe('toute-nouvelle');
  });

  it('counts the endings', () => {
    expect(countEndings(clairiereStory)).toBe(3);
  });
});
