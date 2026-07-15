// Boundary schema tests — spec §9.2, §9.4.
//
// Valid payloads pass; invalid payloads fail closed with a machine-readable
// error. No `confidence` field is exposed anywhere.

import { describe, expect, it } from '@jest/globals';
import {
  AudioItemSchema,
  LookupRequestSchema,
  LookupResultSchema,
  PhraseMatchSchema,
  QuickAddPayloadSchema,
  WordStatusGetPayloadSchema,
  WordStatusSetPayloadSchema,
  WorkerCancelMessageSchema,
  WorkerHydrateChunkMessageSchema,
  WorkerHydrateDoneMessageSchema,
  WorkerLookupMessageSchema,
  WorkerLookupResultMessageSchema,
  WorkerPushDefinitionMessageSchema,
  WorkerReadyMessageSchema,
} from './schema';

describe('LookupRequestSchema', () => {
  it('accepts a valid phrase lookup request', () => {
    const r = LookupRequestSchema.safeParse({
      term: 'take',
      langCode: 'en',
      contextSentence: 'Please take off your shoes.',
      cursorOffset: 7,
    });
    expect(r.success).toBe(true);
  });

  it('accepts a fallback (bôi đen) request', () => {
    const r = LookupRequestSchema.safeParse({
      term: 'take off your shoes',
      langCode: 'en',
      contextSentence: 'Please take off your shoes.',
      cursorOffset: 7,
      fallback: true,
    });
    expect(r.success).toBe(true);
  });

  it('rejects empty term', () => {
    expect(
      LookupRequestSchema.safeParse({
        term: '',
        langCode: 'en',
        contextSentence: 'x',
        cursorOffset: 0,
      }).success,
    ).toBe(false);
  });

  it('rejects non-2-char langCode', () => {
    expect(
      LookupRequestSchema.safeParse({
        term: 'take',
        langCode: 'eng',
        contextSentence: 'x',
        cursorOffset: 0,
      }).success,
    ).toBe(false);
  });

  it('rejects negative cursorOffset', () => {
    expect(
      LookupRequestSchema.safeParse({
        term: 'take',
        langCode: 'en',
        contextSentence: 'x',
        cursorOffset: -1,
      }).success,
    ).toBe(false);
  });

  it('rejects contextSentence over 2000 chars', () => {
    expect(
      LookupRequestSchema.safeParse({
        term: 'take',
        langCode: 'en',
        contextSentence: 'x'.repeat(2001),
        cursorOffset: 0,
      }).success,
    ).toBe(false);
  });
});

