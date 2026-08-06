import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Vitest runs without global `afterEach`, so Testing Library cannot register
// its own teardown: without this, each render piles up in the same document.
afterEach(cleanup);

/*
 * React Flow measures its container before drawing anything. jsdom implements
 * none of the geometry APIs it uses, so they are stubbed here — with sizes, not
 * with zeroes, otherwise the canvas decides it has no room and renders nothing.
 */
class ResizeObserverStub {
  observe(): void {}
  disconnect(): void {}
  unobserve(): void {}
}

Object.defineProperty(window, 'ResizeObserver', { writable: true, value: ResizeObserverStub });
Object.defineProperty(window, 'DOMMatrixReadOnly', {
  writable: true,
  value: class {
    m22 = 1;
    constructor(_transform?: string) {}
  },
});

for (const [property, value] of [
  ['offsetHeight', 600],
  ['offsetWidth', 900],
] as const) {
  Object.defineProperty(window.HTMLElement.prototype, property, {
    configurable: true,
    value,
  });
}

// jsdom stops short of SVG geometry too, and React Flow measures edge labels.
Object.defineProperty(window.SVGElement.prototype, 'getBBox', {
  configurable: true,
  writable: true,
  value: () => ({ x: 0, y: 0, width: 0, height: 0 }),
});
