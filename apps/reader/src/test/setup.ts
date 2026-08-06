import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Without `globals: true`, Testing Library does not register its cleanup: it is
// done here, otherwise the DOM of two tests would overlap.
afterEach(cleanup);

/**
 * jsdom does not implement `matchMedia`. The stub asks for reduced motion, so
 * tests read scenes in one block instead of driving timers to check a story
 * rule.
 */
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: query.includes('prefers-reduced-motion'),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }),
});

// jsdom cannot scroll: convenience calls must not break.
Element.prototype.scrollTo = () => {};
