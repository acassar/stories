import { describe, expect, it } from 'vitest';

import { clairiereStory, validateStory } from '@embranche/story-format';
import type { Link, Scene, Story } from '@embranche/story-format';

import {
  PORT,
  childPosition,
  edgeId,
  focusOn,
  nextScenePosition,
  parseEdgeId,
  routeOf,
  toEdges,
  toNodes,
} from './graph';
import type { LinkFlowEdge } from './graph';
import { DEFAULT_LAYOUT, arrangeStory } from './layout';

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

  it('carries the measured card sizes back onto the nodes', () => {
    // React Flow hides a node of unknown size, so the projection must hand back
    // what has already been measured rather than start over.
    const sizes = new Map([['start', { width: 190, height: 96 }]]);
    const nodes = toNodes(clairiereStory, issues, [], { sizes });

    expect(nodes.find((node) => node.id === 'start')?.measured).toEqual({ width: 190, height: 96 });
    expect(nodes.find((node) => node.id === 'prudence')?.measured).toBeUndefined();
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
      y: lowest.position.y + DEFAULT_LAYOUT.rowGap,
    });
  });

  // Written against the layout rather than against numbers: a scene created by
  // hand and the same scene after « Ranger » must land in the same place.
  it('spreads the children of one parent so they do not stack', () => {
    const parent = clairiereStory.scenes.start!;
    const { columnGap, rowGap } = DEFAULT_LAYOUT;
    expect(childPosition(parent, 1)).toEqual({ x: 400, y: rowGap });
    expect(childPosition(parent, 2)).toEqual({ x: 400 + columnGap, y: rowGap });
  });
});

