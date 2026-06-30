import type { Config } from 'jest';

/**
 * Shared options applied to every project (unit + integration).
 * Projects do NOT inherit top-level testMatch/roots/transform/moduleNameMapper,
 * so we factor them into a constant and spread it into each project.
 */
const moduleNameMapper = {
  '^@/(.*)$': '<rootDir>/src/$1',
  '\\.module\\.css$': '<rootDir>/tests/styleMock.ts',
  // Mock Vite ?worker imports — returns a no-op Worker class for tests
  '\\?worker$': '<rootDir>/tests/workerMock.ts',
  // Mock workerFactory (uses import.meta.url which is invalid in Jest's CJS)
  '@/features/transmux/merging/workerFactory': '<rootDir>/tests/workerMock.ts',
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
        '<rootDir>/tests/components',
        '<rootDir>/tests/utils',
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
    'src/popup/components/**/*.tsx',
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
