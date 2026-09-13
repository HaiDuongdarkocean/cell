import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  // Global ignores
  {
    ignores: [
      'dist/',
      'build/',
      'node_modules/',
      'coverage/',
      'e2e-results/',
      'bin/',
      'tests/integration/.cache/',
      'project-reference/',
      'public/ffmpeg/',
      '.windsurf/',
      // Build artifacts leaked to repo root (gitignored, not source).
      'assets/',
      'ffmpeg/',
      'icons/',
      'manifest.json',
      'service-worker-loader.js',
      'sql-wasm.wasm',
      'test-scroll-up.js',
      'test-verify.js',
      'public/options.js',
      // Generated design-system showcase assets (hashed JS/CSS from build).
      'docs/design-system/assets/',
      // Third-party uBlock extension used only as a browser-test helper (AGENTS.md).
      'tests/data-test/extension-phụ-trợ/',
      'data/extension/uBOLite/',
      // Local-only prototype/seed scratch dirs (not committed).
      'prototype/',
      'seed/',
    ],
  },

  // Base JS recommended
  js.configs.recommended,

  // TypeScript recommended (type-checked)
  ...tseslint.configs.recommended,
  // Type-aware promise rules on src/ + tests/ only — MV3 async code paths
  // (SW lifecycle, messaging, offscreen) are the audit's highest-risk area.
  // Scoped so non-project files (e2e, scripts, *.cjs) aren't parsed for types.
  {
    files: ['src/**/*.ts', 'src/**/*.tsx', 'tests/**/*.ts', 'tests/**/*.tsx'],
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
    },
  },

  // React
  {
    files: ['**/*.tsx', '**/*.ts'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2022,
        chrome: 'readonly',
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: { version: '19' },
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
    },
  },

  // Strict TypeScript rules
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': ['error', { disallowTypeAnnotations: false }],
      // Empty catch clauses are intentionally used at extension API boundaries
      // where the only safe recovery is to fall through (e.g. chrome.storage).
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },

  // FSD layer boundaries: shared and entities are lower layers and must not
  // import from features (dependency arrow points features → entities → shared).
  {
    files: ['src/shared/**/*.ts', 'src/shared/**/*.tsx'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{
          group: ['@/features', '@/features/*', '@/features/**', '**/features/**'],
          message: 'FSD boundary: shared/ must not import from features/. Move the logic down or the consumer up.',
        }],
      }],
    },
  },
  {
    files: ['src/entities/**/*.ts', 'src/entities/**/*.tsx'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{
          group: ['@/features', '@/features/*', '@/features/**', '**/features/**'],
          message: 'FSD boundary: entities/ must not import from features/. Move the contract down into entities/.',
        }],
      }],
    },
  },

  // Feature DAG: dictionaryPopup is the lookup orchestration hub — lower
  // features must not import it back (contracts live in entities/dictionary,
  // logic in features/dictionary, utilities in shared/). universalPanel is the
  // top composition layer: it MAY host dictionaryPopup UI (ui/Dictionary) and
  // reuse the panel port helper (controller/panelBridge) — everything else
  // under dictionaryPopup is banned there too.
  {
    files: [
      'src/features/cardCreator/**/*.ts',
      'src/features/cardCreator/**/*.tsx',
      'src/features/subtitle/**/*.ts',
      'src/features/subtitle/**/*.tsx',
      'src/features/tokenize/**/*.ts',
      'src/features/tokenize/**/*.tsx',
      'src/features/dictionary/**/*.ts',
      'src/features/dictionary/**/*.tsx',
      'src/features/ocr/**/*.ts',
      'src/features/ocr/**/*.tsx',
      'src/features/pronunciation/**/*.ts',
      'src/features/pronunciation/**/*.tsx',
      'src/features/reader/**/*.ts',
      'src/features/reader/**/*.tsx',
      'src/features/srs/**/*.ts',
      'src/features/srs/**/*.tsx',
      'src/features/tts/**/*.ts',
      'src/features/tts/**/*.tsx',
    ],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{
          group: ['@/features/dictionaryPopup', '@/features/dictionaryPopup/**'],
          message: 'Feature DAG: this feature is below dictionaryPopup — move shared contracts to entities/dictionary, logic to features/dictionary, utilities to shared/.',
        }],
      }],
    },
  },
  {
    files: ['src/features/universalPanel/**/*.ts', 'src/features/universalPanel/**/*.tsx'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{
          regex: '^@/features/dictionaryPopup(?!/ui/Dictionary$|/controller/panelBridge$)',
          message: 'Feature DAG: universalPanel may only host dictionaryPopup ui/Dictionary + reuse controller/panelBridge — contracts live in entities/dictionary.',
        }],
      }],
    },
  },

  // Test files — relax some rules
  {
    files: ['**/*.test.ts', '**/*.test.tsx', 'tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      // Tests use require() for dynamic import of CommonJS libs (mux.js) and
      // `this` aliasing for class-context binding in worker-thread setups —
      // both legitimate test patterns, not production debt.
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-this-alias': 'off',
    },
  },

  // Browser manual test scripts
  {
    files: ['tests/manual/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2022,
        chrome: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },

  // Node.js scripts and E2E specs
  {
    files: ['scripts/**/*.js', 'scripts/**/*.mjs', 'tasks/**/*.mjs', 'tests/data-test/**/*.mjs', 'e2e/**/*.ts', '**/*.cjs', '_manual_test_multi.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      // Playwright fixtures pass a callback named `use`; this is not a React hook.
      'react-hooks/rules-of-hooks': 'off',
      // Playwright fixtures with no dependencies use an empty destructuring pattern.
      'no-empty-pattern': 'off',
    },
  },

  // MAIN-world IIFE injection scripts (ADR-020/028/029) — browser-global by
  // design: they run in the page's MAIN world and reference window/document/
  // console/setTimeout directly. Minified comma-expressions and empty catch
  // blocks are legitimate in these inlined scripts, not production debt.
  {
    files: ['**/*.iife.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2022,
      },
    },
    rules: {
      'no-unused-expressions': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      'no-empty': 'off',
    },
  },
);
