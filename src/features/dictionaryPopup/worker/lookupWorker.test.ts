// Lookup worker topology + phrase hydration proof — Tasks 0.3 + 1.2.
//
// Exercises the pure handler (no real Web Worker needed) to prove:
// - WORKER_READY is emitted on startup.
// - HYDRATE_CHUNK validates + stores a real compiled phrase blob per resource.
// - HYDRATE_DONE flips the hydrated flag.
// - LOOKUP before hydration returns a worker-not-hydrated error.
// - LOOKUP after hydration runs matchPhrase and returns detectedPhrase on hit.
// - LOOKUP with no phrase match returns a word-fallback result.
// - Malformed blobs fail closed (hydration error recorded, lookup skips).
// - LOOKUP_CANCEL before LOOKUP drops the result.
// - requestId routes responses; mismatched requestId never crosses.
// - Worker restart re-hydrates cleanly.

import { describe, expect, it } from '@jest/globals';
import {
  buildWorkerReadyMessage,
  createLookupWorkerState,
  handleWorkerMessage,
  setWorkerPriorityMap,
  setWorkerDisabledResourceIds,
} from './lookupWorkerHandler';
import {
  compilePhraseIndex,
  serializePhraseIndex,
  type PhraseIndexInput,
} from '@/features/dictionary/logic/phraseIndexCompiler';
import { parsePhraseTemplate } from '@/features/dictionary/logic/phraseTemplateParser';
import type {
  WorkerCancelMessage,
  WorkerHydrateChunkMessage,
  WorkerHydrateDoneMessage,
  WorkerLookupMessage,
  WorkerPushDefinitionMessage,
} from '../types';
import type { DefinitionEntry } from '../types';

const TEST_VERBS = new Set(['take', 'kick', 'give', 'put', 'look', 'carry']);

function tmpl(term: string): PhraseIndexInput {
  const parsed = parsePhraseTemplate(term, { inflectableLiterals: TEST_VERBS });
  if (parsed.status !== 'supported') {
    throw new Error(`test template "${term}" must be supported, got ${parsed.status}`);
  }
  return {
    templateId: 0,
    sourceTerm: parsed.sourceTerm,
    normalizedTerm: parsed.normalizedTerm,
    nodes: parsed.nodes,
    fixedTokenCount: parsed.fixedTokenCount,
    minSurfaceTokens: parsed.minSurfaceTokens,
    maxSurfaceTokens: parsed.maxSurfaceTokens,
    frequencyRank: 0,
  };
}

function buildBlob(terms: string[]): ArrayBuffer {
  const inputs = terms.map((t, i) => ({ ...tmpl(t), templateId: i }));
  const index = compilePhraseIndex(inputs);
  return serializePhraseIndex(index);
}

function hydrateChunk(resourceId: number, blob: ArrayBuffer): WorkerHydrateChunkMessage {
  return { type: 'HYDRATE_CHUNK', requestId: `h-${resourceId}`, resourceId, payload: blob };
}

function lookup(requestId: string, sentence: string, cursorOffset: number): WorkerLookupMessage {
  return {
    type: 'LOOKUP',
    requestId,
    payload: {
      term: 'take',
      langCode: 'en',
      contextSentence: sentence,
      cursorOffset,
    },
  };
}

describe('lookupWorkerHandler — WORKER_READY', () => {
  it('builds a WORKER_READY message on startup', () => {
    const msg = buildWorkerReadyMessage('init');
    expect(msg.type).toBe('WORKER_READY');
    expect(msg.requestId).toBe('init');
  });
});

