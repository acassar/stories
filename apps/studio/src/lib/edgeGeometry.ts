/**
 * Geometry of the links drawn on the canvas.
 *
 * The studio used to hand its edges to React Flow's `smoothstep` and let it
 * draw them. That settled the look but forbade the two things a dense story
 * graph most needs: a link cannot be told where to leave a card from, and no
 * link knows anything about the others — so a crossing cannot be marked,
 * because nobody is in a position to notice it.
 *
 * So the path is computed here instead. Every link becomes an explicit
 * polyline, made of axis-aligned segments only, and everything else is read off
 * it: the rounded outline that gets drawn, where two links meet, and where to
 * break the one that passes underneath.
 *
 * Pure geometry, no DOM and no React: what is drawn is exactly what is computed
 * here, which is what makes the crossings exact rather than guessed.
 */

export interface Point {
  x: number;
  y: number;
}

/** A card on the canvas: top-left corner and size, as React Flow sees it. */
export interface Box extends Point {
  width: number;
  height: number;
}

export type Side = 'top' | 'bottom' | 'left' | 'right';

/** One end of a link: which card, which side, how far along that side. */
export interface End {
  box: Box;
  side: Side;
  shift: number;
}

/**
 * Card size assumed before React Flow has measured anything.
 *
 * The width is the one in the stylesheet and never varies; the height does,
 * with the badges a scene carries. The measured value is used as soon as it is
 * known — this only has to keep the first frame from being drawn nonsense.
 */
export const CARD = { width: 190, height: 96 } as const;

/** Straight run kept between two turns, so a corner is never drawn on a corner. */
const STUB = 26;

/** Corner radius, trimmed on short segments. */
const RADIUS = 12;

/** Width of the break punched in the link running underneath a crossing. */
export const JUMP = 12;

/** No crossing is marked within this much of either end of a link. */
const END_GUARD = 16;

/** Largest distance between two neighbouring departures on the same side. */
const FAN_STEP = 26;

/** Room left free at both ends of a side, so the fan stays on the card. */
const FAN_MARGIN = 36;

const EPSILON = 0.01;

// ---------------------------------------------------------------------------
// Ports
// ---------------------------------------------------------------------------

/** Where a link touches a card: the middle of a side, moved along it by `shift`. */
export function portPoint(box: Box, side: Side, shift = 0): Point {
  switch (side) {
    case 'top':
      return { x: box.x + box.width / 2 + shift, y: box.y };
    case 'bottom':
      return { x: box.x + box.width / 2 + shift, y: box.y + box.height };
    case 'left':
      return { x: box.x, y: box.y + box.height / 2 + shift };
    case 'right':
      return { x: box.x + box.width, y: box.y + box.height / 2 + shift };
  }
}

/** Length of the side a fan spreads along. */
export function sideLength(box: Box, side: Side): number {
  return side === 'top' || side === 'bottom' ? box.width : box.height;
}

/**
 * Spreads the links sharing one side of a card.
 *
 * Three choices leaving the same node used to leave by the very same point, so
 * their first centimetre was one single line and the eye had no way of telling
 * which branch it was following. Spread out, each departure is its own, and the
 * same holds for arrivals: a node with four parents shows four distinct
 * landings rather than a knot.
 *
 * The fan stays centred on the port, so a lone link is still drawn from the
 * middle of the card and nothing moves for the simple cases.
 */
export function fanShift(index: number, count: number, along: number): number {
  if (count <= 1) return 0;
  const room = Math.max(0, along - FAN_MARGIN);
  const step = Math.min(FAN_STEP, room / (count - 1));
  return (index - (count - 1) / 2) * step;
}

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------

function isVertical(side: Side): boolean {
  return side === 'top' || side === 'bottom';
}

/** Room a link is asked to keep from the ones drawn beside it. */
export interface Detour {
  /** Pushes a bracket further out, so two of them do not share a corridor. */
  lane?: number;
  /** Moves the turn off the halfway line, so two links do not share one. */
  shift?: number;
}

/**
 * The polyline of one link, in canvas coordinates.
 *
 * Four shapes, one per way the two ends face each other: falling from one card
 * into the one below, stepping sideways between two cards on the same rank,
 * bracketing around both cards to climb back up, and — never produced by
 * `routeOf`, kept so the function is total — a single corner for mismatched
 * sides.
 *
 * Where the turn happens is not decided here: a link alone knows nothing of the
 * ones drawn beside it, so the room it must keep is handed to it as `detour`.
 */
