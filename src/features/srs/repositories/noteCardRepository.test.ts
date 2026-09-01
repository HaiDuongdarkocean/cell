import 'fake-indexeddb/auto';
import type { SrsCard, SrsNote, SrsFsrsSerializedState, ComponentType } from '@/entities/srs/types';
import { putNote, getNote, deleteNote, getNotesByDeck, getNoteByTargetAndNotetype } from './noteRepository';
import { putCard, getCard, deleteCard, getCardsByDeck, getCardByNoteAndDeck, getCardsByNote } from './cardRepository';
import { closeAllSrsDBs, clearAllSrsStores, getSrsDbName, deleteSrsDB } from './srsDatabase';
import { SrsError } from '@/features/srs/lib/srsError';

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
});

beforeEach(() => {
  storageLocalGetMock.mockReset();
  storageLocalGetMock.mockResolvedValue({});
  closeAllSrsDBs();
});

beforeEach(async () => {
  await clearAllSrsStores();
});

afterEach(() => {
  closeAllSrsDBs();
});

afterAll(async () => {
  delete (global as { chrome?: unknown }).chrome;
  const dbName = await getSrsDbName();
  await deleteSrsDB(dbName);
});

const emptyFsrs = (now = '2025-01-01T00:00:00.000Z'): SrsFsrsSerializedState => ({
  version: 1,
  due: now,
  stability: 0,
  difficulty: 0,
  elapsedDays: 0,
  scheduledDays: 0,
  reps: 0,
  lapses: 0,
  learningSteps: 0,
  state: 0,
});

const makeComponent = (type: ComponentType, due: string) => ({
  type,
  progress: 0,
  exploreCount: 0,
  fsrsState: emptyFsrs(due),
  reviewCount: 0,
});

const makeNote = (id: string, notetypeId: string, deckId: string, targetWord: string): SrsNote => ({
  id,
  notetypeId,
  deckId,
  targetWord,
  fields: {},
  createdAt: 1,
});

const makeCard = (id: string, noteId: string, deckId: string, nextDue: string): SrsCard => ({
  id,
  noteId,
  deckId,
  components: {
    meaning: makeComponent('meaning', nextDue),
    sound: makeComponent('sound', nextDue),
    spelling: makeComponent('spelling', nextDue),
  },
  studyAgainDue: { meaning: null, sound: null, spelling: null },
  createdAt: 1,
  nextDue,
  maintenanceMode: false,
});

describe('noteRepository', () => {
  it('stores and retrieves a note', async () => {
    const note = makeNote('n1', 'nt1', 'd1', 'abandon');
    await putNote(note);
    const found = await getNote('n1');
    expect(found).toEqual(note);
  });

  it('throws NOT_FOUND for missing note', async () => {
    await expect(getNote('missing')).rejects.toThrow(SrsError);
  });

  it('throws DUPLICATE for same targetWord + notetypeId', async () => {
    const note1 = makeNote('n1', 'nt1', 'd1', 'abandon');
    const note2 = makeNote('n2', 'nt1', 'd1', 'abandon');
    await putNote(note1);
    await expect(putNote(note2)).rejects.toThrow(SrsError);
  });

  it('lists notes by deck', async () => {
    const n1 = makeNote('n1', 'nt1', 'd1', 'abandon');
    const n2 = makeNote('n2', 'nt1', 'd2', 'ability');
    await putNote(n1);
    await putNote(n2);
    const found = await getNotesByDeck('d1');
    expect(found.map((n) => n.id)).toEqual(['n1']);
  });

  it('finds note by target and notetype', async () => {
    const n = makeNote('n1', 'nt1', 'd1', 'abandon');
    await putNote(n);
    const found = await getNoteByTargetAndNotetype('abandon', 'nt1');
    expect(found).toEqual(n);
  });

  it('deletes a note', async () => {
    const n = makeNote('n1', 'nt1', 'd1', 'abandon');
    await putNote(n);
    await deleteNote('n1');
    await expect(getNote('n1')).rejects.toThrow(SrsError);
  });
});

describe('cardRepository', () => {
  it('stores and retrieves a card', async () => {
    const card = makeCard('c1', 'n1', 'd1', '2025-01-01T00:00:00.000Z');
    await putCard(card);
    const found = await getCard('c1');
    expect(found).toEqual(card);
  });

  it('throws NOT_FOUND for missing card', async () => {
    await expect(getCard('missing')).rejects.toThrow(SrsError);
  });

  it('throws DUPLICATE for same noteId + deckId', async () => {
    const c1 = makeCard('c1', 'n1', 'd1', '2025-01-01T00:00:00.000Z');
    const c2 = makeCard('c2', 'n1', 'd1', '2025-01-02T00:00:00.000Z');
    await putCard(c1);
    await expect(putCard(c2)).rejects.toThrow(SrsError);
  });

  it('lists cards by deck', async () => {
    const c1 = makeCard('c1', 'n1', 'd1', '2025-01-01T00:00:00.000Z');
    const c2 = makeCard('c2', 'n2', 'd2', '2025-01-01T00:00:00.000Z');
    await putCard(c1);
    await putCard(c2);
    const found = await getCardsByDeck('d1');
    expect(found.map((c) => c.id)).toEqual(['c1']);
  });

  it('finds card by note and deck', async () => {
    const c = makeCard('c1', 'n1', 'd1', '2025-01-01T00:00:00.000Z');
    await putCard(c);
    const found = await getCardByNoteAndDeck('n1', 'd1');
    expect(found).toEqual(c);
  });

  it('lists cards by note', async () => {
    const c1 = makeCard('c1', 'n1', 'd1', '2025-01-01T00:00:00.000Z');
    const c2 = makeCard('c2', 'n1', 'd2', '2025-01-01T00:00:00.000Z');
    await putCard(c1);
    await putCard(c2);
    const found = await getCardsByNote('n1');
    expect(found.map((c) => c.id)).toEqual(['c1', 'c2']);
  });

  it('deletes a card', async () => {
    const c = makeCard('c1', 'n1', 'd1', '2025-01-01T00:00:00.000Z');
    await putCard(c);
    await deleteCard('c1');
    await expect(getCard('c1')).rejects.toThrow(SrsError);
  });
});
