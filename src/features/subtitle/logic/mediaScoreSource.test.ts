import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { SrtCue } from '@/entities/media/types';
import type { WordStatus } from '@/entities/dictionary';

import { getWordStatuses, emitWordStatusChanged } from '@/features/dictionary';
import { createComprehensionStore, type ComprehensionStore } from '@/features/tokenize';
import { startMediaScoreSource } from './mediaScoreSource';

jest.mock('@/features/dictionary/services/wordStatusClient', () => ({
  getWordStatuses: jest.fn(),
}));

const mockedGet = getWordStatuses as jest.MockedFunction<typeof getWordStatuses>;

function cue(text: string, start = 0, end = 1): SrtCue {
  return { index: 0, start, end, text };
}

function makeCueEmitter(initial: SrtCue[] = []) {
  let cues = initial;
  const listeners = new Set<(c: SrtCue[]) => void>();
  return {
    getCues: () => cues,
    setCues(next: SrtCue[]) {
      cues = next;
      for (const l of listeners) l(cues);
    },
    subscribeCues: (l: (c: SrtCue[]) => void) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}

function allKnown(terms: readonly string[]): Map<string, WordStatus> {
  return new Map(terms.map((t) => [t, 'known' as WordStatus]));
}

async function flushDebounce(ms = 400): Promise<void> {
  await jest.advanceTimersByTimeAsync(ms);
  await Promise.resolve();
  await Promise.resolve();
}

describe('mediaScoreSource', () => {
  let store: ComprehensionStore;
  let stops: (() => void)[];

  beforeEach(() => {
    jest.useFakeTimers();
    store = createComprehensionStore();
    stops = [];
    mockedGet.mockReset();
    mockedGet.mockImplementation(async (_lang, terms) => allKnown(terms));
  });

  afterEach(() => {
    for (const s of stops) s();
    jest.useRealTimers();
  });

  it('publishes media stats after cues arrive and debounce elapses', async () => {
    const emitter = makeCueEmitter();
    stops.push(startMediaScoreSource({ langCode: 'en', store, ...emitter }));
    emitter.setCues([cue('Hello world')]);
    await flushDebounce();
    const s = store.getState().media;
    expect(s).not.toBeNull();
    expect(s!.kind).toBe('media');
    expect(s!.totalTokens).toBe(2);
    expect(s!.coverage).toBe(100);
  });

  it('suppresses when cues are empty and clears stats when cues are removed', async () => {
    const emitter = makeCueEmitter([cue('Hello world')]);
    stops.push(startMediaScoreSource({ langCode: 'en', store, ...emitter }));
    await flushDebounce();
    expect(store.getState().media).not.toBeNull();
    emitter.setCues([]);
    await flushDebounce();
    expect(store.getState().media).toBeNull();
  });

  it('suppresses zh-family languages (zh-hans normalized to zh)', async () => {
    const emitter = makeCueEmitter([cue('你好世界')]);
    stops.push(startMediaScoreSource({ langCode: 'zh-hans', store, ...emitter }));
    await flushDebounce();
    expect(mockedGet).not.toHaveBeenCalled();
    expect(store.getState().media).toBeNull();
  });

  it('fails open when status fetch resolves empty', async () => {
    mockedGet.mockResolvedValue(new Map());
    const emitter = makeCueEmitter([cue('Hello world')]);
    stops.push(startMediaScoreSource({ langCode: 'en', store, ...emitter }));
    await flushDebounce();
    expect(store.getState().media).toBeNull();
  });

  it('chunks term requests at 1000', async () => {
    const big = Array.from({ length: 1500 }, (_v, i) => `w${i}`).join(' ');
    const emitter = makeCueEmitter([cue(big)]);
    stops.push(startMediaScoreSource({ langCode: 'en', store, ...emitter }));
    await flushDebounce();
    expect(mockedGet.mock.calls.length).toBe(2);
    const sizes = mockedGet.mock.calls.map((c) => c[1].length);
    expect(sizes).toEqual([1000, 500]);
    expect(store.getState().media!.totalTokens).toBe(1500);
  });

  it('filters terms longer than 200 chars', async () => {
    const emitter = makeCueEmitter([cue(`${'x'.repeat(201)} ok`)]);
    stops.push(startMediaScoreSource({ langCode: 'en', store, ...emitter }));
    await flushDebounce();
    const sent = mockedGet.mock.calls.flatMap((c) => [...c[1]]);
    expect(sent).toEqual(['ok']);
  });

  it('applies live status events for the same language', async () => {
    mockedGet.mockImplementation(async (_l, terms) =>
      new Map(terms.map((t) => [t, t === 'hello' ? 'known' : 'unknown'] as const)),
    );
    const emitter = makeCueEmitter([cue('hello world')]);
    stops.push(startMediaScoreSource({ langCode: 'en', store, ...emitter }));
    await flushDebounce();
    expect(store.getState().media!.coverage).toBe(50);
    emitWordStatusChanged({ langCode: 'en', term: 'world', status: 'known' });
    expect(store.getState().media!.coverage).toBe(100);
  });

  it('ignores status events for other languages', async () => {
    const emitter = makeCueEmitter([cue('hello world')]);
    stops.push(startMediaScoreSource({ langCode: 'en', store, ...emitter }));
    await flushDebounce();
    const before = store.getState().media;
    emitWordStatusChanged({ langCode: 'ja', term: 'hello', status: 'tracking' });
    expect(store.getState().media).toBe(before);
  });

  it('buffers status events during resolve and replays them', async () => {
    let resolveFetch: (() => void) | null = null;
    mockedGet.mockImplementation(
      (_l, terms) =>
        new Promise<Map<string, WordStatus>>((r) => {
          resolveFetch = () => r(allKnown(terms));
        }),
    );
    const emitter = makeCueEmitter([cue('hello world')]);
    stops.push(startMediaScoreSource({ langCode: 'en', store, ...emitter }));
    jest.advanceTimersByTime(400);
    expect(resolveFetch).not.toBeNull();
    emitWordStatusChanged({ langCode: 'en', term: 'hello', status: 'tracking' });
    resolveFetch!();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    const s = store.getState().media!;
    expect(s.trackingTokens).toBe(1);
    expect(s.knownTokens).toBe(1);
  });

  it('debounces rapid cue updates into one resolve', async () => {
    const emitter = makeCueEmitter();
    stops.push(startMediaScoreSource({ langCode: 'en', store, ...emitter }));
    emitter.setCues([cue('first cue')]);
    emitter.setCues([cue('second cue')]);
    emitter.setCues([cue('third cue')]);
    await flushDebounce();
    expect(mockedGet.mock.calls.length).toBe(1);
    expect(store.getState().media!.totalTokens).toBe(2);
  });
});
