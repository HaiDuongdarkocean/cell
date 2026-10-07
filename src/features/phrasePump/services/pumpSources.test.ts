import { buildPumpItems, listPumpDecks } from './pumpSources';

const getAllCollections = jest.fn();
const getDeck = jest.fn();
const getDecksByCollection = jest.fn();
const getSubDecks = jest.fn();
const getCardIdsByDeckDueBefore = jest.fn();
const getCardsByIds = jest.fn();
const getNotesByIds = jest.fn();
const getNotetypesByIds = jest.fn();
const getAudioAssetsByNote = jest.fn();
const listQueueRows = jest.fn();
const getQueueItem = jest.fn();
const loadSettings = jest.fn();

jest.mock('@/features/srs/repositories/collectionRepository', () => ({ getAllCollections: (...a: unknown[]) => getAllCollections(...a) }));
jest.mock('@/features/srs/repositories/deckRepository', () => ({
  getDeck: (...a: unknown[]) => getDeck(...a),
  getDecksByCollection: (...a: unknown[]) => getDecksByCollection(...a),
  getSubDecks: (...a: unknown[]) => getSubDecks(...a),
}));
jest.mock('@/features/srs/repositories/cardRepository', () => ({
  getCardIdsByDeckDueBefore: (...a: unknown[]) => getCardIdsByDeckDueBefore(...a),
  getCardsByIds: (...a: unknown[]) => getCardsByIds(...a),
}));
jest.mock('@/features/srs/repositories/noteRepository', () => ({ getNotesByIds: (...a: unknown[]) => getNotesByIds(...a) }));
jest.mock('@/features/srs/repositories/notetypeRepository', () => ({ getNotetypesByIds: (...a: unknown[]) => getNotetypesByIds(...a) }));
jest.mock('@/features/srs/repositories/audioAssetRepository', () => ({ getAudioAssetsByNote: (...a: unknown[]) => getAudioAssetsByNote(...a) }));
jest.mock('@/features/miningQueue', () => ({
  listQueueRows: (...a: unknown[]) => listQueueRows(...a),
  getQueueItem: (...a: unknown[]) => getQueueItem(...a),
}));
jest.mock('@/shared/lib/storage/settingsStore', () => ({ loadSettings: () => loadSettings() }));

const collection = { id: 'c1', name: 'English', targetLanguage: 'en' };
const deck = { id: 'd1', collectionId: 'c1', name: 'Core', parentId: null };
const notetype = {
  id: 'nt',
  collectionId: 'c1',
  name: 'basic',
  targetFieldId: 'target',
  fields: [
    { id: 'target', name: 'target', order: 0, type: 'text' },
    { id: 'sentence', name: 'sentence', order: 1, type: 'text' },
    { id: 'sentAudio', name: 'sentAudio', order: 2, type: 'audio' },
  ],
  frontTemplates: [],
  backTemplate: { fieldIds: [], showAll: true },
};
const card = { id: 'card1', noteId: 'n1', deckId: 'd1', nextDue: '2026-01-01' };
const note = {
  id: 'n1',
  notetypeId: 'nt',
  deckId: 'd1',
  targetWord: 'apple',
  fields: {
    target: { kind: 'text', value: 'apple' },
    sentence: { kind: 'text', value: 'I eat an apple' },
    sentAudio: { kind: 'audio', value: 'a.mp3', source: 'local' },
  },
  createdAt: 0,
};

beforeEach(() => {
  jest.resetAllMocks();
  getAllCollections.mockResolvedValue([collection]);
  getDecksByCollection.mockResolvedValue([deck]);
  getSubDecks.mockResolvedValue([]);
  getCardIdsByDeckDueBefore.mockResolvedValue(['card1']);
  getCardsByIds.mockResolvedValue([card]);
  getNotesByIds.mockResolvedValue([note]);
  getNotetypesByIds.mockResolvedValue([notetype]);
  getAudioAssetsByNote.mockResolvedValue([]);
  listQueueRows.mockResolvedValue([]);
  loadSettings.mockResolvedValue({ profiles: [] });
});

