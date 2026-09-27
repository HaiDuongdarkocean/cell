import { useEffect, useRef, useState } from 'react';
import type { ICON_CATALOG } from '@/shared/icons';
import {
  ACCOUNT_LABELS,
  buildScenario,
  type AccountId,
  type Binding,
  type MockConnection,
  type MockProfile,
  type MockScenario,
  type ScenarioId,
} from './mockData';

export type StatusTone = 'ok' | 'warn' | 'info' | 'neutral';

export interface StatusMeta {
  icon: keyof typeof ICON_CATALOG;
  label: string;
  tone: StatusTone;
}

export interface PendingRebind {
  profileId: string;
  from: Binding;
  to: Binding;
}

export interface CompletedRebind {
  profileId: string;
  from: Binding;
  to: Binding;
}

export interface MockAction {
  label: string;
  run(): void;
  primary?: boolean;
}

export interface SyncMock {
  scenario: MockScenario;
  syncing: boolean;
  notice: string | null;
  disconnectTarget: MockConnection | null;
  pendingRebind: PendingRebind | null;
  completedRebind: CompletedRebind | null;
  pendingSystemAccount: AccountId | null;
  connect(): void;
  connectAnother(): void;
  syncNow(): void;
  requestRebind(profileId: string, to: Binding): void;
  cancelRebind(): void;
  confirmRebind(): void;
  keepOldCopy(): void;
  deleteOldCopy(): void;
  reauth(accountId: AccountId): void;
  retryAccount(accountId: AccountId): void;
  retryProfile(profileId: string): void;
  requestSystemChange(accountId: AccountId): void;
  cancelSystemChange(): void;
  confirmSystemChange(): void;
  retryDisconnect(accountId: AccountId): void;
  manageStorage(): void;
  openProfileSettings(): void;
  requestDisconnect(accountId: AccountId): void;
  cancelDisconnect(): void;
  confirmDisconnect(): void;
}

export function connectionStatus(connection: MockConnection): StatusMeta {
  switch (connection.state) {
    case 'syncing':
      return { icon: 'repeat', label: 'Syncing', tone: 'info' };
    case 'needs-reauth':
      return { icon: 'triangleAlert', label: 'Sign-in needed', tone: 'warn' };
    case 'disconnect-pending':
      return { icon: 'clock', label: 'Disconnect pending', tone: 'warn' };
    case 'offline':
      return { icon: 'power', label: 'Offline', tone: 'warn' };
    case 'storage-full':
      return { icon: 'triangleAlert', label: 'Storage full', tone: 'warn' };
    case 'waiting-connection':
      return { icon: 'link', label: 'Waiting for connection', tone: 'warn' };
    case 'healthy':
    default:
      return { icon: 'circleCheck', label: 'Connected', tone: 'ok' };
  }
}

export function profileStatus(profile: MockProfile, connections: MockConnection[]): StatusMeta {
  const bound = connections.find((c) => c.id === profile.binding);
  if (bound?.state === 'disconnect-pending') {
    return { icon: 'clock', label: 'Disconnect pending', tone: 'warn' };
  }
  if (bound?.state === 'offline') {
    return { icon: 'power', label: 'Offline', tone: 'warn' };
  }
  if (bound?.state === 'storage-full') {
    return { icon: 'triangleAlert', label: 'Cloud storage full', tone: 'warn' };
  }
  if (bound?.state === 'waiting-connection') {
    return { icon: 'link', label: 'Connect this account', tone: 'warn' };
  }
  switch (profile.state) {
    case 'waiting':
      return { icon: 'alertCircle', label: 'Waiting — sign in needed', tone: 'warn' };
    case 'migrating':
      return { icon: 'repeat', label: 'Moving', tone: 'info' };
    case 'local-storage-full':
      return { icon: 'triangleAlert', label: 'Device storage full', tone: 'warn' };
    case 'local':
      return { icon: 'power', label: 'Only on this device', tone: 'neutral' };
    case 'protected':
    default:
      return { icon: 'check', label: 'Protected', tone: 'ok' };
  }
}

export function summaryStatus(scenario: MockScenario, syncing: boolean): StatusMeta {
  if (scenario.connections.length === 0) {
    return { icon: 'link', label: 'Not protected yet', tone: 'neutral' };
  }
  if (syncing) return { icon: 'repeat', label: 'Syncing', tone: 'info' };
  if (scenario.migration) return { icon: 'repeat', label: 'Moving a profile', tone: 'info' };
  if (scenario.connections.some((c) => c.state !== 'healthy')) {
    const troubled = scenario.connections.find((c) => c.state !== 'healthy');
    if (troubled?.state === 'disconnect-pending') {
      return { icon: 'clock', label: 'Disconnect pending', tone: 'warn' };
    }
    return { icon: 'triangleAlert', label: 'Needs attention', tone: 'warn' };
  }
  if (scenario.profiles.some((p) => p.state === 'local-storage-full')) {
    return { icon: 'triangleAlert', label: 'Needs attention', tone: 'warn' };
  }
  return { icon: 'circleCheck', label: 'Protected', tone: 'ok' };
}

