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

  it('getAllResources returns sorted by importedAt desc', async () => {
    await addResource(LANG, makeResource({ name: 'old', importedAt: 1000 }));
    await addResource(LANG, makeResource({ name: 'new', importedAt: 3000 }));
    await addResource(LANG, makeResource({ name: 'mid', importedAt: 2000 }));
    const all = await getAllResources(LANG);
    expect(all.map((r) => r.name)).toEqual(['new', 'mid', 'old']);
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
});
