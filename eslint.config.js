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
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },

  // ---------------------------------------------------------------------------
  // Garde-fou d'architecture : le coeur reste agnostique du framework.
  // `story-engine` et `story-format` ne doivent jamais importer React ni toucher
  // au DOM. La regle fait echouer le lint a la moindre tentative.
  // ---------------------------------------------------------------------------
  {
    files: ['packages/story-engine/**/*.ts', 'packages/story-format/**/*.ts'],
    languageOptions: {
      globals: {}, // aucun global navigateur : `window`, `document`... sont des erreurs
    },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react-*', 'react/*', '@xyflow/*', '*.css'],
              message:
                "Le coeur doit rester agnostique du framework UI : pas de React ni de CSS dans story-engine / story-format.",
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'Pas de DOM dans le coeur.' },
        { name: 'document', message: 'Pas de DOM dans le coeur.' },
        { name: 'localStorage', message: 'La persistance est injectee par l’appelant.' },
        { name: 'fetch', message: 'Pas d’I/O dans le coeur.' },
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

  // Tests + fichiers de config
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
