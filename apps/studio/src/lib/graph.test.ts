import { describe, expect, it } from 'vitest';

import { clairiereStory, validateStory } from '@embranche/story-format';

import {
  childPosition,
  edgeId,
  focusOn,
  nextScenePosition,
  parseEdgeId,
  toEdges,
  toNodes,
} from './graph';

const issues = validateStory(clairiereStory).issues;
const sceneCount = Object.keys(clairiereStory.scenes).length;

describe('graph', () => {
  it('produces one node per scene, at its position from the format', () => {
    const nodes = toNodes(clairiereStory, issues, ['start']);
    expect(nodes).toHaveLength(sceneCount);
    const start = nodes.find((node) => node.id === 'start');
    expect(start?.position).toEqual({ x: 400, y: 0 });
    expect(start?.data.isStart).toBe(true);
    expect(start?.selected).toBe(true);
  });

  it('marks the nodes that stop the reading to await a decision', () => {
    const nodes = toNodes(clairiereStory, issues, []);
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

  it('points every edge at its target: a story is read in one direction', () => {
    const edge = toEdges(clairiereStory, issues)[0];
    expect(edge?.markerEnd).toMatchObject({ type: 'arrowclosed' });
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

describe('focus', () => {
  it('tells apart what leads to a node and what follows from it', () => {
    const focus = focusOn(clairiereStory, ['c-lucioles']);

    expect(focus.selected).toEqual(new Set(['c-lucioles']));
    // `start` points at the choice: it is upstream.
    expect(focus.upstream.has('start')).toBe(true);
    expect(focus.downstream.has('start')).toBe(false);
    // `lucioles` is what the choice leads to.
    expect(focus.downstream.has('lucioles')).toBe(true);
  });

  it('marks the edges lying on the path, in both directions', () => {
    const focus = focusOn(clairiereStory, ['c-lucioles']);
    expect(focus.upstreamEdges.has('start:vers-lucioles')).toBe(true);
    expect(focus.downstreamEdges.has('c-lucioles:suite')).toBe(true);
  });

  it('lights the whole graph when nothing is selected', () => {
    const focus = focusOn(clairiereStory, []);
    expect(focus.selected.size).toBe(0);
    // `idle`, not `unrelated`: with no selection there is nothing to put
    // forward, so nothing is pushed back either.
    expect(
      toNodes(clairiereStory, issues, [], { focus }).every((node) => node.data.focus === 'idle'),
    ).toBe(true);
  });

  it('dims only when a selection actually singles something out', () => {
    const lit = toEdges(clairiereStory, issues, { focus: focusOn(clairiereStory, []) });
    expect(lit.every((edge) => edge.style?.opacity === 1)).toBe(true);

    const focused = toEdges(clairiereStory, issues, {
      focus: focusOn(clairiereStory, ['c-lucioles']),
    });
    expect(focused.some((edge) => edge.style?.opacity !== 1)).toBe(true);
  });

  it('survives a story that loops back on itself', () => {
    const looping = structuredClone(clairiereStory);
    looping.scenes.start!.next.push({ id: 'boucle', to: 'start' });
    expect(() => focusOn(looping, ['start'])).not.toThrow();
  });

  it('dims what the selection neither reaches nor comes from', () => {
    const focus = focusOn(clairiereStory, ['c-lucioles']);
    const nodes = toNodes(clairiereStory, issues, ['c-lucioles'], { focus });
    expect(nodes.find((node) => node.id === 'c-lucioles')?.data.focus).toBe('self');
    expect(nodes.find((node) => node.id === 'start')?.data.focus).toBe('upstream');
    expect(nodes.find((node) => node.id === 'lucioles')?.data.focus).toBe('downstream');
    // `c-arbre` hangs off the other branch of the opening choice.
    expect(nodes.find((node) => node.id === 'c-arbre')?.data.focus).toBe('unrelated');
  });
});

describe('projection flags', () => {
  it('carries the search matches down to the nodes', () => {
    const nodes = toNodes(clairiereStory, issues, [], { matches: new Set(['start']) });
    expect(nodes.find((node) => node.id === 'start')?.data.match).toBe(true);
    expect(nodes.find((node) => node.id === 'lucioles')?.data.match).toBe(false);
  });

  it('carries the dead paths down to the nodes and the edges', () => {
    const nodes = toNodes(clairiereStory, issues, [], { dead: new Set(['lucioles']) });
    expect(nodes.find((node) => node.id === 'lucioles')?.data.dead).toBe(true);

    const edges = toEdges(clairiereStory, issues, { deadLinks: new Set(['start:vers-lucioles']) });
    // A link no run can follow stops being animated: it advertises nothing.
    expect(edges.find((edge) => edge.id === 'start:vers-lucioles')?.animated).toBe(false);
  });
});
