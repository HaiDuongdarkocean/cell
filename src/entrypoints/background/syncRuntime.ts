import { HybridClock } from '@/features/sync';
import type { ChangeRecord, ConnectionId, Hlc, ProviderId, Scope } from '@/features/sync';
import type { LocalSource } from '@/features/sync';
import type { BlobReader } from '@/features/sync/app/blobRefs';
import { acquireCycleLock } from '@/features/sync/app/cycleLock';
import type { CycleLock } from '@/features/sync/app/cycleLock';
import { SYNC_DIRECTORY_STORAGE_KEY, readRouting } from '@/features/sync/app/routing';
import { SyncEngine } from '@/features/sync/app/SyncEngine';
import type { CycleResult, EngineStatus, SyncAppliedPayload } from '@/features/sync/app/SyncEngine';
import { createSyncDbStore } from '@/features/sync/app/syncDbStore';
import { migrateProfileIdentity } from '@/features/sync/app/profileIdentityMigration';
import { setActiveProfileAfterRestore } from '@/features/sync/app/reconciliation';
import {
  connectProvider,
  deleteVacatedScopeCopy,
  disconnectAccount,
  setScopeBinding,
  setSystemConnection,
  syncStatusSnapshot,
  SyncServiceError,
} from '@/features/sync/app/syncService';
import type { ConnectResult, SyncServiceDeps, SyncStatusView as ServiceSyncStatusView } from '@/features/sync/app/syncService';
import type { DisconnectResult } from '@/features/sync/app/disconnect';
import { cancelScopeRebind } from '@/features/sync/app/rebind';
import type { RebindResult } from '@/features/sync/app/rebind';
import type { ReconcileResult } from '@/features/sync/app/reconciliation';
import { ChromeKeyValueStore } from '@/features/sync/adapters/local/kv/chromeKvStore';
import { createKvLocalSources } from '@/features/sync/adapters/local/kv';
import { createGoogleDriveStorageProvider } from '@/features/sync/adapters/google-drive/googleDriveDefaults';
import { targetOf } from '@/features/sync/domain/scope';
import { createSrsLocalSource } from '@/features/srs/sync/srsLocalSource';
import type { SrsDataClass } from '@/features/srs/sync/srsLocalSource';
import { createReaderLocalSource } from '@/features/reader/sync/readerLocalSource';
import type { ReaderDataClass } from '@/features/reader/sync/readerLocalSource';
import { dictLocalSources } from '@/features/dictionary/sync/dictLocalSource';
import { createDictBlobReader } from '@/features/dictionary/sync/dictBlobReader';
import { createSrsSyncAccess } from '@/features/srs/sync/srsSyncAccess';
import { loadSettings } from '@/shared/lib/storage/settingsStore';
import { logger } from '@/shared/lib/logger';

const SYNC_CLOCK_WALL_KEY = 'syncClockWall';

const SRS_DATA_CLASSES: readonly SrsDataClass[] = [
  'studyConfig',
  'srsCollection',
  'srsDeck',
  'srsNotetype',
  'srsNote',
  'srsCard',
  'srsReviewEvent',
  'srsAudioAsset',
  'srsImageAsset',
];

const READER_DATA_CLASSES: readonly ReaderDataClass[] = ['readerBook', 'readerProgress'];

export interface SyncRuntimeDeps {
  readonly broadcast: (type: 'SYNC_DATA_APPLIED' | 'SYNC_STATUS_CHANGED', payload: unknown) => void;
  readonly onStatusChanged?: (status: EngineStatus) => void;
}

export type SyncStatusView = ServiceSyncStatusView;

export interface SyncRuntime {
  runCycle(): Promise<CycleResult>;
  status(): Promise<SyncStatusView>;
  connect(providerId: ProviderId): Promise<ConnectResult>;
  disconnect(connectionId: ConnectionId): Promise<DisconnectResult>;
  setSystemConnection(connectionId: ConnectionId): Promise<RebindResult | ReconcileResult | null>;
  setBinding(scope: Scope, destination: ConnectionId | 'local'): Promise<RebindResult | ReconcileResult | null>;
  cancelRebind(scope: Scope): Promise<void>;
  deleteOldCopy(scope: Scope, connectionId: ConnectionId): Promise<void>;
  refreshSources(): Promise<void>;
  engineStatus(): Promise<EngineStatus>;
  hasConnections(): Promise<boolean>;
}

