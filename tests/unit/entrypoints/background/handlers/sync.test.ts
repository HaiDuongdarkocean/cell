import {
  registerSyncHandlers,
  resetSyncRuntimeForTests,
  wireSyncScheduling,
  SYNC_TICK_ALARM,
} from '@/entrypoints/background/handlers/sync';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { STORAGE_KEYS } from '@/shared/config/config';
import type { BackgroundContext } from '@/entrypoints/background/context';
import type { MessageRequest, MessageResponse } from '@/entities/message';
import type { SyncRuntime } from '@/entrypoints/background/syncRuntime';
import { createSyncRuntime } from '@/entrypoints/background/syncRuntime';
import { migrateProfileIdentity } from '@/features/sync/app/profileIdentityMigration';
import { setOutboxDirtyNotifier } from '@/features/sync/adapters/local/idb/capture';

jest.mock('@/entrypoints/background/syncRuntime', () => ({
  createSyncRuntime: jest.fn(),
}));

jest.mock('@/features/sync/app/profileIdentityMigration', () => ({
  migrateProfileIdentity: jest.fn(async () => ({ migrated: false })),
}));

jest.mock('@/features/srs/sync/srsSyncAccess', () => ({
  createSrsSyncAccess: jest.fn(() => ({})),
}));

jest.mock('@/features/sync/adapters/local/idb/capture', () => ({
  setOutboxDirtyNotifier: jest.fn(),
}));

