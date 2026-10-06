/**
 * A story in several languages.
 *
 * A translation is a layer laid over the text of a story, never a second
 * story: the scenes, the links, the conditions and the waits exist once. So a
 * run is the same run whatever language it is read in — the save names scenes
 * and links, not sentences — and a reader can change language halfway through
 * without losing a step.
 *
 * `localizeStory` is a lens, like `interpolate`: it returns the story as it
 * reads in one language, and the engine plays it without knowing.
 */

import type { Scene, SceneId, Story, StoryTranslation } from './types.js';

/** The language a story without `language` is written in. */
export const DEFAULT_STORY_LANGUAGE = 'fr';

/** The language the story is written in, its default made explicit. */
export function languageOf(story: Pick<Story, 'language'>): string {
  return story.language ?? DEFAULT_STORY_LANGUAGE;
}

/** Every language the story can be read in, its own first. */
export function storyLanguages(story: Pick<Story, 'language' | 'translations'>): string[] {
  const own = languageOf(story);
  return [own, ...Object.keys(story.translations ?? {}).filter((tag) => tag !== own)];
}

/**
 * The story as it reads in `language`. Its own language, or one it has no
 * translation for, gives the story back untouched — the same reference, so a
 * memoised engine is not rebuilt for nothing. Whatever the translation leaves
 * out reads in the original.
 */
export function localizeStory(story: Story, language: string): Story {
  const translation = story.translations?.[language];
  if (!translation || language === languageOf(story)) return story;

  const scenes: Record<SceneId, Scene> = {};
  for (const [id, scene] of Object.entries(story.scenes)) {
    const text = translation.scenes?.[id];
    scenes[id] = text
      ? {
          ...scene,
          ...(text.label !== undefined && { label: text.label }),
          ...(text.blocks && { blocks: text.blocks.map((line) => ({ text: line })) }),
          ...(text.section && scene.section && { section: { ...scene.section, ...text.section } }),
          ...(text.ending && scene.ending && { ending: { ...scene.ending, ...text.ending } }),
        }
      : scene;
  }

  return {
    ...story,
    language,
    title: translation.title ?? story.title,
    ...(translation.blurb !== undefined && { blurb: translation.blurb }),
    ...(translation.tag !== undefined && { tag: translation.tag }),
    ...(translation.narrator &&
      story.narrator && { narrator: { ...story.narrator, ...translation.narrator } }),
    scenes,
  };
}

/**
 * Scenes holding text the translation does not give, in story order. A scene
 * with nothing to read — no line, no button, no heading, no ending — is never
 * missing anything.
 */
export function untranslatedScenes(story: Story, translation: StoryTranslation): SceneId[] {
  return Object.values(story.scenes)
    .filter((scene) => {
      const text = translation.scenes?.[scene.id];
      if (scene.blocks.length > 0 && !text?.blocks) return true;
      if (scene.label && text?.label === undefined) return true;
      if (scene.section?.title && text?.section?.title === undefined) return true;
      const ending = text?.ending;
      if (!scene.ending) return false;
      return ending?.type === undefined || ending.name === undefined || ending.blurb === undefined;
    })
    .map((scene) => scene.id);
}
