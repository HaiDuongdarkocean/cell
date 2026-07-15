// Lookup worker message handler — pure, testable, no import.meta.url.
//
// The worker entry (lookupWorker.ts) wires `self.onmessage` to this handler
// and posts each returned response. Tests call the handler directly to prove
// topology: WORKER_READY, HYDRATE_CHUNK (transferable), HYDRATE_DONE, LOOKUP,
// LOOKUP_CANCEL, and requestId routing.
//
// This is the Task 0.3 topology proof. Phrase-index hydration, LRU, and real
// matching land in Tasks 1.2/1.3. For now LOOKUP echoes a stub result so the
// round trip and cancellation are provable without the full data plane.

import type {
  WorkerLookupMessage,
  WorkerLookupResultMessage,
  WorkerReadyMessage,
  WorkerRequestMessage,
} from '../types';
import type { LookupResult } from '../types';

/** Mutable worker state. Created once per worker instance. */
export interface LookupWorkerState {
  /** Chunks received via HYDRATE_CHUNK. ArrayBuffer is the transferred ref. */
  readonly hydratedChunks: ArrayBuffer[];
  /** True after HYDRATE_DONE. Lookups before hydration return an error. */
  hydrated: boolean;
  /** Cancelled requestIds — LOOKUP results for these are dropped. */
  readonly cancelled: Set<string>;
}

/** Create a fresh worker state. */
export function createLookupWorkerState(): LookupWorkerState {
  return {
    hydratedChunks: [],
    hydrated: false,
    cancelled: new Set(),
  };
}

/**
 * Handle one worker message. Returns zero or more response messages to post
 * back to the host. Pure with respect to `state` (mutates `state` in place,
 * no other side effects) — deterministic and testable.
 */
export function handleWorkerMessage(
  state: LookupWorkerState,
  msg: WorkerRequestMessage,
): WorkerLookupResultMessage[] {
  switch (msg.type) {
    case 'HYDRATE_CHUNK': {
      // The ArrayBuffer was transferred — store the single reference. The
      // host's copy is detached (byteLength 0) after transfer; we must not
      // clone or copy it.
      state.hydratedChunks.push(msg.payload);
      return [];
    }
    case 'HYDRATE_DONE': {
      state.hydrated = true;
      return [];
    }
    case 'LOOKUP_CANCEL': {
      state.cancelled.add(msg.requestId);
      return [];
    }
    case 'LOOKUP': {
      return [handleLookup(state, msg)];
    }
    default: {
      // Exhaustive — unknown types never reach here at the type level.
      return [];
    }
  }
}

/** Build the WORKER_READY message posted on worker startup. */
export function buildWorkerReadyMessage(requestId = 'init'): WorkerReadyMessage {
  return { type: 'WORKER_READY', requestId };
}

function handleLookup(
  state: LookupWorkerState,
  msg: WorkerLookupMessage,
): WorkerLookupResultMessage {
  // Cancelled before processing → drop result (no LOOKUP_RESULT emitted).
  if (state.cancelled.has(msg.requestId)) {
    return { type: 'LOOKUP_RESULT', requestId: msg.requestId, ok: false, error: 'cancelled' };
  }

  if (!state.hydrated) {
    return {
      type: 'LOOKUP_RESULT',
      requestId: msg.requestId,
      ok: false,
      error: 'worker-not-hydrated',
    };
  }

  // ponytail: stub result for topology proof. Real matching lands in Task 1.2.
  // Ceiling: returns an empty LookupResult regardless of input. Upgrade path:
  // wire matchPhrase + LRU lookup against hydratedChunks.
  const stub: LookupResult = {
    term: msg.payload.term,
    langCode: msg.payload.langCode,
    reading: '',
    readingKind: 'none',
    frequency: null,
    status: 'unknown',
    partsOfSpeech: [],
    definitions: [],
    detectedPhrase: null,
    matchSource: 'dictionary',
  };

  // Re-check cancellation before emitting (simulates the cancel-during-async
  // check the worker entry performs between steps).
  if (state.cancelled.has(msg.requestId)) {
    return { type: 'LOOKUP_RESULT', requestId: msg.requestId, ok: false, error: 'cancelled' };
  }

  return { type: 'LOOKUP_RESULT', requestId: msg.requestId, ok: true, result: stub };
}
