import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  roots: ['<rootDir>/tests', '<rootDir>/src'],
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.module\\.css$': '<rootDir>/tests/styleMock.ts',
    // Mock Vite ?worker imports — returns a no-op Worker class for tests
    '\\?worker$': '<rootDir>/tests/workerMock.ts',
    // Mock workerFactory (uses import.meta.url which is invalid in Jest's CJS)
    '@/lib/converters/workerFactory': '<rootDir>/tests/workerMock.ts',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        jsx: 'react-jsx',
        esModuleInterop: true,
        types: ['chrome', 'jest', '@testing-library/jest-dom'],
      },
    }],
  },
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/lib/**/*.ts',
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
