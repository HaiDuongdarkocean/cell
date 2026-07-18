// Lookup worker entry — runs inside the Web Worker context.
//
// Wires `self.onmessage` to the pure handler in `lookupWorkerHandler.ts` and
// posts each returned response back to the host. On startup, posts
// WORKER_READY so the background knows the worker is alive and ready to
// receive HYDRATE_CHUNK / LOOKUP messages.
//
// Currently unused — the popup orchestrator loads phrase indexes in the main
// thread. Kept as a reference entry point; do not import in Jest tests.

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
