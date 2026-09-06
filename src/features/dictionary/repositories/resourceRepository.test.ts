import 'fake-indexeddb/auto';
import {
  addResource,
  getResource,
  getAllResources,
  updateResource,
  deleteResource,
  findResourceBySignature,
  countResources,
  deleteAllResources,
  reorderResources,
  setResourceEnabled,
  setResourceProfiles,
} from '@/features/dictionary/repositories/resourceRepository';
import { closeAllDBs, clearAllStores } from '@/features/dictionary/repositories/baseRepository';
import type { ResourceInfo } from '@/entities/dictionary';

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
  closeAllDBs();
});

beforeEach(async () => {
  await clearAllStores(LANG);
});

afterEach(() => {
  closeAllDBs();
});

afterAll(() => {
  delete (global as { chrome?: unknown }).chrome;
});

const LANG = 'en';

function makeResource(overrides: Partial<Omit<ResourceInfo, 'id'>> = {}): Omit<ResourceInfo, 'id'> {
  return {
    name: 'test.txt',
    langCode: LANG,
    type: 'FREQUENCY',
    format: 'txt',
    signature: 'sig-1',
    wordCount: 100,
    installationFinished: true,
    importedAt: Date.now(),
    ...overrides,
  };
}

describe('resourceRepository', () => {
  it('addResource returns auto-generated id', async () => {
    const id = await addResource(LANG, makeResource());
    expect(typeof id).toBe('number');
    expect(id).toBeGreaterThan(0);
  });

  it('getResource retrieves by id', async () => {
    const id = await addResource(LANG, makeResource({ name: 'dict.json' }));
    const resource = await getResource(LANG, id);
    expect(resource?.name).toBe('dict.json');
    expect(resource?.id).toBe(id);
  });

  it('getResource returns undefined for missing id', async () => {
    const resource = await getResource(LANG, 9999);
    expect(resource).toBeUndefined();
  });

  it('getAllResources returns sorted by priority asc, then resourceId desc', async () => {
    await addResource(LANG, makeResource({ name: 'mid-pri', priority: 1, importedAt: 1000 }));
    await addResource(LANG, makeResource({ name: 'high-pri', priority: 0, importedAt: 500 }));
    await addResource(LANG, makeResource({ name: 'no-pri', importedAt: 2000 }));
    const all = await getAllResources(LANG);
    expect(all.map((r) => r.name)).toEqual(['high-pri', 'mid-pri', 'no-pri']);
  });

  it('updateResource replaces by id', async () => {
    const id = await addResource(LANG, makeResource({ wordCount: 100 }));
    const existing = await getResource(LANG, id);
    await updateResource(LANG, { ...existing!, wordCount: 200, installationFinished: true });
    const updated = await getResource(LANG, id);
    expect(updated?.wordCount).toBe(200);
  });

  it('deleteResource removes by id', async () => {
    const id = await addResource(LANG, makeResource());
    await deleteResource(LANG, id);
    const resource = await getResource(LANG, id);
    expect(resource).toBeUndefined();
  });

  it('findResourceBySignature returns matching resource', async () => {
    await addResource(LANG, makeResource({ signature: 'unique-sig-1' }));
    const found = await findResourceBySignature(LANG, 'unique-sig-1');
    expect(found?.signature).toBe('unique-sig-1');
  });

  it('findResourceBySignature returns undefined when not found', async () => {
    const found = await findResourceBySignature(LANG, 'nonexistent');
    expect(found).toBeUndefined();
  });

  it('countResources returns total count', async () => {
    await addResource(LANG, makeResource({ signature: 's1' }));
    await addResource(LANG, makeResource({ signature: 's2' }));
    await expect(countResources(LANG)).resolves.toBe(2);
  });

  it('deleteAllResources clears all', async () => {
    await addResource(LANG, makeResource({ signature: 's1' }));
    await addResource(LANG, makeResource({ signature: 's2' }));
    await deleteAllResources(LANG);
    await expect(countResources(LANG)).resolves.toBe(0);
  });

  it('reorderResources writes priority 0..n onto existing resources of the given type', async () => {
    const idA = await addResource(LANG, makeResource({ type: 'FREQUENCY', name: 'a' }));
    const idB = await addResource(LANG, makeResource({ type: 'FREQUENCY', name: 'b' }));
    const idDict = await addResource(LANG, makeResource({ type: 'DICTIONARY', name: 'dict' }));

    await reorderResources(LANG, 'FREQUENCY', [idB, idA, 9999]);

    const a = await getResource(LANG, idA);
    const b = await getResource(LANG, idB);
    const dict = await getResource(LANG, idDict);
    expect(a?.priority).toBe(1);
    expect(b?.priority).toBe(0);
    expect(dict?.priority).toBeUndefined();
  });

  it('setResourceEnabled updates the enabled flag', async () => {
    const id = await addResource(LANG, makeResource());
    await setResourceEnabled(LANG, id, false);
    const resource = await getResource(LANG, id);
    expect(resource?.enabled).toBe(false);

    await setResourceEnabled(LANG, id, true);
    const updated = await getResource(LANG, id);
    expect(updated?.enabled).toBe(true);
  });

  it('setResourceEnabled throws for a missing resource', async () => {
    await expect(setResourceEnabled(LANG, 9999, false)).rejects.toThrow('Không tìm thấy resource id 9999');
  });

  it('setResourceProfiles updates the profileIds', async () => {
    const id = await addResource(LANG, makeResource());
    await setResourceProfiles(LANG, id, ['profile-a', 'profile-b']);
    const resource = await getResource(LANG, id);
    expect(resource?.profileIds).toEqual(['profile-a', 'profile-b']);
  });

  it('setResourceProfiles throws for a missing resource', async () => {
    await expect(setResourceProfiles(LANG, 9999, ['x'])).rejects.toThrow('Không tìm thấy resource id 9999');
  });
});
