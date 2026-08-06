import { describe, expect, it } from 'vitest';

import { clairiereStory, validateStory } from '@embranche/story-format';

import { childPosition, edgeId, nextScenePosition, parseEdgeId, toEdges, toNodes } from './graph';

const issues = validateStory(clairiereStory).issues;
const sceneCount = Object.keys(clairiereStory.scenes).length;

describe('graph', () => {
  it('produces one node per scene, at its position from the format', () => {
    const nodes = toNodes(clairiereStory, issues, 'start');
    expect(nodes).toHaveLength(sceneCount);
    const start = nodes.find((node) => node.id === 'start');
    expect(start?.position).toEqual({ x: 400, y: 0 });
    expect(start?.data.isStart).toBe(true);
    expect(start?.selected).toBe(true);
  });

  it('marks the nodes that stop the reading to await a decision', () => {
    const nodes = toNodes(clairiereStory, issues, null);
    // `start` offers choices; `prudence` is a line that chains on its own.
    expect(nodes.find((node) => node.id === 'start')?.data.awaitsChoice).toBe(true);
    expect(nodes.find((node) => node.id === 'prudence')?.data.awaitsChoice).toBe(false);
  });

  it('produces one edge per link', () => {
    const edges = toEdges(clairiereStory, issues);
    const links = Object.values(clairiereStory.scenes).flatMap((scene) => scene.next);
    expect(edges).toHaveLength(links.length);
    expect(edges.find((e) => e.id === 'start:vers-lucioles')).toMatchObject({
      source: 'start',
      target: 'c-lucioles',
    });
  });

  it('animates conditional edges to set them apart', () => {
    const conditional = toEdges(clairiereStory, issues).find(
      (edge) => edge.id === 'lucioles:vers-elara',
    );
    expect(conditional?.animated).toBe(true);
    expect(conditional?.label).toBe('◇ si…');
  });

  it('shows on the edge what the node cannot say: the effects', () => {
    const withEffects = toEdges(clairiereStory, issues).find(
      (edge) => edge.id === 'arbre:vers-redescendre',
    );
    expect(withEffects?.label).toBe('⚙ 1');
  });

  it('leaves an unremarkable edge silent', () => {
    const plain = toEdges(clairiereStory, issues).find((edge) => edge.id === 'start:vers-arbre');
    expect(plain?.label).toBeUndefined();
  });

  it('ignores edges to a missing target — the node carries the alert', () => {
    const broken = structuredClone(clairiereStory);
    const before = toEdges(clairiereStory, issues).length;
    broken.scenes.start!.next[0]!.to = 'fantome';
    expect(toEdges(broken, validateStory(broken).issues)).toHaveLength(before - 1);
  });

  it('round-trips edge ids', () => {
    expect(parseEdgeId(edgeId('start', 'vers-lucioles'))).toEqual({
      sceneId: 'start',
      linkId: 'vers-lucioles',
    });
    expect(parseEdgeId('sans-separateur')).toBeNull();
  });

  it('places a new scene below the lowest one', () => {
    const lowest = Object.values(clairiereStory.scenes).reduce((a, b) =>
      b.position.y > a.position.y ? b : a,
    );
    expect(nextScenePosition(clairiereStory)).toEqual({
      x: lowest.position.x,
      y: lowest.position.y + 180,
    });
  });

  it('spreads the children of one parent so they do not stack', () => {
    const parent = clairiereStory.scenes.start!;
    expect(childPosition(parent, 1)).toEqual({ x: 400, y: 170 });
    expect(childPosition(parent, 2)).toEqual({ x: 530, y: 170 });
  });
});