export function accountAction(c: MockConnection, mock: SyncMock): MockAction | null {
  switch (c.state) {
    case 'needs-reauth':
      return { label: 'Sign in again', run: () => mock.reauth(c.id), primary: true };
    case 'offline':
      return { label: 'Try again', run: () => mock.retryAccount(c.id), primary: true };
    case 'storage-full':
      return { label: 'Manage storage', run: () => mock.manageStorage(), primary: true };
    case 'waiting-connection':
      return { label: 'Connect', run: () => mock.reauth(c.id), primary: true };
    case 'disconnect-pending':
      return { label: 'Retry disconnect', run: () => mock.retryDisconnect(c.id), primary: true };
    default:
      return null;
  }
}

export function profileAction(p: MockProfile, mock: SyncMock): MockAction | null {
  if (p.state === 'local-storage-full') {
    return { label: 'Try again', run: () => mock.retryProfile(p.id), primary: true };
  }
  return null;
}

export function useSyncMock(scenarioId: ScenarioId): SyncMock {
  const [scenario, setScenario] = useState<MockScenario>(() => buildScenario(scenarioId));
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [disconnectId, setDisconnectId] = useState<AccountId | null>(null);
  const [pendingRebind, setPendingRebind] = useState<PendingRebind | null>(null);
  const [completedRebind, setCompletedRebind] = useState<CompletedRebind | null>(null);
  const [pendingSystemAccount, setPendingSystemAccount] = useState<AccountId | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    setScenario(buildScenario(scenarioId));
    setSyncing(false);
    setNotice(null);
    setDisconnectId(null);
    setPendingRebind(null);
    setCompletedRebind(null);
    setPendingSystemAccount(null);
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    return () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
    };
  }, [scenarioId]);

  const later = (fn: () => void, ms: number): void => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  const act = (fn: () => void): void => {
    setNotice(null);
    fn();
  };

  const connect = (): void => act(() => {
    setScenario((s) => ({
      ...s,
      lastSync: 'just now',
      connections: [
        {
          id: 'google-drive:duong',
          email: ACCOUNT_LABELS['google-drive:duong'],
          state: 'healthy',
          system: true,
          lastSync: 'just now',
        },
      ],
      profiles: s.profiles.map((p) => ({ ...p, binding: 'google-drive:duong', state: 'protected' })),
    }));
  });

  const connectAnother = (): void => act(() => {
    setScenario((s) => {
      if (s.connections.some((c) => c.id === 'google-drive:study')) return s;
      return {
        ...s,
        connections: [
          ...s.connections,
          {
            id: 'google-drive:study',
            email: ACCOUNT_LABELS['google-drive:study'],
            state: 'healthy',
            system: false,
            lastSync: 'just now',
          },
        ],
      };
    });
  });

  const syncNow = (): void => act(() => {
    setSyncing(true);
    setScenario((s) => ({
      ...s,
      connections: s.connections.map((c) =>
        c.state === 'healthy' ? { ...c, state: 'syncing' } : c,
      ),
    }));
    later(() => {
      setSyncing(false);
      setScenario((s) => ({
        ...s,
        lastSync: 'just now',
        connections: s.connections.map((c) =>
          c.state === 'syncing' ? { ...c, state: 'healthy', lastSync: 'just now' } : c,
        ),
      }));
    }, 1600);
  });

  const applyRebind = (profileId: string, to: Binding): void => {
    setScenario((s) => ({
      ...s,
      lastSync: 'just now',
      profiles: s.profiles.map((p) =>
        p.id === profileId
          ? { ...p, binding: to, state: to === 'local' ? 'local' : 'protected' }
          : p,
      ),
    }));
  };

  const requestRebind = (profileId: string, to: Binding): void => {
    const profile = scenario.profiles.find((p) => p.id === profileId);
    if (!profile || profile.binding === to || scenario.migration || pendingRebind) return;
    setPendingRebind({ profileId, from: profile.binding, to });
  };

  const cancelRebind = (): void => setPendingRebind(null);

  const confirmRebind = (): void => act(() => {
    const pending = pendingRebind;
    setPendingRebind(null);
    if (!pending) return;
    const { profileId, from, to } = pending;
    if (from === 'local' || to === 'local') {
      applyRebind(profileId, to);
      if (from !== 'local') setCompletedRebind(pending);
      return;
    }
    setScenario((s) => ({
      ...s,
      profiles: s.profiles.map((p) =>
        p.id === profileId ? { ...p, state: 'migrating' } : p,
      ),
      migration: { profileId, from: from as AccountId, to: to as AccountId, progress: 0 },
    }));
    let progress = 0;
    const tick = (): void => {
      progress += 16;
      if (progress < 100) {
        const value = progress;
        setScenario((s) =>
          s.migration ? { ...s, migration: { ...s.migration, progress: value } } : s,
        );
        later(tick, 350);
        return;
      }
      setScenario((s) =>
        s.migration
          ? {
              ...s,
              lastSync: 'just now',
              migration: null,
              profiles: s.profiles.map((p) =>
                p.id === profileId ? { ...p, binding: to, state: 'protected' } : p,
              ),
            }
          : s,
      );
      setCompletedRebind(pending);
    };
    later(tick, 350);
    setCompletedRebind(null);
  });

  const keepOldCopy = (): void => setCompletedRebind(null);
  const deleteOldCopy = (): void => setCompletedRebind(null);

  const reauth = (accountId: AccountId): void => act(() => {
    setScenario((s) => ({
      ...s,
      connections: s.connections.map((c) =>
        c.id === accountId && (c.state === 'needs-reauth' || c.state === 'waiting-connection')
          ? { ...c, state: 'healthy', lastSync: 'just now' }
          : c,
      ),
      profiles: s.profiles.map((p) =>
        p.binding === accountId && p.state === 'waiting' ? { ...p, state: 'protected' } : p,
      ),
    }));
  });

  const retryAccount = (accountId: AccountId): void => act(() => {
    setScenario((s) => ({
      ...s,
      connections: s.connections.map((c) =>
        c.id === accountId && c.state === 'offline'
          ? { ...c, state: 'healthy', lastSync: 'just now' }
          : c,
      ),
    }));
  });

  const retryProfile = (profileId: string): void => act(() => {
    setScenario((s) => ({
      ...s,
      lastSync: 'just now',
      profiles: s.profiles.map((p) =>
        p.id === profileId && p.state === 'local-storage-full' ? { ...p, state: 'protected' } : p,
      ),
    }));
  });

  const requestSystemChange = (accountId: AccountId): void => setPendingSystemAccount(accountId);
  const cancelSystemChange = (): void => setPendingSystemAccount(null);
  const confirmSystemChange = (): void => act(() => {
    const target = pendingSystemAccount;
    if (!target) return;
    setScenario((s) => ({
      ...s,
      connections: s.connections.map((c) =>
        c.id === target ? { ...c, state: 'syncing' } : c,
      ),
    }));
    later(() => {
      setScenario((s) => ({
        ...s,
        connections: s.connections.map((c) => ({
          ...c,
          system: c.id === target,
          state: c.id === target ? 'healthy' : c.state === 'syncing' ? 'healthy' : c.state,
          lastSync: c.id === target ? 'just now' : c.lastSync,
        })),
      }));
      setPendingSystemAccount(null);
    }, 1600);
  });

  const retryDisconnect = (accountId: AccountId): void => act(() => {
    setScenario((s) => ({
      ...s,
      connections: s.connections.filter((c) => c.id !== accountId),
      profiles: s.profiles.map((p) =>
        p.binding === accountId ? { ...p, binding: 'local', state: 'local' } : p,
      ),
    }));
  });

  const manageStorage = (): void => setNotice('Storage management would open');

  const openProfileSettings = (): void => setNotice('Profile settings would open');

  const requestDisconnect = (accountId: AccountId): void => setDisconnectId(accountId);
  const cancelDisconnect = (): void => setDisconnectId(null);
  const confirmDisconnect = (): void => act(() => {
    const target = scenario.connections.find((c) => c.id === disconnectId);
    const leavesPending =
      target?.state === 'offline' ||
      target?.state === 'needs-reauth' ||
      target?.state === 'waiting-connection';
    setScenario((s) =>
      leavesPending
        ? {
            ...s,
            connections: s.connections.map((c) =>
              c.id === disconnectId ? { ...c, state: 'disconnect-pending' } : c,
            ),
          }
        : {
            ...s,
            connections: s.connections.filter((c) => c.id !== disconnectId),
            profiles: s.profiles.map((p) =>
              p.binding === disconnectId ? { ...p, binding: 'local', state: 'local' } : p,
            ),
          },
    );
    setDisconnectId(null);
  });

  const disconnectTarget = disconnectId
    ? (scenario.connections.find((c) => c.id === disconnectId) ?? null)
    : null;

  return {
    scenario,
    syncing,
    notice,
    disconnectTarget,
    pendingRebind,
    completedRebind,
    pendingSystemAccount,
    connect,
    connectAnother,
    syncNow,
    requestRebind,
    cancelRebind,
    confirmRebind,
    keepOldCopy,
    deleteOldCopy,
    reauth,
    retryAccount,
    retryProfile,
    requestSystemChange,
    cancelSystemChange,
    confirmSystemChange,
    retryDisconnect,
    manageStorage,
    openProfileSettings,
    requestDisconnect,
    cancelDisconnect,
    confirmDisconnect,
  };
}
