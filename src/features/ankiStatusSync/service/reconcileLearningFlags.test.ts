// reconcileLearningFlags — REQ-4 alt flow + REQ-4b (AC-7/AC-7b): the learning
// flag tracks real card existence across internal SRS + stored Anki links;
// known/ignore rows are never rewritten.

import 'fake-indexeddb/auto';
import { describe, expect, it, beforeAll, beforeEach, afterEach } from '@jest/globals';
import type { SrsCard } from '@/entities/srs/types';

jest.mock('@/features/ankiImport', () => ({
  createDirectInvoker: jest.fn(),
  getStoredAnkiConnectUrl: jest.fn(async () => null),
  htmlToText: (s: string) => s,
}));

jest.mock('@/features/dictionary', () => ({
  ...jest.requireActual<typeof import('@/features/dictionary/logic/normalizationPipeline')>(
    '@/features/dictionary/logic/normalizationPipeline',
  ),
  ...jest.requireActual<typeof import('@/features/dictionary/services/wordStatusSemantics')>(
    '@/features/dictionary/services/wordStatusSemantics',
  ),
  ...jest.requireActual<typeof import('@/features/dictionary/services/wordStatusStore')>(
    '@/features/dictionary/services/wordStatusStore',
  ),
}));

import {
  reconcileTermAfterCardLoss,
  reconcileLearningFlags,
  reconcileSrsCardLoss,
} from './statusSyncService';
import {
  putLinks,
  deleteLinks,
  getAllLinks,
  closeStatusSyncDb,
} from '../repositories/statusSyncStorage';
import { getSrsDB, SRS_STORES, closeAllSrsDBs } from '@/features/srs';
import {
  getWordStatus,
  setWordStatus,
  setWordStatusFromSync,
} from '@/features/dictionary/services/wordStatusStore';
import { closeAllDBs, clearAllStores } from '@/features/dictionary/repositories/baseRepository';

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
  await deleteDb('cell-srs-devmode0');
  await clearAllStores('en');
});

afterEach(() => {
  closeStatusSyncDb();
  closeAllSrsDBs();
  closeAllDBs();
});

interface SrsSeed {
  readonly lang: string;
  readonly deckId: string;
  readonly noteId?: string;
  readonly cardId?: string;
  readonly targetWord?: string;
  readonly scheduledDays?: number;
}

