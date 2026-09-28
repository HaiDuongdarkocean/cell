import { STORAGE_KEYS } from '@/shared/config/config';
import { diffFlattened } from '../../../domain/flatten';
import type {
  ChangeRecord,
  DataClass,
  Hlc,
  PendingKey,
  RecordKey,
  Scope,
} from '../../../domain/types';
import type { KeyValueStore } from '../../../ports/keyValueStore';
import {
  SYNC_CONFLICT_LOG_STORAGE_KEY,
  SYNC_DIRECTORY_STORAGE_KEY,
} from './keys';
import { kvMetaKey, readSyncMetaKV } from './kvMeta';
import { createKvLocalSource } from './kvLocalSource';
import type { KvLocalSourceDeps } from './kvLocalSource';
import { kvValueHash } from './valueHash';

const mockStorageState: {
  local: Record<string, unknown>;
  session: Record<string, unknown>;
} = {
  local: {},
  session: {},
};

jest.mock('@/shared/lib/storage/settingsStore', () => ({
  persistSyncedSettings: jest.fn(async (value: Record<string, unknown>) => {
    mockStorageState.local[STORAGE_KEYS.SETTINGS] = value;
  }),
}));

import { persistSyncedSettings } from '@/shared/lib/storage/settingsStore';

function createMemoryKv(): KeyValueStore {
  return {
    get: jest.fn(async (area: 'local' | 'session', key: string) => {
      const store = area === 'local' ? mockStorageState.local : mockStorageState.session;
      return store[key];
    }) as KeyValueStore['get'],
    set: jest.fn(async (area: 'local' | 'session', key: string, value: unknown) => {
      const store = area === 'local' ? mockStorageState.local : mockStorageState.session;
      store[key] = value;
    }),
    del: jest.fn(async (area: 'local' | 'session', key: string) => {
      const store = area === 'local' ? mockStorageState.local : mockStorageState.session;
      delete store[key];
    }),
    list: jest.fn(async (area: 'local' | 'session', prefix: string) => {
      const store = area === 'local' ? mockStorageState.local : mockStorageState.session;
      return Object.keys(store)
        .filter((key) => key.startsWith(prefix))
        .sort();
    }),
  };
}

const CLOCK_BASE = 1_700_000_000_000;

interface TestClock {
  readonly counter: number;
  tick(): Hlc;
}

function createClock(): TestClock {
  const state = { counter: 0 };
  return {
    get counter() {
      return state.counter;
    },
    tick(): Hlc {
      state.counter += 1;
      return { wall: CLOCK_BASE + state.counter, counter: state.counter, node: 'test-device' };
    },
  };
}

const REMOTE_T = 2_000_000_000_000;

function remoteHlc(offset: number, node = 'remote-device'): Hlc {
  return { wall: REMOTE_T + offset, counter: offset, node };
}

function remoteRecord(
  scope: Scope,
  dataClass: DataClass,
  key: RecordKey,
  op: 'put' | 'delete',
  value: unknown,
  hlc: Hlc,
): ChangeRecord {
  return { scope, dataClass, key, op, value, hlc, firstHlc: hlc };
}

function sourceOf(
  dataClass: 'settings' | 'profileConfig' | 'secondaryKey' | 'syncDirectory',
  kv: KeyValueStore,
  clock: TestClock,
) {
  const deps: KvLocalSourceDeps = { kv, tick: () => clock.tick(), now: () => 111 };
  return createKvLocalSource(dataClass, deps);
}

async function drainPending(
  source: ReturnType<typeof sourceOf>,
  limit = 200,
): Promise<PendingKey[]> {
  const pending = await source.pending(limit);
  await source.resolve(pending);
  await source.ack(pending);
  return pending;
}

beforeEach(() => {
  mockStorageState.local = {};
  mockStorageState.session = {};
  jest.clearAllMocks();
});