describe('buildPumpItems', () => {
  it('assembles an SRS item with collection lang and falls back to TTS (no audio asset)', async () => {
    const items = await buildPumpItems({ deckId: null, includeSubdecks: true, includeQueue: false });
    expect(items).toHaveLength(1);
    const it = items[0]!;
    expect(it.id).toBe('srs:card1');
    expect(it.sentence).toBe('I eat an apple');
    expect(it.term).toBe('apple');
    expect(it.langCode).toBe('en');
    expect(it.audioUrl).toBeUndefined();
  });

  it('uses profile resourceLangCode when deck collection has no language', async () => {
    getAllCollections.mockResolvedValue([{ ...collection, targetLanguage: '' }]);
    loadSettings.mockResolvedValue({
      activeProfileId: 'p1',
      universalNativeLanguage: 'en',
      languageProfiles: [{ id: 'p1', target: 'vi', native: 'en' }],
    });
    const items = await buildPumpItems({ deckId: null, includeSubdecks: true, includeQueue: false });
    expect(items[0]!.langCode).toBe('vi');
  });

  it('resolves raw data: audio when no cached asset exists', async () => {
    getNotesByIds.mockResolvedValue([{
      ...note,
      fields: { ...note.fields, sentAudio: { kind: 'audio', value: 'data:audio/mp3;base64,AAAA', source: 'local' } },
    }]);
    const items = await buildPumpItems({ deckId: null, includeSubdecks: true, includeQueue: false });
    expect(items[0]!.audioUrl).toBe('data:audio/mp3;base64,AAAA');
  });

  it('creates a blob URL from a cached asset', async () => {
    URL.createObjectURL = jest.fn(() => 'blob:mocked');
    getAudioAssetsByNote.mockResolvedValue([{ noteId: 'n1', fieldId: 'sentAudio', index: 0, bytes: new ArrayBuffer(4), mimeType: 'audio/mp3' }]);
    const items = await buildPumpItems({ deckId: null, includeSubdecks: true, includeQueue: false });
    expect(items[0]!.audioUrl).toBe('blob:mocked');
  });

  it('includes queue sentences with snapshot audio and queue langCode', async () => {
    listQueueRows.mockResolvedValue([{ id: 'q1' }]);
    getQueueItem.mockResolvedValue({
      id: 'q1',
      kind: 'sentence',
      term: 'hola',
      sentence: 'Hola mundo',
      langCode: 'es',
      createdAt: 5,
      snapshot: { audioItems: [{ url: 'https://cdn/x.mp3' }] },
    });
    const items = await buildPumpItems({ deckId: null, includeSubdecks: true, includeQueue: true });
    expect(items).toHaveLength(2);
    const q = items.find((i) => i.id === 'queue:q1')!;
    expect(q.langCode).toBe('es');
    expect(q.audioUrl).toBe('https://cdn/x.mp3');
  });

  it('SRS wins dedupe over queue rows with the same sentence', async () => {
    listQueueRows.mockResolvedValue([{ id: 'q1' }]);
    getQueueItem.mockResolvedValue({
      id: 'q1', kind: 'sentence', term: 'apple', sentence: 'I eat an apple', langCode: 'es', createdAt: 5,
    });
    const items = await buildPumpItems({ deckId: null, includeSubdecks: true, includeQueue: true });
    expect(items).toHaveLength(1);
    expect(items[0]!.id).toBe('srs:card1');
  });

  it('narrows to a single deck and walks subdecks when requested', async () => {
    const sub = { id: 'd2', collectionId: 'c1', name: 'Core::Sub', parentId: 'd1' };
    getDeck.mockResolvedValue(deck);
    getSubDecks.mockImplementation(async (id: string) => (id === 'd1' ? [sub] : []));
    getCardIdsByDeckDueBefore.mockImplementation(async (deckId: string) => (deckId === 'd1' ? ['card1'] : []));
    await buildPumpItems({ deckId: 'd1', includeSubdecks: true, includeQueue: false });
    expect(getCardIdsByDeckDueBefore).toHaveBeenCalledWith('d1', expect.any(String), 200);
    expect(getCardIdsByDeckDueBefore).toHaveBeenCalledWith('d2', expect.any(String), 200);
    expect(getDecksByCollection).not.toHaveBeenCalled();
  });

  it('skips notes without a sentence and cards whose note is missing', async () => {
    getCardsByIds.mockResolvedValue([card, { ...card, id: 'card2', noteId: 'missing' }]);
    getNotesByIds.mockResolvedValue([{ ...note, fields: { target: { kind: 'text', value: 'x' } } }]);
    const items = await buildPumpItems({ deckId: null, includeSubdecks: true, includeQueue: false });
    expect(items).toHaveLength(0);
  });
});

describe('listPumpDecks', () => {
  it('prefixes collection name when multiple collections exist', async () => {
    getAllCollections.mockResolvedValue([collection, { id: 'c2', name: 'Viet', targetLanguage: 'vi' }]);
    getDecksByCollection.mockImplementation(async (id: string) => (id === 'c1' ? [deck] : [{ id: 'd3', collectionId: 'c2', name: 'Từ vựng', parentId: null }]));
    const out = await listPumpDecks();
    expect(out.find((d) => d.id === 'd1')!.label).toBe('Core · English');
    expect(out.find((d) => d.id === 'd3')!.langCode).toBe('vi');
  });
});
