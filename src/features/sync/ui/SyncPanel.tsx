import { useCallback, useEffect, useMemo, useState } from 'react';
import { t } from '@/shared/i18n';
import { OVERLAY_LANGUAGE_OPTIONS } from '@/shared/config/languageRegistry';
import type { Settings } from '@/entities/settings';
import { Alert } from '@/shared/ui/Alert';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Dialog } from '@/shared/ui/Dialog';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Icon } from '@/shared/ui/Icon';
import { Select } from '@/shared/ui/Select';
import { SettingsGroup } from '@/shared/ui/SettingsGroup';
import { SettingsRow } from '@/shared/ui/SettingsRow';
import { Spinner } from '@/shared/ui/Spinner';
import { StatusDot } from '@/shared/ui/StatusDot';
import { Text } from '@/shared/ui/Text';
import { Timestamp } from '@/shared/ui/Timestamp';
import { VStack } from '@/shared/ui/Stack';
import type { ConnectionId } from '../domain/types';
import { scopeForTarget, targetOf } from '../domain/scope';
import type { BindingStatusEntry, ConnectionStatusEntry } from '../app/syncService';
import {
  cancelScopeRebind,
  connectProviderAccount,
  deleteOldCopy,
  disconnectConnection,
  disconnectConnectionLocally,
  getSyncStatus,
  onSyncStatusChanged,
  setScopeBinding,
  setSystemConnection,
  syncNow,
  type SyncStatusView,
} from './syncClient';
import styles from './SyncPanel.module.css';

export interface SyncPanelProps {
  readonly settings: Settings;
}

const GOOGLE_DRIVE = 'google-drive' as const;

const langLabel = (code: string): string =>
  OVERLAY_LANGUAGE_OPTIONS.find((o) => o.value === code)?.label ?? code;

const providerLabel = (providerId: string): string =>
  providerId === GOOGLE_DRIVE ? t('settings.sync.provider.googleDrive') : providerId;

interface SummaryMeta {
  readonly dot: 'success' | 'info' | 'warning' | 'neutral';
  readonly label: string;
  readonly pulse: boolean;
}

function summaryMeta(view: SyncStatusView): SummaryMeta {
  switch (view.engine.state) {
    case 'running':
      return { dot: 'info', label: t('settings.sync.state.syncing'), pulse: true };
    case 'needs-reauth':
      return { dot: 'warning', label: t('settings.sync.state.signInNeeded'), pulse: false };
    case 'offline':
      return { dot: 'neutral', label: t('settings.sync.state.offline'), pulse: false };
    case 'storage-full':
      return { dot: 'warning', label: t('settings.sync.state.storageFull'), pulse: false };
    case 'backoff':
      return { dot: 'warning', label: t('settings.sync.state.retrying'), pulse: false };
    case 'idle':
    default:
      return { dot: 'success', label: t('settings.sync.state.protected'), pulse: false };
  }
}

function engineAlertDescription(state: string): string | undefined {
  switch (state) {
    case 'needs-reauth':
      return t('settings.sync.state.signInNeededDesc');
    case 'offline':
      return t('settings.sync.state.offlineDesc');
    case 'storage-full':
      return t('settings.sync.state.storageFullDesc');
    case 'backoff':
      return t('settings.sync.state.retryingDesc');
    default:
      return undefined;
  }
}

