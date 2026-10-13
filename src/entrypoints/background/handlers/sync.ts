/**
 * Sync message handlers + scheduling — SYNC_GET_STATUS, SYNC_NOW,
 * SYNC_CONNECT, SYNC_DISCONNECT, SYNC_SET_SYSTEM_CONNECTION, SYNC_SET_BINDING.
 * Wire-up of the sync runtime lives in ../syncRuntime.ts; the service layer
 * is src/features/sync/app/syncService.ts.
 */
import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { MessageResponse } from '@/entities/message';
import type { ConnectionId, ProviderId, Scope } from '@/features/sync';
import type { CycleResult } from '@/features/sync/app/SyncEngine';
import type { SyncStatusView, SyncRuntime } from '../syncRuntime';
import { createSyncRuntime } from '../syncRuntime';
import { scheduleOnExternalChange } from '@/features/sync/adapters/local/kv';
import { onStorageChanged, removeOnStorageChangedListener } from '@/shared/lib/chrome-apis';
import { STORAGE_KEYS } from '@/shared/config/config';
import {
  EmptyPayloadSchema,
  SyncCancelRebindPayloadSchema,
  SyncConnectPayloadSchema,
  SyncDeleteOldCopyPayloadSchema,
  SyncDisconnectPayloadSchema,
  SyncSetBindingPayloadSchema,
  SyncSetSystemConnectionPayloadSchema,
} from '@/entities/message/schema';
import { SyncServiceError } from '@/features/sync/app/syncService';
import { ProviderError } from '@/features/sync/ports/storageProvider';
import { SystemConnectionRequiredError } from '@/features/sync/app/disconnect';
import { CycleLockLostError } from '@/features/sync/app/cycleLock';
import { RebindBlockedError } from '@/features/sync/app/rebind';
import { BlobUnavailableError } from '@/features/sync/app/pushCycle';
import { WireFormatError } from '@/features/sync/app/wireCodec';
import { migrateProfileIdentity } from '@/features/sync/app/profileIdentityMigration';
import { createSrsSyncAccess } from '@/features/srs/sync/srsSyncAccess';
import { setOutboxDirtyNotifier } from '@/features/sync/adapters/local/idb/capture';
import { configureSyncTriggers } from '../syncTriggers';
import { getJobRegistry } from './jobs';
import { isActiveJob } from '@/entities/job/types';
import { logger } from '@/shared/lib/logger';
import type { BackgroundContext } from '../context';

export const SYNC_TICK_ALARM = 'Tihoka.sync.tick';
const SYNC_TICK_PERIOD_MINUTES = 15;
const CHANGE_DEBOUNCE_MS = 300;
const CHANGE_MAX_WAIT_MS = 1_500;

let runtime: SyncRuntime | undefined;

export function resetSyncRuntimeForTests(): void {
  runtime = undefined;
}

function getRuntime(ctx: BackgroundContext): SyncRuntime {
  runtime ??= createSyncRuntime({
    broadcast: (type, payload) =>
      ctx.messageBus.broadcast({ type: MESSAGE_TYPES[type], payload }),
    onStatusChanged: () => {
      void runtime
        ?.status()
        .then((view) =>
          ctx.messageBus.broadcast({
            type: MESSAGE_TYPES.SYNC_STATUS_CHANGED,
            payload: view,
          }),
        )
        .catch(() => undefined);
    },
  });
  return runtime;
}

function errorMessage(error: unknown): string {
  if (error instanceof SyncServiceError) return `${error.code}: ${error.message}`;
  if (error instanceof SystemConnectionRequiredError) return `system-connection-required: ${error.message}`;
  if (error instanceof CycleLockLostError) return `sync-busy: ${error.message}`;
  if (error instanceof RebindBlockedError) return `rebind-blocked: ${error.message}`;
  if (error instanceof BlobUnavailableError) return `sync-data-missing: ${error.message}`;
  if (error instanceof WireFormatError) return `sync-data-invalid: ${error.message}`;
  if (error instanceof ProviderError) return `provider-${error.kind}: ${error.message}`;
  if (error instanceof Error) return error.message;
  return String(error);
}

function fireIfConnected(): void {
  const rt = runtime;
  if (rt === undefined) return;
  void rt
    .hasConnections()
    .then((connected) => {
      if (!connected) return;
      return rt.runCycle();
    })
    .catch((error) =>
      logger.warn('sync: scheduled cycle failed', { error: errorMessage(error) }),
    );
}

