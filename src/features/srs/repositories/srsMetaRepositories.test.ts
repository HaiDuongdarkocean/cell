import 'fake-indexeddb/auto';
import type { SrsCollection, SrsStudyConfig } from '@/entities/srs/types';
import {
  getCollection,
  putCollection,
  deleteCollection,
  getCollectionByLanguageProfileId,
} from './collectionRepository';
import { getDeck, putDeck, deleteDeck, getDecksByCollection, getSubDecks } from './deckRepository';
import { getStudyConfig, putStudyConfig, deleteStudyConfig } from './studyConfigRepository';
import { closeAllSrsDBs, deleteSrsDB, getSrsDbName, clearAllSrsStores } from './srsDatabase';
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

afterEach(async () => {
  closeAllSrsDBs();
});

afterAll(async () => {
  delete (global as { chrome?: unknown }).chrome;
  const dbName = await getSrsDbName();
  await deleteSrsDB(dbName);
});

const makeCollection = (id: string, languageProfileId: string | null, targetLanguage: string) => ({
  id,
  languageProfileId,
  targetLanguage,
  name: `Collection ${id}`,
  defaultStudyConfigId: `sc-${id}`,
  defaultDeckId: `deck-${id}`,
  defaultNotetypeId: `nt-${id}`,
  createdAt: 1,
});

const makeDeck = (id: string, collectionId: string, parentId: string | null, order: number, name: string) => ({
  id,
  collectionId,
  parentId,
  name,
  order,
  studyConfigId: `sc-${collectionId}`,
});

const makeStudyConfig = (id: string): SrsStudyConfig => ({
  id,
  targetThreshold: 90,
  learningPath: { stages: ['sound', 'meaning', 'spelling'], progressionMode: 'parallel', minExplores: 1 },
  progressConstants: { rememberGainBase: 20, rememberGainMin: 1, forgetPenaltyBase: 12, forgetPenaltyStep: 0.1 },
});

describe('collectionRepository', () => {
  it('stores and retrieves a collection', async () => {
    const c = makeCollection('c1', 'lp1', 'en');
    await putCollection(c);
    const found = await getCollection('c1');
    expect(found).toEqual(c);
  });

  it('throws NOT_FOUND for missing collection', async () => {
    await expect(getCollection('missing')).rejects.toThrow(SrsError);
  });

  it('throws INVALID_INPUT when id missing', async () => {
    const c = { ...makeCollection('c2', 'lp1', 'en'), id: '' };
    await expect(putCollection(c as SrsCollection)).rejects.toThrow(SrsError);
  });

  it('finds collection by language profile id', async () => {
    const c = makeCollection('c3', 'lp2', 'ja');
    await putCollection(c);
    const found = await getCollectionByLanguageProfileId('lp2');
    expect(found).toEqual(c);
  });

  it('deletes a collection', async () => {
    const c = makeCollection('c4', 'lp3', 'en');
    await putCollection(c);
    await deleteCollection('c4');
    await expect(getCollection('c4')).rejects.toThrow(SrsError);
  });
});

describe('deckRepository', () => {
  it('stores and retrieves a deck', async () => {
    const d = makeDeck('d1', 'c1', null, 0, 'Root');
    await putDeck(d);
    const found = await getDeck('d1');
    expect(found).toEqual(d);
  });

  it('throws NOT_FOUND for missing deck', async () => {
    await expect(getDeck('missing')).rejects.toThrow(SrsError);
  });

  it('lists decks by collection, sorted by order', async () => {
    const d1 = makeDeck('d1', 'c1', null, 2, 'Later');
    const d2 = makeDeck('d2', 'c1', null, 1, 'Earlier');
    await putDeck(d1);
    await putDeck(d2);
    const decks = await getDecksByCollection('c1');
    expect(decks.map((d) => d.id)).toEqual(['d2', 'd1']);
  });

  it('lists subdecks by parent', async () => {
    const parent = makeDeck('p1', 'c1', null, 0, 'Parent');
    const child = makeDeck('c1', 'c1', 'p1', 0, 'Child');
    await putDeck(parent);
    await putDeck(child);
    const subs = await getSubDecks('p1');
    expect(subs.map((d) => d.id)).toEqual(['c1']);
  });

  it('deletes a deck', async () => {
    const d = makeDeck('d3', 'c1', null, 0, 'To delete');
    await putDeck(d);
    await deleteDeck('d3');
    await expect(getDeck('d3')).rejects.toThrow(SrsError);
  });
});

describe('studyConfigRepository', () => {
  it('stores and retrieves a study config', async () => {
    const sc = makeStudyConfig('sc1');
    await putStudyConfig(sc);
    const found = await getStudyConfig('sc1');
    expect(found).toEqual(sc);
  });

  it('throws NOT_FOUND for missing study config', async () => {
    await expect(getStudyConfig('missing')).rejects.toThrow(SrsError);
  });

  it('deletes a study config', async () => {
    const sc = makeStudyConfig('sc2');
    await putStudyConfig(sc);
    await deleteStudyConfig('sc2');
    await expect(getStudyConfig('sc2')).rejects.toThrow(SrsError);
  });
});
