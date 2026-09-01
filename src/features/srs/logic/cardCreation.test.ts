import 'fake-indexeddb/auto';
import type { SrsNotetype, SrsStudyConfig } from '@/entities/srs/types';
import { createSrsFsrsAdapter } from '@/features/srs/services/srsFsrsAdapter';
import { addNoteAndCard } from './cardCreation';
import { getNote } from '@/features/srs/repositories/noteRepository';
import { getCard } from '@/features/srs/repositories/cardRepository';
import { putCollection } from '@/features/srs/repositories/collectionRepository';
import { putDeck } from '@/features/srs/repositories/deckRepository';
import { closeAllSrsDBs, clearAllSrsStores, getSrsDbName, deleteSrsDB } from '@/features/srs/repositories/srsDatabase';
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

const now = new Date('2026-09-01T00:00:00.000Z');
const adapter = createSrsFsrsAdapter();

const makeCollection = () => ({
  id: 'col1',
  languageProfileId: 'lp1',
  targetLanguage: 'en',
  name: 'My SRS',
  defaultStudyConfigId: 'sc1',
  defaultDeckId: 'd1',
  defaultNotetypeId: 'nt1',
  createdAt: 1,
});

const makeDeck = () => ({
  id: 'd1',
  collectionId: 'col1',
  parentId: null,
  name: 'Default',
  order: 0,
  studyConfigId: 'sc1',
});

const makeNotetype = (): SrsNotetype => ({
  id: 'nt1',
  collectionId: 'col1',
  name: 'Default',
  targetFieldId: 'target',
  fields: [{ id: 'target', name: 'Target', order: 0, type: 'text' as const }],
  frontTemplates: [],
  backTemplate: { fieldIds: ['target'], showAll: true },
});

const makeConfig = (): SrsStudyConfig => ({
  id: 'sc1',
  targetThreshold: 90,
  learningPath: { stages: ['sound', 'meaning', 'spelling'], progressionMode: 'parallel', minExplores: 1 },
  progressConstants: { rememberGainBase: 20, rememberGainMin: 1, forgetPenaltyBase: 12, forgetPenaltyStep: 0.1 },
});

describe('cardCreation', () => {
  it('creates a note and card from scratch', async () => {
    await putCollection(makeCollection());
    await putDeck(makeDeck());

    const { note, card } = await addNoteAndCard(
      makeCollection(),
      'd1',
      makeNotetype(),
      'abandon',
      { target: { kind: 'text' as const, value: 'abandon' } },
      makeConfig(),
      now,
      adapter,
    );

    expect(await getNote(note.id)).toEqual(note);
    expect((await getCard(card.id)).noteId).toBe(note.id);
  });

  it('reuses an existing note in a different deck but rejects duplicate in same deck', async () => {
    await putCollection(makeCollection());
    await putDeck(makeDeck());
    await putDeck({
      id: 'd2',
      collectionId: 'col1',
      parentId: null,
      name: 'Deck 2',
      order: 1,
      studyConfigId: 'sc1',
    });

    const first = await addNoteAndCard(
      makeCollection(),
      'd1',
      makeNotetype(),
      'abandon',
      { target: { kind: 'text' as const, value: 'abandon' } },
      makeConfig(),
      now,
      adapter,
    );

    const second = await addNoteAndCard(
      makeCollection(),
      'd2',
      makeNotetype(),
      'abandon',
      { target: { kind: 'text' as const, value: 'abandon' } },
      makeConfig(),
      now,
      adapter,
    );

    expect(second.note.id).toBe(first.note.id);
    expect(second.card.id).not.toBe(first.card.id);

    await expect(
      addNoteAndCard(
        makeCollection(),
        'd1',
        makeNotetype(),
        'abandon',
        { target: { kind: 'text' as const, value: 'abandon' } },
        makeConfig(),
        now,
        adapter,
      ),
    ).rejects.toThrow(SrsError);
  });
});