describe('lookupWorkerHandler — phrase blob hydration', () => {
  it('stores a valid compiled blob as a resident index', () => {
    const state = createLookupWorkerState();
    const blob = buildBlob(['take off', 'kick the bucket']);
    handleWorkerMessage(state, hydrateChunk(3, blob));
    expect(state.residentIndexes.size).toBe(1);
    expect(state.residentIndexes.get(3)?.index.termCount).toBe(2);
    expect(state.hydrationErrors.size).toBe(0);
  });

  it('rejects a malformed blob (bad magic) and records the error', () => {
    const state = createLookupWorkerState();
    const bad = new ArrayBuffer(32);
    handleWorkerMessage(state, hydrateChunk(3, bad));
    expect(state.residentIndexes.size).toBe(0);
    expect(state.hydrationErrors.get(3)).toMatch(/deserialize-failed|bad-magic/);
  });

  it('rejects a too-small blob', () => {
    const state = createLookupWorkerState();
    handleWorkerMessage(state, hydrateChunk(3, new ArrayBuffer(8)));
    expect(state.residentIndexes.size).toBe(0);
    expect(state.hydrationErrors.get(3)).toBe('blob-too-small');
  });

  it('hydrates multiple resources independently', () => {
    const state = createLookupWorkerState();
    handleWorkerMessage(state, hydrateChunk(1, buildBlob(['take off'])));
    handleWorkerMessage(state, hydrateChunk(2, buildBlob(['kick the bucket'])));
    expect(state.residentIndexes.size).toBe(2);
    expect(state.residentIndexes.get(1)?.index.termCount).toBe(1);
    expect(state.residentIndexes.get(2)?.index.termCount).toBe(1);
  });

  it('HYDRATE_DONE flips hydrated', () => {
    const state = createLookupWorkerState();
    handleWorkerMessage(state, hydrateChunk(1, buildBlob(['take off'])));
    expect(state.hydrated).toBe(false);
    const done: WorkerHydrateDoneMessage = { type: 'HYDRATE_DONE', requestId: 'h-done' };
    handleWorkerMessage(state, done);
    expect(state.hydrated).toBe(true);
  });
});

describe('lookupWorkerHandler — LOOKUP with real phrase match', () => {
  it('returns worker-not-hydrated error before HYDRATE_DONE', () => {
    const state = createLookupWorkerState();
    handleWorkerMessage(state, hydrateChunk(1, buildBlob(['take off'])));
    const responses = handleWorkerMessage(state, lookup('r1', 'Take off your shoes.', 0));
    expect(responses[0]!.ok).toBe(false);
    expect(responses[0]!.error).toBe('worker-not-hydrated');
  });

  it('returns detectedPhrase on a phrase hit', () => {
    const state = createLookupWorkerState();
    handleWorkerMessage(state, hydrateChunk(1, buildBlob(['take off'])));
    handleWorkerMessage(state, { type: 'HYDRATE_DONE', requestId: 'h-done' } as WorkerHydrateDoneMessage);

    // "Take off your shoes." — cursor on 'take' (offset 0).
    const responses = handleWorkerMessage(state, lookup('r1', 'Take off your shoes.', 0));
    expect(responses[0]!.ok).toBe(true);
    const result = responses[0]!.result!;
    expect(result.detectedPhrase).not.toBeNull();
    expect(result.detectedPhrase?.dictionaryTerm).toBe('take off');
    expect(result.detectedPhrase?.surface).toBe('Take off');
    expect(result.detectedPhrase?.sourceResourceId).toBe(1);
    expect(result.matchSource).toBe('plugin');
    expect(result.definitions).toEqual([]);
  });

  it('returns word-fallback result when no phrase matches', () => {
    const state = createLookupWorkerState();
    handleWorkerMessage(state, hydrateChunk(1, buildBlob(['take off'])));
    handleWorkerMessage(state, { type: 'HYDRATE_DONE', requestId: 'h-done' } as WorkerHydrateDoneMessage);

    // Sentence with no phrase match — cursor on 'hello'.
    const responses = handleWorkerMessage(state, lookup('r1', 'hello world', 0));
    expect(responses[0]!.ok).toBe(true);
    const result = responses[0]!.result!;
    expect(result.detectedPhrase).toBeNull();
    expect(result.matchSource).toBe('dictionary');
    expect(result.term).toBe('hello');
  });

  it('requestId never crosses between concurrent lookups', () => {
    const state = createLookupWorkerState();
    handleWorkerMessage(state, hydrateChunk(1, buildBlob(['take off'])));
    handleWorkerMessage(state, { type: 'HYDRATE_DONE', requestId: 'h-done' } as WorkerHydrateDoneMessage);

    const a = handleWorkerMessage(state, lookup('r-a', 'Take off your shoes.', 0));
    const b = handleWorkerMessage(state, lookup('r-b', 'hello world', 0));
    expect(a[0]!.requestId).toBe('r-a');
    expect(b[0]!.requestId).toBe('r-b');
    expect(a[0]!.result?.detectedPhrase?.dictionaryTerm).toBe('take off');
    expect(b[0]!.result?.detectedPhrase).toBeNull();
  });

  it('skips a resource whose blob failed hydration', () => {
    const state = createLookupWorkerState();
    // Resource 1: bad blob. Resource 2: good blob with 'take off'.
    handleWorkerMessage(state, hydrateChunk(1, new ArrayBuffer(8)));
    handleWorkerMessage(state, hydrateChunk(2, buildBlob(['take off'])));
    handleWorkerMessage(state, { type: 'HYDRATE_DONE', requestId: 'h-done' } as WorkerHydrateDoneMessage);

    const responses = handleWorkerMessage(state, lookup('r1', 'Take off your shoes.', 0));
    expect(responses[0]!.ok).toBe(true);
    expect(responses[0]!.result?.detectedPhrase?.sourceResourceId).toBe(2);
  });
});