export function SyncPanel({ settings }: SyncPanelProps): React.JSX.Element {
  const [view, setView] = useState<SyncStatusView | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [disconnectTarget, setDisconnectTarget] = useState<ConnectionStatusEntry | null>(null);
  const [disconnectLocalMode, setDisconnectLocalMode] = useState(false);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      setView(await getSyncStatus());
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
    return onSyncStatusChanged((status) => setView(status));
  }, [refresh]);

  const profiles = useMemo(
    () => [...(settings.languageProfiles ?? [])].sort((a, b) => a.order - b.order),
    [settings.languageProfiles],
  );

  const run = useCallback(
    async (key: string, action: () => Promise<unknown>): Promise<void> => {
      setBusy(key);
      setActionError(null);
      try {
        await action();
      } catch (error) {
        setActionError(error instanceof Error ? error.message : String(error));
      } finally {
        setBusy(null);
        void refresh();
      }
    },
    [refresh],
  );

  const connectionLabel = useCallback(
    (connectionId: string): string =>
      view?.directory.connections.find((c) => c.connectionId === connectionId)
        ?.displayName ?? connectionId,
    [view],
  );

  const bindingFor = useCallback(
    (target: string): BindingStatusEntry | undefined =>
      view?.directory.bindings.find((b) => b.target === target),
    [view],
  );

  const affectedByDisconnect = useMemo(() => {
    if (disconnectTarget === null || view === null) return [];
    return profiles
      .map((p) => targetOf(p.target))
      .filter((target) => {
        const binding = bindingFor(target);
        const destination =
          binding?.destination ?? view.directory.systemConnection ?? 'local';
        return destination === disconnectTarget.connectionId;
      });
  }, [disconnectTarget, view, profiles, bindingFor]);

  const engineState = view?.engine.state;
  const meta = view !== null ? summaryMeta(view) : null;
  const showRecoveryAction =
    engineState === 'needs-reauth' ||
    engineState === 'backoff' ||
    engineState === 'storage-full';
  const hasConnections = (view?.directory.connections.length ?? 0) > 0;

  return (
    <VStack className={styles.panel}>
      {loadFailed && (
        <Alert
          variant="error"
          title={t('settings.sync.error.loadTitle')}
          description={t('settings.sync.error.loadDesc')}
        />
      )}
      {actionError !== null && (
        <Alert
          variant="error"
          title={t('settings.sync.error.actionTitle')}
          description={actionError}
          onDismiss={() => setActionError(null)}
        />
      )}

      {view === null && !loadFailed && (
        <div className={styles.loading} role="status" aria-label={t('settings.sync.loading')}>
          <Spinner size="lg" />
        </div>
      )}

      {view !== null && !hasConnections && (
        <>
          <EmptyState
            icon={<Icon name="link" size="lg" />}
            title={t('settings.sync.empty.title')}
            description={t('settings.sync.empty.desc')}
            action={
              <Button
                variant="primary"
                leadingIcon={<Icon name="link" />}
                loading={busy === 'connect'}
                onClick={() =>
                  void run('connect', () => connectProviderAccount(GOOGLE_DRIVE))
                }
              >
                {t('settings.sync.connect.googleDrive')}
              </Button>
            }
          />
        </>
      )}

      {view !== null && hasConnections && (
        <>
          {engineState !== undefined &&
            engineState !== 'idle' &&
            engineState !== 'running' && (
              <Alert
                variant={engineState === 'offline' ? 'default' : 'warning'}
                icon={<Icon name={engineState === 'offline' ? 'power' : 'triangleAlert'} />}
                title={meta?.label}
                description={engineAlertDescription(engineState)}
              />
            )}

          <SettingsRow
            dense
            title={
              <>
                {meta !== null && (
                  <StatusDot status={meta.dot} pulse={meta.pulse} aria-label={meta.label} />
                )}
                {meta?.label}
              </>
            }
            description={
              view.directory.lastAppliedAt !== null ? (
                <>
                  {t('settings.sync.lastSynced')}{' '}
                  <Timestamp value={view.directory.lastAppliedAt} />
                </>
              ) : undefined
            }
          >
            {engineState === 'needs-reauth' ? (
              <Button
                variant="primary"
                size="sm"
                leadingIcon={<Icon name="link" />}
                loading={busy === 'reauth'}
                onClick={() => {
                  const provider =
                    view.directory.connections.find(
                      (c) => c.connectionId === view.directory.systemConnection,
                    )?.providerId ?? view.directory.connections[0]?.providerId;
                  if (provider !== undefined) {
                    void run('reauth', () => connectProviderAccount(provider));
                  }
                }}
              >
                {t('settings.sync.signIn')}
              </Button>
            ) : (
              <Button
                variant={showRecoveryAction ? 'primary' : 'secondary'}
                size="sm"
                leadingIcon={<Icon name="repeat" />}
                loading={busy === 'now' || engineState === 'running'}
                onClick={() => void run('now', () => syncNow())}
              >
                {t('settings.sync.syncNow')}
              </Button>
            )}
          </SettingsRow>

          <SettingsGroup label={t('settings.sync.accounts.title')}>
            <ul className={styles.list}>
              {view.directory.connections.map((conn) => (
                <li key={conn.connectionId} className={styles.row}>
                  <Icon name="link" className={styles.rowIcon} color="secondary" />
                  <div className={styles.rowText}>
                    <Text variant="label" truncate className={styles.rowTitle}>
                      {conn.displayName}
                    </Text>
                    <Text variant="supporting" color="secondary" as="span">
                      {providerLabel(conn.providerId)}
                    </Text>
                    {conn.disconnectPending && (
                      <span className={styles.statusWarn}>
                        <Icon name="clock" size="xs" />
                        <Text variant="supporting" as="span">
                          {t('settings.sync.disconnectPending')}
                        </Text>
                      </span>
                    )}
                  </div>
                  {conn.isSystem && (
                    <Badge variant="secondary" size="sm">
                      {t('settings.sync.systemBadge')}
                    </Badge>
                  )}
                  <div className={styles.rowActions}>
                    {!conn.isSystem && view.directory.connections.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        loading={busy === `system:${conn.connectionId}`}
                        onClick={() =>
                          void run(`system:${conn.connectionId}`, () =>
                            setSystemConnection(conn.connectionId),
                          )
                        }
                      >
                        {t('settings.sync.makeSystem')}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setDisconnectLocalMode(false);
                        setDisconnectTarget(conn);
                      }}
                    >
                      {t('settings.sync.disconnect')}
                    </Button>
                    {(conn.disconnectPending || conn.state === 'needs-reauth') && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setDisconnectLocalMode(true);
                          setDisconnectTarget(conn);
                        }}
                      >
                        {t('settings.sync.disconnectLocal')}
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <Button
              variant="outline"
              size="sm"
              leadingIcon={<Icon name="plus" />}
              loading={busy === 'connect'}
              onClick={() => void run('connect', () => connectProviderAccount(GOOGLE_DRIVE))}
            >
              {t('settings.sync.connectAnother')}
            </Button>
          </SettingsGroup>

          <SettingsGroup label={t('settings.sync.profiles.title')}>
            {profiles.length === 0 ? (
              <Text variant="supporting" color="secondary">
                {t('settings.sync.profiles.empty')}
              </Text>
            ) : (
              <ul className={styles.list}>
                {profiles.map((profile) => {
                  const target = targetOf(profile.target);
                  const binding = bindingFor(target);
                  const destination =
                    binding?.destination ?? view.directory.systemConnection ?? 'local';
                  const waitingConn =
                    binding !== undefined && binding.waiting ? binding.destination : null;
                  const scope = scopeForTarget(target);
                  return (
                    <li key={profile.id} className={styles.row}>
                      <div className={styles.rowText}>
                        <Text variant="label" truncate className={styles.rowTitle}>
                          {langLabel(target)}
                        </Text>
                        {binding?.frozen === true && (
                          <span className={styles.statusInfo}>
                            <Icon name="repeat" size="xs" />
                            <Text variant="supporting" as="span">
                              {t('settings.sync.copying')}
                            </Text>
                          </span>
                        )}
                        {waitingConn !== null && (
                          <span className={styles.statusWarn}>
                            <Icon name="link" size="xs" />
                            <Text variant="supporting" as="span">
                              {t('settings.sync.waitingFor', [
                                connectionLabel(waitingConn),
                              ])}
                            </Text>
                          </span>
                        )}
                      </div>
                      {(binding?.frozen === true || waitingConn !== null) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy === `cancel:${target}`}
                          onClick={() =>
                            void run(`cancel:${target}`, () => cancelScopeRebind(scope))
                          }
                        >
                          {t('settings.sync.cancelRebind')}
                        </Button>
                      )}
                      {binding?.vacatedFrom != null && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy === `delete:${target}`}
                          title={t('settings.sync.deleteOldCopy', [
                            connectionLabel(binding.vacatedFrom),
                          ])}
                          onClick={() =>
                            void run(`delete:${target}`, () =>
                              deleteOldCopy(scope, binding.vacatedFrom as ConnectionId),
                            )
                          }
                        >
                          {t('settings.sync.deleteOldCopyShort')}
                        </Button>
                      )}
                      <Select
                        size="sm"
                        variant="outline"
                        className={styles.destinationSelect}
                        value={destination}
                        disabled={binding?.frozen === true || busy === `bind:${target}`}
                        options={[
                          ...view.directory.connections.map((conn) => ({
                            value: conn.connectionId,
                            label: conn.displayName,
                          })),
                          { value: 'local', label: t('settings.sync.destination.local') },
                        ]}
                        onChange={(value) =>
                          void run(`bind:${target}`, () =>
                            setScopeBinding(
                              scope,
                              value === 'local' ? 'local' : (value as ConnectionId),
                            ),
                          )
                        }
                        aria-label={t('settings.sync.destination.aria', [langLabel(target)])}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </SettingsGroup>
        </>
      )}

      <Dialog
        open={disconnectTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDisconnectTarget(null);
        }}
        title={
          disconnectLocalMode
            ? t('settings.sync.disconnectLocal.title')
            : t('settings.sync.disconnect.title')
        }
        description={
          disconnectTarget !== null
            ? disconnectLocalMode
              ? t('settings.sync.disconnectLocal.desc', [disconnectTarget.displayName])
              : t('settings.sync.disconnect.desc', [disconnectTarget.displayName])
            : undefined
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setDisconnectTarget(null)}>
              {t('settings.sync.disconnect.cancel')}
            </Button>
            <Button
              variant="destructive"
              loading={busy === 'disconnect'}
              onClick={() => {
                if (disconnectTarget === null) return;
                const id = disconnectTarget.connectionId;
                const request = disconnectLocalMode
                  ? () => disconnectConnectionLocally(id)
                  : () => disconnectConnection(id);
                void run('disconnect', request).then(() =>
                  setDisconnectTarget(null),
                );
              }}
            >
              {disconnectLocalMode
                ? t('settings.sync.disconnectLocal.confirm')
                : t('settings.sync.disconnect.confirm')}
            </Button>
          </>
        }
      >
        {affectedByDisconnect.length > 0 && (
          <Text variant="body" color="secondary">
            {t('settings.sync.disconnect.affected')}{' '}
            {affectedByDisconnect.map((target) => langLabel(target)).join(', ')}
          </Text>
        )}
      </Dialog>
    </VStack>
  );
}
