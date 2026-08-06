import { describe, expect, it } from 'vitest';

import { clairiereStory, validateStory } from '@embranche/story-format';
import type { Story } from '@embranche/story-format';

import {
  addChild,
  addLink,
  addScene,
  copyScenes,
  countEndings,
  duplicateScene,
  pasteScenes,
  removeLink,
  removeScene,
  removeScenes,
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

describe('copy and paste', () => {
  it('copies nothing when nothing is selected', () => {
    expect(copyScenes(clone(), [])).toBeNull();
    expect(copyScenes(clone(), ['fantome'])).toBeNull();
  });

  it('pastes a copy under a free id, without touching the original', () => {
    const story = clone();
    const clipboard = copyScenes(story, ['lucioles'])!;
    const result = pasteScenes(story, clipboard);

    expect(result.sceneIds).toEqual(['lucioles-2']);
    expect(story.scenes['lucioles-2']).toBeUndefined();
    expect(result.story.scenes['lucioles-2']?.title).toBe(story.scenes.lucioles?.title);
  });

  it('offsets the copy so it does not hide the original', () => {
    const story = clone();
    const result = pasteScenes(story, copyScenes(story, ['lucioles'])!, { x: 40, y: 40 });
    expect(result.story.scenes['lucioles-2']?.position).toEqual({
      x: story.scenes.lucioles!.position.x + 40,
      y: story.scenes.lucioles!.position.y + 40,
    });
  });

  it('keeps a fragment wired to itself: a copied branch stays a branch', () => {
    const story = clone();
    const clipboard = copyScenes(story, ['c-lucioles', 'lucioles'])!;
    const result = pasteScenes(story, clipboard);

    const copiedChoice = result.story.scenes['c-lucioles-2'];
    expect(copiedChoice?.next[0]?.to).toBe('lucioles-2');
    // Link ids are regenerated: two links must never share one inside a node.
    expect(copiedChoice?.next[0]?.id).not.toBe(story.scenes['c-lucioles']?.next[0]?.id);
  });

  it('keeps a link leaving the fragment when its target still exists', () => {
    const story = clone();
    const result = pasteScenes(story, copyScenes(story, ['c-lucioles'])!);
    // The copy was not taken with its target, so it keeps pointing at it.
    expect(result.story.scenes['c-lucioles-2']?.next[0]?.to).toBe('lucioles');
    expect(validateStory(result.story).issues.filter((i) => i.severity === 'error')).toEqual([]);
  });

  it('drops a link whose target exists nowhere, rather than dangling', () => {
    const story = clone();
    const clipboard = copyScenes(story, ['c-lucioles'])!;
    const trimmed = removeScene(story, 'lucioles');

    const result = pasteScenes(trimmed, clipboard);
    expect(result.story.scenes['c-lucioles-2']?.next).toEqual([]);
  });

  it('pastes twice without the two copies sharing anything', () => {
    const story = clone();
    const clipboard = copyScenes(story, ['lucioles'])!;
    const first = pasteScenes(story, clipboard);
    const second = pasteScenes(first.story, clipboard);

    expect(second.sceneIds).toEqual(['lucioles-3']);
    const a = first.story.scenes['lucioles-2']!;
    const b = second.story.scenes['lucioles-3']!;
    expect(a.blocks).not.toBe(b.blocks);
    expect(a.next[0]?.id).not.toBe(b.next[0]?.id);
  });

  it('deletes several nodes in one operation', () => {
    const story = removeScenes(clone(), ['c-lucioles', 'lucioles']);
    expect(story.scenes['c-lucioles']).toBeUndefined();
    expect(story.scenes.lucioles).toBeUndefined();
    // No link is left pointing at what was removed.
    expect(
      Object.values(story.scenes).flatMap((scene) => scene.next.map((link) => link.to)),
    ).not.toContain('lucioles');
  });
});
