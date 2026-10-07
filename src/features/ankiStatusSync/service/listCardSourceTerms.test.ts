import 'fake-indexeddb/auto';
import { describe, expect, it, beforeAll, beforeEach, afterEach } from '@jest/globals';

jest.mock('@/features/ankiImport', () => ({
  createDirectInvoker: jest.fn(),
  getStoredAnkiConnectUrl: jest.fn(async () => null),
  htmlToText: (s: string) => s,
}));

jest.mock('@/features/dictionary', () => ({
  normalizeTerm: (s: string) => s.trim().toLowerCase(),
  setWordStatusFromSync: jest.fn(),
  setWordStatusesFromSync: jest.fn(async () => ({ written: 0, skipped: 0 })),
}));

import { listCardSourceTerms } from './statusSyncService';
import {
  putLinks,
  closeStatusSyncDb,
} from '../repositories/statusSyncStorage';
import {
  getSrsDB,
  SRS_STORES,
  closeAllSrsDBs,
} from '@/features/srs';

const storageLocalGetMock = jest.fn<Promise<Record<string, unknown>>, [string | string[] | null]>();

beforeAll(() => {
  global.chrome = {
    storage: {
      local: {
        get: storageLocalGetMock as unknown as typeof chrome.storage.local.get,
        set: jest.fn(),
      },
    },
  } as unknown as typeof chrome;
  storageLocalGetMock.mockResolvedValue({});
});

function deleteDb(name: string): Promise<void> {
  return new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(name);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}

beforeEach(async () => {
  closeStatusSyncDb();
  closeAllSrsDBs();
  await deleteDb('cell-anki-status-sync');
  await deleteDb('cell-srs-devmode0');
});

afterEach(() => {
  closeStatusSyncDb();
  closeAllSrsDBs();
});

async function seedSrsGraph(): Promise<void> {
  const db = await getSrsDB();
  const tx = db.transaction(
    [SRS_STORES.COLLECTIONS, SRS_STORES.DECKS, SRS_STORES.NOTES],
    'readwrite',
  );
  tx.objectStore(SRS_STORES.COLLECTIONS).put({ id: 'c-en', targetLanguage: 'en' });
  tx.objectStore(SRS_STORES.COLLECTIONS).put({ id: 'c-ja', targetLanguage: 'ja' });
  tx.objectStore(SRS_STORES.DECKS).put({ id: 'd-en', collectionId: 'c-en' });
  tx.objectStore(SRS_STORES.DECKS).put({ id: 'd-ja', collectionId: 'c-ja' });
  tx.objectStore(SRS_STORES.NOTES).put({ id: 'n1', deckId: 'd-en', targetWord: '  Hello ' });
  tx.objectStore(SRS_STORES.NOTES).put({ id: 'n2', deckId: 'd-ja', targetWord: 'world' });
  tx.objectStore(SRS_STORES.NOTES).put({ id: 'n3', deckId: 'd-en', targetWord: 'serendipity' });
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

describe('listCardSourceTerms', () => {
  it('lists Anki-linked terms for the requested language only', async () => {
    await putLinks([
      { cardId: 1, term: 'alpha', langCode: 'en', queue: 0, ivl: 3, mod: 10 },
      { cardId: 2, term: 'beta', langCode: 'en', queue: 0, ivl: 3, mod: 10 },
      { cardId: 3, term: 'gamma', langCode: 'ja', queue: 0, ivl: 3, mod: 10 },
    ]);

    const { anki } = await listCardSourceTerms('en');
    expect([...anki].sort()).toEqual(['alpha', 'beta']);
  });

  it('lists SRS terms via collection target language, normalized', async () => {
    await seedSrsGraph();

    const { srs } = await listCardSourceTerms('en');
    expect([...srs].sort()).toEqual(['hello', 'serendipity']);

    const ja = await listCardSourceTerms('ja');
    expect(ja.srs).toEqual(['world']);
  });

  it('returns empty lists when no cards exist', async () => {
    const terms = await listCardSourceTerms('en');
    expect(terms.anki).toEqual([]);
    expect(terms.srs).toEqual([]);
  });
});
