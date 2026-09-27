import 'fake-indexeddb/auto';
import type { LanguageProfile } from '@/entities/settings';
import { DEFAULT_SETTINGS, STORAGE_KEYS } from '@/shared/config/config';
import { loadSettings } from '@/shared/lib/storage/settingsStore';
import {
  clearAllSrsStores,
  closeAllSrsDBs,
  deleteSrsDB,
  getSrsDbName,
} from '@/features/srs/repositories/srsDatabase';
import {
  getCollection,
  putCollection,
} from '@/features/srs/repositories/collectionRepository';
import { migrateProfileIdentity } from '@/features/sync/app/profileIdentityMigration';
import { createSrsSyncAccess } from '@/features/srs/sync/srsSyncAccess';

const srs = createSrsSyncAccess();
const runMigration = (): Promise<boolean> => migrateProfileIdentity({ srs });

const store = new Map<string, unknown>();

const storageLocalGetMock = jest.fn(
  async (keys: string | string[] | null): Promise<Record<string, unknown>> => {
    if (keys === null) return Object.fromEntries(store);
    const list = typeof keys === 'string' ? [keys] : keys;
    const out: Record<string, unknown> = {};
    for (const key of list) if (store.has(key)) out[key] = store.get(key);
    return out;
  },
);
const storageLocalSetMock = jest.fn(async (items: Record<string, unknown>): Promise<void> => {
  for (const [key, value] of Object.entries(items)) store.set(key, value);
});

const makeProfile = (overrides: Partial<LanguageProfile>): LanguageProfile =>
  ({
    id: 'p1',
    target: 'en',
    native: '',
    name: 'profile',
    order: 1,
    subtitleOverlayTargetStyle: {},
    subtitleOverlayNativeStyle: {},
    subtitleOverlayAutoLoad: true,
    subtitleOverlayAutoLoadAsr: false,
    subtitleOverlayAutoTranslate: true,
    dictionaryPopup: {},
    ...overrides,
  }) as unknown as LanguageProfile;

const makeCollection = (id: string, languageProfileId: string | null) => ({
  id,
  languageProfileId,
  targetLanguage: 'en',
  name: `Collection ${id}`,
  defaultStudyConfigId: `sc-${id}`,
  defaultDeckId: `deck-${id}`,
  defaultNotetypeId: `nt-${id}`,
  createdAt: 1,
});

async function seedSettings(overrides: Record<string, unknown>): Promise<void> {
  store.set(STORAGE_KEYS.SETTINGS, {
    ...DEFAULT_SETTINGS,
    schemaVersion: 32,
    ...overrides,
  });
}

beforeAll(() => {
  global.chrome = {
    storage: {
      local: {
        get: storageLocalGetMock as unknown as typeof chrome.storage.local.get,
        set: storageLocalSetMock as unknown as typeof chrome.storage.local.set,
      },
    },
  } as unknown as typeof chrome;
});

beforeEach(async () => {
  store.clear();
  storageLocalGetMock.mockClear();
  storageLocalSetMock.mockClear();
  closeAllSrsDBs();
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

describe('migrateProfileIdentity', () => {
  it('merges duplicate-target profiles into the lowest (order, id) survivor', async () => {
    await seedSettings({
      languageProfiles: [
        makeProfile({ id: 'p-b', target: 'en', name: 'en second', order: 2, native: 'ja' }),
        makeProfile({ id: 'p-a', target: 'en', name: 'en first', order: 1, native: 'vi' }),
        makeProfile({ id: 'p-j', target: 'ja', name: 'ja', order: 3 }),
      ],
      activeProfileId: 'p-b',
      srs: { ...DEFAULT_SETTINGS.srs, activeLanguageProfileId: 'p-b' },
    });
    await putCollection(makeCollection('c1', 'p-b'));
    await putCollection(makeCollection('c2', 'p-a'));
    await putCollection(makeCollection('c3', 'p-j'));

    expect(await runMigration()).toBe(true);

    const settings = await loadSettings();
    expect(settings.languageProfiles.map((p) => p.id).sort()).toEqual([
      'profile-en',
      'profile-ja',
    ]);
    const en = settings.languageProfiles.find((p) => p.id === 'profile-en')!;
    expect(en.name).toBe('en first');
    expect(en.native).toBe('vi');
    expect(settings.activeProfileId).toBe('profile-en');
    expect(settings.srs.activeLanguageProfileId).toBe('profile-en');
    expect(settings.syncMigrations?.profileIdentity).toBe('done');
    expect(settings.languageProfiles.map((p) => p.order)).toEqual([1, 2]);

    expect((await getCollection('c1')).languageProfileId).toBe('profile-en');
    expect((await getCollection('c2')).languageProfileId).toBe('profile-en');
    expect((await getCollection('c3')).languageProfileId).toBe('profile-ja');
  });

  it('renames non-duplicate profiles and keeps collections of unknown profiles', async () => {
    await seedSettings({
      languageProfiles: [makeProfile({ id: 'abc', target: 'fr', order: 1 })],
      activeProfileId: null,
    });
    await putCollection(makeCollection('c1', 'abc'));
    await putCollection(makeCollection('c2', 'profile-de'));

    await runMigration();

    const settings = await loadSettings();
    expect(settings.languageProfiles.map((p) => p.id)).toEqual(['profile-fr']);
    expect((await getCollection('c1')).languageProfileId).toBe('profile-fr');
    expect((await getCollection('c2')).languageProfileId).toBe('profile-de');
  });

  it('is idempotent — a second run changes nothing', async () => {
    await seedSettings({
      languageProfiles: [
        makeProfile({ id: 'x1', target: 'en', order: 2 }),
        makeProfile({ id: 'x0', target: 'en', order: 1 }),
      ],
      activeProfileId: 'x1',
    });
    await putCollection(makeCollection('c1', 'x0'));

    await runMigration();
    const first = await loadSettings();
    expect(await runMigration()).toBe(false);
    const second = await loadSettings();
    expect(second.languageProfiles).toEqual(first.languageProfiles);
    expect((await getCollection('c1')).languageProfileId).toBe('profile-en');
  });

  it('is a no-op when the flag is already done', async () => {
    await seedSettings({
      languageProfiles: [makeProfile({ id: 'weird', target: 'en' })],
      syncMigrations: { profileIdentity: 'done' },
    });
    expect(await runMigration()).toBe(false);
    const settings = await loadSettings();
    expect(settings.languageProfiles[0]!.id).toBe('weird');
  });
});
