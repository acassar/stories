import { describe, expect, it } from 'vitest';

import { cimesStory, clairiereStory, exampleStories } from './examples.js';
import { createEmptyStory, createScene, slugify } from './factories.js';
import { hasWaits, waitMinutesOf } from './scenes.js';
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

/** Deep copy: tests must never damage the shared examples. */
function clone(story: Story): Story {
  return JSON.parse(JSON.stringify(story)) as Story;
}

describe('validateStoryShape', () => {
  it('accepts a well-formed document', () => {
    expect(validateStoryShape(clairiereStory).valid).toBe(true);
  });

  it('rejects a document that is not an object', () => {
    const result = validateStoryShape('pas une histoire');
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.code).toBe('schema');
  });

  it('rejects a missing required field and points at the offending path', () => {
    const story = clone(clairiereStory) as Partial<Story>;
    delete story.startSceneId;
    const result = validateStoryShape(story);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.path === 'startSceneId')).toBe(true);
  });

  it('rejects a scene id containing forbidden characters', () => {
    const story = clone(clairiereStory);
    story.scenes['scene invalide'] = createScene({ id: 'scene invalide', kind: 'npc' });
    expect(validateStoryShape(story).valid).toBe(false);
  });

  it('rejects a node kind outside the vocabulary', () => {
    const story = clone(clairiereStory);
    // @ts-expect-error — an unknown kind is injected on purpose
    story.scenes.start.kind = 'narrateur';
    expect(validateStoryShape(story).valid).toBe(false);
  });

  it('rejects a condition with an unknown operator', () => {
    const story = clone(clairiereStory);
    // @ts-expect-error — an out-of-vocabulary operator is injected on purpose
    story.scenes.start.next[0].condition = { op: 'eval', code: 'process.exit()' };
    expect(validateStoryShape(story).valid).toBe(false);
  });
});

