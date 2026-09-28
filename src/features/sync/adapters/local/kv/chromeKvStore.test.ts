import { ChromeKeyValueStore } from './chromeKvStore';

const mockStorageState: {
  local: Record<string, unknown>;
  session: Record<string, unknown>;
} = {
  local: {},
  session: {},
};

function installChromeStub(): void {
  const makeArea = (store: Record<string, unknown>) => ({
    get: jest.fn(async (key: string | string[] | null) => {
      if (key === null) return { ...store };
      if (typeof key === 'string')
        return key in store ? { [key]: store[key] } : {};
      return Object.fromEntries(
        key.filter((k) => k in store).map((k) => [k, store[k]]),
      );
    }),
    set: jest.fn(async (items: Record<string, unknown>) => {
      Object.assign(store, items);
    }),
    remove: jest.fn(async (keys: string | string[]) => {
      for (const key of Array.isArray(keys) ? keys : [keys]) delete store[key];
    }),
  });
  (globalThis as { chrome?: unknown }).chrome = {
    storage: {
      local: makeArea(mockStorageState.local),
      session: makeArea(mockStorageState.session),
    },
  };
}

beforeEach(() => {
  mockStorageState.local = {};
  mockStorageState.session = {};
  installChromeStub();
});

afterAll(() => {
  delete (globalThis as { chrome?: unknown }).chrome;
});

describe('createChromeKvStore', () => {
  test('set/get round-trips values in the local area', async () => {
    const store = new ChromeKeyValueStore();
    await store.set('local', 'alpha', { nested: [1, 2] });
    await store.set('local', 'beta', 'x');
    expect(await store.get('local', 'alpha')).toEqual({ nested: [1, 2] });
    expect(await store.get('local', 'missing')).toBeUndefined();
    expect(mockStorageState.local.alpha).toEqual({ nested: [1, 2] });
  });

  test('del removes keys without touching siblings', async () => {
    const store = new ChromeKeyValueStore();
    await store.set('local', 'alpha', 1);
    await store.set('local', 'beta', 2);
    await store.del('local', 'alpha');
    expect(await store.get('local', 'alpha')).toBeUndefined();
    expect(await store.get('local', 'beta')).toBe(2);
  });

  test('list returns sorted keys under the prefix only', async () => {
    const store = new ChromeKeyValueStore();
    mockStorageState.local['syncMetaKV'] = { a: 1 };
    mockStorageState.local['zz/other'] = 1;
    mockStorageState.local['syncMeta/extra'] = 2;
    expect(await store.list('local', 'syncMetaKV')).toEqual(['syncMetaKV']);
    expect(await store.list('local', 'syncMeta')).toEqual(['syncMeta/extra', 'syncMetaKV']);
    expect(await store.list('local', 'nope')).toEqual([]);
  });

  test('session area is isolated from local', async () => {
    const store = new ChromeKeyValueStore();
    await store.set('session', 'token', 'ephemeral');
    expect(await store.get('session', 'token')).toBe('ephemeral');
    expect(await store.get('local', 'token')).toBeUndefined();
    await store.del('session', 'token');
    expect(await store.get('session', 'token')).toBeUndefined();
  });
});