async function seedSrsGraph(seed: SrsSeed): Promise<void> {
  const db = await getSrsDB();
  const tx = db.transaction(
    [SRS_STORES.COLLECTIONS, SRS_STORES.DECKS, SRS_STORES.NOTES, SRS_STORES.CARDS],
    'readwrite',
  );
  tx.objectStore(SRS_STORES.COLLECTIONS).put({
    id: `c-${seed.lang}`,
    targetLanguage: seed.lang,
  });
  tx.objectStore(SRS_STORES.DECKS).put({ id: seed.deckId, collectionId: `c-${seed.lang}` });
  if (seed.noteId) {
    tx.objectStore(SRS_STORES.NOTES).put({
      id: seed.noteId,
      deckId: seed.deckId,
      notetypeId: 'nt1',
      targetWord: seed.targetWord ?? '',
      fields: {},
      createdAt: 1,
    });
  }
  if (seed.noteId && seed.cardId) {
    const card: SrsCard = {
      id: seed.cardId,
      noteId: seed.noteId,
      deckId: seed.deckId,
      components: {
        sound: {
          type: 'sound',
          progress: 0,
          exploreCount: 0,
          reviewCount: 0,
          fsrsState: {
            version: 1,
            due: '2026-01-01T00:00:00.000Z',
            stability: 0,
            difficulty: 0,
            elapsedDays: 0,
            scheduledDays: seed.scheduledDays ?? 0,
            reps: 0,
            lapses: 0,
            learningSteps: 0,
            state: 0,
          },
        },
      },
      studyAgainDue: {},
      createdAt: 1,
      nextDue: '2026-01-01',
      maintenanceMode: false,
    };
    tx.objectStore(SRS_STORES.CARDS).put(card);
  }
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

describe('reconcileTermAfterCardLoss', () => {
  it('clears learning → unknown when no card exists in either source', async () => {
    await setWordStatusFromSync('en', 'orphan', 'learning', { source: 'srs', sourceAt: 1 });

    await reconcileTermAfterCardLoss('en', 'orphan');

    expect(await getWordStatus('en', 'orphan')).toBe('unknown');
  });

  it('keeps learning when an Anki card link survives', async () => {
    await setWordStatusFromSync('en', 'linked', 'learning', { source: 'anki', sourceAt: 1 });
    await putLinks([{ cardId: 11, term: 'linked', langCode: 'en', queue: 0, ivl: 3, mod: 10 }]);

    await reconcileTermAfterCardLoss('en', 'linked');

    expect(await getWordStatus('en', 'linked')).toBe('learning');
  });

  it('keeps learning when an internal SRS card survives', async () => {
    await setWordStatusFromSync('en', 'carded', 'learning', { source: 'srs', sourceAt: 1 });
    await seedSrsGraph({ lang: 'en', deckId: 'd-en', noteId: 'n1', cardId: 'c1', targetWord: 'carded' });

    await reconcileTermAfterCardLoss('en', 'carded');

    expect(await getWordStatus('en', 'carded')).toBe('learning');
  });

  it('leaves tracking/known/ignore terms untouched', async () => {
    await setWordStatus('en', 't', 'tracking');
    await setWordStatus('en', 'k', 'known');
    await setWordStatus('en', 'i', 'ignore');

    await reconcileTermAfterCardLoss('en', 't');
    await reconcileTermAfterCardLoss('en', 'k');
    await reconcileTermAfterCardLoss('en', 'i');

    expect(await getWordStatus('en', 't')).toBe('tracking');
    expect(await getWordStatus('en', 'k')).toBe('known');
    expect(await getWordStatus('en', 'i')).toBe('ignore');
  });
});

describe('reconcileLearningFlags', () => {
  it('restores learning on an unknown-family term with a live SRS card', async () => {
    await setWordStatus('en', 'drifted', 'tracking');
    await seedSrsGraph({ lang: 'en', deckId: 'd-en', noteId: 'n1', cardId: 'c1', targetWord: 'drifted' });

    await reconcileLearningFlags('en');

    expect(await getWordStatus('en', 'drifted')).toBe('learning');
  });

  it('clears learning terms with zero cards across both sources', async () => {
    await setWordStatusFromSync('en', 'gone', 'learning', { source: 'srs', sourceAt: 1 });

    await reconcileLearningFlags('en');

    expect(await getWordStatus('en', 'gone')).toBe('unknown');
  });

  it('keeps learning when only an Anki link exists', async () => {
    await setWordStatusFromSync('en', 'anki-only', 'learning', { source: 'anki', sourceAt: 1 });
    await putLinks([{ cardId: 21, term: 'anki-only', langCode: 'en', queue: 0, ivl: 3, mod: 10 }]);

    await reconcileLearningFlags('en');

    expect(await getWordStatus('en', 'anki-only')).toBe('learning');
  });

  it('never rewrites known/ignore terms even with a live card', async () => {
    await setWordStatus('en', 'solid', 'known');
    await setWordStatus('en', 'muted', 'ignore');
    await seedSrsGraph({ lang: 'en', deckId: 'd-en', noteId: 'n1', cardId: 'c1', targetWord: 'solid' });
    await seedSrsGraph({ lang: 'en', deckId: 'd-en', noteId: 'n2', cardId: 'c2', targetWord: 'muted' });

    await reconcileLearningFlags('en');

    expect(await getWordStatus('en', 'solid')).toBe('known');
    expect(await getWordStatus('en', 'muted')).toBe('ignore');
  });

  it('ignores cards on collections of another language', async () => {
    await setWordStatus('en', 'drifted', 'tracking');
    await seedSrsGraph({ lang: 'ja', deckId: 'd-ja', noteId: 'n1', cardId: 'c1', targetWord: 'drifted' });

    await reconcileLearningFlags('en');

    expect(await getWordStatus('en', 'drifted')).toBe('tracking');
  });
});

describe('reconcileSrsCardLoss', () => {
  it('resolves the deck language and clears the flag when no card remains', async () => {
    await seedSrsGraph({ lang: 'en', deckId: 'd-en' });
    await setWordStatusFromSync('en', 'lost', 'learning', { source: 'srs', sourceAt: 1 });

    await reconcileSrsCardLoss('d-en', '  Lost ');

    expect(await getWordStatus('en', 'lost')).toBe('unknown');
  });

  it('keeps the flag when a sibling card still lives in another deck', async () => {
    await seedSrsGraph({ lang: 'en', deckId: 'd-gone' });
    await seedSrsGraph({ lang: 'en', deckId: 'd-live', noteId: 'n1', cardId: 'c1', targetWord: 'kept' });
    await setWordStatusFromSync('en', 'kept', 'learning', { source: 'srs', sourceAt: 1 });

    await reconcileSrsCardLoss('d-gone', 'kept');

    expect(await getWordStatus('en', 'kept')).toBe('learning');
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
