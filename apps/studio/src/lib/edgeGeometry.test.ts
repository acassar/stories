import { describe, expect, it } from 'vitest';

import {
  CARD,
  JUMP,
  breakAt,
  allCrossings,
  allOverlaps,
  distanceOf,
  fanShift,
  pointAt,
  polylineLength,
  portPoint,
  roundedPath,
  routeLink,
  sideLength,
  traceOf,
} from './edgeGeometry';
import type { Box, End, Point, Side } from './edgeGeometry';

function card(x: number, y: number): Box {
  return { x, y, width: CARD.width, height: CARD.height };
}

function end(box: Box, side: Side, shift = 0): End {
  return { box, side, shift };
}

/** Every segment of a link runs along one axis: that is what makes it readable. */
function axisAligned(points: Point[]): boolean {
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1] as Point;
    const to = points[index] as Point;
    if (Math.abs(from.x - to.x) > 0.01 && Math.abs(from.y - to.y) > 0.01) return false;
  }
  return true;
}

describe('ports', () => {
  it('touches the middle of a side, and slides along it', () => {
    const box = card(0, 0);
    expect(portPoint(box, 'bottom')).toEqual({ x: 95, y: 96 });
    expect(portPoint(box, 'bottom', 20)).toEqual({ x: 115, y: 96 });
    expect(portPoint(box, 'top')).toEqual({ x: 95, y: 0 });
    expect(portPoint(box, 'right')).toEqual({ x: 190, y: 48 });
    expect(portPoint(box, 'left', -10)).toEqual({ x: 0, y: 38 });
  });

  it('measures the side a fan spreads along', () => {
    const box = card(0, 0);
    expect(sideLength(box, 'top')).toBe(CARD.width);
    expect(sideLength(box, 'right')).toBe(CARD.height);
  });
});

describe('fan', () => {
  it('leaves a lone link in the middle of its card', () => {
    expect(fanShift(0, 1, CARD.width)).toBe(0);
  });

  it('spreads several links and keeps them centred on the port', () => {
    const shifts = [0, 1, 2].map((index) => fanShift(index, 3, CARD.width));
    expect(shifts[0]).toBeLessThan(0);
    expect(shifts[1]).toBe(0);
    expect(shifts[2]).toBeGreaterThan(0);
    // Centred: the fan moves the departures apart without moving the link away.
    expect(shifts.reduce((sum, shift) => sum + shift, 0)).toBeCloseTo(0);
  });

  it('tightens the fan rather than letting it run off the card', () => {
    const wide = [...Array(12).keys()].map((index) => fanShift(index, 12, CARD.width));
    const span = Math.max(...wide) - Math.min(...wide);
    expect(span).toBeLessThanOrEqual(CARD.width);
  });
});

describe('routing', () => {
  it('falls from one card into the one below, in right angles only', () => {
    const points = routeLink(end(card(0, 0), 'bottom'), end(card(60, 300), 'top'));
    expect(axisAligned(points)).toBe(true);
    expect(points[0]).toEqual({ x: 95, y: 96 });
    expect(points[points.length - 1]).toEqual({ x: 155, y: 300 });
  });

  it('draws one single line when the two cards are exactly aligned', () => {
    // Nothing to turn around: a needless corner would read as a detour.
    const points = routeLink(end(card(0, 0), 'bottom'), end(card(0, 300), 'top'));
    expect(points).toHaveLength(2);
  });

  it('separates two links leaving the same card', () => {
    const from = card(0, 0);
    const first = routeLink(end(from, 'bottom', -24), end(card(-200, 300), 'top'));
    const second = routeLink(end(from, 'bottom', 24), end(card(200, 300), 'top'));
    // The whole point of the fan: the two links no longer share their start.
    expect(first[0]).not.toEqual(second[0]);
    expect(Math.abs((first[0] as Point).x - (second[0] as Point).x)).toBe(48);
  });

  it('walks around both cards when the link climbs back up', () => {
    const source = card(0, 400);
    const target = card(300, 0);
    const points = routeLink(end(source, 'right'), end(target, 'right'));
    const lane = Math.max(...points.map((point) => point.x));
    // Outside the rightmost card: the bracket never runs across the text.
    expect(lane).toBeGreaterThan(target.x + target.width);
    expect(axisAligned(points)).toBe(true);
  });

  it('moves the turn off the halfway line when it is asked to', () => {
    const from = end(card(0, 0), 'bottom');
    const to = end(card(400, 300), 'top');
    const turnOf = (points: Point[]) => (points[1] as Point).y;

    expect(turnOf(routeLink(from, to, { shift: -30 }))).toBe(turnOf(routeLink(from, to)) - 30);
  });

  it('pushes a second bracket further out than the first', () => {
    const source = card(0, 400);
    const target = card(0, 0);
    const near = routeLink(end(source, 'right'), end(target, 'right'));
    const far = routeLink(end(source, 'right'), end(target, 'right'), { lane: 40 });
    expect(Math.max(...far.map((p) => p.x))).toBeGreaterThan(Math.max(...near.map((p) => p.x)));
  });

  it('steps sideways between two cards on the same rank', () => {
    const points = routeLink(end(card(0, 0), 'right'), end(card(400, 0), 'left'));
    expect(axisAligned(points)).toBe(true);
    expect(points[0]).toEqual({ x: 190, y: 48 });
    expect(points[points.length - 1]).toEqual({ x: 400, y: 48 });
  });

  it('brackets a card pointing at itself, outside its own frame', () => {
    const box = card(0, 0);
    const points = routeLink(end(box, 'right', -15), end(box, 'right', 15));
    expect(points.length).toBeGreaterThanOrEqual(3);
    expect(Math.max(...points.map((point) => point.x))).toBeGreaterThan(box.x + box.width);
  });

  it('turns once when the two ends do not face the same way', () => {
    // Never produced by `routeOf`; the function still has to answer.
    const points = routeLink(end(card(0, 0), 'bottom'), end(card(300, 300), 'left'));
    expect(axisAligned(points)).toBe(true);
    expect(points[points.length - 1]).toEqual({ x: 300, y: 348 });
  });
});