export function routeLink(from: End, to: End, detour: Detour = {}): Point[] {
  const start = portPoint(from.box, from.side, from.shift);
  const end = portPoint(to.box, to.side, to.shift);
  const lane = detour.lane ?? 0;

  const shift = detour.shift ?? 0;

  if (isVertical(from.side) && isVertical(to.side)) {
    const midY = (start.y + end.y) / 2 + shift;
    return simplify([start, { x: start.x, y: midY }, { x: end.x, y: midY }, end]);
  }

  if (!isVertical(from.side) && !isVertical(to.side)) {
    // Same side: the link walks around both cards rather than through them.
    if (from.side === to.side) {
      const laneX = bracketLine(from, to, lane);
      return simplify([start, { x: laneX, y: start.y }, { x: laneX, y: end.y }, end]);
    }
    const midX = (start.x + end.x) / 2 + shift;
    return simplify([start, { x: midX, y: start.y }, { x: midX, y: end.y }, end]);
  }

  // A vertical port must be left vertically, a horizontal one horizontally.
  return simplify(
    isVertical(from.side)
      ? [start, { x: start.x, y: end.y }, end]
      : [start, { x: end.x, y: start.y }, end],
  );
}

function right(box: Box): number {
  return box.x + box.width;
}

/**
 * The vertical line a bracket walks along, `lane` further out from the cards.
 *
 * Exported because the corridor has to be known before the link is drawn: two
 * brackets are only kept apart by whoever can see both, and that is not the
 * link itself.
 */
export function bracketLine(from: End, to: End, lane = 0): number {
  return from.side === 'right'
    ? Math.max(right(from.box), right(to.box)) + STUB + lane
    : Math.min(from.box.x, to.box.x) - STUB - lane;
}

/** Drops the points that add nothing: duplicates, and corners that do not turn. */
function simplify(points: Point[]): Point[] {
  const distinct: Point[] = [];
  for (const point of points) {
    const last = distinct[distinct.length - 1];
    if (last && same(last, point)) continue;
    distinct.push(point);
  }

  const kept: Point[] = [];
  for (let index = 0; index < distinct.length; index += 1) {
    const previous = kept[kept.length - 1];
    const current = distinct[index] as Point;
    const next = distinct[index + 1];
    if (previous && next && collinear(previous, current, next)) continue;
    kept.push(current);
  }
  return kept;
}

function same(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) < EPSILON && Math.abs(a.y - b.y) < EPSILON;
}

function collinear(a: Point, b: Point, c: Point): boolean {
  const vertical = Math.abs(a.x - b.x) < EPSILON && Math.abs(b.x - c.x) < EPSILON;
  const horizontal = Math.abs(a.y - b.y) < EPSILON && Math.abs(b.y - c.y) < EPSILON;
  return vertical || horizontal;
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

/** The polyline as an SVG path, corners rounded as far as the segments allow. */
export function roundedPath(points: Point[], radius = RADIUS): string {
  const first = points[0];
  if (!first) return '';
  if (points.length === 1) return `M ${fixed(first.x)},${fixed(first.y)}`;

  let path = `M ${fixed(first.x)},${fixed(first.y)}`;
  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1] as Point;
    const corner = points[index] as Point;
    const next = points[index + 1] as Point;
    const trim = Math.min(radius, distance(previous, corner) / 2, distance(corner, next) / 2);
    if (trim < 1) {
      path += ` L ${fixed(corner.x)},${fixed(corner.y)}`;
      continue;
    }
    const entry = towards(corner, previous, trim);
    const exit = towards(corner, next, trim);
    path += ` L ${fixed(entry.x)},${fixed(entry.y)}`;
    path += ` Q ${fixed(corner.x)},${fixed(corner.y)} ${fixed(exit.x)},${fixed(exit.y)}`;
  }
  const last = points[points.length - 1] as Point;
  return `${path} L ${fixed(last.x)},${fixed(last.y)}`;
}

function fixed(value: number): string {
  return String(Math.round(value * 100) / 100);
}

function towards(from: Point, to: Point, by: number): Point {
  const span = distance(from, to);
  if (span === 0) return from;
  return { x: from.x + ((to.x - from.x) * by) / span, y: from.y + ((to.y - from.y) * by) / span };
}

function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

// ---------------------------------------------------------------------------
// Crossings
// ---------------------------------------------------------------------------

type Segment = [Point, Point];

function segments(points: Point[]): Segment[] {
  const list: Segment[] = [];
  for (let index = 1; index < points.length; index += 1) {
    list.push([points[index - 1] as Point, points[index] as Point]);
  }
  return list;
}

function horizontal(segment: Segment): boolean {
  return Math.abs(segment[0].y - segment[1].y) < EPSILON;
}

