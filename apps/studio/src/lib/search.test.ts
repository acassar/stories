import { describe, expect, it } from 'vitest';

import { clairiereStory } from '@embranche/story-format';

import { matchingScenes, normalize, searchScenes } from './search';

describe('search', () => {
  it('finds a node by a word of its text', () => {
    const hits = searchScenes(clairiereStory, 'fougères');
    expect(hits.map((hit) => hit.sceneId)).toContain('start');
    expect(hits.find((hit) => hit.sceneId === 'start')?.field).toBe('text');
  });

  it('ignores case and accents', () => {
    expect(normalize('Luciolés')).toBe('lucioles');
    expect(searchScenes(clairiereStory, 'LUCIOLES').length).toBeGreaterThan(0);
    expect(searchScenes(clairiereStory, 'lucioles')).toEqual(
      searchScenes(clairiereStory, 'LUCIOLÈS'),
    );
  });

  it('returns one hit per node, whatever the number of matches inside it', () => {
    const hits = searchScenes(clairiereStory, 'e');
    expect(new Set(hits.map((hit) => hit.sceneId)).size).toBe(hits.length);
  });

  it('names the field the match came from', () => {
    // Fields are examined in the order an author thinks of them, so a node
    // whose title and label both match is reported on its title.
    const byTitle = searchScenes(clairiereStory, 'Suivre les lucioles');
    expect(byTitle.find((hit) => hit.sceneId === 'c-lucioles')?.field).toBe('title');

    const renamedLabel = structuredClone(clairiereStory);
    renamedLabel.scenes['c-lucioles']!.label = 'Mentir effrontément';
    expect(searchScenes(renamedLabel, 'effrontément')[0]?.field).toBe('label');

    const byId = searchScenes(clairiereStory, 'c-arbre');
    expect(byId.find((hit) => hit.sceneId === 'c-arbre')?.field).toBe('id');
  });

  it('answers nothing to an empty query rather than everything', () => {
    expect(searchScenes(clairiereStory, '')).toEqual([]);
    expect(searchScenes(clairiereStory, '   ')).toEqual([]);
    expect(matchingScenes(clairiereStory, '').size).toBe(0);
  });

  it('trims the excerpt around the match', () => {
    const hit = searchScenes(clairiereStory, 'fougères')[0];
    expect(hit?.excerpt).toContain('fougères');
    expect(hit?.excerpt.length).toBeLessThan(120);
  });

  it('reports the kind and the displayed name of the node', () => {
    const hit = searchScenes(clairiereStory, 'Suivre les lucioles').find(
      (candidate) => candidate.sceneId === 'c-lucioles',
    );
    expect(hit?.kind).toBe('Choix');
    expect(hit?.name).toBe('Suivre les lucioles');
  });

  it('finds nothing when nothing matches', () => {
    expect(searchScenes(clairiereStory, 'hippopotame')).toEqual([]);
  });
});
