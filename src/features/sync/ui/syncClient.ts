import { MESSAGE_TYPES } from '@/shared/config/messages';
import { t } from '@/shared/i18n';
import type { MessageKey } from '@/shared/i18n';
import {
  onMessage,
  removeOnMessageListener,
  requestMessage,
} from '@/shared/lib/chrome-apis/runtime';
import { messagePayload } from '@/entities/message/payload';
import type { ConnectionId, ProviderId, Scope } from '../domain/types';
import type { CycleResult } from '../app/SyncEngine';
import type { ConnectResult, SyncStatusView } from '../app/syncService';
import type { DisconnectResult } from '../app/disconnect';
import type { RebindResult } from '../app/rebind';
import type { ReconcileResult } from '../app/reconciliation';

export type { SyncStatusView };

const SYNC_ERROR_KEYS: Record<string, MessageKey> = {
  'unknown-provider': 'settings.sync.error.unknownProvider',
  'unknown-connection': 'settings.sync.error.unknownConnection',
  'auth-cancelled': 'settings.sync.error.authCancelled',
  'system-connection-required': 'settings.sync.error.systemConnectionRequired',
  'invalid-destination': 'settings.sync.error.invalidDestination',
  'sync-busy': 'settings.sync.error.syncBusy',
  'rebind-blocked': 'settings.sync.error.rebindBlocked',
  'sync-data-missing': 'settings.sync.error.dataMissing',
  'sync-data-invalid': 'settings.sync.error.dataInvalid',
  'provider-auth': 'settings.sync.error.providerAuth',
  'provider-quota': 'settings.sync.error.providerQuota',
  'provider-network': 'settings.sync.error.providerNetwork',
  'provider-rate-limit': 'settings.sync.error.providerRateLimit',
  'provider-not-found': 'settings.sync.error.providerNotFound',
  'provider-unknown': 'settings.sync.error.providerUnknown',
};

function syncErrorText(error: string): string {
  const code = error.split(':', 1)[0].trim();
  const key = SYNC_ERROR_KEYS[code];
  return key === undefined ? error : t(key);
}

const syncRequestOpts = (): { mapError: (error: string) => string; fallback: string } => ({
  mapError: syncErrorText,
  fallback: t('settings.sync.error.requestFailed'),
});

export function getSyncStatus(): Promise<SyncStatusView> {
  return requestMessage<SyncStatusView>(MESSAGE_TYPES.SYNC_GET_STATUS, { tabId: -1 }, syncRequestOpts());
}

export function syncNow(): Promise<CycleResult> {
  return requestMessage<CycleResult>(MESSAGE_TYPES.SYNC_NOW, { tabId: -1 }, syncRequestOpts());
}

export function connectProviderAccount(providerId: ProviderId): Promise<ConnectResult> {
  return requestMessage<ConnectResult>(MESSAGE_TYPES.SYNC_CONNECT, { tabId: -1, providerId }, syncRequestOpts());
}

export function disconnectConnection(connectionId: ConnectionId): Promise<DisconnectResult> {
  return requestMessage<DisconnectResult>(MESSAGE_TYPES.SYNC_DISCONNECT, {
    tabId: -1,
    connectionId,
  }, syncRequestOpts());
}

export function disconnectConnectionLocally(
  connectionId: ConnectionId,
): Promise<DisconnectResult> {
  return requestMessage<DisconnectResult>(MESSAGE_TYPES.SYNC_DISCONNECT_LOCAL, {
    tabId: -1,
    connectionId,
  }, syncRequestOpts());
}

export function setSystemConnection(
  connectionId: ConnectionId,
): Promise<RebindResult | ReconcileResult | null> {
  return requestMessage<RebindResult | ReconcileResult | null>(
    MESSAGE_TYPES.SYNC_SET_SYSTEM_CONNECTION,
    { tabId: -1, connectionId },
    syncRequestOpts(),
  );
}

export function setScopeBinding(
  scope: Scope,
  destination: ConnectionId | 'local',
): Promise<RebindResult | ReconcileResult | null> {
  return requestMessage<RebindResult | ReconcileResult | null>(MESSAGE_TYPES.SYNC_SET_BINDING, {
    tabId: -1,
    scope,
    destination,
  }, syncRequestOpts());
}

export function cancelScopeRebind(scope: Scope): Promise<void> {
  return requestMessage<void>(MESSAGE_TYPES.SYNC_CANCEL_REBIND, { tabId: -1, scope }, syncRequestOpts());
}

export function deleteOldCopy(scope: Scope, connectionId: ConnectionId): Promise<void> {
  return requestMessage<void>(MESSAGE_TYPES.SYNC_DELETE_OLD_COPY, {
    tabId: -1,
    scope,
    connectionId,
  }, syncRequestOpts());
}

export function onSyncStatusChanged(callback: (status: SyncStatusView) => void): () => void {
  const listener = (message: unknown): boolean => {
    const payload = messagePayload<SyncStatusView>(message, MESSAGE_TYPES.SYNC_STATUS_CHANGED);
    if (payload) callback(payload);
    return false;
  };
  onMessage(listener);
  return () => removeOnMessageListener(listener);
}