describe('drawing', () => {
  it('rounds the corners it has room for', () => {
    const path = roundedPath([
      { x: 0, y: 0 },
      { x: 0, y: 100 },
      { x: 100, y: 100 },
    ]);
    expect(path.startsWith('M 0,0')).toBe(true);
    expect(path).toContain('Q');
  });

  it('leaves a corner square when the segments are too short to round it', () => {
    const path = roundedPath([
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ]);
    expect(path).not.toContain('Q');
  });

  it('says nothing about an empty link', () => {
    expect(roundedPath([])).toBe('');
    expect(roundedPath([{ x: 4, y: 5 }])).toBe('M 4,5');
  });
});

describe('crossings', () => {
  const flat: Point[] = [
    { x: 0, y: 100 },
    { x: 400, y: 100 },
  ];

  /** Where the given links meet, in the order the crossings were found. */
  const meetings = (...links: Point[][]) =>
    allCrossings(links.map(traceOf)).map((meeting) => meeting.at);

  it('finds where a link actually passes over another', () => {
    expect(
      meetings(flat, [
        { x: 200, y: 0 },
        { x: 200, y: 300 },
      ]),
    ).toEqual([{ x: 200, y: 100 }]);
  });

  it('names the link handed over first, which is the one drawn underneath', () => {
    const upright: Point[] = [
      { x: 200, y: 0 },
      { x: 200, y: 300 },
    ];
    expect(allCrossings([traceOf(upright), traceOf(flat)])[0]).toMatchObject({ a: 0, b: 1 });
    expect(allCrossings([traceOf(flat), traceOf(upright)])[0]).toMatchObject({ a: 0, b: 1 });
  });

  it('ignores two links running the same way', () => {
    expect(
      meetings(flat, [
        { x: 0, y: 140 },
        { x: 400, y: 140 },
      ]),
    ).toEqual([]);
  });

  it('ignores a link that stops short of the other', () => {
    expect(
      meetings(flat, [
        { x: 200, y: 0 },
        { x: 200, y: 60 },
      ]),
    ).toEqual([]);
  });

  it('does not mark the port two links share', () => {
    // Both leave the same card: they meet at its edge by construction, and
    // breaking every departure would be worse than not marking anything.
    const first: Point[] = [
      { x: 100, y: 0 },
      { x: 100, y: 200 },
    ];
    const second: Point[] = [
      { x: 0, y: 4 },
      { x: 200, y: 4 },
    ];
    expect(meetings(first, second)).toEqual([]);
  });
});

/*
 * Two links drawn on the same pixels. The corridors are there to prevent it,
 * and normally do; what is left has to be found so the canvas can own up to it
 * rather than show one line where two run.
 */
