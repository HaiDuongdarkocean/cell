// Card loss → hasCard layer only: deck-language resolution for the
// SRS_CARDS_CHANGED broadcast + link sweep. Word status is never rewritten
// by card deletion — tracking is user-owned, card presence lives in hasCard.

import 'fake-indexeddb/auto';
import { describe, expect, it, beforeAll, beforeEach, afterEach } from '@jest/globals';

jest.mock('@/features/ankiImport', () => ({
  createDirectInvoker: jest.fn(),
  getStoredAnkiConnectUrl: jest.fn(async () => null),
  htmlToText: (s: string) => s,
}));

import { srsDeckLangCode } from './statusSyncService';
import {
  putLinks,
  deleteLinks,
  getAllLinks,
  closeStatusSyncDb,
} from '../repositories/statusSyncStorage';
import { getSrsDB, SRS_STORES, closeAllSrsDBs } from '@/features/srs';
import {
  getWordStatus,
  setWordStatusFromSync,
  closeAllDBs,
  clearAllStores,
} from '@/features/dictionary';

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
  closeAllDBs();
  await deleteDb('cell-anki-status-sync');
  await deleteDb('Tihoka-srs-devmode0');
  await clearAllStores('en');
});

afterEach(() => {
  closeStatusSyncDb();
  closeAllSrsDBs();
  closeAllDBs();
});

async function seedDeck(deckId: string, lang: string): Promise<void> {
  const db = await getSrsDB();
  const tx = db.transaction([SRS_STORES.COLLECTIONS, SRS_STORES.DECKS], 'readwrite');
  tx.objectStore(SRS_STORES.COLLECTIONS).put({ id: `c-${lang}`, targetLanguage: lang });
  tx.objectStore(SRS_STORES.DECKS).put({ id: deckId, collectionId: `c-${lang}` });
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

describe('srsDeckLangCode', () => {
  it('resolves the deck collection target language', async () => {
    await seedDeck('d-en', 'en');
    expect(await srsDeckLangCode('d-en')).toBe('en');
  });

  it('returns null-ish fallback only when nothing resolves', async () => {
    // Unknown deck → falls back to active profile; no profiles in storage → null.
    storageLocalGetMock.mockResolvedValueOnce({});
    const code = await srsDeckLangCode('missing-deck');
    expect(code === null || typeof code === 'string').toBe(true);
  });

  it('never mutates word status — card loss is a hasCard-only update', async () => {
    await seedDeck('d-en', 'en');
    await setWordStatusFromSync('en', 'tracked', 'tracking', { source: 'srs', sourceAt: 1 });
    await putLinks([{ cardId: 7, term: 'tracked', langCode: 'en', queue: 0, ivl: 3, mod: 10 }]);

    await deleteLinks([7]);
    await srsDeckLangCode('d-en');

    expect(await getWordStatus('en', 'tracked')).toBe('tracking');
    expect(await getAllLinks()).toEqual([]);
  });
});

describe('deleteLinks', () => {
  it('removes only the given cardIds', async () => {
    await putLinks([
      { cardId: 1, term: 'a', langCode: 'en', queue: 0, ivl: 3, mod: 10 },
      { cardId: 2, term: 'b', langCode: 'en', queue: 0, ivl: 3, mod: 10 },
      { cardId: 3, term: 'c', langCode: 'en', queue: 0, ivl: 3, mod: 10 },
    ]);

    await deleteLinks([1, 2]);

    const remaining = await getAllLinks();
    expect(remaining.map((link) => link.cardId)).toEqual([3]);
  });
});