/**
 * A link's polyline, cut up once for the questions asked of it many times over.
 *
 * Every link is compared with every other, so the graph asks about a given link
 * as many times as it holds links. Splitting its segments — or walking them to
 * find out how far apart two links are — inside that loop is the difference
 * between a canvas that follows the mouse and one that does not.
 */
export interface Trace {
  points: Point[];
  /** Horizontal segments and vertical ones: a crossing is one of each. */
  flat: Segment[];
  upright: Segment[];
  /** The two ends, where a link is allowed to meet its neighbours. */
  head: Point;
  tail: Point;
}

export function traceOf(points: Point[]): Trace {
  const flat: Segment[] = [];
  const upright: Segment[] = [];
  for (const segment of segments(points)) {
    (horizontal(segment) ? flat : upright).push(segment);
  }
  const first = points[0] ?? { x: 0, y: 0 };
  return { points, flat, upright, head: first, tail: points[points.length - 1] ?? first };
}

/** Two links meeting at a point. `a` is the one handed over first. */
export interface Meeting {
  at: Point;
  a: number;
  b: number;
}

/** One vertical stretch of some link, ready to be searched by position. */
interface Bar {
  x: number;
  top: number;
  bottom: number;
  owner: number;
}

/**
 * Every place two links meet, across the whole graph.
 *
 * Every segment is axis-aligned, so a crossing is a horizontal one meeting a
 * vertical one — no general line intersection to solve. Touches at the very
 * ends are left out: two links sharing a card meet at its port by design, and
 * marking that would put a break on every departure.
 *
 * Asked of the whole graph at once rather than of pairs of links, because the
 * pairs are what costs: three hundred links make forty-five thousand of them,
 * on a canvas that recomputes this at every frame of a drag. Sorting the
 * vertical stretches by position once means a horizontal run only ever looks at
 * the stretches standing in the span it actually covers.
 */
export function allCrossings(traces: Trace[]): Meeting[] {
  const bars: Bar[] = [];
  traces.forEach((trace, owner) => {
    for (const [from, to] of trace.upright) {
      bars.push({
        x: from.x,
        top: Math.min(from.y, to.y),
        bottom: Math.max(from.y, to.y),
        owner,
      });
    }
  });
  bars.sort((one, other) => one.x - other.x);

  const met: Meeting[] = [];
  const seen = new Map<string, Point[]>();

  traces.forEach((trace, owner) => {
    for (const run of trace.flat) {
      const left = Math.min(run[0].x, run[1].x);
      const right = Math.max(run[0].x, run[1].x);

      for (let index = firstFrom(bars, left); index < bars.length; index += 1) {
        const bar = bars[index] as Bar;
        if (bar.x > right) break;
        if (bar.owner === owner) continue;

        const other = traces[bar.owner] as Trace;
        const hit = meet(run, bar);
        if (!hit) continue;
        if (nearEnd(hit, trace) || nearEnd(hit, other)) continue;

        const key = owner < bar.owner ? `${owner}:${bar.owner}` : `${bar.owner}:${owner}`;
        const already = seen.get(key) ?? [];
        if (already.some((point) => distance(point, hit) < 1)) continue;
        already.push(hit);
        seen.set(key, already);

        met.push({
          at: hit,
          a: Math.min(owner, bar.owner),
          b: Math.max(owner, bar.owner),
        });
      }
    }
  });
  return met;
}

/** A stretch of line two links are drawn along together. `a` comes first. */
export interface Overlap {
  a: number;
  b: number;
  from: Point;
  to: Point;
}

/** How close two parallel runs must be to count as drawn on top of each other. */
const TOUCHING = 3;

/**
 * Every stretch where two links are drawn along the very same line.
 *
 * Not a crossing and not a near miss: the same pixels, carrying two links, with
 * nothing to tell the reader that the second one is there. The corridors exist
 * to prevent this, and mostly do — but a band holds only so many, and where one
 * runs out the honest thing is to say so rather than to draw a single line and
 * let it pass for the truth.
 */
export function allOverlaps(traces: Trace[]): Overlap[] {
  return [...sharedRuns(traces, true), ...sharedRuns(traces, false)];
}