describe('capture: flatten + diff → records', () => {
  test('new settings values emit put records under global scope', async () => {
    const kv = createMemoryKv();
    const clock = createClock();
    mockStorageState.local[STORAGE_KEYS.SETTINGS] = {
      uiLanguage: 'en',
      subtitleOffset: 120,
    };
    const source = sourceOf('settings', kv, clock);

    const pending = await source.pending(100);
    const keys = pending.map((p) => p.key).sort();
    expect(keys).toEqual(['kv:settings/subtitleOffset', 'kv:settings/uiLanguage']);
    expect(pending.every((p) => p.scope === 'global' && p.op === 'put')).toBe(true);

    const records = await source.resolve(pending);
    expect(records).toHaveLength(2);
    const lang = records.find((r) => r.key === 'kv:settings/uiLanguage');
    expect(lang?.op).toBe('put');
    expect(lang?.value).toBe('en');
    expect(lang?.dataClass).toBe('settings');
    expect(lang?.hlc.node).toBe('test-device');
    expect(lang?.firstHlc).toEqual(lang?.hlc);
  });

  test('unlisted fields never emit pending records', async () => {
    const kv = createMemoryKv();
    const clock = createClock();
    mockStorageState.local[STORAGE_KEYS.SETTINGS] = {
      uiLanguage: 'en',
      schemaVersion: 4,
      activeProfileId: 'p1',
      languageProfiles: [{ id: 'p1', target: 'ja' }],
      subtitleOverlayTargetLanguage: 'en',
      subtitleOverlayNativeLanguage: 'en',
      subtitleOverlayTargetStyle: { fontSize: 20 },
      dictionaryPopup: { enabled: true },
      srs: { activeDeckId: 'd1', activeCollectionId: 'c1', userNote: 'keep' },
      localPlayerSettings: { lastDirectoryId: 'dir-9', volume: 5 },
      pronunciation: { downloadEspeakTtsData: true, rate: 1 },
      someDeviceOnlyFlag: true,
    };
    const source = sourceOf('settings', kv, clock);
    const pending = await source.pending(200);
    const keys = pending.map((p) => p.key);
    expect(keys).toContain('kv:settings/uiLanguage');
    expect(keys).toContain('kv:settings/srs/userNote');
    expect(keys).toContain('kv:settings/localPlayerSettings/volume');
    expect(keys).toContain('kv:settings/pronunciation/rate');
    expect(keys.some((k) => k.includes('schemaVersion'))).toBe(false);
    expect(keys.some((k) => k.includes('activeProfileId'))).toBe(false);
    expect(keys.some((k) => k.includes('languageProfiles'))).toBe(false);
    expect(keys.some((k) => k.includes('subtitleOverlayTargetLanguage'))).toBe(false);
    expect(keys.some((k) => k.includes('dictionaryPopup'))).toBe(false);
    expect(keys.some((k) => k.includes('srs/activeDeckId'))).toBe(false);
    expect(keys.some((k) => k.includes('localPlayerSettings/lastDirectoryId'))).toBe(false);
    expect(keys.some((k) => k.includes('downloadEspeakTtsData'))).toBe(false);
    expect(keys.some((k) => k.includes('someDeviceOnlyFlag'))).toBe(false);
  });

  test('element-array leaves strip device-local fields', async () => {
    const kv = createMemoryKv();
    const clock = createClock();
    mockStorageState.local[STORAGE_KEYS.SETTINGS] = {
      subtitleApiKeys: [{ id: 'k1', key: 'secret', status: 'rate-limited', rateLimitedUntil: 5 }],
    };
    const source = sourceOf('settings', kv, clock);
    const pending = await source.pending(50);
    expect(pending.map((p) => p.key)).toEqual(['kv:settings/subtitleApiKeys/@k1']);
    const records = await source.resolve(pending);
    const leaf = records[0].value as Record<string, unknown>;
    expect(leaf.id).toBe('k1');
    expect(leaf.key).toBe('secret');
    expect(leaf.status).toBeUndefined();
    expect(leaf.rateLimitedUntil).toBeUndefined();
  });

  test('acks stamp syncMetaKV and clear pending', async () => {
    const kv = createMemoryKv();
    const clock = createClock();
    mockStorageState.local[STORAGE_KEYS.SETTINGS] = { uiLanguage: 'en' };
    const source = sourceOf('settings', kv, clock);

    const pending = await source.pending(10);
    const records = await source.resolve(pending);
    await source.ack(pending);

    const meta = await readSyncMetaKV(kv);
    expect(meta[kvMetaKey('global', 'kv:settings/uiLanguage')]).toMatchObject({
      op: 'put',
      hlc: records[0].hlc,
      valueHash: await kvValueHash('en'),
    });
    expect(await source.pending(10)).toEqual([]);
  });

  test('unchanged-value writes do not re-emit after ack', async () => {
    const kv = createMemoryKv();
    const clock = createClock();
    mockStorageState.local[STORAGE_KEYS.SETTINGS] = { uiLanguage: 'en' };
    const source = sourceOf('settings', kv, clock);
    await drainPending(source);

    mockStorageState.local[STORAGE_KEYS.SETTINGS] = {
      ...(mockStorageState.local[STORAGE_KEYS.SETTINGS] as Record<string, unknown>),
      uiLanguage: 'en',
    };
    expect(await source.pending(10)).toEqual([]);
  });

  test('diffFlattened detects puts and tombstones', () => {
    const prev = [
      { path: 'a', value: 1 },
      { path: 'b', value: 2 },
    ];
    const next = [{ path: 'a', value: 3 }];
    const diff = diffFlattened(prev, next);
    expect(diff.puts).toEqual([{ path: 'a', value: 3 }]);
    expect(diff.tombstones).toEqual(['b']);
  });
});