describe('overlaps', () => {
  const shared = (...links: Point[][]) => allOverlaps(links.map(traceOf));

  it('finds the stretch two links run along together', () => {
    expect(
      shared(
        [
          { x: 0, y: 100 },
          { x: 400, y: 100 },
        ],
        [
          { x: 200, y: 100 },
          { x: 600, y: 100 },
        ],
      ),
    ).toEqual([{ a: 0, b: 1, from: { x: 200, y: 100 }, to: { x: 400, y: 100 } }]);
  });

  it('marks it on the link handed over last, the only one anyone can see', () => {
    // The other is hidden underneath: a mark on it would never be drawn.
    const [found] = shared(
      [
        { x: 0, y: 0 },
        { x: 0, y: 400 },
      ],
      [
        { x: 0, y: 100 },
        { x: 0, y: 500 },
      ],
    );
    expect(found).toMatchObject({ a: 0, b: 1 });
  });

  it('says nothing about two links that merely cross', () => {
    expect(
      shared(
        [
          { x: 0, y: 100 },
          { x: 400, y: 100 },
        ],
        [
          { x: 200, y: 0 },
          { x: 200, y: 300 },
        ],
      ),
    ).toEqual([]);
  });

  it('says nothing about two links running side by side', () => {
    expect(
      shared(
        [
          { x: 0, y: 100 },
          { x: 400, y: 100 },
        ],
        [
          { x: 0, y: 120 },
          { x: 400, y: 120 },
        ],
      ),
    ).toEqual([]);
  });

  it('says nothing about two links that merely touch end to end', () => {
    expect(
      shared(
        [
          { x: 0, y: 100 },
          { x: 200, y: 100 },
        ],
        [
          { x: 199, y: 100 },
          { x: 400, y: 100 },
        ],
      ),
    ).toEqual([]);
  });
});

describe('measuring', () => {
  const line: Point[] = [
    { x: 0, y: 0 },
    { x: 0, y: 100 },
    { x: 100, y: 100 },
  ];

  it('measures a link and finds a point along it', () => {
    expect(polylineLength(line)).toBe(200);
    expect(pointAt(line, 50)).toEqual({ x: 0, y: 50 });
    expect(pointAt(line, 150)).toEqual({ x: 50, y: 100 });
  });

  it('clamps at both ends rather than running off', () => {
    expect(pointAt(line, -10)).toEqual({ x: 0, y: 0 });
    expect(pointAt(line, 900)).toEqual({ x: 100, y: 100 });
    expect(pointAt([], 10)).toEqual({ x: 0, y: 0 });
  });

  it('places a point on the link, or says it is not on it', () => {
    expect(distanceOf(line, { x: 0, y: 40 })).toBe(40);
    expect(distanceOf(line, { x: 30, y: 100 })).toBe(130);
    expect(distanceOf(line, { x: 30, y: 40 })).toBeNull();
  });
});

describe('breaks', () => {
  const line: Point[] = [
    { x: 0, y: 0 },
    { x: 300, y: 0 },
  ];

  it('leaves a link alone when nothing crosses it', () => {
    expect(breakAt(line, [])).toEqual([line]);
  });

  it('cuts the link where another passes over it', () => {
    const pieces = breakAt(line, [{ x: 150, y: 0 }]);
    expect(pieces).toHaveLength(2);
    expect(pieces[0]).toEqual([
      { x: 0, y: 0 },
      { x: 150 - JUMP / 2, y: 0 },
    ]);
    expect(pieces[1]).toEqual([
      { x: 150 + JUMP / 2, y: 0 },
      { x: 300, y: 0 },
    ]);
  });

  it('merges two breaks that would touch, rather than leaving a crumb', () => {
    const pieces = breakAt(line, [
      { x: 150, y: 0 },
      { x: 154, y: 0 },
    ]);
    expect(pieces).toHaveLength(2);
    expect(polylineLength(pieces[0] as Point[])).toBeLessThan(150);
  });

  it('keeps the corners of the piece it cuts out', () => {
    const bent: Point[] = [
      { x: 0, y: 0 },
      { x: 0, y: 200 },
      { x: 200, y: 200 },
    ];
    const pieces = breakAt(bent, [{ x: 0, y: 50 }]);
    expect(pieces).toHaveLength(2);
    // The second piece still turns the corner it inherited.
    expect(pieces[1]).toContainEqual({ x: 0, y: 200 });
  });

  it('drops a break that is not on the link', () => {
    expect(breakAt(line, [{ x: 40, y: 40 }])).toEqual([line]);
  });

  it('does not leave a stub when the break falls on an end', () => {
    const pieces = breakAt(line, [{ x: 1, y: 0 }]);
    expect(pieces.every((piece) => polylineLength(piece) > 0.5)).toBe(true);
  });
});
