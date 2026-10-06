import { describe, expect, it } from 'vitest';

import { clairiereStory } from './fixtures/index.js';
import { languageOf, localizeStory, storyLanguages, untranslatedScenes } from './translate.js';
import { validateStory, validateStoryShape } from './validate.js';
import type { Scene, Story, StoryTranslation } from './types.js';

/** Deep copy: tests must never damage the shared examples. */
function clone(story: Story): Story {
  return JSON.parse(JSON.stringify(story)) as Story;
}

/** Every piece of text the story shows, in English. */
function fullEnglish(story: Story): StoryTranslation {
  const scenes: StoryTranslation['scenes'] = {};
  for (const scene of Object.values(story.scenes)) {
    scenes[scene.id] = {
      blocks: scene.blocks.map((block) => `EN ${block.text}`),
      ...(scene.label && { label: `EN ${scene.label}` }),
      ...(scene.section && { section: { title: 'Chapter' } }),
      ...(scene.ending && { ending: { type: 'Ending', name: 'EN', blurb: 'EN' } }),
    };
  }
  return { title: 'The Firefly Glade', blurb: 'One night…', scenes };
}

function withEnglish(translation: StoryTranslation = fullEnglish(clairiereStory)): Story {
  return { ...clone(clairiereStory), translations: { en: translation } };
}

describe('languages', () => {
  it('reads a story without a language as French', () => {
    expect(languageOf(clairiereStory)).toBe('fr');
    expect(storyLanguages(clairiereStory)).toEqual(['fr']);
  });

  it('lists the story language first, then its translations', () => {
    expect(storyLanguages({ language: 'en', translations: { fr: {}, de: {} } })).toEqual([
      'en',
      'fr',
      'de',
    ]);
  });

  it('does not list the story language twice', () => {
    expect(storyLanguages({ language: 'fr', translations: { fr: {} } })).toEqual(['fr']);
  });
});

describe('localizeStory', () => {
  it('gives the story back untouched in its own language or an unknown one', () => {
    const story = withEnglish();
    expect(localizeStory(story, 'fr')).toBe(story);
    expect(localizeStory(story, 'de')).toBe(story);
  });

  it('replaces the text and keeps the graph', () => {
    const story = withEnglish();
    const english = localizeStory(story, 'en');
    const start = english.scenes.start as Scene;

    expect(english.title).toBe('The Firefly Glade');
    expect(english.language).toBe('en');
    expect(start.blocks[0]?.text).toMatch(/^EN /);
    expect(start.next).toEqual(story.scenes.start?.next);
    expect(english.variables).toEqual(story.variables);
  });

  it('keeps the original where the translation is silent', () => {
    const story = withEnglish({ scenes: { start: { blocks: ['The path.'] } } });
    const english = localizeStory(story, 'en');

    expect(english.title).toBe(clairiereStory.title);
    expect(english.scenes.start?.blocks).toEqual([{ text: 'The path.' }]);
    expect(english.scenes['c-lucioles']).toBe(story.scenes['c-lucioles']);
  });

  it('lets a translation cut its lines differently from the original', () => {
    const story = withEnglish({ scenes: { start: { blocks: ['One.', 'Two.', 'Three.'] } } });
    expect(localizeStory(story, 'en').scenes.start?.blocks).toHaveLength(3);
  });

  it('merges a partial ending and narrator over the original', () => {
    const story = withEnglish({ narrator: { status: 'the voice of the glade' } });
    const ending = Object.values(story.scenes).find((scene) => scene.ending) as Scene;
    story.translations!.en!.scenes = { [ending.id]: { ending: { name: 'Home' } } };

    const english = localizeStory(story, 'en');
    expect(english.narrator).toEqual({ name: 'Elara', status: 'the voice of the glade' });
    expect(english.scenes[ending.id]?.ending).toEqual({ ...ending.ending, name: 'Home' });
  });
});

describe('untranslatedScenes', () => {
  it('finds nothing missing in a complete translation', () => {
    expect(untranslatedScenes(clairiereStory, fullEnglish(clairiereStory))).toEqual([]);
  });

  it('names each scene still holding original text', () => {
    const translation = fullEnglish(clairiereStory);
    delete translation.scenes!.start;
    delete translation.scenes!['c-lucioles']!.label;
    expect(untranslatedScenes(clairiereStory, translation)).toEqual(['start', 'c-lucioles']);
  });
});

describe('validating translations', () => {
  it('accepts a complete translation without a word', () => {
    const result = validateStory(withEnglish());
    expect(result.issues.filter((issue) => issue.code.startsWith('translation'))).toEqual([]);
  });

  it('rejects a language that is not a tag', () => {
    expect(validateStoryShape({ ...clone(clairiereStory), language: 'Français' }).valid).toBe(
      false,
    );
    expect(validateStoryShape({ ...clone(clairiereStory), translations: { EN: {} } }).valid).toBe(
      false,
    );
  });

  it('reports a half-done translation once, without blocking', () => {
    const result = validateStory(withEnglish({ scenes: { start: { blocks: ['The path.'] } } }));
    const incomplete = result.issues.filter((issue) => issue.code === 'translation-incomplete');

    expect(result.valid).toBe(true);
    expect(incomplete).toHaveLength(1);
    expect(incomplete[0]?.severity).toBe('warning');
  });

  it('reports text given to a scene the story does not have', () => {
    const translation = fullEnglish(clairiereStory);
    translation.scenes!.ghost = { blocks: ['Boo.'] };
    const result = validateStory(withEnglish(translation));
    expect(result.issues.some((issue) => issue.code === 'translation-unknown-scene')).toBe(true);
  });

  it('reports a token in a translation naming a variable nobody sets', () => {
    const translation = fullEnglish(clairiereStory);
    translation.scenes!.start!.blocks = ['You have {{ lantern }} lanterns.'];
    const result = validateStory(withEnglish(translation));
    expect(
      result.issues.some(
        (issue) => issue.code === 'unknown-variable-in-text' && issue.message.includes('lantern'),
      ),
    ).toBe(true);
  });
});