interface BuiltRuntime {
  readonly kv: ChromeKeyValueStore;
  readonly hlc: HybridClock;
  readonly deviceId: string;
  readonly sources: LocalSource[];
  readonly kvSources: LocalSource[];
  readonly engine: SyncEngine;
  readonly serviceDepsBase: Omit<SyncServiceDeps, 'fence'>;
}

let builtPromise: Promise<BuiltRuntime> | undefined;
let runtimeDeps: SyncRuntimeDeps = { broadcast: () => undefined };

async function profileTargets(): Promise<readonly string[]> {
  const settings = await loadSettings();
  const targets = new Set<string>();
  for (const profile of settings.languageProfiles) {
    const target = targetOf(profile.target);
    if (target !== '') targets.add(target);
  }
  return [...targets].sort();
}

async function ensureDeviceId(kv: ChromeKeyValueStore): Promise<string> {
  const state =
    (await kv.get<Record<string, unknown>>('local', SYNC_DIRECTORY_STORAGE_KEY)) ?? {};
  if (typeof state['deviceId'] === 'string' && state['deviceId'] !== '') {
    return state['deviceId'];
  }
  const deviceId = crypto.randomUUID();
  await kv.set('local', SYNC_DIRECTORY_STORAGE_KEY, { ...state, deviceId });
  return deviceId;
}

function providerFor(providerId: ProviderId) {
  if (providerId === 'google-drive') return createGoogleDriveStorageProvider();
  throw new SyncServiceError('unknown-provider', `unknown sync provider: ${providerId}`);
}

async function dictSources(): Promise<LocalSource[]> {
  const targets = await profileTargets();
  const out: LocalSource[] = [];
  for (const langCode of targets) out.push(...dictLocalSources(langCode));
  return out;
}

async function buildRuntime(): Promise<BuiltRuntime> {
  const kv = new ChromeKeyValueStore();
  await migrateProfileIdentity({ srs: createSrsSyncAccess() });

  const deviceId = await ensureDeviceId(kv);
  const hlc = new HybridClock(`${deviceId}:runtime`, Date.now);
  const savedWall = await kv.get<number>('local', SYNC_CLOCK_WALL_KEY);
  if (savedWall !== undefined) hlc.seedWall(savedWall);
  const store = createSyncDbStore();
  const dictBlobReader = createDictBlobReader(profileTargets);
  const blobs: BlobReader = dictBlobReader;
  const kvSources = createKvLocalSources({
    kv,
    tick: () => hlc.tick(),
    now: () => Date.now(),
  });
  const sources: LocalSource[] = [
    ...SRS_DATA_CLASSES.map(createSrsLocalSource),
    ...READER_DATA_CLASSES.map(createReaderLocalSource),
    ...(await dictSources()),
    ...kvSources,
  ];

  const serviceDepsBase: Omit<SyncServiceDeps, 'fence'> = {
    providerFor,
    kv,
    store,
    sources: () => sources,
    blobs,
    srs: createSrsSyncAccess(),
    profileTargets,
    deviceId: async () => deviceId,
    cycleId: () => crypto.randomUUID(),
    clock: { now: () => Date.now() },
    tick: () => hlc.tick(),
    observeHlc: (remote: Hlc) => hlc.observe(remote),
    onDisconnect: async (connectionId) => {
      logger.info('sync: connection disconnected', { connectionId });
    },
  };

  const engine = new SyncEngine({
    kv,
    store,
    sources,
    blobs,
    providerFor,
    connections: async () => [...(await readRouting(kv)).connections],
    deviceId: async () => deviceId,
    clock: { now: () => Date.now() },
    ids: { uuid: () => crypto.randomUUID() },
    tick: () => hlc.tick(),
    observeHlc: (remote: Hlc) => hlc.observe(remote),
    onApplied: async (payload: SyncAppliedPayload) => {
      runtimeDeps.broadcast('SYNC_DATA_APPLIED', payload);
    },
    onRoutingChange: async (record: ChangeRecord) => {
      logger.info('sync: routing change applied', { scope: record.scope, key: record.key });
    },
  });
  engine.subscribe((status) => runtimeDeps.onStatusChanged?.(status));
  return { kv, hlc, deviceId, sources, kvSources, engine, serviceDepsBase };
}

async function ensureBuilt(): Promise<BuiltRuntime> {
  if (builtPromise === undefined) builtPromise = buildRuntime();
  return builtPromise;
}