describe('routing', () => {
  it('falls straight into a node sitting below', () => {
    expect(routeOf({ x: 0, y: 0 }, { x: 40, y: 200 })).toEqual({
      sourceHandle: PORT.out,
      targetHandle: PORT.in,
    });
  });

  it('walks around the cards when the link climbs back up', () => {
    // Same side at both ends: the path brackets past the two nodes instead of
    // being drawn across them.
    expect(routeOf({ x: 0, y: 400 }, { x: 300, y: 0 })).toEqual({
      sourceHandle: PORT.outRight,
      targetHandle: PORT.inRight,
    });
    expect(routeOf({ x: 300, y: 400 }, { x: 0, y: 0 })).toEqual({
      sourceHandle: PORT.outLeft,
      targetHandle: PORT.inLeft,
    });
  });

  it('goes straight across between two nodes of the same rank', () => {
    expect(routeOf({ x: 0, y: 200 }, { x: 300, y: 200 })).toEqual({
      sourceHandle: PORT.outRight,
      targetHandle: PORT.inLeft,
    });
  });

  it('brackets a node that points at itself beside its own card', () => {
    expect(routeOf({ x: 50, y: 50 }, { x: 50, y: 50 })).toEqual({
      sourceHandle: PORT.outRight,
      targetHandle: PORT.inRight,
    });
  });

  it('routes every edge from the positions of the story', () => {
    const back = structuredClone(clairiereStory);
    // `portail` is an ending at the bottom of the graph: pointing it back at
    // the opening is the textbook climbing link.
    back.scenes.portail!.next = [{ id: 'recommencer', to: 'start' }];
    delete back.scenes.portail!.ending;
    const edge = toEdges(back, validateStory(back).issues).find(
      (item) => item.id === 'portail:recommencer',
    );
    expect(edge?.sourceHandle).toBe(PORT.outRight);
    expect(edge?.targetHandle).toBe(PORT.inRight);
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

  it('draws the links touching the selection heavier than the rest of the cone', () => {
    const edges = toEdges(clairiereStory, issues, {
      focus: focusOn(clairiereStory, ['c-lucioles']),
    });
    const touching = edges.find((edge) => edge.id === 'start:vers-lucioles');
    const further = edges.find((edge) => edge.id === 'c-lucioles:suite');
    const beyond = edges.find((edge) => edge.id === 'lucioles:vers-elara');

    expect(touching?.style?.strokeWidth).toBe(further?.style?.strokeWidth);
    expect(Number(touching?.style?.strokeWidth)).toBeGreaterThan(
      Number(beyond?.style?.strokeWidth),
    );
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

  it('carries the picked links down to the edges', () => {
    // React Flow is controlled: without this the click on a link never took,
    // and the delete key had nothing selected to remove.
    const edges = toEdges(clairiereStory, issues, {
      selectedLinks: new Set(['start:vers-lucioles']),
    });
    expect(edges.find((edge) => edge.id === 'start:vers-lucioles')?.selected).toBe(true);
    expect(edges.find((edge) => edge.id === 'start:vers-arbre')?.selected).toBe(false);
  });

  it('carries the dead paths down to the nodes and the edges', () => {
    const nodes = toNodes(clairiereStory, issues, [], { dead: new Set(['lucioles']) });
    expect(nodes.find((node) => node.id === 'lucioles')?.data.dead).toBe(true);

    const edges = toEdges(clairiereStory, issues, { deadLinks: new Set(['start:vers-lucioles']) });
    // A link no run can follow stops being animated: it advertises nothing.
    expect(edges.find((edge) => edge.id === 'start:vers-lucioles')?.animated).toBe(false);
  });
});

/*
 * How a link is drawn. `toEdges` is the only place that sees the whole wiring
 * at once, so it is the only place that can spread the departures of one node
 * and notice that two links cross — which is exactly what is checked here.
 */
describe('drawing the links', () => {
  /** Where a link starts, read back from the path it hands over. */
  function startOf(edge: LinkFlowEdge): { x: number; y: number } {
    const match = /^M (-?[\d.]+),(-?[\d.]+)/.exec(edge.data?.hit ?? '');
    if (!match) throw new Error(`no path on ${edge.id}`);
    return { x: Number(match[1]), y: Number(match[2]) };
  }

  /** Where it lands. */
  function endOf(edge: LinkFlowEdge): { x: number; y: number } {
    const match = /L (-?[\d.]+),(-?[\d.]+)$/.exec(edge.data?.hit ?? '');
    if (!match) throw new Error(`no path on ${edge.id}`);
    return { x: Number(match[1]), y: Number(match[2]) };
  }

  /** Every height a path turns at, between the two ranks it joins. */
  function band(edge: LinkFlowEdge): number[] {
    return [...(edge.data?.hit ?? '').matchAll(/,(-?[\d.]+)/g)]
      .map((match) => Number(match[1]))
      .filter((y) => y > 120 && y < 380);
  }

  /** Two cards side by side, each pointing at the other's neighbour below. */
  function crossedStory(): Story {
    const node = (id: string, x: number, y: number, next: Link[] = []): Scene => ({
      id,
      kind: 'npc',
      title: id,
      blocks: [{ text: id }],
      position: { x, y },
      next,
    });
    return {
      id: 'croisement',
      title: 'Croisement',
      version: '1',
      formatVersion: 2,
      startSceneId: 'gauche',
      scenes: {
        gauche: node('gauche', 0, 0, [{ id: 'vers-droite', to: 'bas-droite' }]),
        droite: node('droite', 600, 0, [{ id: 'vers-gauche', to: 'bas-gauche' }]),
        'bas-gauche': node('bas-gauche', 0, 400),
        'bas-droite': node('bas-droite', 600, 400),
      },
    };
  }

  it('gives each link leaving a node a start of its own', () => {
    const departures = toEdges(clairiereStory, issues)
      .filter((edge) => edge.source === 'start')
      .map(startOf);

    expect(departures.length).toBeGreaterThan(1);
    // Without the fan they all left by the same point, and the first centimetre
    // of two branches was one single line.
    expect(new Set(departures.map((point) => point.x)).size).toBe(departures.length);
  });

  it('gives each link arriving at a node a landing of its own', () => {
    // `portail` is reached from two different choices.
    const arrivals = toEdges(clairiereStory, issues)
      .filter((edge) => edge.target === 'portail')
      .map(endOf);

    expect(arrivals).toHaveLength(2);
    expect(new Set(arrivals.map((point) => point.x)).size).toBe(2);
  });

  it('leaves a link whole when nothing crosses it', () => {
    const lonely = toEdges(clairiereStory, issues).find((edge) => edge.id === 'c-lucioles:suite');
    expect(lonely?.data?.pieces).toHaveLength(1);
  });

  it('breaks the link running underneath where another passes over it', () => {
    const edges = toEdges(crossedStory(), []);
    const broken = edges.filter((edge) => (edge.data?.pieces.length ?? 0) > 1);

    // Two links that cross: exactly one of them gives way, and it is the one
    // handed over first — the other stays whole, so the eye follows it through.
    expect(edges).toHaveLength(2);
    expect(broken).toHaveLength(1);
    expect(broken[0]?.id).toBe('gauche:vers-droite');
  });

  it('keeps two links climbing back up out of the same corridor', () => {
    const node = (id: string, y: number, next: Link[] = []): Scene => ({
      id,
      kind: 'npc',
      title: id,
      blocks: [{ text: id }],
      position: { x: 0, y },
      next,
    });
    const story: Story = {
      id: 'retours',
      title: 'Retours',
      version: '1',
      formatVersion: 2,
      startSceneId: 'haut',
      scenes: {
        haut: node('haut', 0),
        milieu: node('milieu', 400, [{ id: 'retour', to: 'haut' }]),
        bas: node('bas', 800, [{ id: 'retour', to: 'haut' }]),
      },
    };

    // Both walk around the cards on the same side; without a corridor each,
    // they would walk it along the very same line.
    const bars = toEdges(story, []).map((edge) =>
      Math.max(...[...(edge.data?.hit ?? '').matchAll(/([\d.]+),/g)].map((m) => Number(m[1]))),
    );
    expect(bars).toHaveLength(2);
    expect(bars[0]).not.toBe(bars[1]);
  });

  it('keeps two long links out of the same column', () => {
    // The case a real story produces and neither the fan nor the lean catches:
    // two different cards standing in the same column, each pulling a long link
    // down to the same distant scene. They share no card, so nothing counted
    // them together, and they travel the same way, so they leaned the same way.
    const node = (id: string, y: number, next: Link[] = []): Scene => ({
      id,
      kind: 'npc',
      title: id,
      blocks: [{ text: id }],
      position: { x: 0, y },
      next,
    });
    const story: Story = {
      id: 'colonne',
      title: 'Colonne',
      version: '1',
      formatVersion: 2,
      startSceneId: 'haut',
      scenes: {
        haut: node('haut', 0, [{ id: 'vers-fin', to: 'fin' }]),
        milieu: node('milieu', 400, [{ id: 'vers-fin', to: 'fin' }]),
        fin: node('fin', 1600),
      },
    };

    const edges = toEdges(story, []);
    expect(edges).toHaveLength(2);
    // Nothing is drawn twice on one line, so nothing has to be owned up to.
    expect(edges.flatMap((edge) => edge.data?.doubled ?? [])).toEqual([]);
    expect(startOf(edges[0] as LinkFlowEdge).x).not.toBe(startOf(edges[1] as LinkFlowEdge).x);
  });

  it('owns up to a link that runs behind a card', () => {
    // The wiring is drawn beneath the cards on purpose, so a link skipping a
    // rank vanishes under whatever stands in its column and comes back out the
    // other side. The corridors dodge a card where they can; a card directly in
    // the way is wider than the room a port has to slide in, and then the only
    // honest thing left is to say so.
    const node = (id: string, y: number, next: Link[] = []): Scene => ({
      id,
      kind: 'npc',
      title: id,
      blocks: [{ text: id }],
      position: { x: 0, y },
      next,
    });
    const story: Story = {
      id: 'derriere',
      title: 'Derrière',
      version: '1',
      formatVersion: 2,
      startSceneId: 'haut',
      scenes: {
        haut: node('haut', 0, [{ id: 'saut', to: 'bas' }]),
        milieu: node('milieu', 400),
        bas: node('bas', 800),
      },
    };

    const marks = toEdges(story, []).flatMap((edge) => edge.data?.obscured ?? []);
    expect(marks.map((mark) => mark.why)).toEqual(['behind']);
    // Placed on the card it disappears behind, so the legend can go there.
    expect(marks[0]?.at.y).toBeGreaterThan(400);
    expect(marks[0]?.at.y).toBeLessThan(496);
  });

  it('says nothing once the graph has been tidied up', () => {
    // Hand-placed positions do hide a link or two; the layout is what clears
    // them, and after it there is nothing left to own up to.
    const tidy = arrangeStory(clairiereStory);
    const clean = toEdges(tidy, []).flatMap((edge) => edge.data?.obscured ?? []);
    expect(clean).toEqual([]);
  });

  it('keeps two links between the same ranks off the same line', () => {
    const edges = toEdges(crossedStory(), []);
    // Left to themselves both would turn at the halfway line, and their runs
    // would be drawn one over the other — a shared stretch of line rather than
    // a crossing, which is nothing the eye can undo and nothing to mark.
    const first = band(edges[0] as LinkFlowEdge);
    const second = band(edges[1] as LinkFlowEdge);

    expect(first.length).toBeGreaterThan(0);
    expect(first.some((y) => second.includes(y))).toBe(false);
  });
});
