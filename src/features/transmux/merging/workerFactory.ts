/**
 * Web Worker factory for transmux workers.
 *
 * This file is kept separate from parallelTransmuxer.ts so that
 * `import.meta.url` (which is invalid syntax in CommonJS / Jest's
 * ts-jest environment) is isolated here. The factory is only loaded
 * via dynamic import() when Web Workers are actually available,
 * so Jest never parses this file.
 */

export function createTransmuxWorker(): Worker {
  return new Worker(
    new URL('../../offscreen/transmuxWorker.ts', import.meta.url),
    { type: 'module' },
  );
}
