import { MESSAGE_TYPES } from '@/shared/config/messages';
import { t } from '@/shared/i18n';
import type { MessageKey } from '@/shared/i18n';
import {
  onMessage,
  removeOnMessageListener,
  sendMessage,
} from '@/shared/lib/chrome-apis/runtime';
import type { MessageResponse } from '@/entities/message';
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

async function request<T>(type: string, payload: Record<string, unknown>): Promise<T> {
  const response = await sendMessage<MessageResponse<T>>({ type, payload });
  if (!response?.success) {
    throw new Error(response?.error ? syncErrorText(response.error) : t('settings.sync.error.requestFailed'));
  }
  return response.data as T;
}

export function getSyncStatus(): Promise<SyncStatusView> {
  return request<SyncStatusView>(MESSAGE_TYPES.SYNC_GET_STATUS, { tabId: -1 });
}

export function syncNow(): Promise<CycleResult> {
  return request<CycleResult>(MESSAGE_TYPES.SYNC_NOW, { tabId: -1 });
}

export function connectProviderAccount(providerId: ProviderId): Promise<ConnectResult> {
  return request<ConnectResult>(MESSAGE_TYPES.SYNC_CONNECT, { tabId: -1, providerId });
}

export function disconnectConnection(connectionId: ConnectionId): Promise<DisconnectResult> {
  return request<DisconnectResult>(MESSAGE_TYPES.SYNC_DISCONNECT, {
    tabId: -1,
    connectionId,
  });
}

export function disconnectConnectionLocally(
  connectionId: ConnectionId,
): Promise<DisconnectResult> {
  return request<DisconnectResult>(MESSAGE_TYPES.SYNC_DISCONNECT_LOCAL, {
    tabId: -1,
    connectionId,
  });
}

export function setSystemConnection(
  connectionId: ConnectionId,
): Promise<RebindResult | ReconcileResult | null> {
  return request<RebindResult | ReconcileResult | null>(
    MESSAGE_TYPES.SYNC_SET_SYSTEM_CONNECTION,
    { tabId: -1, connectionId },
  );
}

export function setScopeBinding(
  scope: Scope,
  destination: ConnectionId | 'local',
): Promise<RebindResult | ReconcileResult | null> {
  return request<RebindResult | ReconcileResult | null>(MESSAGE_TYPES.SYNC_SET_BINDING, {
    tabId: -1,
    scope,
    destination,
  });
}

export function cancelScopeRebind(scope: Scope): Promise<void> {
  return request<void>(MESSAGE_TYPES.SYNC_CANCEL_REBIND, { tabId: -1, scope });
}

export function deleteOldCopy(scope: Scope, connectionId: ConnectionId): Promise<void> {
  return request<void>(MESSAGE_TYPES.SYNC_DELETE_OLD_COPY, {
    tabId: -1,
    scope,
    connectionId,
  });
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
