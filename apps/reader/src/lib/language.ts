/**
 * Which language each story is read in.
 *
 * A choice per story rather than one for the whole reader: stories come with
 * the languages their authors gave them, and someone reading one in English
 * may well keep another in its French. With no choice made, the first language
 * the browser asks for that the story offers wins, and the story's own after it.
 *
 * As in `library.ts`, `localStorage` lives here and nowhere else.
 */

import { languageOf, storyLanguages } from '@embranche/story-format';
import type { Story } from '@embranche/story-format';

const LANGUAGES_KEY = 'embranche.reader.languages.v1';

export function loadLanguages(storage: Storage = window.localStorage): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(LANGUAGES_KEY) ?? '{}');
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function saveLanguage(
  storyId: string,
  language: string,
  storage: Storage = window.localStorage,
): Record<string, string> {
  const languages = { ...loadLanguages(storage), [storyId]: language };
  storage.setItem(LANGUAGES_KEY, JSON.stringify(languages));
  return languages;
}

export function forgetLanguage(storyId: string, storage: Storage = window.localStorage): void {
  const languages = loadLanguages(storage);
  delete languages[storyId];
  storage.setItem(LANGUAGES_KEY, JSON.stringify(languages));
}

/**
 * The language to read `story` in. A choice the story no longer offers — its
 * translation was dropped by a new version — falls back like no choice at all.
 */
export function pickLanguage(
  story: Pick<Story, 'language' | 'translations'>,
  chosen: string | undefined,
  preferred: readonly string[] = [],
): string {
  const offered = storyLanguages(story);
  if (chosen && offered.includes(chosen)) return chosen;
  for (const wanted of preferred) {
    const exact = offered.find((tag) => tag.toLowerCase() === wanted.toLowerCase());
    if (exact) return exact;
    const primary = wanted.split('-')[0]?.toLowerCase();
    const loose = offered.find((tag) => tag.split('-')[0] === primary);
    if (loose) return loose;
  }
  return languageOf(story);
}

/** A language named in itself — « Français », « English » — as its readers would look for it. */
export function languageName(tag: string): string {
  try {
    const name = new Intl.DisplayNames([tag], { type: 'language' }).of(tag);
    if (name && name !== tag) return name.charAt(0).toLocaleUpperCase(tag) + name.slice(1);
  } catch {
    // An engine without `DisplayNames`, or a tag it cannot read: the tag itself.
  }
  return tag.toUpperCase();
}
