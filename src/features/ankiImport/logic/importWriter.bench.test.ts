import 'fake-indexeddb/auto';
import { importNormalized } from './importWriter';
import {
  clearAllSrsStores,
  closeAllSrsDBs,
  deleteSrsDB,
  getSrsDbName,
} from '@/features/srs';
import type { NormalizedAnkiData } from '../model/normalized';

const loadSettingsMock = jest.fn();
jest.mock('@/shared/lib/storage/settingsStore', () => ({
  loadSettings: () => loadSettingsMock(),
  saveSettings: jest.fn(),
}));

const N_CARDS = 600;

beforeEach(async () => {
  closeAllSrsDBs();
  await clearAllSrsStores();
  loadSettingsMock.mockReset();
  loadSettingsMock.mockResolvedValue({
    activeProfileId: 'lp1',
    languageProfiles: [{ id: 'lp1', target: 'ja', native: '', name: 'Việt → Nhật', order: 1 }],
    srs: {},
  });
});

afterEach(() => closeAllSrsDBs());
afterAll(async () => {
  const name = await getSrsDbName();
  await deleteSrsDB(name);
});

function makeBigData(resolve: (name: string) => Promise<{ bytes: ArrayBuffer; mimeType: string } | null>): NormalizedAnkiData {
  const cards: NormalizedAnkiData['cards'] extends readonly (infer T)[] ? T[] : never = [];
  const notes: NormalizedAnkiData['notes'] extends readonly (infer T)[] ? T[] : never = [];
  const revlog: NormalizedAnkiData['revlog'] extends readonly (infer T)[] ? T[] : never = [];
  for (let i = 0; i < N_CARDS; i++) {
    notes.push({
      id: i,
      modelId: 'm1',
      fields: [`word${i}`, `def ${i}`, `[sound:w${i % 50}.mp3]`, `<img src="i${i % 30}.png">`],
      tags: [],
    });
    cards.push({
      id: 1000 + i, noteId: i, deckId: '2', ord: 0, type: 2, queue: 2,
      due: 42, ivl: 30, factor: 2500, reps: 12, lapses: 1, left: 0, odid: 0,
    });
    revlog.push(
      { id: 1750000000000 + i * 2, cardId: 1000 + i, ease: 3, ivl: 30, time: 4000 },
      { id: 1749000000000 + i * 2, cardId: 1000 + i, ease: 1, ivl: -60, time: 3000 },
    );
  }
  return {
    source: 'apkg',
    fidelity: 'full',
    hasScheduling: true,
    crtMs: Date.UTC(2026, 0, 1),
    decks: [{ id: '2', name: 'Big', filtered: false, desiredRetention: 0.9 }],
    notetypes: [{
      id: 'm1', name: 'Basic', isCloze: false,
      fields: [
        { name: 'Front', ord: 0 }, { name: 'Back', ord: 1 },
        { name: 'Audio', ord: 2 }, { name: 'Pic', ord: 3 },
      ],
    }],
    notes,
    cards,
    revlog,
    media: {
      names: [],
      resolve,
      size: () => 3,
    },
  };
}

describe('importNormalized bench', () => {
  it('writes 600 cards in few transactions', async () => {
    let txCount = 0;
    const origTx = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (this: IDBDatabase, ...args: Parameters<IDBDatabase['transaction']>) {
      txCount += 1;
      return origTx.apply(this, args);
    };
    let resolveCalls = 0;
    const data = makeBigData(async (name: string) => {
      resolveCalls += 1;
      return { bytes: new Uint8Array([1, 2, 3]).buffer, mimeType: name.endsWith('.png') ? 'image/png' : 'audio/mpeg' };
    });

    const t0 = Date.now();
    const report = await importNormalized({
      data,
      selection: { deckIds: new Set(['2']), notetypeIds: new Set(['m1']) },
      mappings: { m1: { Front: 'target', Back: 'definition', Audio: 'audio', Pic: 'image' } },
      targetLanguage: 'ja',
      now: new Date(),
    });
    const ms = Date.now() - t0;
    IDBDatabase.prototype.transaction = origTx;

    console.log(`imported=${report.importedCards} ms=${ms} txCount=${txCount} resolveCalls=${resolveCalls}`);
    expect(report.importedCards).toBe(N_CARDS);
    expect(report.reviewRecords).toBe(N_CARDS * 2);
    expect(report.mediaHits).toBe(N_CARDS * 2);
    // 80 unique filenames (50 mp3 + 30 png), not 1200 sequential calls
    expect(resolveCalls).toBe(80);
    // preamble txs + ~5 chunk commits — not ~2400 per-record txs
    expect(txCount).toBeLessThan(40);
  });
});