describe('capture: tombstones', () => {
  test('removing a leaf emits a delete record', async () => {
    const kv = createMemoryKv();
    const clock = createClock();
    mockStorageState.local[STORAGE_KEYS.SETTINGS] = {
      uiLanguage: 'en',
      subtitleOffset: 120,
    };
    const source = sourceOf('settings', kv, clock);
    await drainPending(source);

    mockStorageState.local[STORAGE_KEYS.SETTINGS] = { uiLanguage: 'en' };
    const pending = await source.pending(10);
    expect(pending).toEqual([
      {
        scope: 'global',
        dataClass: 'settings',
        key: 'kv:settings/subtitleOffset',
        op: 'delete',
      },
    ]);
    const records = await source.resolve(pending);
    expect(records[0].op).toBe('delete');
    expect(records[0].firstHlc).toBeDefined();
    await source.ack(pending);
    const meta = await readSyncMetaKV(kv);
    expect(meta[kvMetaKey('global', 'kv:settings/subtitleOffset')]?.op).toBe('delete');
    expect(
      meta[kvMetaKey('global', 'kv:settings/subtitleOffset')]?.firstHlc,
    ).toBeDefined();
  });

  test('tombstones persist in meta indefinitely and re-emit via snapshot', async () => {
    const kv = createMemoryKv();
    const clock = createClock();
    mockStorageState.local[STORAGE_KEYS.SETTINGS] = {
      uiLanguage: 'en',
      subtitleOffset: 120,
    };
    const source = sourceOf('settings', kv, clock);
    await drainPending(source);
    mockStorageState.local[STORAGE_KEYS.SETTINGS] = { uiLanguage: 'en' };
    await drainPending(source);

    const snapshot: ChangeRecord[] = [];
    for await (const record of source.snapshot('global')) snapshot.push(record);
    const tombstone = snapshot.find((r) => r.key === 'kv:settings/subtitleOffset');
    expect(tombstone?.op).toBe('delete');
    const live = snapshot.find((r) => r.key === 'kv:settings/uiLanguage');
    expect(live?.op).toBe('put');
    expect(live?.hlc.wall).toBe(CLOCK_BASE + 2);
  });
});

describe('secondaryKey', () => {
  test('emits records for whitelisted secondary keys with proper record keys', async () => {
    const kv = createMemoryKv();
    const clock = createClock();
    mockStorageState.local.themeMode = 'dark';
    mockStorageState.local.tokenizeSettings = { whitespace: 'visible' };
    const source = sourceOf('secondaryKey', kv, clock);
    const pending = await source.pending(50);
    const keys = pending.map((p) => p.key);
    expect(keys).toContain('kv:themeMode');
    expect(keys).toContain('kv:tokenizeSettings/whitespace');
  });

  test('element-array strip fields (tabId) leave scope but stay out of record value', async () => {
    const kv = createMemoryKv();
    const clock = createClock();
    mockStorageState.local.auto_download_whitelist = [
      { url: 'https://a.example', enabled: true, tabId: 42 },
    ];
    const source = sourceOf('secondaryKey', kv, clock);
    const pending = await source.pending(50);
    expect(pending.map((p) => p.key)).toEqual([
      'kv:auto_download_whitelist/@https:~1~1a.example',
    ]);
    const records = await source.resolve(pending);
    const leaf = records[0].value as Record<string, unknown>;
    expect(leaf.url).toBe('https://a.example');
    expect(leaf.enabled).toBe(true);
    expect(leaf.tabId).toBeUndefined();
  });

  test('non-whitelisted storage keys emit nothing', async () => {
    const kv = createMemoryKv();
    const clock = createClock();
    mockStorageState.local.mySecretDeviceFlag = true;
    const source = sourceOf('secondaryKey', kv, clock);
    expect(await source.pending(50)).toEqual([]);
  });
});