function pushIfConnected(): void {
  const rt = runtime;
  if (rt === undefined) return;
  void rt
    .hasConnections()
    .then((connected) => {
      if (!connected) return;
      return rt.runPush();
    })
    .catch((error) =>
      logger.warn('sync: scheduled push failed', { error: errorMessage(error) }),
    );
}

async function guarded<T>(fn: () => Promise<T>): Promise<MessageResponse<T>> {
  try {
    return { success: true, data: await fn() };
  } catch (error) {
    logger.warn('sync: handler failed', { error: errorMessage(error) });
    return { success: false, error: errorMessage(error) };
  }
}

export function registerSyncHandlers(ctx: BackgroundContext): void {
  const rt = () => getRuntime(ctx);

  ctx.on(
    MESSAGE_TYPES.SYNC_GET_STATUS,
    async (request): Promise<MessageResponse<SyncStatusView>> => {
      const parsed = EmptyPayloadSchema.safeParse(request.payload);
      if (!parsed.success) {
        return { success: false, error: `Invalid SYNC_GET_STATUS payload: ${parsed.error.message}` };
      }
      return guarded(() => rt().status());
    },
  );

  ctx.on(
    MESSAGE_TYPES.SYNC_NOW,
    async (request): Promise<MessageResponse<CycleResult>> => {
      const parsed = EmptyPayloadSchema.safeParse(request.payload);
      if (!parsed.success) {
        return { success: false, error: `Invalid SYNC_NOW payload: ${parsed.error.message}` };
      }
      return guarded(() => rt().runCycle());
    },
  );

  ctx.on(MESSAGE_TYPES.SYNC_CONNECT, async (request) => {
    const parsed = SyncConnectPayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return { success: false, error: `Invalid SYNC_CONNECT payload: ${parsed.error.message}` };
    }
    const response = await guarded(() =>
      rt().connect(parsed.data.providerId as ProviderId),
    );
    if (response.success) fireIfConnected();
    return response;
  });

  ctx.on(MESSAGE_TYPES.SYNC_DISCONNECT, async (request) => {
    const parsed = SyncDisconnectPayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return { success: false, error: `Invalid SYNC_DISCONNECT payload: ${parsed.error.message}` };
    }
    const response = await guarded(() =>
      rt().disconnect(parsed.data.connectionId as ConnectionId),
    );
    if (response.success) fireIfConnected();
    return response;
  });

  ctx.on(MESSAGE_TYPES.SYNC_DISCONNECT_LOCAL, async (request) => {
    const parsed = SyncDisconnectPayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return {
        success: false,
        error: `Invalid SYNC_DISCONNECT_LOCAL payload: ${parsed.error.message}`,
      };
    }
    const response = await guarded(() =>
      rt().disconnectLocal(parsed.data.connectionId as ConnectionId),
    );
    if (response.success) fireIfConnected();
    return response;
  });

  ctx.on(MESSAGE_TYPES.SYNC_SET_SYSTEM_CONNECTION, async (request) => {
    const parsed = SyncSetSystemConnectionPayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return {
        success: false,
        error: `Invalid SYNC_SET_SYSTEM_CONNECTION payload: ${parsed.error.message}`,
      };
    }
    const response = await guarded(() =>
      rt().setSystemConnection(parsed.data.connectionId as ConnectionId),
    );
    if (response.success) fireIfConnected();
    return response;
  });

  ctx.on(MESSAGE_TYPES.SYNC_SET_BINDING, async (request) => {
    const parsed = SyncSetBindingPayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return { success: false, error: `Invalid SYNC_SET_BINDING payload: ${parsed.error.message}` };
    }
    const response = await guarded(() =>
      rt().setBinding(
        parsed.data.scope as Scope,
        parsed.data.destination as ConnectionId | 'local',
      ),
    );
    if (response.success) fireIfConnected();
    return response;
  });

  ctx.on(MESSAGE_TYPES.SYNC_CANCEL_REBIND, async (request) => {
    const parsed = SyncCancelRebindPayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return {
        success: false,
        error: `Invalid SYNC_CANCEL_REBIND payload: ${parsed.error.message}`,
      };
    }
    const response = await guarded(() => rt().cancelRebind(parsed.data.scope as Scope));
    if (response.success) fireIfConnected();
    return response;
  });

  ctx.on(MESSAGE_TYPES.SYNC_DELETE_OLD_COPY, async (request) => {
    const parsed = SyncDeleteOldCopyPayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return {
        success: false,
        error: `Invalid SYNC_DELETE_OLD_COPY payload: ${parsed.error.message}`,
      };
    }
    const response = await guarded(() =>
      rt().deleteOldCopy(
        parsed.data.scope as Scope,
        parsed.data.connectionId as ConnectionId,
      ),
    );
    if (response.success) fireIfConnected();
    return response;
  });

  ctx.on(MESSAGE_TYPES.SYNC_OUTBOX_DIRTY, async (request) => {
    const parsed = EmptyPayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return {
        success: false,
        error: `Invalid SYNC_OUTBOX_DIRTY payload: ${parsed.error.message}`,
      };
    }
    pushScheduler?.();
    return { success: true };
  });
}

