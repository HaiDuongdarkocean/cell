import { InMemoryKeyValueStore } from '../adapters/memory/InMemoryKeyValueStore';
import { SeededClock } from '../adapters/memory/SeededClock';
import {
  acquireCycleLock,
  CycleLockLostError,
  LOCK_TTL_MS,
  SYNC_LOCK_STORAGE_KEY,
} from './cycleLock';
import type { SyncLockEntry } from './cycleLock';

interface Harness {
  kv: InMemoryKeyValueStore;
  clock: SeededClock;
  heartbeats: (() => void)[];
  deps: () => {
    kv: InMemoryKeyValueStore;
    clock: SeededClock;
    schedule: (intervalMs: number, fn: () => void) => () => void;
  };
}

function harness(): Harness {
  const kv = new InMemoryKeyValueStore();
  const clock = new SeededClock(1000);
  const heartbeats: (() => void)[] = [];
  const schedule = (_intervalMs: number, fn: () => void): (() => void) => {
    heartbeats.push(fn);
    return () => undefined;
  };
  return { kv, clock, heartbeats, deps: () => ({ kv, clock, schedule }) };
}

const readLock = (kv: InMemoryKeyValueStore) =>
  kv.get<SyncLockEntry>('session', SYNC_LOCK_STORAGE_KEY);

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('acquireCycleLock', () => {
  it('acquires an absent lock and stamps expiresAt = now + ttl', async () => {
    const t = harness();
    const lock = await acquireCycleLock(t.deps(), 'cycle-1');
    expect(lock).not.toBeNull();
    expect(lock?.cycleId).toBe('cycle-1');
    expect(await readLock(t.kv)).toEqual({ cycleId: 'cycle-1', expiresAt: 1000 + LOCK_TTL_MS });
  });

  it('refuses to acquire while a foreign live lock exists', async () => {
    const t = harness();
    await t.kv.set('session', SYNC_LOCK_STORAGE_KEY, {
      cycleId: 'other',
      expiresAt: 5000,
    });
    const lock = await acquireCycleLock(t.deps(), 'cycle-1');
    expect(lock).toBeNull();
    expect((await readLock(t.kv))?.cycleId).toBe('other');
  });

  it('steals an expired foreign lock', async () => {
    const t = harness();
    await t.kv.set('session', SYNC_LOCK_STORAGE_KEY, { cycleId: 'old', expiresAt: 900 });
    const lock = await acquireCycleLock(t.deps(), 'cycle-1');
    expect(lock?.cycleId).toBe('cycle-1');
    expect((await readLock(t.kv))?.cycleId).toBe('cycle-1');
  });

  it('renews an entry for the same cycleId', async () => {
    const t = harness();
    await t.kv.set('session', SYNC_LOCK_STORAGE_KEY, { cycleId: 'cycle-1', expiresAt: 2000 });
    const lock = await acquireCycleLock(t.deps(), 'cycle-1');
    expect(lock).not.toBeNull();
    expect((await readLock(t.kv))?.expiresAt).toBe(1000 + LOCK_TTL_MS);
  });

  it('serializes concurrent same-process acquisitions to a single winner', async () => {
    const t = harness();
    const [a, b] = await Promise.all([
      acquireCycleLock(t.deps(), 'cycle-1'),
      acquireCycleLock(t.deps(), 'cycle-2'),
    ]);
    const winners = [a, b].filter((l) => l !== null);
    expect(winners).toHaveLength(1);
    expect((await readLock(t.kv))?.cycleId).toBe(winners[0]!.cycleId);
    await winners[0]!.release();
  });
});

describe('CycleLock fencing', () => {
  it('verify passes while owned and unexpired', async () => {
    const t = harness();
    const lock = await acquireCycleLock(t.deps(), 'cycle-1');
    await expect(lock!.verify()).resolves.toBeUndefined();
  });

  it('verify throws after a foreign steal', async () => {
    const t = harness();
    const lock = await acquireCycleLock(t.deps(), 'cycle-1');
    await t.kv.set('session', SYNC_LOCK_STORAGE_KEY, { cycleId: 'thief', expiresAt: 99999 });
    await expect(lock!.verify()).rejects.toBeInstanceOf(CycleLockLostError);
  });

  it('verify throws once the entry has expired even without a steal', async () => {
    const t = harness();
    const lock = await acquireCycleLock(t.deps(), 'cycle-1');
    t.clock.set(1000 + LOCK_TTL_MS + 1);
    await expect(lock!.verify()).rejects.toBeInstanceOf(CycleLockLostError);
  });

  it('verify throws after release', async () => {
    const t = harness();
    const lock = await acquireCycleLock(t.deps(), 'cycle-1');
    await lock!.release();
    await expect(lock!.verify()).rejects.toBeInstanceOf(CycleLockLostError);
  });
});

describe('CycleLock heartbeat + release', () => {
  it('heartbeat renews expiresAt while held', async () => {
    const t = harness();
    const lock = await acquireCycleLock(t.deps(), 'cycle-1');
    expect(t.heartbeats).toHaveLength(1);
    t.clock.advance(30_000);
    t.heartbeats[0]!();
    await flush();
    expect((await readLock(t.kv))?.expiresAt).toBe(31_000 + LOCK_TTL_MS);
    await lock!.release();
  });

  it('heartbeat does not resurrect a stolen lock', async () => {
    const t = harness();
    await acquireCycleLock(t.deps(), 'cycle-1');
    await t.kv.set('session', SYNC_LOCK_STORAGE_KEY, { cycleId: 'thief', expiresAt: 99999 });
    t.heartbeats[0]!();
    await flush();
    expect((await readLock(t.kv))?.cycleId).toBe('thief');
  });

  it('release removes only its own entry', async () => {
    const t = harness();
    const lock = await acquireCycleLock(t.deps(), 'cycle-1');
    await lock!.release();
    expect(await readLock(t.kv)).toBeUndefined();

    const second = await acquireCycleLock(t.deps(), 'cycle-2');
    await t.kv.set('session', SYNC_LOCK_STORAGE_KEY, { cycleId: 'thief', expiresAt: 99999 });
    await second!.release();
    expect((await readLock(t.kv))?.cycleId).toBe('thief');
  });
});
