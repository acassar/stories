import { describe, expect, it } from 'vitest';

import { clairiereStory, createEmptyStory, createLink, createScene } from '@embranche/story-format';
import type { Condition, Story } from '@embranche/story-format';

import { exploreReachable, findDeadScenes, linkKey } from './reachability.js';

/**
 * One start, two buttons, one of them behind `condition`. Whether `piege` is
 * reachable is exactly what the analysis has to decide.
 */
function forkedStory(condition: Condition): Story {
  const base = createEmptyStory({ id: 'fourche', title: 'Fourche' });
  return {
    ...base,
    variables: { ouvert: false },
    startSceneId: 'depart',
    scenes: {
      depart: createScene({
        id: 'depart',
        kind: 'npc',
        title: 'Le seuil',
        blocks: [{ text: 'Deux portes.' }],
        next: [
          createLink({ id: 'vers-sure', to: 'sure' }),
          createLink({ id: 'vers-risquee', to: 'risquee', condition }),
        ],
      }),
      sure: createScene({
        id: 'sure',
        kind: 'choice',
        title: 'La porte sûre',
        label: 'La porte sûre',
        next: [createLink({ id: 'vers-fin', to: 'fin' })],
      }),
      risquee: createScene({
        id: 'risquee',
        kind: 'choice',
        title: 'La porte risquée',
        label: 'La porte risquée',
        next: [createLink({ id: 'vers-piege', to: 'piege' })],
      }),
      piege: createScene({
        id: 'piege',
        kind: 'npc',
        title: 'Le piège',
        blocks: [{ text: 'Trop tard.' }],
        ending: { type: 'Fin', name: 'Le piège', blurb: 'Refermé.' },
      }),
      fin: createScene({
        id: 'fin',
        kind: 'npc',
        title: 'La sortie',
        blocks: [{ text: 'Dehors.' }],
        ending: { type: 'Fin', name: 'La sortie', blurb: 'Enfin.' },
      }),
    },
  };
}

describe('exploreReachable', () => {
  it('walks a story without conditions from end to end', () => {
    const report = exploreReachable(clairiereStory);
    expect(report.exhaustive).toBe(true);
    expect(report.scenes.has(clairiereStory.startSceneId)).toBe(true);
    expect(report.scenes.size).toBeGreaterThan(1);
  });

  it('declares dead a scene guarded by a condition no effect can satisfy', () => {
    const story = forkedStory({ op: 'eq', variable: 'ouvert', value: true });
    const report = exploreReachable(story);

    expect(report.scenes.has('sure')).toBe(true);
    expect(report.scenes.has('risquee')).toBe(false);
    expect(report.scenes.has('piege')).toBe(false);
    expect(findDeadScenes(story)).toEqual(['risquee', 'piege']);
  });

  it('keeps alive a scene whose condition an effect does satisfy', () => {
    const story = forkedStory({ op: 'eq', variable: 'ouvert', value: true });
    // The safe door now opens the risky one — the graph is unchanged, the
    // reading is not.
    story.scenes.sure!.next[0]!.effects = [{ op: 'set', variable: 'ouvert', value: true }];
    story.scenes.fin!.next = [createLink({ id: 'retour', to: 'depart' })];
    delete story.scenes.fin!.ending;

    const report = exploreReachable(story);
    expect(report.scenes.has('risquee')).toBe(true);
    expect(report.scenes.has('piege')).toBe(true);
    expect(findDeadScenes(story)).toEqual([]);
  });

  it('reports the links a run actually follows', () => {
    const story = forkedStory({ op: 'eq', variable: 'ouvert', value: true });
    const report = exploreReachable(story);
    expect(report.links.has(linkKey('depart', 'vers-sure'))).toBe(true);
    expect(report.links.has(linkKey('depart', 'vers-risquee'))).toBe(false);
  });

  it('follows only the first passable link out of a chaining node, like the engine', () => {
    const story = forkedStory({ op: 'always' });
    // Both targets stop being choices: the node now chains, and chaining takes
    // the first passable link and nothing else.
    story.scenes.sure!.kind = 'npc';
    story.scenes.risquee!.kind = 'npc';

    const report = exploreReachable(story);
    expect(report.scenes.has('sure')).toBe(true);
    expect(report.scenes.has('risquee')).toBe(false);
  });

  it('never leaves a terminal scene, even when links hang off it', () => {
    const story = forkedStory({ op: 'always' });
    story.scenes.piege!.next = [createLink({ id: 'fuite', to: 'depart' })];

    expect(exploreReachable(story).links.has(linkKey('piege', 'fuite'))).toBe(false);
  });

  it('gives up honestly rather than answering from a partial search', () => {
    const story = forkedStory({ op: 'always' });
    const report = exploreReachable(story, { maxStates: 1 });
    expect(report.exhaustive).toBe(false);
    // A bounded search proves nothing about what it did not see.
    expect(findDeadScenes(story, { maxStates: 1 })).toEqual([]);
  });

  it('returns an empty report when the start scene does not exist', () => {
    const story = { ...forkedStory({ op: 'always' }), startSceneId: 'fantome' };
    expect(exploreReachable(story).scenes.size).toBe(0);
  });

  it('takes `visited` into account without exploding the state space', () => {
    const story = forkedStory({ op: 'visited', scene: 'sure' });
    // `sure` is only walked through after leaving `depart`, so the guarded link
    // can never be taken on the way out of it.
    expect(exploreReachable(story).scenes.has('risquee')).toBe(false);
  });
});