describe('lookupWorkerHandler — multi-resource priority (Task 1.4)', () => {
  it('picks the newest resource (highest resourceId) when both match', () => {
    const state = createLookupWorkerState();
    // Both resources contain 'take off'. resourceId 5 is newer than 1.
    handleWorkerMessage(state, hydrateChunk(1, buildBlob(['take off'])));
    handleWorkerMessage(state, hydrateChunk(5, buildBlob(['take off'])));
    handleWorkerMessage(state, { type: 'HYDRATE_DONE', requestId: 'h-done' } as WorkerHydrateDoneMessage);

    const responses = handleWorkerMessage(state, lookup('r1', 'Take off your shoes.', 0));
    expect(responses[0]!.ok).toBe(true);
    expect(responses[0]!.result?.detectedPhrase?.sourceResourceId).toBe(5);
  });

  it('repeated runs produce the same winner (deterministic)', () => {
    function run(): number {
      const state = createLookupWorkerState();
      handleWorkerMessage(state, hydrateChunk(2, buildBlob(['take off'])));
      handleWorkerMessage(state, hydrateChunk(7, buildBlob(['take off'])));
      handleWorkerMessage(state, hydrateChunk(4, buildBlob(['take off'])));
      handleWorkerMessage(state, { type: 'HYDRATE_DONE', requestId: 'h-done' } as WorkerHydrateDoneMessage);
      const responses = handleWorkerMessage(state, lookup('r1', 'Take off your shoes.', 0));
      return responses[0]!.result!.detectedPhrase!.sourceResourceId;
    }
    expect(run()).toBe(run());
    expect(run()).toBe(7); // highest resourceId
  });

  it('sourceResourceId is never a sentinel zero for a real match', () => {
    const state = createLookupWorkerState();
    handleWorkerMessage(state, hydrateChunk(3, buildBlob(['take off'])));
    handleWorkerMessage(state, { type: 'HYDRATE_DONE', requestId: 'h-done' } as WorkerHydrateDoneMessage);

    const responses = handleWorkerMessage(state, lookup('r1', 'Take off your shoes.', 0));
    expect(responses[0]!.result?.detectedPhrase?.sourceResourceId).toBe(3);
    expect(responses[0]!.result?.detectedPhrase?.sourceResourceId).not.toBe(0);
  });

  it('falls back to a lower-priority resource when the newest has no match', () => {
    const state = createLookupWorkerState();
    // resourceId 5 has 'give up'; resourceId 1 has 'take off'. Lookup for
    // 'take off' → 5 has no match → 1 wins.
    handleWorkerMessage(state, hydrateChunk(5, buildBlob(['give up'])));
    handleWorkerMessage(state, hydrateChunk(1, buildBlob(['take off'])));
    handleWorkerMessage(state, { type: 'HYDRATE_DONE', requestId: 'h-done' } as WorkerHydrateDoneMessage);

    const responses = handleWorkerMessage(state, lookup('r1', 'Take off your shoes.', 0));
    expect(responses[0]!.result?.detectedPhrase?.sourceResourceId).toBe(1);
    expect(responses[0]!.result?.detectedPhrase?.dictionaryTerm).toBe('take off');
  });
});

