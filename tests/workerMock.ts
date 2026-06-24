/**
 * Mock for Vite's `?worker` imports in Jest.
 *
 * Returns a class that mimics the Worker API but runs synchronously
 * in the same thread. Tests that need actual worker behavior should
 * mock the transmuxGroupInWorker function directly.
 */

class MockWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;

  postMessage(_data: unknown, _transfer?: Transferable[]): void {
    // No-op — tests should mock the caller, not the worker
  }

  terminate(): void {
    // No-op
  }

  addEventListener(_type: string, _listener: (event: Event) => void): void {
    // No-op
  }

  removeEventListener(_type: string, _listener: (event: Event) => void): void {
    // No-op
  }
}

export default MockWorker;

// Named export matching workerFactory.ts (used by parallelTransmuxer.ts)
export function createTransmuxWorker(): MockWorker {
  return new MockWorker();
}