function sharedRuns(traces: Trace[], upright: boolean): Overlap[] {
  interface Run {
    at: number;
    low: number;
    high: number;
    owner: number;
  }

  const runs: Run[] = [];
  traces.forEach((trace, owner) => {
    for (const [from, to] of upright ? trace.upright : trace.flat) {
      const at = upright ? from.x : from.y;
      const one = upright ? from.y : from.x;
      const other = upright ? to.y : to.x;
      runs.push({ at, low: Math.min(one, other), high: Math.max(one, other), owner });
    }
  });
  runs.sort((one, other) => one.at - other.at);

  const found: Overlap[] = [];
  for (let index = 0; index < runs.length; index += 1) {
    const run = runs[index] as Run;
    // Sorted by position, so the moment one is too far the rest are too.
    for (let other = index + 1; other < runs.length; other += 1) {
      const next = runs[other] as Run;
      if (next.at - run.at >= TOUCHING) break;
      if (next.owner === run.owner) continue;

      const low = Math.max(run.low, next.low);
      const high = Math.min(run.high, next.high);
      if (high - low <= TOUCHING) continue;

      found.push({
        a: Math.min(run.owner, next.owner),
        b: Math.max(run.owner, next.owner),
        from: upright ? { x: run.at, y: low } : { x: low, y: run.at },
        to: upright ? { x: run.at, y: high } : { x: high, y: run.at },
      });
    }
  }
  return found;
}

/** Index of the first stretch standing at or beyond `x`. */
function firstFrom(bars: Bar[], x: number): number {
  let low = 0;
  let high = bars.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if ((bars[middle] as Bar).x < x) low = middle + 1;
    else high = middle;
  }
  return low;
}

function meet(run: Segment, bar: Bar): Point | null {
  const y = run[0].y;
  // Strictly inside both: a corner landing on another link is a touch, not a
  // crossing, and breaking the line there would read as an error.
  if (!within(bar.x, run[0].x, run[1].x)) return null;
  if (!within(y, bar.top, bar.bottom)) return null;
  return { x: bar.x, y };
}

function within(value: number, a: number, b: number): boolean {
  return value > Math.min(a, b) + 1 && value < Math.max(a, b) - 1;
}

function nearEnd(point: Point, trace: Trace): boolean {
  return distance(point, trace.head) < END_GUARD || distance(point, trace.tail) < END_GUARD;
}

// ---------------------------------------------------------------------------
// Measuring and cutting
// ---------------------------------------------------------------------------

export function polylineLength(points: Point[]): number {
  return segments(points).reduce((total, [from, to]) => total + distance(from, to), 0);
}

/** The point at `travelled` along the polyline; clamped at both ends. */
export function pointAt(points: Point[], travelled: number): Point {
  const first = points[0];
  if (!first) return { x: 0, y: 0 };
  let left = travelled;
  for (const [from, to] of segments(points)) {
    const span = distance(from, to);
    if (left <= span) return towards(from, to, Math.max(0, left));
    left -= span;
  }
  return points[points.length - 1] as Point;
}

/** How far along the polyline a point sits, or `null` if it is not on it. */
export function distanceOf(points: Point[], point: Point): number | null {
  let travelled = 0;
  for (const [from, to] of segments(points)) {
    if (onSegment(point, [from, to])) return travelled + distance(from, point);
    travelled += distance(from, to);
  }
  return null;
}

function onSegment(point: Point, [from, to]: Segment): boolean {
  const slack = distance(from, point) + distance(point, to) - distance(from, to);
  return Math.abs(slack) < 0.5;
}

/**
 * Breaks the polyline around each crossing, and returns the pieces left.
 *
 * This is the old draughtsman's line jump: where two links cross, one of them
 * is interrupted, and the eye reads without hesitating which one runs on. It is
 * the link drawn underneath that gets the break — see `toEdges` for who that
 * is — so the one on top stays whole.
 */
export function breakAt(points: Point[], cuts: Point[], gap = JUMP): Point[][] {
  if (cuts.length === 0) return [points];
  const total = polylineLength(points);

  const ranges = cuts
    .map((cut) => distanceOf(points, cut))
    .filter((at): at is number => at !== null)
    .sort((a, b) => a - b)
    .map((at): [number, number] => [at - gap / 2, at + gap / 2]);

  const merged: [number, number][] = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([...range]);
  }

  const pieces: Point[][] = [];
  let cursor = 0;
  for (const [from, to] of merged) {
    if (from > cursor) pieces.push(slice(points, cursor, Math.min(from, total)));
    cursor = Math.max(cursor, to);
  }
  if (cursor < total) pieces.push(slice(points, cursor, total));
  return pieces.filter((piece) => piece.length >= 2 && polylineLength(piece) > 0.5);
}

/** The part of the polyline between two distances, ends included. */
function slice(points: Point[], from: number, to: number): Point[] {
  const cut: Point[] = [pointAt(points, from)];
  let travelled = 0;
  for (const [start, end] of segments(points)) {
    travelled += distance(start, end);
    if (travelled > from && travelled < to) cut.push(end);
  }
  cut.push(pointAt(points, to));
  return simplify(cut);
}
