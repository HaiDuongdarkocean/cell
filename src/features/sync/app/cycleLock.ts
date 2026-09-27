import type { Clock } from '../ports/clock';
import type { KeyValueStore } from '../ports/keyValueStore';

export const SYNC_LOCK_STORAGE_KEY = 'syncLock';
export const LOCK_TTL_MS = 120_000;
export const LOCK_HEARTBEAT_MS = 30_000;

export interface SyncLockEntry {
  readonly cycleId: string;
  readonly expiresAt: number;
}

export class CycleLockLostError extends Error {
  constructor(message = 'sync cycle lock lost') {
    super(message);
    this.name = 'CycleLockLostError';
  }
}

export interface CycleLock {
  readonly cycleId: string;
  verify(): Promise<void>;
  renew(): Promise<void>;
  release(): Promise<void>;
}

export interface CycleLockDeps {
  readonly kv: KeyValueStore;
  readonly clock: Clock;
  readonly ttlMs?: number;
  readonly heartbeatMs?: number;
  readonly schedule?: (intervalMs: number, fn: () => void) => () => void;
}

export async function acquireCycleLock(
  deps: CycleLockDeps,
  cycleId: string,
): Promise<CycleLock | null> {
  const ttlMs = deps.ttlMs ?? LOCK_TTL_MS;
  const heartbeatMs = deps.heartbeatMs ?? LOCK_HEARTBEAT_MS;
  const schedule = deps.schedule ?? defaultSchedule;
  const read = () => deps.kv.get<SyncLockEntry>('session', SYNC_LOCK_STORAGE_KEY);

  const existing = await read();
  if (
    existing !== undefined &&
    existing.cycleId !== cycleId &&
    existing.expiresAt > deps.clock.now()
  ) {
    return null;
  }
  await deps.kv.set('session', SYNC_LOCK_STORAGE_KEY, {
    cycleId,
    expiresAt: deps.clock.now() + ttlMs,
  });
  const confirm = await read();
  if (confirm === undefined || confirm.cycleId !== cycleId) return null;

  let held = true;
  let stopHeartbeat: () => void = () => undefined;
  const lock: CycleLock = {
    cycleId,
    async verify() {
      const entry = await read();
      if (
        entry === undefined ||
        entry.cycleId !== cycleId ||
        entry.expiresAt <= deps.clock.now()
      ) {
        held = false;
        stopHeartbeat();
        throw new CycleLockLostError();
      }
    },
    async renew() {
      const entry = await read();
      if (entry === undefined || entry.cycleId !== cycleId) {
        held = false;
        stopHeartbeat();
        return;
      }
      await deps.kv.set('session', SYNC_LOCK_STORAGE_KEY, {
        cycleId,
        expiresAt: deps.clock.now() + ttlMs,
      });
    },
    async release() {
      held = false;
      stopHeartbeat();
      const entry = await read();
      if (entry !== undefined && entry.cycleId === cycleId) {
        await deps.kv.del('session', SYNC_LOCK_STORAGE_KEY);
      }
    },
  };
  stopHeartbeat = schedule(heartbeatMs, () => {
    if (held) void lock.renew();
  });
  return lock;
}

function defaultSchedule(intervalMs: number, fn: () => void): () => void {
  const timer = setInterval(fn, intervalMs);
  return () => clearInterval(timer);
}
