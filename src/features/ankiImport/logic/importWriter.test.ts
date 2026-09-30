import 'fake-indexeddb/auto';
import { importNormalized, estimateMediaBytes } from './importWriter';
import {
  clearAllSrsStores,
  closeAllSrsDBs,
  deleteSrsDB,
  getAudioAssetsByNote,
  getCardsByDeck,
  getCollectionByLanguageProfileId,
  getDecksByCollection,
  getNote,
  getNotetype,
  getReviewEventsByCard,
  getSrsDbName,
} from '@/features/srs';
import type { NormalizedAnkiData } from '../model/normalized';

const loadSettingsMock = jest.fn();
jest.mock('@/shared/lib/storage/settingsStore', () => ({
  loadSettings: () => loadSettingsMock(),
  saveSettings: jest.fn(),
}));

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

const NOW = new Date('2026-09-01T00:00:00.000Z');
const CRT = new Date('2026-01-01T00:00:00.000Z').getTime();

function makeData(over: Partial<NormalizedAnkiData> = {}): NormalizedAnkiData {
  return {
    source: 'apkg',
    fidelity: 'full',
    hasScheduling: true,
    crtMs: CRT,
    decks: [
      { id: '1', name: 'Default', filtered: false },
      { id: '2', name: 'Languages::JP::Core2k', filtered: false, desiredRetention: 0.9 },
      { id: '9', name: 'Filtered', filtered: true },
    ],
    notetypes: [
      { id: 'm1', name: 'Basic', isCloze: false, fields: [{ name: 'Front', ord: 0 }, { name: 'Back', ord: 1 }, { name: 'Audio', ord: 2 }] },
      { id: 'm2', name: 'ClozeX', isCloze: true, fields: [{ name: 'Text', ord: 0 }] },
    ],
    notes: [
      { id: 101, modelId: 'm1', fields: ['猫', 'con mèo', '[sound:cat.mp3]'], tags: ['jlpt'] },
      { id: 102, modelId: 'm2', fields: ['{{c1::犬}}'], tags: [] },
    ],
    cards: [
      // review card, due day 42 after crt → 2026-02-12
      { id: 1001, noteId: 101, deckId: '2', ord: 0, type: 2, queue: 2, due: 42, ivl: 30, factor: 2500, reps: 12, lapses: 1, left: 0, odid: 0 },
      // sibling card of same note → second note clone
      { id: 1002, noteId: 101, deckId: '2', ord: 1, type: 0, queue: 0, due: 5, ivl: 0, factor: 0, reps: 0, lapses: 0, left: 0, odid: 0 },
      // suspended → skipped
      { id: 1003, noteId: 101, deckId: '2', ord: 0, type: 2, queue: -1, due: 40, ivl: 10, factor: 2400, reps: 4, lapses: 0, left: 0, odid: 0 },
      // cloze card → skipped
      { id: 1004, noteId: 102, deckId: '2', ord: 0, type: 2, queue: 2, due: 40, ivl: 10, factor: 2400, reps: 4, lapses: 0, left: 0, odid: 0 },
      // filtered-deck card routed to odid '2'
      { id: 1005, noteId: 101, deckId: '9', ord: 0, type: 2, queue: 2, due: 41, ivl: 7, factor: 2200, reps: 3, lapses: 0, left: 0, odid: 2 },
    ],
    revlog: [
      { id: 1750000000000, cardId: 1001, ease: 3, ivl: 30, time: 4000 },
      { id: 1749000000000, cardId: 1001, ease: 1, ivl: -60, time: 3000 },
    ],
    media: {
      names: ['cat.mp3'],
      resolve: async (name) => (name === 'cat.mp3'
        ? { bytes: new Uint8Array([1, 2, 3]).buffer, mimeType: 'audio/mpeg' }
        : null),
      size: (name) => (name === 'cat.mp3' ? 3 : null),
    },
    ...over,
  };
}

const MAPPING = { m1: { Front: 'target', Back: 'definition', Audio: 'audio' } } as const;

const SELECTION = { deckIds: new Set(['2']), notetypeIds: new Set(['m1']) };

async function run(over: Partial<NormalizedAnkiData> = {}, opts = {}) {
  return importNormalized({
    data: makeData(over),
    selection: SELECTION,
    mappings: { ...MAPPING },
    targetLanguage: 'ja',
    now: NOW,
    ...opts,
  });
}

