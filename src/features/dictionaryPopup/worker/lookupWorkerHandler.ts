// Lookup worker message handler — pure, testable, no import.meta.url.
//
// The worker entry (lookupWorker.ts) wires `self.onmessage` to this handler
// and posts each returned response. Tests call the handler directly.
//
// Task 1.2: HYDRATE_CHUNK now carries { resourceId, blob } and the handler
// validates + deserializes the blob via phraseIndexLoader, storing a
// ResidentPhraseIndex per resource. LOOKUP runs matchPhrase against all
// resident indexes (first match wins — multi-resource priority is Task 1.4)
// and returns a LookupResult with detectedPhrase populated when a phrase
// matches. Definitions stay empty until the LRU/miss path lands (Task 1.3).

import type {
  WorkerLookupMessage,
  WorkerLookupResultMessage,
  WorkerReadyMessage,
  WorkerRequestMessage,
} from '../types';
import type { LookupResult, DefinitionEntry } from '../types';
import { matchPhrase, tokenizeSentence, comparePhraseMatches } from '@/features/dictionary/logic/phraseMatcher';
import type { PhraseMatch } from '@/features/dictionary/logic/phraseMatcher';
import type { PhraseIndex } from '@/features/dictionary/logic/phraseIndexCompiler';
import {
  loadPhraseIndexBlob,
  type ResidentPhraseIndex,
} from './phraseIndexLoader';
import { LruCache } from '../logic/lruCache';
import { sortResidentIndexesByPriority } from './resourcePriority';

/** Hard cap for the definitions LRU (spec §9.5: exactly 10k live entries). */
export const DEFINITION_LRU_CAP = 10000;

/** Mutable worker state. Created once per worker instance. */
export interface LookupWorkerState {
  /** Resident phrase indexes keyed by resourceId. */
  readonly residentIndexes: Map<number, ResidentPhraseIndex>;
  /** Definitions LRU — top 10k by recency (spec §9.5). Key = term. */
  readonly definitionLru: LruCache<string, readonly DefinitionEntry[]>;
  /** True after HYDRATE_DONE. Lookups before hydration return an error. */
  hydrated: boolean;
  /** Hydration errors per resourceId (for diagnostics; never crashes lookup). */
  readonly hydrationErrors: Map<number, string>;
  /** Cancelled requestIds — LOOKUP results for these are dropped. */
  readonly cancelled: Set<string>;
  /** resourceId → explicit priority (lower = higher). Set by the host. */
  priorityMap?: ReadonlyMap<number, number>;
  /** Set of disabled resourceIds — HYDRATE_CHUNK will skip these. */
  disabledResourceIds?: ReadonlySet<number>;
}

/** Create a fresh worker state. */
export function createLookupWorkerState(): LookupWorkerState {
  return {
    residentIndexes: new Map(),
    definitionLru: new LruCache<string, readonly DefinitionEntry[]>(DEFINITION_LRU_CAP),
    hydrated: false,
    hydrationErrors: new Map(),
    cancelled: new Set(),
  };
}

/** Attach an explicit resource priority map to a worker state. */
export function setWorkerPriorityMap(
  state: LookupWorkerState,
  priorityMap: ReadonlyMap<number, number>,
): void {
  state.priorityMap = priorityMap;
}

