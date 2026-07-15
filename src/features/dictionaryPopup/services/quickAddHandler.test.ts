// quickAddHandler tests — spec §9.2, D7: Anki Quick Add + offline retry.

import { describe, expect, it, beforeEach } from '@jest/globals';
import {
  executeQuickAdd,
  queueQuickAdd,
  getOfflineQueueLength,
  clearOfflineQueue,
  processOfflineQueue,
} from './quickAddHandler';
import type { FetchFn } from '@/features/cardCreator/service/ankiConnectClient';
import type { QuickAddPayload, WordStatus } from '../types';
import type { CardCreatorSettings } from '@/entities/settings/types';

function makePayload(overrides: Partial<QuickAddPayload> = {}): QuickAddPayload {
  return {
    term: 'take off',
    langCode: 'en',
    definitions: [],
    audios: [],
    images: [],
    translation: '',
    sentence: 'Take off your shoes.',
    status: 'tracking' as WordStatus,
    destination: 'anki',
    ...overrides,
  };
}

function makeSettings(overrides: Partial<CardCreatorSettings> = {}): CardCreatorSettings {
  return {
    ankiConnectUrl: 'http://localhost:8765',
    defaultDeck: 'Default',
    defaultNoteType: 'Cell Video Card',
    defaultTags: '',
    mediaUpdateMode: 'overwrite',
    ...overrides,
  };
}

/** Mock fetch that returns AnkiConnect-style responses. */
function makeMockFetch(response: unknown = 12345): FetchFn {
  return async () => ({
    ok: true,
    status: 200,
    json: async () => ({ result: response, error: null }),
  });
}

/** Mock fetch that fails with connection error. */
function makeOfflineFetch(): FetchFn {
  return async () => {
    throw new TypeError('Failed to fetch');
  };
}

/** Mock fetch that throws a field error. */
function makeFieldErrorFetch(): FetchFn {
  return async () => {
    throw new Error("value for field 'Front' is required");
  };
}

/** Mock fetch that inspects the request body (for asserting tags). */
function makeInspectingFetch(response: unknown, inspect: (body: string) => void): FetchFn {
  return async (_url, init) => {
    inspect(init?.body ?? '');
    return { ok: true, status: 200, json: async () => ({ result: response, error: null }) };
  };
}

describe('executeQuickAdd', () => {
  beforeEach(() => {
    clearOfflineQueue();
  });

  it('returns ok with noteId on success', async () => {
    const fetchFn = makeMockFetch(12345);
    const result = await executeQuickAdd(
      makePayload(),
      makeSettings(),
      { Front: 'term', Back: 'definitions' },
      fetchFn,
    );
    expect(result.ok).toBe(true);
    expect(result.noteId).toBe(12345);
  });

  it('returns error when noteId is null (duplicate)', async () => {
    const fetchFn = makeMockFetch(null);
    const result = await executeQuickAdd(
      makePayload(),
      makeSettings(),
      { Front: 'term' },
      fetchFn,
    );
    expect(result.ok).toBe(false);
    expect(result.error).toContain('null noteId');
  });

  it('queues for retry on connection error', async () => {
    const fetchFn = makeOfflineFetch();
    const result = await executeQuickAdd(
      makePayload(),
      makeSettings(),
      { Front: 'term' },
      fetchFn,
    );
    expect(result.ok).toBe(false);
    expect(result.error).toContain('queued for retry');
    expect(getOfflineQueueLength()).toBe(1);
  });

  it('parses field errors from AnkiConnect message', async () => {
    const fetchFn = makeFieldErrorFetch();
    const result = await executeQuickAdd(
      makePayload(),
      makeSettings(),
      { Front: 'term' },
      fetchFn,
    );
    expect(result.ok).toBe(false);
    expect(result.fieldErrors).toBeDefined();
    expect(result.fieldErrors![0]!.field).toBe('Front');
  });

  it('includes tags from settings', async () => {
    let capturedBody = '';
    const fetchFn = makeInspectingFetch(99, (body) => { capturedBody = body; });
    await executeQuickAdd(
      makePayload(),
      makeSettings({ defaultTags: 'english video' }),
      { Front: 'term' },
      fetchFn,
    );
    const body = JSON.parse(capturedBody);
    expect(body.params.note.tags).toEqual(['english', 'video']);
  });
});

describe('offline queue', () => {
  beforeEach(() => {
    clearOfflineQueue();
  });

  it('queueQuickAdd adds to queue', () => {
    queueQuickAdd(makePayload(), makeSettings(), { Front: 'term' });
    expect(getOfflineQueueLength()).toBe(1);
  });

  it('clearOfflineQueue empties the queue', () => {
    queueQuickAdd(makePayload(), makeSettings(), { Front: 'term' });
    clearOfflineQueue();
    expect(getOfflineQueueLength()).toBe(0);
  });

  it('processOfflineQueue retries queued items', async () => {
    queueQuickAdd(makePayload(), makeSettings(), { Front: 'term' });
    const fetchFn = makeMockFetch(42);
    const results = await processOfflineQueue(fetchFn);
    expect(results).toHaveLength(1);
    expect(results[0]!.ok).toBe(true);
    expect(results[0]!.noteId).toBe(42);
    expect(getOfflineQueueLength()).toBe(0);
  });

  it('processOfflineQueue re-queues on continued failure', async () => {
    queueQuickAdd(makePayload(), makeSettings(), { Front: 'term' });
    const fetchFn = makeOfflineFetch();
    const results = await processOfflineQueue(fetchFn);
    expect(results).toHaveLength(1);
    expect(results[0]!.ok).toBe(false);
    expect(getOfflineQueueLength()).toBe(1); // re-queued
  });
});