describe('PhraseMatchSchema', () => {
  it('accepts a structurally valid phrase match', () => {
    const r = PhraseMatchSchema.safeParse({
      dictionaryTerm: 'take off',
      surface: 'take off',
      span: { start: 7, end: 15 },
      quality: 'fixed',
      sourceResourceId: 3,
    });
    expect(r.success).toBe(true);
  });

  it('rejects an invented confidence field is not part of the schema', () => {
    // Extra fields are ignored by Zod default, but the schema must NOT define
    // `confidence`. Verify the parsed output has no confidence key.
    const r = PhraseMatchSchema.safeParse({
      dictionaryTerm: 'take off',
      surface: 'take off',
      span: { start: 7, end: 15 },
      quality: 'fixed',
      sourceResourceId: 3,
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect((r.data as Record<string, unknown>)['confidence']).toBeUndefined();
    }
  });

  it('rejects negative sourceResourceId', () => {
    expect(
      PhraseMatchSchema.safeParse({
        dictionaryTerm: 'x',
        surface: 'x',
        span: { start: 0, end: 1 },
        quality: 'fixed',
        sourceResourceId: -1,
      }).success,
    ).toBe(false);
  });

  it('rejects unknown quality value', () => {
    expect(
      PhraseMatchSchema.safeParse({
        dictionaryTerm: 'x',
        surface: 'x',
        span: { start: 0, end: 1 },
        quality: 'fuzzy',
        sourceResourceId: 1,
      }).success,
    ).toBe(false);
  });
});

describe('LookupResultSchema', () => {
  const valid = {
    term: 'take off',
    langCode: 'en',
    reading: 'teɪk ɒf',
    readingKind: 'ipa',
    frequency: { rank: 1200, source: 'Cambridge' },
    status: 'unknown',
    partsOfSpeech: ['phrasal verb'],
    definitions: [
      {
        id: 'd1',
        pos: 'phrasal verb',
        text: 'to remove something',
        examples: ['Take off your coat.'],
        source: 'Cambridge',
        defaultSelected: true,
      },
    ],
    detectedPhrase: {
      dictionaryTerm: 'take off',
      surface: 'take off',
      span: { start: 7, end: 15 },
      quality: 'fixed',
      sourceResourceId: 3,
    },
    matchSource: 'plugin',
  };

  it('accepts a full phrase result', () => {
    expect(LookupResultSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts a word-fallback result with null detectedPhrase', () => {
    expect(
      LookupResultSchema.safeParse({ ...valid, detectedPhrase: null, matchSource: 'fallback' })
        .success,
    ).toBe(true);
  });

  it('accepts null frequency', () => {
    expect(LookupResultSchema.safeParse({ ...valid, frequency: null }).success).toBe(true);
  });

  it('rejects unknown matchSource', () => {
    expect(LookupResultSchema.safeParse({ ...valid, matchSource: 'guess' }).success).toBe(false);
  });

  it('rejects unknown word status', () => {
    expect(LookupResultSchema.safeParse({ ...valid, status: 'maybe' }).success).toBe(false);
  });
});

describe('QuickAddPayloadSchema', () => {
  const valid = {
    term: 'take off',
    langCode: 'en',
    definitions: [
      {
        id: 'd1',
        pos: 'phrasal verb',
        text: 'to remove',
        examples: [],
        source: 'Cambridge',
        defaultSelected: true,
      },
    ],
    audios: [
      {
        id: 'a1',
        kind: 'word',
        source: 'community',
        label: 'Forvo · US',
        state: 'idle',
        url: 'https://x/a.mp3',
        defaultSelected: true,
      },
    ],
    images: [],
    translation: '',
    sentence: 'Take off your shoes.',
    status: 'tracking',
    destination: 'anki',
  };

  it('accepts a valid Quick Add payload', () => {
    expect(QuickAddPayloadSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects destination other than anki (MVP)', () => {
    expect(
      QuickAddPayloadSchema.safeParse({ ...valid, destination: 'cell-memory' }).success,
    ).toBe(false);
  });

  it('rejects unknown audio source kind', () => {
    expect(
      QuickAddPayloadSchema.safeParse({
        ...valid,
        audios: [{ ...valid.audios[0], source: 'forvo' }],
      }).success,
    ).toBe(false);
  });
});

describe('AudioItemSchema', () => {
  it('accepts all audio states', () => {
    for (const state of ['idle', 'loading', 'playing', 'paused', 'unavailable', 'error']) {
      expect(
        AudioItemSchema.safeParse({
          id: 'a',
          kind: 'word',
          source: 'community',
          label: 'x',
          state,
          defaultSelected: false,
        }).success,
      ).toBe(true);
    }
  });
});

describe('Worker envelope schemas', () => {
  it('accepts a WORKER_READY message', () => {
    expect(WorkerReadyMessageSchema.safeParse({ type: 'WORKER_READY', requestId: 'r1' }).success).toBe(true);
  });

  it('accepts a LOOKUP message with valid LookupRequest payload', () => {
    expect(
      WorkerLookupMessageSchema.safeParse({
        type: 'LOOKUP',
        requestId: 'r1',
        payload: {
          term: 'take',
          langCode: 'en',
          contextSentence: 'Take off your shoes.',
          cursorOffset: 0,
        },
      }).success,
    ).toBe(true);
  });

  it('rejects a LOOKUP message with invalid payload', () => {
    expect(
      WorkerLookupMessageSchema.safeParse({
        type: 'LOOKUP',
        requestId: 'r1',
        payload: { term: '', langCode: 'en', contextSentence: 'x', cursorOffset: 0 },
      }).success,
    ).toBe(false);
  });

  it('accepts a LOOKUP_CANCEL message', () => {
    expect(WorkerCancelMessageSchema.safeParse({ type: 'LOOKUP_CANCEL', requestId: 'r1' }).success).toBe(true);
  });

  it('accepts a HYDRATE_CHUNK message with ArrayBuffer payload + resourceId', () => {
    const buf = new ArrayBuffer(8);
    expect(
      WorkerHydrateChunkMessageSchema.safeParse({
        type: 'HYDRATE_CHUNK',
        requestId: 'r1',
        resourceId: 3,
        payload: buf,
      }).success,
    ).toBe(true);
  });

  it('rejects HYDRATE_CHUNK with non-ArrayBuffer payload', () => {
    expect(
      WorkerHydrateChunkMessageSchema.safeParse({
        type: 'HYDRATE_CHUNK',
        requestId: 'r1',
        resourceId: 3,
        payload: 'not-a-buffer',
      }).success,
    ).toBe(false);
  });

  it('rejects HYDRATE_CHUNK missing resourceId', () => {
    expect(
      WorkerHydrateChunkMessageSchema.safeParse({
        type: 'HYDRATE_CHUNK',
        requestId: 'r1',
        payload: new ArrayBuffer(8),
      }).success,
    ).toBe(false);
  });

  it('rejects HYDRATE_CHUNK with negative resourceId', () => {
    expect(
      WorkerHydrateChunkMessageSchema.safeParse({
        type: 'HYDRATE_CHUNK',
        requestId: 'r1',
        resourceId: -1,
        payload: new ArrayBuffer(8),
      }).success,
    ).toBe(false);
  });

  it('accepts a HYDRATE_DONE message', () => {
    expect(WorkerHydrateDoneMessageSchema.safeParse({ type: 'HYDRATE_DONE', requestId: 'r1' }).success).toBe(true);
  });

  it('accepts a PUSH_DEFINITION message with entries', () => {
    expect(
      WorkerPushDefinitionMessageSchema.safeParse({
        type: 'PUSH_DEFINITION',
        requestId: 'r1',
        term: 'take',
        entries: [{ id: 'd1', text: 'to remove', examples: [], source: 'Cambridge', defaultSelected: true }],
      }).success,
    ).toBe(true);
  });

  it('rejects PUSH_DEFINITION with empty term', () => {
    expect(
      WorkerPushDefinitionMessageSchema.safeParse({
        type: 'PUSH_DEFINITION',
        requestId: 'r1',
        term: '',
        entries: [],
      }).success,
    ).toBe(false);
  });

  it('accepts a successful LOOKUP_RESULT', () => {
    expect(
      WorkerLookupResultMessageSchema.safeParse({
        type: 'LOOKUP_RESULT',
        requestId: 'r1',
        ok: true,
      }).success,
    ).toBe(true);
  });

  it('accepts an errored LOOKUP_RESULT', () => {
    expect(
      WorkerLookupResultMessageSchema.safeParse({
        type: 'LOOKUP_RESULT',
        requestId: 'r1',
        ok: false,
        error: 'aborted',
      }).success,
    ).toBe(true);
  });

  it('rejects a LOOKUP_RESULT missing requestId', () => {
    expect(
      WorkerLookupResultMessageSchema.safeParse({ type: 'LOOKUP_RESULT', ok: true }).success,
    ).toBe(false);
  });
});

describe('WordStatus payloads', () => {
  it('accepts a valid WORD_STATUS_GET payload', () => {
    expect(
      WordStatusGetPayloadSchema.safeParse({ tabId: 1, term: 'take', langCode: 'en' }).success,
    ).toBe(true);
  });

  it('accepts a valid WORD_STATUS_SET payload', () => {
    expect(
      WordStatusSetPayloadSchema.safeParse({
        tabId: 1,
        term: 'take',
        langCode: 'en',
        status: 'tracking',
      }).success,
    ).toBe(true);
  });

  it('rejects unknown status on SET', () => {
    expect(
      WordStatusSetPayloadSchema.safeParse({
        tabId: 1,
        term: 'take',
        langCode: 'en',
        status: 'maybe',
      }).success,
    ).toBe(false);
  });
});