let pushScheduler: (() => void) | undefined;

function debouncedFire(
  fn: () => void,
  waitMs: number,
  maxWaitMs: number,
): (() => void) & { cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  let firstAt: number | undefined;
  const run = () => {
    if (timer !== undefined) clearTimeout(timer);
    if (deadline !== undefined) clearTimeout(deadline);
    timer = undefined;
    deadline = undefined;
    firstAt = undefined;
    fn();
  };
  const fire = () => {
    const now = Date.now();
    if (firstAt === undefined) {
      firstAt = now;
      deadline = setTimeout(() => {
        if (timer !== undefined) clearTimeout(timer);
        run();
      }, maxWaitMs);
    }
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(run, waitMs);
  };
  fire.cancel = () => {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
    if (deadline !== undefined) {
      clearTimeout(deadline);
      deadline = undefined;
    }
    firstAt = undefined;
  };
  return fire;
}

export function wireSyncScheduling(ctx: BackgroundContext): Array<() => void> {
  const rt = getRuntime(ctx);
  const unsubs: Array<() => void> = [];
  void migrateProfileIdentity({ srs: createSrsSyncAccess() }).catch((error) =>
    logger.warn('sync: profile identity migration failed', { error: errorMessage(error) }),
  );

  if (typeof chrome !== 'undefined' && chrome.alarms !== undefined) {
    const onAlarm = (alarm: chrome.alarms.Alarm) => {
      if (alarm.name === SYNC_TICK_ALARM) fireIfConnected();
    };
    void chrome.alarms.create(SYNC_TICK_ALARM, { periodInMinutes: SYNC_TICK_PERIOD_MINUTES });
    chrome.alarms.onAlarm.addListener(onAlarm);
    unsubs.push(() => chrome.alarms.onAlarm.removeListener(onAlarm));
  }

  const debounced = debouncedFire(pushIfConnected, CHANGE_DEBOUNCE_MS, CHANGE_MAX_WAIT_MS);
  pushScheduler = debounced;
  setOutboxDirtyNotifier(debounced);
  unsubs.push(
    scheduleOnExternalChange(debounced),
    debounced.cancel,
    () => {
      if (pushScheduler === debounced) pushScheduler = undefined;
      setOutboxDirtyNotifier();
    },
  );

  unsubs.push(
    ...configureSyncTriggers({
      hasConnections: () => rt.hasConnections(),
      checkRemote: () => rt.checkRemote(),
      hasActiveResourceJob: () => {
        try {
          const registry = getJobRegistry();
          return (['resource-import', 'resource-delete'] as const).some((kind) =>
            registry.list(kind).some(isActiveJob),
          );
        } catch {
          return false;
        }
      },
    }),
  );

  const targetsOf = (value: unknown): string => {
    const profiles = (value as { languageProfiles?: { target: string }[] } | undefined)
      ?.languageProfiles;
    return profiles === undefined ? '' : profiles.map((p) => p.target).sort().join(',');
  };
  const onSettingsChanged = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: string,
  ) => {
    if (area !== 'local') return;
    const change = changes[STORAGE_KEYS.SETTINGS];
    if (change === undefined) return;
    if (targetsOf(change.oldValue) === targetsOf(change.newValue)) return;
    void rt
      .refreshSources()
      .then(() => fireIfConnected())
      .catch((error) =>
        logger.warn('sync: source refresh failed', { error: errorMessage(error) }),
      );
  };
  onStorageChanged(onSettingsChanged);
  unsubs.push(() => removeOnStorageChangedListener(onSettingsChanged));

  if (typeof self !== 'undefined') {
    const online = () => fireIfConnected();
    self.addEventListener('online', online);
    unsubs.push(() => self.removeEventListener('online', online));
  }

  fireIfConnected();
  return unsubs;
}