describe('syncDirectory', () => {
  test('emits only directory record keys and ignores non-directory entries', async () => {
    const kv = createMemoryKv();
    const clock = createClock();
    mockStorageState.local[SYNC_DIRECTORY_STORAGE_KEY] = {
      systemConnection: { providerId: 'gdrive', accountKey: 'me' },
      'connection:gdrive:me': { cursor: 'abc' },
      'binding:global/kv:settings/uiLanguage': 'file-id-1',
      scratch: 'not-a-record-key',
      'progress-bar-settings': { recentVideos: [] },
    };
    const source = sourceOf('syncDirectory', kv, clock);
    const pending = await source.pending(50);
    const keys = pending.map((p) => p.key).sort();
    expect(keys).toEqual([
      'binding:global/kv:settings/uiLanguage',
      'connection:gdrive:me',
      'systemConnection',
    ]);
    const records = await source.resolve(pending);
    expect(
      records.find((r) => r.key === 'binding:global/kv:settings/uiLanguage')?.value,
    ).toBe('file-id-1');
    expect(records.every((r) => r.dataClass === 'syncDirectory')).toBe(true);
  });
});

describe('profileConfig', () => {
  test('emits profile existence + field records under profile scope', async () => {
    const kv = createMemoryKv();
    const clock = createClock();
    mockStorageState.local[STORAGE_KEYS.SETTINGS] = {
      languageProfiles: [
        { id: 'p1', target: 'ja-JP', native: 'en', order: 0, ttsVoiceId: 'v1' },
      ],
    };
    const source = sourceOf('profileConfig', kv, clock);
    const pending = await source.pending(50);
    const byKey = new Map(pending.map((p) => [p.key, p]));
    expect(byKey.get('profile')?.scope).toBe('profile:ja');
    expect(byKey.get('profile/native')?.scope).toBe('profile:ja');
    expect(byKey.get('profile/order')?.scope).toBe('profile:ja');
    expect(byKey.get('profile/ttsVoiceId')?.scope).toBe('profile:ja');

    const records = await source.resolve(pending);
    const existence = records.find((r) => r.key === 'profile');
    expect(existence?.value).toBe('p1');
    expect(existence?.scope).toBe('profile:ja');
    const field = records.find((r) => r.key === 'profile/ttsVoiceId');
    expect(field?.value).toBe('v1');
    expect(field?.dataClass).toBe('profileConfig');
  });

  test('per-scope meta keys do not collide between profiles', async () => {
    const kv = createMemoryKv();
    const clock = createClock();
    mockStorageState.local[STORAGE_KEYS.SETTINGS] = {
      languageProfiles: [
        { id: 'p1', target: 'ja', native: 'en', order: 0 },
        { id: 'p2', target: 'ko', native: 'en', order: 1 },
      ],
    };
    const source = sourceOf('profileConfig', kv, clock);
    const pending = await source.pending(50);
    const records = await source.resolve(pending);
    await source.ack(pending);
    const meta = await readSyncMetaKV(kv);
    expect(meta[kvMetaKey('profile:ja', 'profile')]?.op).toBe('put');
    expect(meta[kvMetaKey('profile:ko', 'profile')]?.op).toBe('put');
    expect(meta[kvMetaKey('profile:ja', 'profile/native')]?.valueHash).toBeDefined();
    expect(
      records
        .filter((r) => r.key === 'profile')
        .map((r) => r.scope)
        .sort(),
    ).toEqual(['profile:ja', 'profile:ko']);
  });

  test('deleting a profile emits existence tombstone plus field tombstones', async () => {
    const kv = createMemoryKv();
    const clock = createClock();
    mockStorageState.local[STORAGE_KEYS.SETTINGS] = {
      languageProfiles: [{ id: 'p1', target: 'ja', native: 'en', order: 0 }],
    };
    const source = sourceOf('profileConfig', kv, clock);
    await drainPending(source);

    mockStorageState.local[STORAGE_KEYS.SETTINGS] = { languageProfiles: [] };
    const pending = await source.pending(50);
    const ops = new Map(pending.map((p) => [p.key, p.op]));
    expect(ops.get('profile')).toBe('delete');
    expect(ops.get('profile/native')).toBe('delete');
    expect(ops.get('profile/target')).toBe('delete');
    expect(pending.every((p) => p.scope === 'profile:ja')).toBe(true);
  });

  test('device-local profile fields never emit', async () => {
    const kv = createMemoryKv();
    const clock = createClock();
    mockStorageState.local[STORAGE_KEYS.SETTINGS] = {
      languageProfiles: [
        {
          id: 'p1',
          target: 'ja',
          native: 'en',
          order: 0,
          tts: { voiceId: 'v', savedVoices: ['x'], downloadedLanguages: ['ja'] },
        },
      ],
    };
    const source = sourceOf('profileConfig', kv, clock);
    const pending = await source.pending(50);
    const keys = pending.map((p) => p.key);
    expect(keys).toContain('profile/tts/voiceId');
    expect(keys).not.toContain('profile/tts/savedVoices');
    expect(keys).not.toContain('profile/tts/downloadedLanguages');
  });
});