async function persistClockWall(built: BuiltRuntime): Promise<void> {
  const stored = await built.kv.get<number>('local', SYNC_CLOCK_WALL_KEY);
  const floor = built.hlc.wallFloor;
  if (stored === undefined || floor > stored) {
    await built.kv.set('local', SYNC_CLOCK_WALL_KEY, floor);
  }
}

const SERVICE_LOCK_WAIT_MS = 30_000;
const SERVICE_LOCK_RETRY_MS = 300;

async function withServiceLock<T>(
  built: BuiltRuntime,
  fn: (fence: () => Promise<void>) => Promise<T>,
): Promise<T> {
  const cycleId = `service-${crypto.randomUUID()}`;
  const deadline = Date.now() + SERVICE_LOCK_WAIT_MS;
  let lock: CycleLock | null = null;
  while (lock === null && Date.now() < deadline) {
    lock = await acquireCycleLock(
      { kv: built.kv, clock: { now: () => Date.now() } },
      cycleId,
    );
    if (lock === null) {
      await new Promise((resolve) => setTimeout(resolve, SERVICE_LOCK_RETRY_MS));
    }
  }
  if (lock === null) {
    throw new SyncServiceError('sync-busy', 'a sync cycle is in progress — retry shortly');
  }
  try {
    return await fn(() => lock.verify());
  } finally {
    await persistClockWall(built).catch(() => undefined);
    await lock.release();
  }
}

export function createSyncRuntime(deps: SyncRuntimeDeps): SyncRuntime {
  runtimeDeps = deps;
  return {
    async runCycle() {
      const built = await ensureBuilt();
      const result = await built.engine.runCycle();
      await persistClockWall(built).catch(() => undefined);
      if (result.appliedDataClasses.length > 0) {
        await setActiveProfileAfterRestore().catch((error) =>
          logger.warn('sync: post-restore profile activation failed', {
            error: error instanceof Error ? error.message : String(error),
          }),
        );
      }
      runtimeDeps.broadcast('SYNC_STATUS_CHANGED', await statusOf(built));
      return result;
    },
    async status() {
      const built = await ensureBuilt();
      return statusOf(built);
    },
    async connect(providerId) {
      const built = await ensureBuilt();
      return withServiceLock(built, (fence) =>
        connectProvider({ ...built.serviceDepsBase, fence }, providerId),
      );
    },
    async disconnect(connectionId) {
      const built = await ensureBuilt();
      return withServiceLock(built, (fence) =>
        disconnectAccount({ ...built.serviceDepsBase, fence }, connectionId),
      );
    },
    async setSystemConnection(connectionId) {
      const built = await ensureBuilt();
      return withServiceLock(built, (fence) =>
        setSystemConnection({ ...built.serviceDepsBase, fence }, connectionId),
      );
    },
    async setBinding(scope, destination) {
      const built = await ensureBuilt();
      return withServiceLock(built, (fence) =>
        setScopeBinding({ ...built.serviceDepsBase, fence }, scope, destination),
      );
    },
    async cancelRebind(scope) {
      const built = await ensureBuilt();
      return withServiceLock(built, () =>
        cancelScopeRebind({ kv: built.kv }, scope),
      );
    },
    async deleteOldCopy(scope, connectionId) {
      const built = await ensureBuilt();
      return withServiceLock(built, (fence) =>
        deleteVacatedScopeCopy({ ...built.serviceDepsBase, fence }, scope, connectionId),
      );
    },
    async refreshSources() {
      const built = await ensureBuilt();
      built.sources.splice(
        0,
        built.sources.length,
        ...SRS_DATA_CLASSES.map(createSrsLocalSource),
        ...READER_DATA_CLASSES.map(createReaderLocalSource),
        ...(await dictSources()),
        ...built.kvSources,
      );
    },
    async engineStatus() {
      const built = await ensureBuilt();
      return built.engine.current;
    },
    async hasConnections() {
      const kv = new ChromeKeyValueStore();
      const state = await kv.get<Record<string, unknown>>(
        'local',
        SYNC_DIRECTORY_STORAGE_KEY,
      );
      return (
        typeof state === 'object' &&
        state !== null &&
        Object.keys(state).some((key) => key.startsWith('connection:'))
      );
    },
  };
}

async function statusOf(built: BuiltRuntime): Promise<SyncStatusView> {
  const directory = await syncStatusSnapshot({
    ...built.serviceDepsBase,
    fence: async () => undefined,
    connectionHealth: () => built.engine.connectionHealth(),
  });
  return { engine: built.engine.current, directory };
}