describe('lookupWorkerHandler — definitions LRU + PUSH_DEFINITION (spec §9.5)', () => {
  it('PUSH_DEFINITION inserts into the LRU and word-fallback returns it', () => {
    const state = createLookupWorkerState();
    handleWorkerMessage(state, hydrateChunk(1, buildBlob(['take off'])));
    handleWorkerMessage(state, { type: 'HYDRATE_DONE', requestId: 'h-done' } as WorkerHydrateDoneMessage);

    const defs: DefinitionEntry[] = [
      { id: 'd1', pos: 'phrasal verb', text: 'to remove', examples: [], source: 'Cambridge', defaultSelected: true },
    ];
    const push: WorkerPushDefinitionMessage = {
      type: 'PUSH_DEFINITION',
      requestId: 'p1',
      term: 'hello',
      entries: defs,
    };
    handleWorkerMessage(state, push);
    expect(state.definitionLru.has('hello')).toBe(true);
    expect(state.definitionLru.size).toBe(1);

    // Word fallback for 'hello' now returns the pushed definitions.
    const responses = handleWorkerMessage(state, lookup('r1', 'hello world', 0));
    expect(responses[0]!.ok).toBe(true);
    expect(responses[0]!.result?.definitions).toEqual(defs);
    expect(responses[0]!.result?.matchSource).toBe('dictionary');
  });

  it('LRU enforces the 10k cap on PUSH_DEFINITION', () => {
    const state = createLookupWorkerState();
    for (let i = 0; i < 12000; i++) {
      handleWorkerMessage(state, {
        type: 'PUSH_DEFINITION',
        requestId: `p${i}`,
        term: `t${i}`,
        entries: [],
      } as WorkerPushDefinitionMessage);
    }
    expect(state.definitionLru.size).toBe(10000);
    // First 2000 evicted.
    expect(state.definitionLru.has('t0')).toBe(false);
    expect(state.definitionLru.has('t1999')).toBe(false);
    expect(state.definitionLru.has('t2000')).toBe(true);
  });

  it('word fallback returns empty definitions on LRU miss', () => {
    const state = createLookupWorkerState();
    handleWorkerMessage(state, hydrateChunk(1, buildBlob(['take off'])));
    handleWorkerMessage(state, { type: 'HYDRATE_DONE', requestId: 'h-done' } as WorkerHydrateDoneMessage);

    const responses = handleWorkerMessage(state, lookup('r1', 'mystery word', 0));
    expect(responses[0]!.result?.definitions).toEqual([]);
  });
});

describe('lookupWorkerHandler — cancellation', () => {
  it('LOOKUP_CANCEL before LOOKUP drops the result', () => {
    const state = createLookupWorkerState();
    handleWorkerMessage(state, hydrateChunk(1, buildBlob(['take off'])));
    handleWorkerMessage(state, { type: 'HYDRATE_DONE', requestId: 'h-done' } as WorkerHydrateDoneMessage);

    const cancel: WorkerCancelMessage = { type: 'LOOKUP_CANCEL', requestId: 'r1' };
    handleWorkerMessage(state, cancel);

    const responses = handleWorkerMessage(state, lookup('r1', 'Take off your shoes.', 0));
    expect(responses[0]!.ok).toBe(false);
    expect(responses[0]!.error).toBe('cancelled');
    expect(responses[0]!.result).toBeUndefined();
  });

  it('LOOKUP_CANCEL does not affect a different requestId', () => {
    const state = createLookupWorkerState();
    handleWorkerMessage(state, hydrateChunk(1, buildBlob(['take off'])));
    handleWorkerMessage(state, { type: 'HYDRATE_DONE', requestId: 'h-done' } as WorkerHydrateDoneMessage);

    handleWorkerMessage(state, { type: 'LOOKUP_CANCEL', requestId: 'r1' } as WorkerCancelMessage);
    const responses = handleWorkerMessage(state, lookup('r2', 'Take off your shoes.', 0));
    expect(responses[0]!.ok).toBe(true);
    expect(responses[0]!.requestId).toBe('r2');
  });

  it('cancel is idempotent', () => {
    const state = createLookupWorkerState();
    handleWorkerMessage(state, hydrateChunk(1, buildBlob(['take off'])));
    handleWorkerMessage(state, { type: 'HYDRATE_DONE', requestId: 'h-done' } as WorkerHydrateDoneMessage);

    handleWorkerMessage(state, { type: 'LOOKUP_CANCEL', requestId: 'r1' } as WorkerCancelMessage);
    handleWorkerMessage(state, { type: 'LOOKUP_CANCEL', requestId: 'r1' } as WorkerCancelMessage);
    expect(state.cancelled.has('r1')).toBe(true);

    const responses = handleWorkerMessage(state, lookup('r1', 'Take off your shoes.', 0));
    expect(responses[0]!.ok).toBe(false);
    expect(responses[0]!.error).toBe('cancelled');
  });
});

