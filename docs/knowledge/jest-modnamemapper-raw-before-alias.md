# Jest moduleNameMapper ordering — specific suffix before generic alias

> **Principle**: [Mock mapper ordering — specific suffix before generic alias](principles.md#mock-mapper-ordering--specific-suffix-before-generic-alias)

## Problem

After adding `?raw` imports to `popupShell.ts` (`import tokensCss from '@/shared/styles/tokens.css?raw'`), Jest tests failed with:

```
ENOENT: no such file or directory, open 'D:\Tool\learning apply skill\cell\src\shared\styles\tokens.css?raw'
```

All 4 dictionary popup test suites (130 tests) failed to run.

## Root causes

`jest.config.ts` had `moduleNameMapper` with `^@/(.*)$` listed **before** `\\?raw$`:

```ts
const moduleNameMapper = {
  '^@/(.*)$': '<rootDir>/src/$1',           // ← generic, matches FIRST
  '\\?raw$': '<rootDir>/tests/rawMock.ts',  // ← never reached
};
```

Jest tries `moduleNameMapper` patterns in declaration order. `^@/(.*)$` matched `@/shared/styles/tokens.css?raw` → resolved to `<rootDir>/src/shared/styles/tokens.css?raw` → file system lookup includes `?raw` suffix → ENOENT (no file has `?raw` in its name).

The `\\?raw$` mapper (which would redirect to `rawMock.ts`) was never reached because the generic alias consumed the import path first.

## Fix

Reorder `moduleNameMapper` — specific suffix mappers before generic alias:

```ts
const moduleNameMapper = {
  '\\?raw$': '<rootDir>/tests/rawMock.ts',  // ← specific, FIRST
  '\\?worker$': '<rootDir>/tests/workerMock.ts',
  '^@/(.*)$': '<rootDir>/src/$1',           // ← generic, LAST
  '\\.module\\.css$': '<rootDir>/tests/styleMock.ts',
};
```

## Key insight

Jest `moduleNameMapper` tries patterns in declaration order — first match wins. Generic alias `^@/(.*)$` matches ANY path including those with Vite suffixes (`?raw`, `?worker`, `?url`). Specific suffix mappers must be declared before the generic alias, or they're unreachable.

## Verification

```
npx jest --selectProjects unit --testPathPatterns="popupToolbar|popupShell|popupContent|popupDictionaryController"
Test Suites: 4 passed, 4 total
Tests:       130 passed, 130 total
```

Full suite: 3126 passed, 0 failed. Build: OK.
