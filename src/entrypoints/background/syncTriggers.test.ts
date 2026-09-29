import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  configureSyncTriggers,
  isFirstStatusesGetForTab,
  REMOTE_CHECK_LAST_KEY,
  requestRemoteCheck,
  resetSyncTriggersForTests,
} from './syncTriggers';
import type { SyncTriggersDeps } from './syncTriggers';

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

let clock = 10_000;

function makeDeps(overrides: Partial<SyncTriggersDeps> = {}): SyncTriggersDeps & {
  hasConnections: jest.Mock<() => Promise<boolean>>;
  checkRemote: jest.Mock<() => Promise<unknown>>;
  sessionSet: jest.Mock<(key: string, value: unknown) => Promise<void>>;
} {
  const deps = {
    hasConnections: jest.fn(async () => true),
    checkRemote: jest.fn(async () => ({})),
    now: () => clock,
    sessionGet: jest.fn(async () => undefined as number | undefined),
    sessionSet: jest.fn(async (_key: string, _value: unknown) => undefined),
    ...overrides,
  };
  return deps as SyncTriggersDeps & {
    hasConnections: jest.Mock<() => Promise<boolean>>;
    checkRemote: jest.Mock<() => Promise<unknown>>;
    sessionSet: jest.Mock<(key: string, value: unknown) => Promise<void>>;
  };
}

async function flush(): Promise<void> {
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
}

beforeEach(() => {
  clock = 10_000;
  resetSyncTriggersForTests();
});

afterEach(() => {
  resetSyncTriggersForTests();
  delete (globalThis as { chrome?: unknown }).chrome;
});

describe('requestRemoteCheck throttle (SC-11)', () => {
  it('10 concurrent calls on a cold seed run exactly one checkRemote', async () => {
    const deps = makeDeps();
    configureSyncTriggers(deps);
    for (let i = 0; i < 10; i += 1) requestRemoteCheck();
    await flush();
    expect(deps.checkRemote).toHaveBeenCalledTimes(1);
    expect(deps.sessionSet).toHaveBeenCalledWith(REMOTE_CHECK_LAST_KEY, clock);
  });

  it('a call after the 3s window runs a second check', async () => {
    const deps = makeDeps();
    configureSyncTriggers(deps);
    requestRemoteCheck();
    await flush();
    clock += 3_000;
    requestRemoteCheck();
    await flush();
    expect(deps.checkRemote).toHaveBeenCalledTimes(2);
  });

  it('a call inside the window is dropped', async () => {
    const deps = makeDeps();
    configureSyncTriggers(deps);
    requestRemoteCheck();
    await flush();
    clock += 2_999;
    requestRemoteCheck();
    await flush();
    expect(deps.checkRemote).toHaveBeenCalledTimes(1);
  });

  it('a simulated restart keeps the throttle via the session seed', async () => {
    const stored = 9_000;
    const deps = makeDeps({ sessionGet: async () => stored });
    configureSyncTriggers(deps);
    requestRemoteCheck();
    await flush();
    expect(deps.checkRemote).not.toHaveBeenCalled();
    clock = 12_000;
    requestRemoteCheck();
    await flush();
    expect(deps.checkRemote).toHaveBeenCalledTimes(1);
  });

  it('a call while not connected does not stamp; the first connected call runs', async () => {
    let connected = false;
    const deps = makeDeps({ hasConnections: jest.fn(async () => connected) });
    configureSyncTriggers(deps);
    requestRemoteCheck();
    await flush();
    expect(deps.checkRemote).not.toHaveBeenCalled();
    expect(deps.sessionSet).not.toHaveBeenCalled();
    connected = true;
    requestRemoteCheck();
    await flush();
    expect(deps.checkRemote).toHaveBeenCalledTimes(1);
  });

  it('with a warm seed, 3 concurrent calls whose hasConnections resolve together run one check', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<boolean>((resolve) => {
      release = () => resolve(true);
    });
    const deps = makeDeps({
      sessionGet: async () => 0,
      hasConnections: jest.fn(async () => gate),
    });
    configureSyncTriggers(deps);
    requestRemoteCheck();
    await flush();
    requestRemoteCheck();
    requestRemoteCheck();
    release();
    await flush();
    expect(deps.checkRemote).toHaveBeenCalledTimes(1);
  });

  it('a session read failure seeds 0 and still runs the check', async () => {
    const deps = makeDeps({
      sessionGet: async () => {
        throw new Error('nope');
      },
    });
    configureSyncTriggers(deps);
    requestRemoteCheck();
    await flush();
    expect(deps.checkRemote).toHaveBeenCalledTimes(1);
  });

  it('a checkRemote rejection is swallowed and logged', async () => {
    const deps = makeDeps({
      checkRemote: jest.fn(async () => {
        throw new Error('boom');
      }),
    });
    configureSyncTriggers(deps);
    requestRemoteCheck();
    await flush();
    expect(deps.checkRemote).toHaveBeenCalledTimes(1);
  });
});

describe('first-per-navigation tracking', () => {
  it('qualifies once per tab, never for tabId <= 0, and resets on navigation/removal', () => {
    const onUpdated = mockEvent();
    const onRemoved = mockEvent();
    (globalThis as { chrome?: unknown }).chrome = {
      tabs: { onUpdated, onRemoved },
    };
    configureSyncTriggers(makeDeps());

    expect(isFirstStatusesGetForTab(7)).toBe(true);
    expect(isFirstStatusesGetForTab(7)).toBe(false);
    expect(isFirstStatusesGetForTab(0)).toBe(false);
    expect(isFirstStatusesGetForTab(-1)).toBe(false);

    onUpdated.fire(7, { url: 'https://example.com/next' });
    expect(isFirstStatusesGetForTab(7)).toBe(true);

    onUpdated.fire(7, { status: 'loading' });
    expect(isFirstStatusesGetForTab(7)).toBe(true);

    onRemoved.fire(7);
    expect(isFirstStatusesGetForTab(7)).toBe(true);
  });
});