describe('lookupWorkerHandler — worker restart safety', () => {
  it('a fresh state is unhydrated and has no resident indexes', () => {
    const state = createLookupWorkerState();
    expect(state.hydrated).toBe(false);
    expect(state.residentIndexes.size).toBe(0);
    expect(state.cancelled.size).toBe(0);
    expect(state.hydrationErrors.size).toBe(0);
  });

  it('re-hydrating a fresh state works (simulates worker restart)', () => {
    const s1 = createLookupWorkerState();
    handleWorkerMessage(s1, hydrateChunk(1, buildBlob(['take off'])));
    handleWorkerMessage(s1, { type: 'HYDRATE_DONE', requestId: 'h-done' } as WorkerHydrateDoneMessage);
    expect(s1.hydrated).toBe(true);

    const s2 = createLookupWorkerState();
    handleWorkerMessage(s2, hydrateChunk(1, buildBlob(['take off'])));
    handleWorkerMessage(s2, { type: 'HYDRATE_DONE', requestId: 'h-done' } as WorkerHydrateDoneMessage);
    expect(s2.hydrated).toBe(true);
    expect(s2.residentIndexes.size).toBe(1);
    expect(s2.cancelled.size).toBe(0);
  });
});

describe('lookupWorkerHandler — explicit priority + disabled resources', () => {
  it('picks the lowest-priority resource over newest resourceId', () => {
    const state = createLookupWorkerState();
    handleWorkerMessage(state, hydrateChunk(1, buildBlob(['take off'])));
    handleWorkerMessage(state, hydrateChunk(5, buildBlob(['take off'])));
    setWorkerPriorityMap(state, new Map([
      [1, 1],
      [5, 10],
    ]));
    handleWorkerMessage(state, { type: 'HYDRATE_DONE', requestId: 'h-done' } as WorkerHydrateDoneMessage);

    const responses = handleWorkerMessage(state, lookup('r1', 'Take off your shoes.', 0));
    expect(responses[0]!.ok).toBe(true);
    expect(responses[0]!.result?.detectedPhrase?.sourceResourceId).toBe(1);
  });

  it('ignores disabled resources during hydration and lookup', () => {
    const state = createLookupWorkerState();
    setWorkerDisabledResourceIds(state, new Set([1]));
    handleWorkerMessage(state, hydrateChunk(1, buildBlob(['take off'])));
    handleWorkerMessage(state, hydrateChunk(5, buildBlob(['take off'])));
    expect(state.residentIndexes.size).toBe(1);
    expect(state.residentIndexes.has(1)).toBe(false);
    expect(state.residentIndexes.has(5)).toBe(true);

    handleWorkerMessage(state, { type: 'HYDRATE_DONE', requestId: 'h-done' } as WorkerHydrateDoneMessage);
    const responses = handleWorkerMessage(state, lookup('r1', 'Take off your shoes.', 0));
    expect(responses[0]!.ok).toBe(true);
    expect(responses[0]!.result?.detectedPhrase?.sourceResourceId).toBe(5);
  });
});
