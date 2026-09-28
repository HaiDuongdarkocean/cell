import { MESSAGE_TYPES } from '@/shared/config/messages';
import {
  onMessage,
  removeOnMessageListener,
  sendMessage,
} from '@/shared/lib/chrome-apis/runtime';
import type { MessageResponse } from '@/entities/message';
import type { ConnectionId, ProviderId, Scope } from '../domain/types';
import type { CycleResult } from '../app/SyncEngine';
import type { ConnectResult, SyncStatusView } from '../app/syncService';
import type { DisconnectResult } from '../app/disconnect';
import type { RebindResult } from '../app/rebind';
import type { ReconcileResult } from '../app/reconciliation';

export type { SyncStatusView };

async function request<T>(type: string, payload: Record<string, unknown>): Promise<T> {
  const response = await sendMessage<MessageResponse<T>>({ type, payload });
  if (!response?.success) {
    throw new Error(response?.error ?? 'sync request failed');
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

function isSyncStatusView(payload: unknown): payload is SyncStatusView {
  if (typeof payload !== 'object' || payload === null) return false;
  const view = payload as { engine?: unknown; directory?: unknown };
  return (
    typeof view.engine === 'object' &&
    view.engine !== null &&
    typeof view.directory === 'object' &&
    view.directory !== null
  );
}

export function onSyncStatusChanged(callback: (status: SyncStatusView) => void): () => void {
  const listener = (message: unknown): boolean => {
    const msg = message as { type?: string; payload?: unknown };
    if (msg.type === MESSAGE_TYPES.SYNC_STATUS_CHANGED && isSyncStatusView(msg.payload)) {
      callback(msg.payload);
    }
    return false;
  };
  onMessage(listener);
  return () => removeOnMessageListener(listener);
}
