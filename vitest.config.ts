import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    /*
     * Coverage is measured on the core alone — the story format and the engine.
     * They hold the rules of the game, they are pure TypeScript, and nothing
     * stops them from being covered exhaustively; a threshold there is a
     * promise that can be kept. Putting the same figure on the React apps would
     * only push us into testing markup.
     */
    coverage: {
      provider: 'v8',
      include: ['packages/story-format/src/**/*.ts', 'packages/story-engine/src/**/*.ts'],
      exclude: ['**/*.test.ts'],
      reporter: ['text-summary', 'lcov'],
      /*
       * Set just under what the suite actually reaches today (99.7 / 89.8 /
       * 97.3): the threshold is there to catch a slide, not to be a target one
       * aims at by writing tests for the sake of a figure.
       */
      thresholds: {
        statements: 99,
        branches: 88,
        functions: 96,
        lines: 99,
      },
    },
    projects: [
      {
        test: {
          name: 'story-format',
          root: './packages/story-format',
          environment: 'node',
          include: ['src/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'story-engine',
          root: './packages/story-engine',
          environment: 'node',
          include: ['src/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'reader',
          root: './apps/reader',
          environment: 'jsdom',
          include: ['src/**/*.test.{ts,tsx}'],
          setupFiles: ['./src/test/setup.ts'],
        },
      },
      {
        test: {
          name: 'studio',
          root: './apps/studio',
          environment: 'jsdom',
          include: ['src/**/*.test.{ts,tsx}'],
          setupFiles: ['./src/test/setup.ts'],
        },
      },
    ],
  },
});
