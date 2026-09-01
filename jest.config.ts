import type { Config } from 'jest';

/**
 * Shared options applied to every project (unit + integration).
 * Projects do NOT inherit top-level testMatch/roots/transform/moduleNameMapper,
 * so we factor them into a constant and spread it into each project.
 */
const moduleNameMapper = {
  // Mock @jocelyn-stericker/espeak-phonemes and its assets (WASM cannot run in jsdom).
  '^@jocelyn-stericker/espeak-phonemes$': '<rootDir>/tests/__mocks__/espeakPhonemes.ts',
  '^@jocelyn-stericker/espeak-phonemes/espeak-phonemes\\.js$': '<rootDir>/tests/__mocks__/espeakPhonemesWasm.ts',
  '^@jocelyn-stericker/espeak-phonemes/espeak-phonemes\\.wasm\\?url$': '<rootDir>/tests/__mocks__/espeakPhonemesUrl.ts',
  '^@jocelyn-stericker/espeak-phonemes/espeak-ng-data\\.tar\\?url$': '<rootDir>/tests/__mocks__/espeakPhonemesUrl.ts',
  // Mock Vite ?raw CSS imports — returns empty CSS string for tests.
  '\\.css\\?raw$': '<rootDir>/tests/cssRawMock.ts',
  // Mock Vite ?raw SVG imports — must be BEFORE @/ alias so ?raw suffixes don't
  // get resolved as real files. Returns placeholder string for tests.
  '\\?raw$': '<rootDir>/tests/rawMock.ts',
  // Mock Vite ?inline CSS imports — returns placeholder string for tests.
  '\\?inline$': '<rootDir>/tests/inlineCssMock.ts',
  // Mock Vite ?worker imports — returns a no-op Worker class for tests
  '\\?worker$': '<rootDir>/tests/workerMock.ts',
  // Mock devMode in tests — source uses import.meta.env which is invalid in Jest's CJS
  // Must be BEFORE the generic '^@/(.*)$' mapper so it takes precedence.
  '^@/shared/lib/env/devMode$': '<rootDir>/tests/__mocks__/devMode.ts',
  '^@/(.*)$': '<rootDir>/src/$1',
  // CSS module mock must come BEFORE plain .css mock so module files
  // get the Proxy (class-name passthrough) instead of the empty string.
  '\\.module\\.css$': '<rootDir>/tests/styleMock.ts',
  // Mock plain (non-module) CSS imports — returns empty string for tests.
  '\\.css$': '<rootDir>/tests/cssRawMock.ts',
  // Mock workerFactory (uses import.meta.url which is invalid in Jest's CJS)
  '@/features/transmux/merging/workerFactory': '<rootDir>/tests/workerMock.ts',
  // unzipit uses DecompressionStream which is not available in jsdom/Node;
  // use an fflate-based mock for unit tests.
  '^unzipit$': '<rootDir>/tests/__mocks__/unzipit.ts',
};

const transform = {
  '^.+\\.tsx?$': [
    'ts-jest',
    {
      tsconfig: {
        jsx: 'react-jsx',
        esModuleInterop: true,
        types: ['chrome', 'jest', '@testing-library/jest-dom'],
      },
    },
  ],
};

const config: Config = {
  projects: [
    {
      displayName: 'unit',
      testEnvironment: 'jsdom',
      setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
      roots: [
        '<rootDir>/tests/unit',
        '<rootDir>/src',
      ],
      testMatch: ['**/*.test.ts', '**/*.test.tsx'],
      moduleNameMapper,
      transform,
    },
    {
      displayName: 'integration',
      testEnvironment: 'jsdom',
      setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
      roots: ['<rootDir>/tests/integration'],
      // Only pick up *.integration.test.ts so the setup/ folder is excluded.
      testMatch: ['**/*.integration.test.ts'],
      // Download + cache real m3u8 segments once per run (Node context).
      globalSetup: '<rootDir>/tests/integration/setup/globalSetup.ts',
      moduleNameMapper,
      transform,
    },
  ],
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/features/**/*.ts',
    'src/shared/**/*.ts',
    'src/entities/**/*.ts',
    'src/entrypoints/popup/components/**/*.tsx',
    'src/features/settings/ui/**/*.tsx',
    '!src/**/*.d.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};

export default config;
