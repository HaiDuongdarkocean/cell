import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { saveLookupLog, readLookupLog, clearLookupLog } from './lookupLogStore';
import type { LookupLogEntry } from '@/features/dictionary';

declare global {
  var __lookupLogDevMode: boolean | undefined;
}

jest.mock('@/shared/lib/env/devMode', () => ({
  get isDevMode() {
    return Boolean(global.__lookupLogDevMode);
  },
}));

const storageData: Record<string, unknown> = {};

const localMock = {
  get: jest.fn((key: string) => Promise.resolve({ [key]: storageData[key] })),
  set: jest.fn((items: Record<string, unknown>) => {
    Object.assign(storageData, items);
    return Promise.resolve();
  }),
  remove: jest.fn((key: string) => {
    delete storageData[key];
    return Promise.resolve();
  }),
};

function makeEntry(id: string): LookupLogEntry {
  return {
    id,
    timestamp: 1,
    request: { term: 'a', langCode: 'en', contextSentence: 'a', cursorOffset: 0, fallback: false },
    tokens: [],
    targetTokenIndex: 0,
    surfaceTerm: 'a',
    results: [],
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  for (const key of Object.keys(storageData)) delete storageData[key];
  global.__lookupLogDevMode = false;
  (globalThis as { chrome?: unknown }).chrome = { storage: { local: localMock } };
});

describe('lookupLogStore dev gate', () => {
  it('no-ops all operations when dev mode is off', async () => {
    await saveLookupLog(makeEntry('e1'));
    expect(await readLookupLog()).toEqual([]);
    await clearLookupLog();

    expect(localMock.get).not.toHaveBeenCalled();
    expect(localMock.set).not.toHaveBeenCalled();
    expect(localMock.remove).not.toHaveBeenCalled();
  });

  it('saves, reads and clears the ring buffer when dev mode is on', async () => {
    global.__lookupLogDevMode = true;

    await saveLookupLog(makeEntry('e1'));
    await saveLookupLog(makeEntry('e2'));

    const logs = await readLookupLog();
    expect(logs.map((l) => l.id)).toEqual(['e1', 'e2']);

    await clearLookupLog();
    expect(localMock.remove).toHaveBeenCalledWith('lookupLog');
    expect(await readLookupLog()).toEqual([]);
  });
});