describe('applyRemote', () => {
  test('remote put writes via persistSyncedSettings and suppresses echo', async () => {
    const kv = createMemoryKv();
    const clock = createClock();
    mockStorageState.local[STORAGE_KEYS.SETTINGS] = {
      uiLanguage: 'vi',
      subtitleOffset: 120,
    };
    const source = sourceOf('settings', kv, clock);
    await drainPending(source);

    const remote = remoteRecord(
      'global',
      'settings',
      'kv:settings/uiLanguage',
      'put',
      'en',
      remoteHlc(10),
    );
    const result = await source.applyRemote([remote]);
    expect(result.applied.map((r) => r.key)).toEqual(['kv:settings/uiLanguage']);
    expect(result.localWon).toEqual([]);
    expect(persistSyncedSettings).toHaveBeenCalledWith(
      expect.objectContaining({ uiLanguage: 'en', subtitleOffset: 120 }),
    );
    expect(await source.pending(10)).toEqual([]);
    const meta = await readSyncMetaKV(kv);
    expect(meta[kvMetaKey('global', 'kv:settings/uiLanguage')]?.hlc).toEqual(remote.hlc);
  });

  test('remote delete removes the leaf and writes tombstone meta', async () => {
    const kv = createMemoryKv();
    const clock = createClock();
    mockStorageState.local[STORAGE_KEYS.SETTINGS] = {
      uiLanguage: 'en',
      subtitleOffset: 120,
    };
    const source = sourceOf('settings', kv, clock);
    await drainPending(source);

    const tomb = remoteRecord(
      'global',
      'settings',
      'kv:settings/subtitleOffset',
      'delete',
      undefined,
      remoteHlc(10),
    );
    const result = await source.applyRemote([tomb]);
    expect(result.applied).toHaveLength(1);
    const lastWrite = (persistSyncedSettings as jest.Mock).mock.calls.at(-1)?.[0] as
      Record<string, unknown>;
    expect(Object.prototype.hasOwnProperty.call(lastWrite, 'subtitleOffset')).toBe(false);
    expect(lastWrite.uiLanguage).toBe('en');
    const meta = await readSyncMetaKV(kv);
    expect(meta[kvMetaKey('global', 'kv:settings/subtitleOffset')]?.op).toBe('delete');
    expect(meta[kvMetaKey('global', 'kv:settings/subtitleOffset')]?.firstHlc).toBeDefined();
    expect(await source.pending(10)).toEqual([]);
  });

  test('older remote put loses to newer local drift (localWon + conflict log)', async () => {
    const kv = createMemoryKv();
    const clock = createClock();
    mockStorageState.local[STORAGE_KEYS.SETTINGS] = { uiLanguage: 'en' };
    const source = sourceOf('settings', kv, clock);
    await source.resolve(await source.pending(10));

    const older = remoteRecord(
      'global',
      'settings',
      'kv:settings/uiLanguage',
      'put',
      'stale',
      { wall: CLOCK_BASE - 1, counter: 0, node: 'remote' },
    );
    const result = await source.applyRemote([older]);
    expect(result.localWon).toHaveLength(1);
    expect(result.applied).toEqual([]);
    const log = mockStorageState.local[SYNC_CONFLICT_LOG_STORAGE_KEY] as Array<{
      winner: string;
    }>;
    expect(log[0]?.winner).toBe('local');
    expect(await source.pending(10)).toHaveLength(1);
  });

  test('suppressed parent tombstone keeps child puts opaque', async () => {
    const kv = createMemoryKv();
    const clock = createClock();
    mockStorageState.local[STORAGE_KEYS.SETTINGS] = {};
    const source = sourceOf('settings', kv, clock);

    const parentTomb = remoteRecord(
      'global',
      'settings',
      'kv:settings/subtitleApiKeys',
      'delete',
      undefined,
      remoteHlc(20),
    );
    const childPut = remoteRecord(
      'global',
      'settings',
      'kv:settings/subtitleApiKeys/@k1',
      'put',
      { id: 'k1', key: 'x' },
      remoteHlc(10),
    );
    const result = await source.applyRemote([parentTomb, childPut]);
    expect(result.applied.map((r) => r.key)).toEqual(['kv:settings/subtitleApiKeys']);
    expect(result.opaque.map((r) => r.key)).toEqual(['kv:settings/subtitleApiKeys/@k1']);
    const meta = await readSyncMetaKV(kv);
    expect(meta[kvMetaKey('global', 'kv:settings/subtitleApiKeys/@k1')]?.suppressed).toBe(
      true,
    );
    expect(await source.pending(10)).toEqual([]);
  });

  test('profile field put materializes only when existence is live', async () => {
    const kv = createMemoryKv();
    const clock = createClock();
    mockStorageState.local[STORAGE_KEYS.SETTINGS] = { languageProfiles: [] };
    const source = sourceOf('profileConfig', kv, clock);

    const existence = remoteRecord(
      'profile:ja',
      'profileConfig',
      'profile',
      'put',
      'p-remote',
      remoteHlc(100),
    );
    const field = remoteRecord(
      'profile:ja',
      'profileConfig',
      'profile/native',
      'put',
      'en',
      remoteHlc(101),
    );
    const result = await source.applyRemote([existence, field]);
    expect(result.opaque).toEqual([]);
    const write = (persistSyncedSettings as jest.Mock).mock.calls.at(-1)?.[0] as {
      languageProfiles: Array<Record<string, unknown>>;
    };
    expect(write.languageProfiles).toHaveLength(1);
    expect(write.languageProfiles[0].id).toBe('p-remote');
    expect(write.languageProfiles[0].native).toBe('en');
    expect(write.languageProfiles[0].target).toBe('ja');
  });

  test('profile field put without existence stays opaque', async () => {
    const kv = createMemoryKv();
    const clock = createClock();
    mockStorageState.local[STORAGE_KEYS.SETTINGS] = { languageProfiles: [] };
    const source = sourceOf('profileConfig', kv, clock);

    const field = remoteRecord(
      'profile:ja',
      'profileConfig',
      'profile/native',
      'put',
      'en',
      remoteHlc(101),
    );
    const result = await source.applyRemote([field]);
    expect(result.opaque.map((r) => r.key)).toEqual(['profile/native']);
    const meta = await readSyncMetaKV(kv);
    expect(meta[kvMetaKey('profile:ja', 'profile/native')]?.suppressed).toBe(true);
    expect(await source.pending(50)).toEqual([]);
  });

  test('profile existence tombstone removes the element, preserving other profiles', async () => {
    const kv = createMemoryKv();
    const clock = createClock();
    mockStorageState.local[STORAGE_KEYS.SETTINGS] = {
      languageProfiles: [
        { id: 'p1', target: 'ja', native: 'en', order: 0 },
        { id: 'p2', target: 'ko', native: 'en', order: 1 },
      ],
    };
    const source = sourceOf('profileConfig', kv, clock);
    await drainPending(source);

    const tomb = remoteRecord(
      'profile:ja',
      'profileConfig',
      'profile',
      'delete',
      undefined,
      remoteHlc(10),
    );
    const result = await source.applyRemote([tomb]);
    expect(result.applied).toHaveLength(1);
    const write = (persistSyncedSettings as jest.Mock).mock.calls.at(-1)?.[0] as {
      languageProfiles: Array<Record<string, unknown>>;
    };
    expect(write.languageProfiles.map((p) => p.target)).toEqual(['ko']);
    expect(await source.pending(50)).toEqual([]);
  });

  test('local-only profile fields are preserved across remote apply', async () => {
    const kv = createMemoryKv();
    const clock = createClock();
    mockStorageState.local[STORAGE_KEYS.SETTINGS] = {
      languageProfiles: [
        {
          id: 'p1',
          target: 'ja',
          native: 'en',
          order: 0,
          tts: { voiceId: 'v', savedVoices: ['x1'] },
        },
      ],
    };
    const source = sourceOf('profileConfig', kv, clock);
    await drainPending(source);

    const remote = remoteRecord(
      'profile:ja',
      'profileConfig',
      'profile/native',
      'put',
      'de',
      remoteHlc(10),
    );
    await source.applyRemote([remote]);
    const write = (persistSyncedSettings as jest.Mock).mock.calls.at(-1)?.[0] as {
      languageProfiles: Array<Record<string, unknown>>;
    };
    expect(write.languageProfiles[0].tts).toMatchObject({
      voiceId: 'v',
      savedVoices: ['x1'],
    });
    expect(write.languageProfiles[0].native).toBe('de');
  });

  test('secondaryKey remote apply writes whole object preserving device-local fields', async () => {
    const kv = createMemoryKv();
    const clock = createClock();
    mockStorageState.local.auto_download_whitelist = [
      { url: 'https://a.example', enabled: true, tabId: 42 },
      { url: 'https://b.example', enabled: false, tabId: 7 },
    ];
    const source = sourceOf('secondaryKey', kv, clock);
    await drainPending(source);

    const remote = remoteRecord(
      'global',
      'secondaryKey',
      'kv:auto_download_whitelist/@https:~1~1a.example',
      'put',
      { url: 'https://a.example', enabled: false },
      remoteHlc(10),
    );
    const result = await source.applyRemote([remote]);
    expect(result.applied).toHaveLength(1);
    const list = mockStorageState.local.auto_download_whitelist as Array<
      Record<string, unknown>
    >;
    const a = list.find((e) => e.url === 'https://a.example');
    const b = list.find((e) => e.url === 'https://b.example');
    expect(a?.enabled).toBe(false);
    expect(a?.tabId).toBe(42);
    expect(b?.tabId).toBe(7);
    expect(await source.pending(50)).toEqual([]);
  });

  test('snapshot uses committed remote hlc for applied records', async () => {
    const kv = createMemoryKv();
    const clock = createClock();
    mockStorageState.local[STORAGE_KEYS.SETTINGS] = {};
    const source = sourceOf('settings', kv, clock);
    const remote = remoteRecord(
      'global',
      'settings',
      'kv:settings/uiLanguage',
      'put',
      'vi',
      remoteHlc(42),
    );
    await source.applyRemote([remote]);
    const snapshot: ChangeRecord[] = [];
    for await (const record of source.snapshot('global')) snapshot.push(record);
    const row = snapshot.find((r) => r.key === 'kv:settings/uiLanguage');
    expect(row?.hlc).toEqual(remote.hlc);
    expect(row?.firstHlc).toEqual(remote.hlc);
  });
});

describe('current()', () => {
  test('returns effective records per key across scopes', async () => {
    const kv = createMemoryKv();
    const clock = createClock();
    mockStorageState.local[STORAGE_KEYS.SETTINGS] = {
      uiLanguage: 'en',
      languageProfiles: [{ id: 'p1', target: 'ja', native: 'en', order: 0 }],
    };
    const source = sourceOf('profileConfig', kv, clock);
    const map = await source.current('profile:ja', ['profile', 'profile/nonexistent']);
    expect(map.get('profile')?.scope).toBe('profile:ja');
    expect(map.get('profile/nonexistent')).toBeNull();
  });
});
