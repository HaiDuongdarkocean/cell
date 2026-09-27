import { ChromeKeyValueStore } from './chromeKvStore';
import { createKvLocalSources } from './index';

function fakeArea() {
  const map = new Map<string, unknown>();
  return {
    get: jest.fn(async (keys?: string | string[] | null) => {
      if (keys === null || keys === undefined) {
        return Object.fromEntries(map);
      }
      const list = Array.isArray(keys) ? keys : [keys];
      const out: Record<string, unknown> = {};
      for (const key of list) {
        if (map.has(key)) out[key] = map.get(key);
      }
      return out;
    }),
    set: jest.fn(async (items: Record<string, unknown>) => {
      for (const [key, value] of Object.entries(items)) map.set(key, value);
    }),
    remove: jest.fn(async (keys: string | string[]) => {
      for (const key of Array.isArray(keys) ? keys : [keys]) map.delete(key);
    }),
    map,
  };
}

describe('ChromeKeyValueStore', () => {
  const local = fakeArea();
  const session = fakeArea();

  beforeAll(() => {
    global.chrome = {
      storage: { local, session },
    } as unknown as typeof chrome;
  });

  afterAll(() => {
    delete (global as { chrome?: unknown }).chrome;
  });

  beforeEach(() => {
    local.map.clear();
    session.map.clear();
    jest.clearAllMocks();
  });

  it('reads and writes per area', async () => {
    const kv = new ChromeKeyValueStore();
    await kv.set('local', 'a', 1);
    await kv.set('session', 'a', 2);
    expect(await kv.get<number>('local', 'a')).toBe(1);
    expect(await kv.get<number>('session', 'a')).toBe(2);
    expect(local.set).toHaveBeenCalledWith({ a: 1 });
    expect(session.set).toHaveBeenCalledWith({ a: 2 });
  });

  it('deletes and lists keys by prefix', async () => {
    const kv = new ChromeKeyValueStore();
    await kv.set('local', 'syncCursors:x', 1);
    await kv.set('local', 'syncCursors:y', 2);
    await kv.set('local', 'other', 3);
    expect(await kv.list('local', 'syncCursors:')).toEqual(['syncCursors:x', 'syncCursors:y']);
    await kv.del('local', 'syncCursors:x');
    expect(await kv.get('local', 'syncCursors:x')).toBeUndefined();
    expect(local.remove).toHaveBeenCalledWith('syncCursors:x');
  });

  it('resolves undefined for missing keys', async () => {
    const kv = new ChromeKeyValueStore();
    expect(await kv.get('local', 'missing')).toBeUndefined();
  });
});

describe('createKvLocalSources', () => {
  it('creates one source per synced registry key plus the directory source', () => {
    const sources = createKvLocalSources({
      kv: new ChromeKeyValueStore(),
      tick: () => ({ wall: 0, counter: 0, node: 't' }),
    });
    expect(sources).toHaveLength(8);
    const byClass = sources.reduce<Record<string, number>>((acc, s) => {
      acc[s.dataClass] = (acc[s.dataClass] ?? 0) + 1;
      return acc;
    }, {});
    expect(byClass).toEqual({ settings: 1, secondaryKey: 6, syncDirectory: 1 });
  });
});
