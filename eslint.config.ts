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
      'dist-firefox/',
      'build/',
      'node_modules/',
      'coverage/',
      'e2e-results/',
      'tmp/',
      'bin/',
      'tests/integration/.cache/',
      'project-reference/',
      'public/ffmpeg/',
      'public/espeakng/',
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
      'loop/',
      // Binary MPEG-TS HLS fixture segments — the *.ts extension collides
      // with the TypeScript globs and would be misparsed.
      'e2e/firefox/fixtures/',
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
      // react-hooks v7 `recommended` bundles the React Compiler rule set
      // (refs, set-state-in-effect, purity, immutability...). Keep the
      // classic v5 pair; adopting the compiler rules is a separate refactor.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
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
  {
    files: ['src/features/**/*.ts', 'src/features/**/*.tsx'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{
          group: ['@/entrypoints', '@/entrypoints/*', '@/entrypoints/**', '**/entrypoints/**'],
          message: 'FSD boundary: features/ must not import from entrypoints/. Move the shared piece down or the consumer up.',
        }],
      }],
    },
  },

  // Sync domain purity (NFR-11): the domain layer must stay free of browser,
  // network and storage side effects so it is unit-testable and provider-
  // agnostic. Ports/adapters wire these in; domain code never sees them.
  {
    files: ['src/features/sync/domain/**/*.ts', 'src/features/sync/domain/**/*.tsx'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['@/entrypoints', '@/entrypoints/*', '@/entrypoints/**', '**/entrypoints/**'],
            message: 'FSD boundary: features/ must not import from entrypoints/.',
          },
          {
            group: ['@/features/sync/adapters', '@/features/sync/adapters/*', '@/features/sync/adapters/**', '**/features/sync/adapters/**'],
            message: 'Sync domain must not depend on adapters — depend on ports only.',
          },
          {
            group: ['idb', 'idb/*', 'idb/**'],
            message: 'Sync domain must not touch IndexedDB — inject the LocalSource port.',
          },
        ],
      }],
      'no-restricted-globals': ['error',
        { name: 'chrome', message: 'Sync domain must not call chrome.* — inject a port.' },
        { name: 'fetch', message: 'Sync domain must not call fetch — inject the StorageProvider port.' },
        { name: 'indexedDB', message: 'Sync domain must not touch IndexedDB — inject the LocalSource port.' },
      ],
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

  // Feature DAG: settings sits at the composition layer — its dialog
  // aggregates other features' panels (settings → cardCreator/dictionary/
  // subtitle/tts/audio/theme). No feature may import it back; feature-owned
  // settings panels live inside the owning feature.
  {
    files: [
      'src/features/audio/**/*.ts',
      'src/features/audio/**/*.tsx',
      'src/features/cardCreator/**/*.ts',
      'src/features/cardCreator/**/*.tsx',
      'src/features/detection/**/*.ts',
      'src/features/detection/**/*.tsx',
      'src/features/dictionary/**/*.ts',
      'src/features/dictionary/**/*.tsx',
      'src/features/dictionaryPopup/**/*.ts',
      'src/features/dictionaryPopup/**/*.tsx',
      'src/features/download/**/*.ts',
      'src/features/download/**/*.tsx',
      'src/features/local-player/**/*.ts',
      'src/features/local-player/**/*.tsx',
      'src/features/ocr/**/*.ts',
      'src/features/ocr/**/*.tsx',
      'src/features/reader/**/*.ts',
      'src/features/reader/**/*.tsx',
      'src/features/srs/**/*.ts',
      'src/features/srs/**/*.tsx',
      'src/features/studyModes/**/*.ts',
      'src/features/studyModes/**/*.tsx',
      'src/features/subtitle/**/*.ts',
      'src/features/subtitle/**/*.tsx',
      'src/features/theme/**/*.ts',
      'src/features/theme/**/*.tsx',
      'src/features/tokenize/**/*.ts',
      'src/features/tokenize/**/*.tsx',
      'src/features/translate/**/*.ts',
      'src/features/translate/**/*.tsx',
      'src/features/transmux/**/*.ts',
      'src/features/transmux/**/*.tsx',
      'src/features/tts/**/*.ts',
      'src/features/tts/**/*.tsx',
      'src/features/whitelist/**/*.ts',
      'src/features/whitelist/**/*.tsx',
    ],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{
          group: ['@/features/settings', '@/features/settings/**'],
          message: 'Feature DAG: settings is a composition layer — features must not import it back. Move feature-owned panels into the owning feature.',
        }],
      }],
    },
  },
  // pronunciation sits below cardCreator (dictionaryGenerate consumes its
  // orchestrator) and below settings — both directions are banned back.
  {
    files: ['src/features/pronunciation/**/*.ts', 'src/features/pronunciation/**/*.tsx'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['@/features/settings', '@/features/settings/**'],
            message: 'Feature DAG: settings is a composition layer — features must not import it back. Move feature-owned panels into the owning feature.',
          },
          {
            group: ['@/features/cardCreator', '@/features/cardCreator/**'],
            message: 'Feature DAG: cardCreator consumes pronunciation — do not import back.',
          },
        ],
      }],
    },
  },

  // Context boundary: the service worker has no DOM — a document/window
  // reference in background code is a latent crash caught at lint time.
  {
    files: ['src/entrypoints/background/**/*.ts', 'src/entrypoints/background/**/*.tsx'],
    rules: {
      'no-restricted-globals': ['error',
        { name: 'document', message: 'Service worker has no DOM — route DOM work through the offscreen document.' },
        { name: 'window', message: 'Service worker has no window — use self/globalThis or the offscreen document.' },
      ],
    },
  },

  // Context boundary: content scripts do not fetch — cross-origin goes through
  // offscreenFetch in background. Main-world iifes (page context, cannot reach
  // extension APIs) and the existing runtimeMessages site are the frozen
  // exception set — no new fetch call sites.
  {
    files: ['src/entrypoints/content/**/*.ts', 'src/entrypoints/content/**/*.tsx'],
    ignores: [
      'src/entrypoints/content/**/*.iife.ts',
      'src/entrypoints/content/runtimeMessages.ts',
    ],
    rules: {
      'no-restricted-globals': ['error',
        { name: 'fetch', message: 'Context boundary: fetch in a content script goes through offscreenFetch — do not add a new call site.' },
      ],
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
    files: ['scripts/**/*.js', 'scripts/**/*.mjs', 'tasks/**/*.mjs', '.agents/**/*.mjs', 'tests/data-test/**/*.mjs', 'e2e/**/*.ts', 'e2e/**/*.mjs', '**/*.cjs', '_manual_test_multi.ts'],
    // playwright-launch.mjs declares its globals via `/* global */` (it needs
    // document/location inside page.evaluate); node globals would collide.
    ignores: ['.agents/skills/continuous-ux-audit-cycle/scripts/playwright-launch.mjs'],
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