jest.mock('@/shared/lib/logger', () => ({
  logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const mockedCreate = createSyncRuntime as jest.MockedFunction<typeof createSyncRuntime>;
const mockedMigrate = migrateProfileIdentity as jest.MockedFunction<typeof migrateProfileIdentity>;
const mockedSetOutboxDirtyNotifier = setOutboxDirtyNotifier as jest.MockedFunction<
  typeof setOutboxDirtyNotifier
>;

const rt = {
  status: jest.fn(async (): Promise<unknown> => ({ enabled: true })),
  runCycle: jest.fn(async () => ({ acquired: true })),
  runPush: jest.fn(async () => ({ acquired: true })),
  checkRemote: jest.fn(async () => ({ acquired: true })),
  connect: jest.fn(async () => ({ ok: true })),
  disconnect: jest.fn(async () => ({ ok: true })),
  setSystemConnection: jest.fn(async () => ({ ok: true })),
  setBinding: jest.fn(async () => ({ ok: true })),
  cancelRebind: jest.fn(async () => undefined),
  refreshSources: jest.fn(async () => undefined),
  engineStatus: jest.fn(() => ({ state: 'idle' })),
  hasConnections: jest.fn(async () => true),
};

type Handler = (request: MessageRequest) => Promise<MessageResponse<unknown>>;

function makeContext() {
  const handlers = new Map<string, Handler>();
  const broadcast = jest.fn();
  const ctx = {
    on: jest.fn((type: string, fn: Handler) => {
      handlers.set(type, fn);
    }),
    messageBus: { broadcast },
  } as unknown as BackgroundContext;
  return { ctx, handlers, broadcast };
}

interface MockEvent {
  listeners: Array<(...args: never[]) => void>;
  addListener(fn: (...args: never[]) => void): void;
  removeListener(fn: (...args: never[]) => void): void;
  fire(...args: unknown[]): void;
}

function mockEvent(): MockEvent {
  const event: MockEvent = {
    listeners: [],
    addListener(fn) {
      event.listeners.push(fn);
    },
    removeListener(fn) {
      event.listeners = event.listeners.filter((l) => l !== fn);
    },
    fire(...args: unknown[]) {
      for (const l of event.listeners) l(...(args as never[]));
    },
  };
  return event;
}

function installChrome() {
  const alarms = { create: jest.fn(), onAlarm: mockEvent() };
  const storageOnChanged = mockEvent();
  (globalThis as { chrome?: unknown }).chrome = {
    alarms,
    storage: { onChanged: storageOnChanged },
  };
  return { alarms, storageOnChanged };
}

function request(type: string, payload: unknown): MessageRequest {
  return { type, payload } as MessageRequest;
}

async function flush(): Promise<void> {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

beforeEach(() => {
  jest.clearAllMocks();
  resetSyncRuntimeForTests();
  rt.hasConnections.mockResolvedValue(true);
  mockedCreate.mockReturnValue(rt as unknown as SyncRuntime);
});

afterEach(() => {
  delete (globalThis as { chrome?: unknown }).chrome;
});

describe('sync handlers', () => {
  it('SYNC_GET_STATUS returns runtime status', async () => {
    const { ctx, handlers } = makeContext();
    registerSyncHandlers(ctx);
    const res = await handlers.get(MESSAGE_TYPES.SYNC_GET_STATUS)!(
      request(MESSAGE_TYPES.SYNC_GET_STATUS, {}),
    );
    expect(res).toEqual({ success: true, data: { enabled: true } });
    expect(rt.status).toHaveBeenCalled();
  });

  it('SYNC_NOW runs a cycle', async () => {
    const { ctx, handlers } = makeContext();
    registerSyncHandlers(ctx);
    const res = await handlers.get(MESSAGE_TYPES.SYNC_NOW)!(
      request(MESSAGE_TYPES.SYNC_NOW, {}),
    );
    expect(res.success).toBe(true);
    expect(rt.runCycle).toHaveBeenCalled();
  });

  it('rejects invalid payloads', async () => {
    const { ctx, handlers } = makeContext();
    registerSyncHandlers(ctx);
    const res = await handlers.get(MESSAGE_TYPES.SYNC_SET_BINDING)!(
      request(MESSAGE_TYPES.SYNC_SET_BINDING, { nope: 1 }),
    );
    expect(res.success).toBe(false);
    expect(rt.setBinding).not.toHaveBeenCalled();
  });

  it('SYNC_CONNECT forwards the provider id', async () => {
    const { ctx, handlers } = makeContext();
    registerSyncHandlers(ctx);
    await handlers.get(MESSAGE_TYPES.SYNC_CONNECT)!(
      request(MESSAGE_TYPES.SYNC_CONNECT, { providerId: 'google-drive' }),
    );
    expect(rt.connect).toHaveBeenCalledWith('google-drive');
  });

  it('SYNC_DISCONNECT and SYNC_SET_* forward args', async () => {
    const { ctx, handlers } = makeContext();
    registerSyncHandlers(ctx);
    await handlers.get(MESSAGE_TYPES.SYNC_DISCONNECT)!(
      request(MESSAGE_TYPES.SYNC_DISCONNECT, { connectionId: 'gd:acct' }),
    );
    await handlers.get(MESSAGE_TYPES.SYNC_SET_SYSTEM_CONNECTION)!(
      request(MESSAGE_TYPES.SYNC_SET_SYSTEM_CONNECTION, { connectionId: 'gd:acct' }),
    );
    await handlers.get(MESSAGE_TYPES.SYNC_SET_BINDING)!(
      request(MESSAGE_TYPES.SYNC_SET_BINDING, { scope: 'profile:en', destination: 'local' }),
    );
    expect(rt.disconnect).toHaveBeenCalledWith('gd:acct');
    expect(rt.setSystemConnection).toHaveBeenCalledWith('gd:acct');
    expect(rt.setBinding).toHaveBeenCalledWith('profile:en', 'local');
  });

  it('broadcasts the canonical SyncStatusView on engine status changes', async () => {
    const view = {
      engine: { state: 'idle', updatedAt: 7 },
      directory: {
        connections: [],
        bindings: [],
        systemConnection: null,
        lastAppliedAt: null,
      },
    };
    rt.status.mockResolvedValue(view);
    const { ctx, handlers, broadcast } = makeContext();
    registerSyncHandlers(ctx);
    await handlers.get(MESSAGE_TYPES.SYNC_GET_STATUS)!(
      request(MESSAGE_TYPES.SYNC_GET_STATUS, {}),
    );
    const deps = mockedCreate.mock.calls.at(-1)![0];
    deps.onStatusChanged?.({ state: 'running', updatedAt: 9 } as never);
    await flush();
    expect(rt.status).toHaveBeenCalled();
    expect(broadcast).toHaveBeenCalledWith({
      type: MESSAGE_TYPES.SYNC_STATUS_CHANGED,
      payload: view,
    });
  });

  it('returns a failure envelope when the service throws', async () => {
    rt.connect.mockRejectedValueOnce(new Error('boom'));
    const { ctx, handlers } = makeContext();
    registerSyncHandlers(ctx);
    const res = await handlers.get(MESSAGE_TYPES.SYNC_CONNECT)!(
      request(MESSAGE_TYPES.SYNC_CONNECT, { providerId: 'google-drive' }),
    );
    expect(res).toEqual({ success: false, error: 'boom' });
  });
});

describe('sync scheduling', () => {
  let unsubs: Array<() => void> = [];

  const wire = (ctx: BackgroundContext) => {
    unsubs = wireSyncScheduling(ctx);
    return unsubs;
  };

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    for (const unsub of unsubs) unsub();
    unsubs = [];
    jest.useRealTimers();
  });

  it('runs profile identity migration on wiring', async () => {
    const { ctx } = makeContext();
    installChrome();
    wire(ctx);
    await flush();
    expect(mockedMigrate).toHaveBeenCalled();
  });

  it('SC-14: creates the tick alarm with a 15-minute period and fires a cycle when connected', async () => {
    const { ctx } = makeContext();
    const chrome = installChrome();
    wire(ctx);
    await flush();
    expect(chrome.alarms.create).toHaveBeenCalledWith(
      SYNC_TICK_ALARM,
      expect.objectContaining({ periodInMinutes: 15 }),
    );
    rt.runCycle.mockClear();
    rt.hasConnections.mockClear();
    chrome.alarms.onAlarm.fire({ name: SYNC_TICK_ALARM });
    await flush();
    expect(rt.hasConnections).toHaveBeenCalled();
    expect(rt.runCycle).toHaveBeenCalledTimes(1);
  });

  it('skips cycles when there are no connections', async () => {
    const { ctx } = makeContext();
    const chrome = installChrome();
    rt.hasConnections.mockResolvedValue(false);
    wire(ctx);
    await flush();
    rt.runCycle.mockClear();
    chrome.alarms.onAlarm.fire({ name: SYNC_TICK_ALARM });
    await flush();
    expect(rt.runCycle).not.toHaveBeenCalled();
  });

  it('ignores foreign alarms', async () => {
    const { ctx } = makeContext();
    const chrome = installChrome();
    wire(ctx);
    await flush();
    rt.runCycle.mockClear();
    rt.hasConnections.mockClear();
    chrome.alarms.onAlarm.fire({ name: 'other.alarm' });
    await flush();
    expect(rt.hasConnections).not.toHaveBeenCalled();
  });

  it('SC-14: debounces synced storage-key changes into one push, not a cycle', async () => {
    const { ctx } = makeContext();
    const chrome = installChrome();
    wire(ctx);
    await flush();
    rt.runPush.mockClear();
    rt.runCycle.mockClear();
    const change = { oldValue: 1, newValue: 2 };
    chrome.storageOnChanged.fire({ themeMode: change }, 'local');
    chrome.storageOnChanged.fire({ syncMetaKV: change }, 'local');
    jest.advanceTimersByTime(300);
    await flush();
    expect(rt.runPush).toHaveBeenCalledTimes(1);
    expect(rt.runCycle).not.toHaveBeenCalled();
  });

  it('SC-2: five signals inside 200ms fire one push ≥300ms after the last signal', async () => {
    const { ctx } = makeContext();
    const chrome = installChrome();
    wire(ctx);
    await flush();
    rt.runPush.mockClear();
    const change = { oldValue: 1, newValue: 2 };
    for (let i = 0; i < 5; i += 1) {
      chrome.storageOnChanged.fire({ settings: change }, 'local');
      jest.advanceTimersByTime(40);
    }
    jest.advanceTimersByTime(259);
    await flush();
    expect(rt.runPush).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    await flush();
    expect(rt.runPush).toHaveBeenCalledTimes(1);
  });

  it('SC-2: a steady signal stream fires the push at least every 1500ms', async () => {
    const { ctx } = makeContext();
    const chrome = installChrome();
    wire(ctx);
    await flush();
    rt.runPush.mockClear();
    const change = { oldValue: 1, newValue: 2 };
    for (let t = 0; t < 4_500; t += 100) {
      chrome.storageOnChanged.fire({ settings: change }, 'local');
      jest.advanceTimersByTime(100);
    }
    await flush();
    expect(rt.runPush.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('SC-2: a burst ending 1400ms after the first signal fires at exactly 1500ms', async () => {
    const { ctx } = makeContext();
    const chrome = installChrome();
    wire(ctx);
    await flush();
    rt.runPush.mockClear();
    const change = { oldValue: 1, newValue: 2 };
    for (let t = 0; t <= 1_400; t += 100) {
      chrome.storageOnChanged.fire({ settings: change }, 'local');
      jest.advanceTimersByTime(100);
    }
    await flush();
    expect(rt.runPush).toHaveBeenCalledTimes(1);
  });

  it('SC-1: the outbox-dirty notifier wired by wireSyncScheduling reaches the debounced push directly', async () => {
    const { ctx } = makeContext();
    installChrome();
    wire(ctx);
    await flush();
    rt.runPush.mockClear();
    const notifier = mockedSetOutboxDirtyNotifier.mock.calls.at(-1)![0] as () => void;
    expect(typeof notifier).toBe('function');
    notifier();
    jest.advanceTimersByTime(300);
    await flush();
    expect(rt.runPush).toHaveBeenCalledTimes(1);
  });

  it('SYNC_OUTBOX_DIRTY routes into the same debounced push', async () => {
    const { ctx, handlers } = makeContext();
    installChrome();
    registerSyncHandlers(ctx);
    wire(ctx);
    await flush();
    rt.runPush.mockClear();
    const res = await handlers.get(MESSAGE_TYPES.SYNC_OUTBOX_DIRTY)!(
      request(MESSAGE_TYPES.SYNC_OUTBOX_DIRTY, {}),
    );
    expect(res.success).toBe(true);
    expect(rt.runPush).not.toHaveBeenCalled();
    jest.advanceTimersByTime(300);
    await flush();
    expect(rt.runPush).toHaveBeenCalledTimes(1);
  });

  it('refreshes sources when profile targets change, not for other settings writes', async () => {
    const { ctx } = makeContext();
    const chrome = installChrome();
    wire(ctx);
    await flush();
    rt.refreshSources.mockClear();
    rt.runCycle.mockClear();

    const settingsChange = (
      oldTargets: string[],
      newTargets: string[],
    ): Record<string, chrome.storage.StorageChange> => ({
      [STORAGE_KEYS.SETTINGS]: {
        oldValue: {
          languageProfiles: oldTargets.map((target) => ({ target })),
        },
        newValue: {
          languageProfiles: newTargets.map((target) => ({ target })),
        },
      },
    });

    chrome.storageOnChanged.fire(settingsChange(['en'], ['en']), 'local');
    await flush();
    expect(rt.refreshSources).not.toHaveBeenCalled();

    chrome.storageOnChanged.fire(settingsChange(['en'], ['en', 'ja']), 'local');
    await flush();
    expect(rt.refreshSources).toHaveBeenCalledTimes(1);
    expect(rt.runCycle).toHaveBeenCalledTimes(1);
  });

  it('fires on online events', async () => {
    const { ctx } = makeContext();
    installChrome();
    wire(ctx);
    await flush();
    rt.runCycle.mockClear();
    self.dispatchEvent(new Event('online'));
    await flush();
    expect(rt.runCycle).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes listeners on teardown', async () => {
    const { ctx } = makeContext();
    const chrome = installChrome();
    wire(ctx);
    await flush();
    for (const unsub of unsubs) unsub();
    rt.runCycle.mockClear();
    rt.hasConnections.mockClear();
    chrome.alarms.onAlarm.fire({ name: SYNC_TICK_ALARM });
    chrome.storageOnChanged.fire({ syncState: { oldValue: 1, newValue: 2 } }, 'local');
    jest.advanceTimersByTime(35_000);
    await flush();
    expect(rt.hasConnections).not.toHaveBeenCalled();
    expect(rt.runCycle).not.toHaveBeenCalled();
  });
});