/** Attach the set of disabled resourceIds to a worker state. */
export function setWorkerDisabledResourceIds(
  state: LookupWorkerState,
  disabledResourceIds: ReadonlySet<number>,
): void {
  state.disabledResourceIds = disabledResourceIds;
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
      if (state.disabledResourceIds?.has(msg.resourceId)) {
        // Disabled resources are never loaded into resident memory.
        return [];
      }
      const result = loadPhraseIndexBlob(msg.resourceId, msg.payload, {
        enabled: !state.disabledResourceIds?.has(msg.resourceId),
      });
      if (result.ok) {
        state.residentIndexes.set(msg.resourceId, result.resident);
        state.hydrationErrors.delete(msg.resourceId);
      } else if (result.error !== 'resource-disabled') {
        // Fail closed: record the error, do not crash. The resource is
        // skipped for lookup; the host can re-hydrate or report.
        state.hydrationErrors.set(msg.resourceId, result.error);
      }
      return [];
    }
    case 'HYDRATE_DONE': {
      state.hydrated = true;
      return [];
    }
    case 'PUSH_DEFINITION': {
      // Background pushes a definition after an IDB miss (spec §9.5 step 4).
      // The LRU enforces the 10k cap; set() evicts the least-recently-used.
      const entries = msg.entries as readonly DefinitionEntry[];
      state.definitionLru.set(msg.term, entries);
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

  const result = runLookup(state, msg);

  // Re-check cancellation before emitting.
  if (state.cancelled.has(msg.requestId)) {
    return { type: 'LOOKUP_RESULT', requestId: msg.requestId, ok: false, error: 'cancelled' };
  }

  return { type: 'LOOKUP_RESULT', requestId: msg.requestId, ok: true, result };
}

/**
 * Run the phrase match against all resident indexes in priority order.
 *
 * Collects the best match per resource, then picks the overall winner by:
 * (1) explicit resource priority (lower rank wins),
 * (2) resourceId descending for unprioritized resources,
 * (3) the matcher's deterministic ranking tuple (comparePhraseMatches).
 *
 * The winning sourceResourceId is the real resourceId — never a sentinel.
 */
function runLookup(state: LookupWorkerState, msg: WorkerLookupMessage): LookupResult {
  const { contextSentence, cursorOffset, term, langCode } = msg.payload;

  const residents = [...state.residentIndexes.values()].filter(
    (r) => !state.disabledResourceIds?.has(r.resourceId),
  );
  const sorted = sortResidentIndexesByPriority(residents, state.priorityMap);
  const candidates: { resident: ResidentPhraseIndex; match: PhraseMatch }[] = [];

  for (const resident of sorted) {
    const index: PhraseIndex = resident.index;
    const match = matchPhrase(
      { sentence: contextSentence, cursorOffset },
      index,
      resident.resourceId,
    );
    if (match) {
      candidates.push({ resident, match });
    }
  }

  if (candidates.length > 0) {
    // Pick the winner: explicit priority first, then resourceId descending,
    // then comparePhraseMatches. Mirrors the host orchestrator ordering.
    candidates.sort((a, b) => {
      const pa = state.priorityMap?.get(a.resident.resourceId) ?? Number.MAX_SAFE_INTEGER;
      const pb = state.priorityMap?.get(b.resident.resourceId) ?? Number.MAX_SAFE_INTEGER;
      if (pa !== pb) return pa - pb;
      const prioDiff = b.resident.resourceId - a.resident.resourceId;
      if (prioDiff !== 0) return prioDiff;
      return comparePhraseMatches(a.match, b.match);
    });
    const winner = candidates[0]!;
    const match = winner.match;
    return {
      term: match.dictionaryTerm,
      langCode,
      reading: '',
      readingKind: 'none',
      frequency: null,
      status: 'unknown',
      partsOfSpeech: [],
      definitions: [],
      rawDefinitions: [],
      detectedPhrase: {
        dictionaryTerm: match.dictionaryTerm,
        surface: match.surface,
        span: match.span,
        quality: match.quality,
        sourceResourceId: winner.resident.resourceId,
      },
      matchSource: 'plugin',
    };
  }

  // No phrase match — word fallback. Definitions come from the LRU (hit) or
  // the background miss path (push via PUSH_DEFINITION, then re-lookup).
  const tokens = tokenizeSentence(contextSentence);
  const target = tokens.find((t) => cursorOffset >= t.start && cursorOffset < t.end);
  const wordTerm = target?.text ?? term;
  const cached = state.definitionLru.get(wordTerm);
  return {
    term: wordTerm,
    langCode,
    reading: '',
    readingKind: 'none',
    frequency: null,
    status: 'unknown',
    partsOfSpeech: [],
    definitions: cached ?? [],
    rawDefinitions: [],
    detectedPhrase: null,
    matchSource: 'dictionary',
  };
}