describe('importNormalized', () => {
  it('imports eligible cards, skips suspended/cloze, routes filtered-deck cards via odid', async () => {
    const report = await run();
    expect(report.importedCards).toBe(3); // 1001, 1002, 1005
    expect(report.skippedSuspended).toBe(1); // 1003
    expect(report.skippedCloze).toBe(1); // 1004
    expect(report.decksCreated).toBe(1);
    expect(report.reviewRecords).toBe(2);
    expect(report.mediaHits).toBe(3); // each imported note references cat.mp3

    const collection = await getCollectionByLanguageProfileId('lp1');
    expect(collection).toBeTruthy();
    const decks = await getDecksByCollection(collection!.id);
    expect(decks.map((d) => d.name)).toEqual(['Languages › JP › Core2k']);

    const cards = await getCardsByDeck(decks[0]!.id);
    expect(cards).toHaveLength(3);
    const c1001 = cards.find((c) => c.importSource?.cardId === 1001)!;
    expect(c1001.components.meaning.fsrsState.state).toBe(2);
    expect(c1001.components.meaning.fsrsState.due.startsWith('2026-02-12')).toBe(true);
    expect(c1001.components.meaning.reviewCount).toBe(12);

    const c1002 = cards.find((c) => c.importSource?.cardId === 1002)!;
    expect(c1002.components.meaning.fsrsState.state).toBe(0);

    // sibling card got its own note clone, normalized onto the system notetype
    const n1002 = await getNote(c1002.noteId);
    expect(n1002.id).not.toBe(c1001.noteId);
    expect(n1002.targetWord).toBe('猫');
    expect(n1002.tags).toEqual(['jlpt']);
    const sysNt = await getNotetype(`default-word-${collection!.id}`);
    expect(sysNt).toBeTruthy();
    expect(n1002.notetypeId).toBe(sysNt!.id);
    expect(n1002.fields['target']).toEqual({ kind: 'text', value: '猫' });
    expect(n1002.fields['wordAudio']?.kind).toBe('audio');
    expect(collection!.defaultNotetypeId).toBe(sysNt!.id);

    // revlog written for 1001
    const revs = await getReviewEventsByCard(c1001.id);
    expect(revs).toHaveLength(2);
    expect(revs.find((r) => r.judgment === 'forget')).toBeTruthy();
    expect(revs[0]!.id.startsWith('import-anki-')).toBe(true);

    // media asset stored
    const assets = await getAudioAssetsByNote(c1001.noteId);
    expect(assets).toHaveLength(1);
    expect(assets[0]!.mimeType).toBe('audio/mpeg');
  });

  it('is idempotent: re-import reports duplicates and writes nothing twice', async () => {
    await run();
    const second = await run();
    expect(second.importedCards).toBe(0);
    expect(second.duplicates).toBe(3);
    expect(second.decksCreated).toBe(0);

    const collection = await getCollectionByLanguageProfileId('lp1');
    const decks = await getDecksByCollection(collection!.id);
    expect(decks).toHaveLength(1);
    const cards = await getCardsByDeck(decks[0]!.id);
    expect(cards).toHaveLength(3);
    const revs = await getReviewEventsByCard(cards[0]!.id);
    expect(revs.length).toBeLessThanOrEqual(2);
  });

  it('counts media misses and leaves the field unset', async () => {
    const data = makeData({
      media: { names: [], resolve: async () => null },
    });
    const report = await importNormalized({
      data, selection: SELECTION, mappings: { ...MAPPING }, targetLanguage: 'ja', now: NOW,
    });
    expect(report.importedCards).toBe(3);
    expect(report.mediaMisses).toBe(3);
    expect(report.mediaHits).toBe(0);

    const collection = await getCollectionByLanguageProfileId('lp1');
    const decks = await getDecksByCollection(collection!.id);
    const cards = await getCardsByDeck(decks[0]!.id);
    const note = await getNote(cards[0]!.noteId);
    expect(note.fields['wordAudio']).toBeUndefined();
  });

  it('aborts mid-run leaving only committed bundles', async () => {
    const controller = new AbortController();
    let calls = 0;
    await expect(run({}, {
      signal: controller.signal,
      onProgress: () => { calls += 1; if (calls === 2) controller.abort(); },
    })).rejects.toMatchObject({ code: 'ABORTED' });
  });

  it('estimates media bytes when the source exposes sizes', async () => {
    const bytes = estimateMediaBytes(makeData(), SELECTION, { ...MAPPING });
    expect(bytes).toBe(3); // cat.mp3 referenced once (deduped by filename)
    const noSize = estimateMediaBytes(
      makeData({ media: { names: [], resolve: async () => null } }),
      SELECTION,
      { ...MAPPING },
    );
    expect(noSize).toBeNull();
  });
});
