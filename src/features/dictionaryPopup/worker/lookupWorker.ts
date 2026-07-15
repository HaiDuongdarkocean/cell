// Lookup worker entry — runs inside the Web Worker context.
//
// Wires `self.onmessage` to the pure handler in `lookupWorkerHandler.ts` and
// posts each returned response back to the host. On startup, posts
// WORKER_READY so the background knows the worker is alive and ready to
// receive HYDRATE_CHUNK / LOOKUP messages.
//
// This file is loaded via `workerFactory.ts` (which isolates import.meta.url)
// and is never imported by Jest tests. Test the handler, not this entry.

import {
  buildWorkerReadyMessage,
  createLookupWorkerState,
  handleWorkerMessage,
} from './lookupWorkerHandler';
import type { WorkerRequestMessage, WorkerReadyMessage } from '../types';

const state = createLookupWorkerState();

// Announce readiness. The host waits for this before sending HYDRATE_CHUNK.
(self as unknown as Worker).postMessage(buildWorkerReadyMessage('init') as WorkerReadyMessage);

(self as unknown as Worker).onmessage = (event: MessageEvent<WorkerRequestMessage>) => {
  const responses = handleWorkerMessage(state, event.data);
  for (const r of responses) {
    (self as unknown as Worker).postMessage(r);
  }
};
