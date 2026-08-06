// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**'] },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        // A leading `_` means deliberately ignored, including when dropping a
        // key by destructuring (`const { ending: _drop, ...rest } = scene`).
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
    },
  },

  // ---------------------------------------------------------------------------
  // Architecture guard rail: the core stays framework-agnostic.
  // `story-engine` and `story-format` must never import React nor touch the
  // DOM. This rule fails the lint at the slightest attempt.
  // ---------------------------------------------------------------------------
  {
    files: ['packages/story-engine/**/*.ts', 'packages/story-format/**/*.ts'],
    languageOptions: {
      globals: {}, // no browser global: `window`, `document`... are errors
    },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react-*', 'react/*', '@xyflow/*', '*.css'],
              message:
                'The core must stay agnostic of the UI framework: no React and no CSS in story-engine / story-format.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'No DOM in the core.' },
        { name: 'document', message: 'No DOM in the core.' },
        { name: 'localStorage', message: 'Persistence is injected by the caller.' },
        { name: 'fetch', message: 'No I/O in the core.' },
      ],
    },
  },

  // Apps React
  {
    files: ['apps/**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    languageOptions: {
      globals: {
        window: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
        navigator: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        requestAnimationFrame: 'readonly',
        matchMedia: 'readonly',
        HTMLElement: 'readonly',
        HTMLInputElement: 'readonly',
        HTMLTextAreaElement: 'readonly',
        HTMLDivElement: 'readonly',
        HTMLButtonElement: 'readonly',
        File: 'readonly',
        FileReader: 'readonly',
        Blob: 'readonly',
        URL: 'readonly',
        AudioContext: 'readonly',
        Event: 'readonly',
        KeyboardEvent: 'readonly',
        structuredClone: 'readonly',
        crypto: 'readonly',
        alert: 'readonly',
        confirm: 'readonly',
      },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },

  // Tests and config files
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/*.config.{ts,js}', '**/vite.config.ts'],
    languageOptions: {
      globals: { process: 'readonly', console: 'readonly', __dirname: 'readonly' },
    },
    rules: {
      'no-restricted-globals': 'off',
    },
  },

  prettier,
);
