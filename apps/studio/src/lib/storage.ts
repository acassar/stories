/**
 * Persistance locale du studio.
 *
 * C'est *ici* que vit `localStorage`, pas dans le moteur ni dans le format :
 * remplacer ce fichier par un client HTTP ou par le systeme de fichiers Tauri
 * ne demanderait de toucher a rien d'autre.
 */

import { exampleStories, validateStory } from '@embranche/story-format';
import type { Story } from '@embranche/story-format';

const STORAGE_KEY = 'embranche.studio.stories.v1';

/** Interface de rangement — abstraite pour rendre le module testable. */
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
    // On garde tout ce qui est structurellement lisible : un recit en cours
    // d'ecriture peut etre incoherent sans etre irrecuperable.
    return parsed.filter((item): item is Story => isStoryLike(item));
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
 * Au tout premier lancement, on amorce la bibliotheque avec les recits
 * d'exemple : un studio vide n'apprend rien a personne.
 */
export function seedIfEmpty(repository: StoryRepository): Story[] {
  const existing = repository.list();
  if (existing.length > 0) return existing;
  for (const story of exampleStories) repository.save(structuredClone(story));
  return repository.list();
}

/** Telecharge le recit au format `story-format` — le fichier lu par le lecteur. */
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
 * Lit le contenu d'un fichier. `Blob.text()` manque encore a l'appel sur
 * quelques moteurs (et sur jsdom) : on retombe alors sur `FileReader`.
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

/** Lit un fichier JSON et refuse tout document qui ne passe pas la validation. */
export async function importStoryFile(file: File): Promise<ImportResult> {
  let data: unknown;
  try {
    data = JSON.parse(await readFileText(file));
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