describe('validateStory — graph coherence', () => {
  it('validates the sample stories without error', () => {
    for (const story of exampleStories) {
      const result = validateStory(story);
      const errors = result.issues.filter((i) => i.severity === 'error');
      expect(errors, `${story.title} : ${errors.map((e) => e.message).join(' | ')}`).toEqual([]);
      expect(result.valid).toBe(true);
    }
  });

  it('validates the story produced by createEmptyStory', () => {
    expect(validateStory(createEmptyStory()).valid).toBe(true);
  });

  it('reports a start scene that does not exist', () => {
    const story = clone(clairiereStory);
    story.startSceneId = 'nulle-part';
    const result = validateStory(story);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === 'missing-start-scene')).toBe(true);
  });

  it('reports a link to a scene that does not exist', () => {
    const story = clone(clairiereStory);
    story.scenes.start!.next[0]!.to = 'fantome';
    const result = validateStory(story);
    expect(result.valid).toBe(false);
    const issue = result.issues.find((i) => i.code === 'dangling-link-target');
    expect(issue?.sceneId).toBe('start');
    expect(issue?.linkId).toBe('vers-lucioles');
  });

  it('reports a dictionary key that does not match the scene id', () => {
    const story = clone(clairiereStory);
    story.scenes.egaree = createScene({ id: 'autre-id', kind: 'npc' });
    const result = validateStory(story);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === 'scene-id-mismatch')).toBe(true);
  });

  it('reports two links sharing the same id', () => {
    const story = clone(clairiereStory);
    const scene = story.scenes.start!;
    scene.next.push({ ...scene.next[0]!, to: 'c-arbre' });
    const result = validateStory(story);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === 'duplicate-link-id')).toBe(true);
  });

  it('reports a choice node without a label: the button would be empty', () => {
    const story = clone(clairiereStory);
    delete story.scenes['c-lucioles']!.label;
    const result = validateStory(story);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === 'choice-without-label')).toBe(true);
  });

  it('refuses a node that mixes choices and chaining', () => {
    const story = clone(clairiereStory);
    // `start` already offers two choices; add a direct link to an npc node.
    story.scenes.start!.next.push({ id: 'raccourci', to: 'arbre' });
    const result = validateStory(story);
    expect(result.valid).toBe(false);
    const issue = result.issues.find((i) => i.code === 'mixed-links');
    expect(issue?.sceneId).toBe('start');
  });

  it('refuses a chaining loop the player could not break', () => {
    const story = clone(clairiereStory);
    // `prudence` already chains on its own; make it loop back on itself.
    story.scenes.prudence!.next = [{ id: 'boucle', to: 'prudence' }];
    const result = validateStory(story);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === 'auto-loop' && i.sceneId === 'prudence')).toBe(
      true,
    );
  });

  it('accepts a loop that goes through a choice — the player can leave it', () => {
    // `c-repartir` leads back to `sommet`, already visited: that is legitimate.
    expect(validateStory(cimesStory).issues.some((i) => i.code === 'auto-loop')).toBe(false);
  });

  it('warns when every link of a chaining node is conditional', () => {
    const story = clone(clairiereStory);
    story.scenes.prudence!.next[0]!.condition = { op: 'eq', variable: 'prudent', value: true };
    const issue = validateStory(story).issues.find((i) => i.code === 'no-default-link');
    expect(issue?.severity).toBe('warning');
    expect(issue?.sceneId).toBe('prudence');
  });

  it('warns — without blocking — about an orphan scene', () => {
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

  it('warns about a dead end: neither continuation nor ending', () => {
    const story = clone(clairiereStory);
    delete story.scenes.portail!.ending;
    const result = validateStory(story);
    expect(result.valid).toBe(true);
    expect(result.issues.some((i) => i.code === 'dead-end' && i.sceneId === 'portail')).toBe(true);
  });

  it('warns about an ending that keeps outgoing links', () => {
    const story = clone(clairiereStory);
    story.scenes.portail!.next.push({ id: 'apres-la-fin', to: 'start' });
    const result = validateStory(story);
    expect(result.issues.some((i) => i.code === 'ending-with-links')).toBe(true);
  });

  it('warns about a link looping back on its own node', () => {
    const story = clone(clairiereStory);
    story.scenes.prudence!.next[0]!.to = 'prudence';
    expect(validateStory(story).issues.some((i) => i.code === 'self-loop')).toBe(true);
  });

  it('warns about a story without any ending', () => {
    const story = clone(clairiereStory);
    for (const scene of Object.values(story.scenes)) delete scene.ending;
    expect(validateStory(story).issues.some((i) => i.code === 'no-ending')).toBe(true);
  });

  it('warns about a condition reading a variable that is never written', () => {
    const story = clone(clairiereStory);
    story.scenes.start!.next[0]!.condition = { op: 'gt', variable: 'karma', value: 3 };
    const issue = validateStory(story).issues.find((i) => i.code === 'unknown-variable');
    expect(issue?.severity).toBe('warning');
    expect(issue?.message).toContain('karma');
  });

  it('warns about a text calling a variable the story never sets', () => {
    const story = clone(clairiereStory);
    story.scenes.start!.blocks[0]!.text = 'Bonjour {{ prenom }}, la nuit tombe.';
    const issue = validateStory(story).issues.find((i) => i.code === 'unknown-variable-in-text');
    expect(issue?.severity).toBe('warning');
    expect(issue?.sceneId).toBe('start');
    expect(issue?.message).toContain('prenom');
  });

  it('says nothing about a text calling a variable the story does set', () => {
    const story = clone(clairiereStory);
    // `prudent` is initialized by the story: naming it in the text is legitimate.
    story.scenes.start!.blocks[0]!.text = 'Tu avances, prudent : {{ prudent }}.';
    expect(validateStory(story).issues.some((i) => i.code === 'unknown-variable-in-text')).toBe(
      false,
    );
  });

  it('looks inside a button label and an ending as well as the body', () => {
    const story = clone(clairiereStory);
    story.scenes['c-lucioles']!.label = 'Suivre les {{ lueurs }}';
    story.scenes.portail!.ending!.blurb = 'Tu franchis avec {{ courage }}.';
    const codes = validateStory(story)
      .issues.filter((i) => i.code === 'unknown-variable-in-text')
      .map((i) => i.sceneId);
    expect(codes).toContain('c-lucioles');
    expect(codes).toContain('portail');
  });

  it('does not warn when the variable is written by an effect elsewhere', () => {
    // `prudent` is initialized by the story and set by an effect: nothing to report.
    const result = validateStory(clairiereStory);
    expect(result.issues.some((i) => i.code === 'unknown-variable')).toBe(false);
  });
});

