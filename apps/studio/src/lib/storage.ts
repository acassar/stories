/**
 * Local persistence of the studio.
 *
 * `localStorage` lives *here*, not in the engine nor in the format: replacing
 * this file with an HTTP client or with the Tauri file system would not require
 * touching anything else.
 */

import { exampleStories, migrateStory, validateStory } from '@embranche/story-format';
import type { Story } from '@embranche/story-format';

const STORAGE_KEY = 'embranche.studio.stories.v1';

/** Storage interface — abstracted to keep the module testable. */
export interface StoryRepository {
  list(): Story[];
  save(story: Story): void;
  remove(storyId: string): void;
}

function readAll(storage: Storage): Story[] {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Everything structurally readable is kept: a story being written can be
    // inconsistent without being unrecoverable. A draft written under an older
    // format is migrated along the way, not discarded.
    return parsed.map(migrateStory).filter((item): item is Story => isStoryLike(item));
  } catch {
    return [];
  }
}

function isStoryLike(value: unknown): value is Story {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<Story>;
  return typeof candidate.id === 'string' && typeof candidate.scenes === 'object';
}

function writeAll(storage: Storage, stories: Story[]): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(stories));
}

export function createLocalRepository(storage: Storage = window.localStorage): StoryRepository {
  return {
    list: () => readAll(storage),
    save(story) {
      const stories = readAll(storage);
      const index = stories.findIndex((s) => s.id === story.id);
      if (index >= 0) stories[index] = story;
      else stories.push(story);
      writeAll(storage, stories);
    },
    remove(storyId) {
      writeAll(
        storage,
        readAll(storage).filter((s) => s.id !== storyId),
      );
    },
  };
}

/**
 * On the very first launch, the library is seeded with the sample stories: an
 * empty studio teaches nobody anything.
 */
export function seedIfEmpty(repository: StoryRepository): Story[] {
  const existing = repository.list();
  if (existing.length > 0) return existing;
  for (const story of exampleStories) repository.save(structuredClone(story));
  return repository.list();
}

/** Downloads the story in `story-format` — the file the reader opens. */
export function downloadStoryJson(story: Story): void {
  const blob = new Blob([JSON.stringify(story, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${story.id}.embranche.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export interface ImportResult {
  story?: Story;
  error?: string;
}

/**
 * Reads the content of a file. `Blob.text()` is still missing on a few engines
 * (and on jsdom), so `FileReader` is the fallback.
 */
function readFileText(file: File): Promise<string> {
  if (typeof file.text === 'function') return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Lecture impossible'));
    reader.readAsText(file);
  });
}

/** Reads a JSON file and refuses any document that fails validation. */
export async function importStoryFile(file: File): Promise<ImportResult> {
  let data: unknown;
  try {
    data = migrateStory(JSON.parse(await readFileText(file)));
  } catch {
    return { error: 'Ce fichier n’est pas du JSON valide.' };
  }
  const result = validateStory(data);
  const blocking = result.issues.filter((issue) => issue.severity === 'error');
  if (blocking.length > 0) {
    return { error: `Histoire refusée : ${blocking[0]?.message ?? 'document incohérent'}` };
  }
  return { story: data as Story };
}
