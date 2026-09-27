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
  SyncConnectPayloadSchema,
  SyncDisconnectPayloadSchema,
  SyncSetBindingPayloadSchema,
  SyncSetSystemConnectionPayloadSchema,
} from '@/entities/message/schema';
import { SyncServiceError } from '@/features/sync/app/syncService';
import { migrateProfileIdentity } from '@/features/sync/app/profileIdentityMigration';
import { createSrsSyncAccess } from '@/features/srs/sync/srsSyncAccess';
import { logger } from '@/shared/lib/logger';
import type { BackgroundContext } from '../context';

export const SYNC_TICK_ALARM = 'cell.sync.tick';
const SYNC_TICK_PERIOD_MINUTES = 5;
const CHANGE_DEBOUNCE_MS = 2_000;
const CHANGE_MAX_WAIT_MS = 30_000;

let runtime: SyncRuntime | undefined;

function getRuntime(ctx: BackgroundContext): SyncRuntime {
  runtime ??= createSyncRuntime({
    broadcast: (type, payload) =>
      ctx.messageBus.broadcast({ type: MESSAGE_TYPES[type], payload }),
    onStatusChanged: (status) =>
      ctx.messageBus.broadcast({ type: MESSAGE_TYPES.SYNC_STATUS_CHANGED, payload: status }),
  });
  return runtime;
}

function errorMessage(error: unknown): string {
  if (error instanceof SyncServiceError) return `${error.code}: ${error.message}`;
  if (error instanceof Error) return error.message;
  return String(error);
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
    return guarded(() => rt().connect(parsed.data.providerId as ProviderId));
  });

  ctx.on(MESSAGE_TYPES.SYNC_DISCONNECT, async (request) => {
    const parsed = SyncDisconnectPayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return { success: false, error: `Invalid SYNC_DISCONNECT payload: ${parsed.error.message}` };
    }
    return guarded(() => rt().disconnect(parsed.data.connectionId as ConnectionId));
  });

  ctx.on(MESSAGE_TYPES.SYNC_SET_SYSTEM_CONNECTION, async (request) => {
    const parsed = SyncSetSystemConnectionPayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return {
        success: false,
        error: `Invalid SYNC_SET_SYSTEM_CONNECTION payload: ${parsed.error.message}`,
      };
    }
    return guarded(() => rt().setSystemConnection(parsed.data.connectionId as ConnectionId));
  });

  ctx.on(MESSAGE_TYPES.SYNC_SET_BINDING, async (request) => {
    const parsed = SyncSetBindingPayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return { success: false, error: `Invalid SYNC_SET_BINDING payload: ${parsed.error.message}` };
    }
    return guarded(() =>
      rt().setBinding(
        parsed.data.scope as Scope,
        parsed.data.destination as ConnectionId | 'local',
      ),
    );
  });
}

function debouncedFire(fn: () => void, waitMs: number, maxWaitMs: number): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let firstAt: number | undefined;
  return () => {
    const now = Date.now();
    if (firstAt === undefined) firstAt = now;
    if (timer !== undefined) clearTimeout(timer);
    if (now - firstAt >= maxWaitMs) {
      firstAt = undefined;
      fn();
      return;
    }
    timer = setTimeout(() => {
      firstAt = undefined;
      fn();
    }, waitMs);
  };
}

export function wireSyncScheduling(ctx: BackgroundContext): Array<() => void> {
  const rt = getRuntime(ctx);
  const unsubs: Array<() => void> = [];
  void migrateProfileIdentity({ srs: createSrsSyncAccess() }).catch((error) =>
    logger.warn('sync: profile identity migration failed', { error: errorMessage(error) }),
  );
  const fire = () => {
    void rt
      .runCycle()
      .catch((error) => logger.warn('sync: scheduled cycle failed', { error: errorMessage(error) }));
  };
  const fireIfConnected = () => {
    void rt
      .hasConnections()
      .then((connected) => {
        if (connected) fire();
      })
      .catch(() => undefined);
  };

  if (typeof chrome !== 'undefined' && chrome.alarms !== undefined) {
    const onAlarm = (alarm: chrome.alarms.Alarm) => {
      if (alarm.name === SYNC_TICK_ALARM) fireIfConnected();
    };
    void chrome.alarms.create(SYNC_TICK_ALARM, { periodInMinutes: SYNC_TICK_PERIOD_MINUTES });
    chrome.alarms.onAlarm.addListener(onAlarm);
    unsubs.push(() => chrome.alarms.onAlarm.removeListener(onAlarm));
  }

  unsubs.push(scheduleOnExternalChange(debouncedFire(fireIfConnected, CHANGE_DEBOUNCE_MS, CHANGE_MAX_WAIT_MS)));

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