describe('parseStory', () => {
  it('returns the typed story when it is valid', () => {
    expect(parseStory(clairiereStory).id).toBe('clairiere-lucioles');
  });

  it('throws StoryFormatError and exposes every issue', () => {
    const story = clone(clairiereStory);
    story.startSceneId = 'nulle-part';
    try {
      parseStory(story);
      expect.unreachable('parseStory should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(StoryFormatError);
      expect((error as StoryFormatError).issues.length).toBeGreaterThan(0);
    }
  });

  it('accepts a full JSON round-trip', () => {
    const parsed = parseStoryJson(JSON.stringify(clairiereStory));
    expect(parsed).toEqual(clairiereStory);
  });

  it('throws on syntactically invalid JSON', () => {
    expect(() => parseStoryJson('{ oups')).toThrow(StoryFormatError);
  });
});

describe('helpers', () => {
  it('findUnreachableScenes returns nothing on a connected story', () => {
    expect(findUnreachableScenes(clairiereStory)).toEqual([]);
  });

  it('collectConditionVariables descends into composite operators', () => {
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

  it('collectStoryVariables gathers variables read and written', () => {
    expect([...collectStoryVariables(clairiereStory)]).toEqual(['prudent']);
  });

  it('issuesForScene filters by scene', () => {
    const story = clone(clairiereStory);
    story.scenes.start!.next[0]!.to = 'fantome';
    const result = validateStory(story);
    expect(issuesForScene(result, 'start')).toHaveLength(1);
    expect(issuesForScene(result, 'arbre')).toHaveLength(0);
  });

  it('slugify produces an id accepted by the schema', () => {
    expect(slugify('La Clairière aux Lucioles !')).toBe('la-clairiere-aux-lucioles');
    expect(slugify('   ')).toBe('scene');
  });
});

describe('waits', () => {
  it('survives a JSON round-trip and passes validation', () => {
    const story = clone(clairiereStory);
    story.scenes.lucioles!.waitMinutes = 720;
    story.narrator = { name: 'Elara', status: 'en ligne', awayStatus: 'hors ligne' };

    const back = JSON.parse(JSON.stringify(story)) as Story;
    expect(validateStory(back).valid).toBe(true);
    expect(parseStory(back).scenes.lucioles?.waitMinutes).toBe(720);
    expect(parseStory(back).narrator?.awayStatus).toBe('hors ligne');
  });

  it('reports a wait declared on a choice, which would never be played', () => {
    const story = clone(clairiereStory);
    story.scenes['c-franchir']!.waitMinutes = 30;

    const result = validateStory(story);
    expect(result.valid).toBe(true);
    expect(result.issues.some((issue) => issue.code === 'wait-on-choice')).toBe(true);
  });

  it('rejects a negative wait as a malformed document', () => {
    const story = clone(clairiereStory);
    story.scenes.start!.waitMinutes = -5;
    expect(validateStoryShape(story).valid).toBe(false);
  });

  it('waitMinutesOf ignores what a choice declares; hasWaits is derived', () => {
    expect(hasWaits(clairiereStory)).toBe(false);

    const story = clone(clairiereStory);
    story.scenes['c-franchir']!.waitMinutes = 30;
    expect(waitMinutesOf(story.scenes['c-franchir']!)).toBe(0);
    expect(hasWaits(story)).toBe(false);

    story.scenes.lucioles!.waitMinutes = 15;
    expect(waitMinutesOf(story.scenes.lucioles!)).toBe(15);
    expect(hasWaits(story)).toBe(true);
  });

  it('a story written before waits existed reads as having none', () => {
    expect(hasWaits(createEmptyStory())).toBe(false);
    expect(waitMinutesOf(createScene({ id: 'x', kind: 'npc' }))).toBe(0);
  });
});
