/**
 * Full-text search across the scenes of a story.
 *
 * Fifty nodes in, "where did I write that line?" stops being answerable by
 * looking at the canvas. The search covers everything the author typed — title,
 * button label, messages, ending — plus the node id, because that is what the
 * inspector and the JSON show.
 *
 * Matching ignores case and accents: an author who types « lucioles » must find
 * « Lucioles » and « Luciolés » alike.
 */

import { kinds } from '@embranche/design-tokens';
import type { Scene, SceneId, Story } from '@embranche/story-format';

export type SearchField = 'title' | 'label' | 'text' | 'ending' | 'id';

export interface SearchHit {
  sceneId: SceneId;
  /** Field the match was found in — the most telling one, when several match. */
  field: SearchField;
  /** Label of the node kind, so the result list reads like the canvas. */
  kind: string;
  /** Node name, as the canvas shows it. */
  name: string;
  /** Surrounding text, trimmed around the match. */
  excerpt: string;
}

const EXCERPT_RADIUS = 34;

/** Lowercases and strips accents — the only normalization the search does. */
export function normalize(input: string): string {
  return input
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/**
 * One hit per scene at most: the point is to find *the node*, and listing the
 * same node four times because the word appears in four of its messages helps
 * nobody. Fields are examined in the order an author thinks of them.
 */
export function searchScenes(story: Story, query: string): SearchHit[] {
  const needle = normalize(query.trim());
  if (needle.length === 0) return [];

  const hits: SearchHit[] = [];
  for (const scene of Object.values(story.scenes)) {
    const hit = matchScene(scene, needle);
    if (hit) hits.push(hit);
  }
  return hits;
}

/** Just the ids — what the canvas needs to light the matching nodes up. */
export function matchingScenes(story: Story, query: string): Set<SceneId> {
  return new Set(searchScenes(story, query).map((hit) => hit.sceneId));
}

function matchScene(scene: Scene, needle: string): SearchHit | null {
  const candidates: { field: SearchField; value: string }[] = [
    { field: 'title', value: scene.title },
    { field: 'label', value: scene.label ?? '' },
    { field: 'text', value: scene.blocks.map((block) => block.text).join(' · ') },
    {
      field: 'ending',
      value: scene.ending ? `${scene.ending.type} ${scene.ending.name} ${scene.ending.blurb}` : '',
    },
    { field: 'id', value: scene.id },
  ];

  for (const candidate of candidates) {
    const at = normalize(candidate.value).indexOf(needle);
    if (at < 0) continue;
    return {
      sceneId: scene.id,
      field: candidate.field,
      kind: kinds[scene.kind].label,
      name: (scene.kind === 'choice' ? scene.label || scene.title : scene.title) || scene.id,
      excerpt: excerpt(candidate.value, at, needle.length),
    };
  }
  return null;
}

/** Trims the value around the match, with ellipses where it was cut. */
function excerpt(value: string, at: number, length: number): string {
  const start = Math.max(0, at - EXCERPT_RADIUS);
  const end = Math.min(value.length, at + length + EXCERPT_RADIUS);
  return `${start > 0 ? '…' : ''}${value.slice(start, end).trim()}${end < value.length ? '…' : ''}`;
}
