import 'fake-indexeddb/auto';
import { ensureFirstRun } from './firstRunService';
import { getCollection, getCollectionByLanguageProfileId } from '@/features/srs/repositories/collectionRepository';
import { getDeck } from '@/features/srs/repositories/deckRepository';
import { getNotetype } from '@/features/srs/repositories/notetypeRepository';
import { getStudyConfig } from '@/features/srs/repositories/studyConfigRepository';
import { closeAllSrsDBs, clearAllSrsStores, getSrsDbName, deleteSrsDB } from '@/features/srs/repositories/srsDatabase';
import { loadSettings } from '@/shared/lib/storage/settingsStore';
import { STORAGE_KEYS } from '@/shared/config/config';

const storage: Record<string, unknown> = {};

beforeAll(() => {
  global.chrome = {
    storage: {
      local: {
        get: jest.fn(async (keys: string | string[]) => {
          const key = Array.isArray(keys) ? keys[0] : keys;
          return { [key]: storage[key] };
        }),
        set: jest.fn(async (obj: Record<string, unknown>) => {
          Object.assign(storage, obj);
        }),
      },
    },
  } as unknown as typeof chrome;
});

beforeEach(() => {
  Object.keys(storage).forEach((k) => delete storage[k]);
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

async function seedSettings(languageProfileId: string) {
  const settings = await loadSettings();
  const seeded = {
    ...settings,
    activeProfileId: languageProfileId,
    languageProfiles: [
      {
        id: languageProfileId,
        target: 'en',
        native: '',
        name: 'English',
        order: 1,
        resourceIds: [],
      },
    ],
  };
  storage[STORAGE_KEYS.SETTINGS] = { ...seeded, schemaVersion: 27 };
}

describe('firstRunService', () => {
  it('creates default collection/deck/notetype/study-config on first run', async () => {
    await seedSettings('lp-en');
    const result = await ensureFirstRun();

    expect(result.created).toBe(true);

    const collection = await getCollection(result.collectionId);
    expect(collection.targetLanguage).toBe('en');
    expect(collection.defaultDeckId).toBe(result.deckId);
    expect(collection.defaultNotetypeId).toBe(result.notetypeId);
    expect(collection.defaultStudyConfigId).toBe(result.studyConfigId);

    const deck = await getDeck(result.deckId);
    expect(deck.collectionId).toBe(result.collectionId);

    const notetype = await getNotetype(result.notetypeId);
    expect(notetype.collectionId).toBe(result.collectionId);
    expect(notetype.frontTemplates).toHaveLength(8);

    const studyConfig = await getStudyConfig(result.studyConfigId);
    expect(studyConfig.learningPath.stages).toEqual(['sound', 'meaning', 'spelling']);

    const settings = await loadSettings();
    expect(settings.srs.activeCollectionId).toBe(result.collectionId);
    expect(settings.srs.activeDeckId).toBe(result.deckId);
    expect(settings.srs.activeNotetypeId).toBe(result.notetypeId);
    expect(settings.srs.activeLanguageProfileId).toBe('lp-en');
  });

  it('returns existing collection on second run', async () => {
    await seedSettings('lp-en');
    const first = await ensureFirstRun();
    const second = await ensureFirstRun();

    expect(second.created).toBe(false);
    expect(second.collectionId).toBe(first.collectionId);
    expect(await getCollectionByLanguageProfileId('lp-en')).toBeDefined();
  });
});
