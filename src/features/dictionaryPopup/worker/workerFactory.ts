/**
 * Lookup worker factory — isolates `import.meta.url` from the testable handler.
 *
 * Mirrors `src/features/transmux/merging/workerFactory.ts`: this file is only
 * loaded via dynamic import() when Web Workers are available, so Jest (CJS /
 * ts-jest) never parses `import.meta.url`. The pure handler in
 * `lookupWorkerHandler.ts` is what tests exercise.
 */

export function createLookupWorker(): Worker {
  return new Worker(
    new URL('./lookupWorker.ts', import.meta.url),
    { type: 'module' },
  );
}
