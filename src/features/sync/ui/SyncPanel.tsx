import { useCallback, useEffect, useMemo, useState } from 'react';
import { t } from '@/shared/i18n';
import { OVERLAY_LANGUAGE_OPTIONS } from '@/shared/config/languageRegistry';
import type { LanguageProfile, Settings } from '@/entities/settings';
import { Accordion } from '@/shared/ui/Accordion';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Bars } from '@/shared/ui/Charts';
import { Dialog } from '@/shared/ui/Dialog';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Icon } from '@/shared/ui/Icon';
import { Select } from '@/shared/ui/Select';
import { SettingsGroup } from '@/shared/ui/SettingsGroup';
import { SettingsRow } from '@/shared/ui/SettingsRow';
import { Spinner } from '@/shared/ui/Spinner';
import { StatusDot } from '@/shared/ui/StatusDot';
import { Text } from '@/shared/ui/Text';
import { createToastHost } from '@/shared/ui/mountToast';
import { ShadowThemeProvider } from '@/features/theme';
import { Timestamp } from '@/shared/ui/Timestamp';
import { VStack } from '@/shared/ui/Stack';
import type { ConnectionId, DataClass } from '../domain/types';
import { scopeForTarget, targetOf } from '../domain/scope';
import type { BindingStatusEntry, ConnectionStatusEntry } from '../app/syncService';
import type { SyncRunRecord } from '../app/runHistory';
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

const toastHost = createToastHost({ provider: ShadowThemeProvider });

type HeroTone = 'ok' | 'info' | 'warn' | 'error' | 'neutral';

interface HeroMeta {
  readonly tone: HeroTone;
  readonly pulse: boolean;
  readonly title: string;
  readonly desc: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const ACTIVITY_DAYS = 14;

interface DayBucket {
  readonly dayStart: number;
  items: number;
  errors: number;
  readonly runs: SyncRunRecord[];
}

function bucketByDay(
  history: readonly SyncRunRecord[],
  now: number,
): { buckets: DayBucket[]; totalItems: number; totalErrors: number } {
  const todayStart = new Date(now).setHours(0, 0, 0, 0);
  const buckets: DayBucket[] = [];
  for (let i = ACTIVITY_DAYS - 1; i >= 0; i--) {
    buckets.push({ dayStart: todayStart - i * DAY_MS, items: 0, errors: 0, runs: [] });
  }
  let totalItems = 0;
  let totalErrors = 0;
  for (const run of history) {
    const idx = Math.floor((run.at - buckets[0]!.dayStart) / DAY_MS);
    if (idx < 0 || idx >= ACTIVITY_DAYS) continue;
    const bucket = buckets[idx]!;
    bucket.runs.push(run);
    bucket.items += run.ackedKeys + run.appliedDataClasses.length;
    bucket.errors += run.failed.length + (run.ok ? 0 : 1);
    totalItems += run.ackedKeys;
    totalErrors += run.ok ? 0 : 1;
  }
  return { buckets, totalItems, totalErrors };
}

function runKindLabel(kind: SyncRunRecord['kind']): string {
  return t(`settings.sync.run.kind.${kind}`);
}

function heroFor(view: SyncStatusView): HeroMeta {
  switch (view.engine.state) {
    case 'running':
      return {
        tone: 'info',
        pulse: true,
        title: t('settings.sync.state.syncing'),
        desc: t('settings.sync.hero.syncingDesc'),
      };
    case 'needs-reauth':
      return {
        tone: 'warn',
        pulse: false,
        title: t('settings.sync.state.signInNeeded'),
        desc: t('settings.sync.state.signInNeededDesc'),
      };
    case 'offline':
      return {
        tone: 'neutral',
        pulse: false,
        title: t('settings.sync.state.offline'),
        desc: t('settings.sync.state.offlineDesc'),
      };
    case 'storage-full':
      return {
        tone: 'warn',
        pulse: false,
        title: t('settings.sync.state.storageFull'),
        desc: t('settings.sync.state.storageFullDesc'),
      };
    case 'backoff':
      return {
        tone: 'warn',
        pulse: false,
        title: t('settings.sync.state.retrying'),
        desc: t('settings.sync.state.retryingDesc'),
      };
    case 'idle':
    default:
      return {
        tone: 'ok',
        pulse: false,
        title: t('settings.sync.state.protected'),
        desc: t('settings.sync.hero.protectedDesc'),
      };
  }
}

type ScopeLabeler = (scope: string) => string;

function scopeLabel(
  scope: string,
  profiles: readonly LanguageProfile[],
): string {
  if (scope === 'global') return t('settings.sync.scope.global');
  if (scope.startsWith('profile:')) {
    const target = scope.slice('profile:'.length);
    return profiles.find((p) => p.target === target)?.name ?? target;
  }
  return scope;
}

function dataClassLabel(dataClass: DataClass): string {
  return t(`settings.sync.dataClass.${dataClass}`);
}

function progressText(
  view: SyncStatusView,
  labelScope: ScopeLabeler,
): string | null {
  const progress = view.engine.progress;
  if (progress === undefined) return null;
  const scopeSuffix =
    progress.scope !== undefined ? ` — ${labelScope(progress.scope)}` : '';
  if (progress.phase === 'push' && progress.pending > 0) {
    return (
      t('settings.sync.progress.push', [progress.done, progress.pending]) +
      scopeSuffix
    );
  }
  return (
    t(`settings.sync.progress.${progress.phase}`, [
      progress.scopesDone,
      progress.scopesTotal,
    ]) + scopeSuffix
  );
}

function RunRow({
  run,
  labelScope,
}: {
  readonly run: SyncRunRecord;
  readonly labelScope: ScopeLabeler;
}): React.JSX.Element {
  const lines: string[] = [];
  if (run.pushed.length > 0)
    lines.push(
      t('settings.sync.run.uploaded', [
        run.pushed.map(labelScope).join(', '),
      ]),
    );
  if (run.pulled.length > 0)
    lines.push(
      t('settings.sync.run.downloaded', [
        run.pulled.map(labelScope).join(', '),
      ]),
    );
  if (run.appliedDataClasses.length > 0)
    lines.push(
      t('settings.sync.run.applied', [
        run.appliedDataClasses.map(dataClassLabel).join(', '),
      ]),
    );
  for (const error of run.errors) lines.push(error);
  return (
    <li className={styles.runRow}>
      <span className={styles.runHead}>
        <span className={styles.runTime}>
          {new Date(run.at).toLocaleTimeString(undefined, {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
        <span className={styles.runKind}>{runKindLabel(run.kind)}</span>
        <span className={styles.runItems}>
          {t('settings.sync.run.items', [run.ackedKeys])}
        </span>
        {!run.ok && (
          <Badge variant="secondary" size="sm" className={styles.runFailBadge}>
            {t('settings.sync.run.failed')}
          </Badge>
        )}
      </span>
      {lines.map((line) => (
        <span key={line} className={styles.runLine}>
          {line}
        </span>
      ))}
    </li>
  );
}

type QueueFilter = 'all' | 'waiting' | 'active' | 'done';
type EngineProgressView = NonNullable<SyncStatusView['engine']['progress']>;
type QueueItem = NonNullable<EngineProgressView['items']>[number];

function itemState(item: QueueItem, activeScope: string | undefined): 'done' | 'active' | 'waiting' {
  if (item.done >= item.total) return 'done';
  if (item.scope === activeScope) return 'active';
  return 'waiting';
}

function SyncQueue({
  progress,
  labelScope,
}: {
  readonly progress: EngineProgressView | undefined;
  readonly labelScope: ScopeLabeler;
}): React.JSX.Element | null {
  const [filter, setFilter] = useState<QueueFilter>('all');
  const items = useMemo(() => progress?.items ?? [], [progress]);

  const withState = useMemo(
    () =>
      items.map((item) => ({ item, state: itemState(item, progress?.scope) })),
    [items, progress?.scope],
  );
  const counts = useMemo(
    () => ({
      all: withState.length,
      waiting: withState.filter((e) => e.state === 'waiting').length,
      active: withState.filter((e) => e.state === 'active').length,
      done: withState.filter((e) => e.state === 'done').length,
    }),
    [withState],
  );
  const visible = withState.filter((e) => filter === 'all' || e.state === filter);

  if (withState.length === 0) return null;

  return (
    <div className={styles.queueCard}>
      <div className={styles.queueHead}>
        <Text variant="label" color="secondary">
          {t('settings.sync.queue.title')}
        </Text>
        <div className={styles.queueTabs} role="tablist">
          {(['all', 'waiting', 'active', 'done'] as const).map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={filter === f}
              className={`${styles.queueTab} ${filter === f ? styles.queueTabActive : ''}`}
              onClick={() => setFilter(f)}
            >
              {t(`settings.sync.queue.${f}`)} {counts[f]}
            </button>
          ))}
        </div>
      </div>
      <ul className={styles.queueList}>
        {visible.map(({ item, state }) => (
          <li key={`${item.scope}|${item.dataClass ?? ''}`} className={styles.queueRow}>
            {state === 'active' ? (
              <Spinner size="sm" aria-hidden="true" />
            ) : state === 'done' ? (
              <Icon name="check" className={styles.queueDoneIcon} />
            ) : (
              <span className={styles.queueWaitDot} aria-hidden="true" />
            )}
            <span className={styles.queueName}>
              {labelScope(item.scope)}
              {item.dataClass !== null && (
                <span className={styles.queueKind}> · {dataClassLabel(item.dataClass)}</span>
              )}
              {item.key !== undefined && (
                <span className={styles.queueKey}> · {item.key.split('/').pop()}</span>
              )}
            </span>
            <span className={styles.queueCount}>
              {state === 'done'
                ? t('settings.sync.queue.doneState')
                : `${item.done}/${item.total}`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SyncPanel({ settings }: SyncPanelProps): React.JSX.Element {
  const [view, setView] = useState<SyncStatusView | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [disconnectTarget, setDisconnectTarget] = useState<ConnectionStatusEntry | null>(null);
  const [disconnectLocalMode, setDisconnectLocalMode] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      setView(await getSyncStatus());
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
      toastHost.showToast(t('settings.sync.error.loadTitle'), 'error', {
        actionId: 'sync-load',
      });
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
      try {
        await action();
      } catch (error) {
        toastHost.showToast(
          error instanceof Error ? error.message : String(error),
          'error',
          { actionId: 'sync-action' },
        );
      } finally {
        setBusy(null);
        void refresh();
      }
    },
    [refresh],
  );

  const connectionLabel = useCallback(
    (connectionId: string): string =>
      view?.directory.connections.find((c) => c.connectionId === connectionId)?.displayName ??
      connectionId,
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
        const destination = binding?.destination ?? view.directory.systemConnection ?? 'local';
        return destination === disconnectTarget.connectionId;
      });
  }, [disconnectTarget, view, profiles, bindingFor]);

  const activity = useMemo(
    () => (view !== null ? bucketByDay(view.history, Date.now()) : null),
    [view],
  );

  const labelScope = useCallback<ScopeLabeler>(
    (scope) => scopeLabel(scope, profiles),
    [profiles],
  );

  const willSync = useMemo(() => {
    const names = profiles.map((p) => p.name);
    names.push(t('settings.sync.scope.global'));
    return names.join(', ');
  }, [profiles]);

  const engineState = view?.engine.state;
  const hero = view !== null ? heroFor(view) : null;
  const liveProgress = view !== null ? progressText(view, labelScope) : null;
  const hasConnections = (view?.directory.connections.length ?? 0) > 0;

  const connectPending = busy === 'connect' && (
    <div className={`${styles.connectPending} ${styles.flat}`}>
      <Accordion>
        <Accordion.Item value="connect">
          <Accordion.Trigger>
            <span className={styles.connectingLabel}>
              <Spinner size="sm" aria-hidden="true" />
              {t('settings.sync.connecting')}
            </span>
          </Accordion.Trigger>
          <Accordion.Content>
            <Text variant="supporting" color="secondary">
              {t('settings.sync.connectingDetail')}
            </Text>
            <Text variant="supporting" color="secondary">
              {t('settings.sync.willSync', [willSync])}
            </Text>
          </Accordion.Content>
        </Accordion.Item>
      </Accordion>
    </div>
  );

  const heroAction = (() => {
    if (view === null || hero === null) return null;
    if (engineState === 'needs-reauth') {
      return (
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
      );
    }
    return (
      <Button
        variant={engineState === 'backoff' || engineState === 'storage-full' ? 'primary' : 'secondary'}
        size="sm"
        leadingIcon={<Icon name="repeat" />}
        loading={busy === 'now' || engineState === 'running'}
        disabled={engineState === 'offline'}
        onClick={() => void run('now', () => syncNow())}
      >
        {engineState === 'backoff' || engineState === 'storage-full'
          ? t('settings.sync.error.tryAgain')
          : t('settings.sync.syncNow')}
      </Button>
    );
  })();

  return (
    <VStack className={styles.panel}>
      {view === null && loadFailed && (
        <SettingsRow
          dense
          title={t('settings.sync.error.loadTitle')}
          description={t('settings.sync.error.loadDesc')}
        >
          <Button variant="ghost" size="sm" onClick={() => void refresh()}>
            {t('settings.sync.error.tryAgain')}
          </Button>
        </SettingsRow>
      )}

      {view === null && !loadFailed && (
        <div className={styles.loading} role="status" aria-label={t('settings.sync.loading')}>
          <Spinner size="lg" />
        </div>
      )}

      {view !== null && !hasConnections && (
        <>
          <ol className={styles.steps} aria-label={t('settings.sync.steps.aria')}>
            {(['1', '2', '3'] as const).map((n, i) => (
              <li key={n} className={`${styles.step} ${i === 0 ? styles.stepCurrent : ''}`}>
                <span className={styles.stepNum} aria-hidden="true">
                  {i + 1}
                </span>
                <span className={styles.stepLabel}>{t(`settings.sync.steps.${n}`)}</span>
              </li>
            ))}
          </ol>
          <Text variant="supporting" color="secondary" className={styles.willSync}>
            {t('settings.sync.willSync', [willSync])}
          </Text>
          <EmptyState
            icon={<Icon name="cloud" size="lg" />}
            title={t('settings.sync.empty.title')}
            description={t('settings.sync.empty.desc')}
            action={
              <>
                <Button
                  variant="primary"
                  leadingIcon={<Icon name="link" />}
                  loading={busy === 'connect'}
                  onClick={() => void run('connect', () => connectProviderAccount(GOOGLE_DRIVE))}
                >
                  {t('settings.sync.connect.googleDrive')}
                </Button>
                {connectPending}
              </>
            }
          />
        </>
      )}

      {view !== null && hasConnections && hero !== null && (
        <>
          <div className={`${styles.hero} ${styles[`hero-${hero.tone}`]}`} role="status">
            <StatusDot
              status={
                hero.tone === 'ok'
                  ? 'success'
                  : hero.tone === 'warn'
                    ? 'warning'
                    : hero.tone === 'error'
                      ? 'error'
                      : hero.tone === 'info'
                        ? 'info'
                        : 'neutral'
              }
              pulse={hero.pulse}
              aria-label={hero.title}
              className={styles.heroDot}
            />
            <div className={styles.heroText}>
              <span className={styles.heroTitle}>{hero.title}</span>
              <span className={styles.heroDesc}>
                {liveProgress ?? hero.desc}
                {view.directory.lastAppliedAt !== null && engineState === 'idle' && (
                  <>
                    {' · '}
                    {t('settings.sync.lastSynced')}{' '}
                    <Timestamp value={view.directory.lastAppliedAt} />
                  </>
                )}
              </span>
              {liveProgress !== null &&
                (() => {
                  const progress = view.engine.progress!;
                  const total = Math.max(
                    progress.phase === 'push' ? progress.pending : progress.scopesTotal,
                    1,
                  );
                  const done =
                    progress.phase === 'push' ? progress.done : progress.scopesDone;
                  return (
                    <span className={styles.progress} aria-hidden="true">
                      <span
                        className={styles.progressFill}
                        style={{ width: `${Math.min((done / total) * 100, 100)}%` }}
                      />
                    </span>
                  );
                })()}
            </div>
            <div className={styles.heroAction}>{heroAction}</div>
          </div>

          <SyncQueue
            progress={view.engine.progress}
            labelScope={labelScope}
          />

          {activity !== null && activity.buckets.some((b) => b.runs.length > 0) && (
            <div className={styles.chartCard}>
              <div className={styles.chartHead}>
                <Text variant="label" color="secondary">
                  {t('settings.sync.activity.title')}
                </Text>
                <Text variant="supporting" color="secondary">
                  {t('settings.sync.activity.summary', [
                    activity.totalItems,
                    activity.totalErrors,
                  ])}
                </Text>
              </div>
              <Bars
                label={t('settings.sync.activity.aria', [activity.totalItems])}
                selectedIndex={selectedDay ?? undefined}
                onSelect={(i) => setSelectedDay((prev) => (prev === i ? null : i))}
                points={activity.buckets.map((b) => ({
                  value: b.items,
                  label: `${new Date(b.dayStart).toLocaleDateString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })} — ${t('settings.sync.activity.dayLabel', [b.items, b.errors])}`,
                }))}
              />
              {selectedDay !== null && activity.buckets[selectedDay] !== undefined && (
                <ul className={styles.runList} aria-label={t('settings.sync.activity.dayAria')}>
                  {activity.buckets[selectedDay]!.runs.length === 0 ? (
                    <li className={styles.runLine}>
                      {t('settings.sync.activity.emptyDay')}
                    </li>
                  ) : (
                    activity.buckets[selectedDay]!.runs.map((r) => (
                      <RunRow key={r.id} run={r} labelScope={labelScope} />
                    ))
                  )}
                </ul>
              )}
            </div>
          )}

          <SettingsGroup
            label={t('settings.sync.accounts.title')}
            action={
              <Button
                variant="link"
                size="sm"
                className={styles.groupAction}
                loading={busy === 'connect'}
                onClick={() => void run('connect', () => connectProviderAccount(GOOGLE_DRIVE))}
              >
                <Icon name="plus" size="xs" /> {t('settings.sync.connectAnother')}
              </Button>
            }
          >
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
            {connectPending}
          </SettingsGroup>

          <div className={styles.flat}>
            <Accordion>
              <Accordion.Item value="advanced">
                <Accordion.Trigger>
                  <span className={styles.advTrigger}>
                    {t('settings.sync.advanced.title')}
                    <Text as="span" variant="supporting" color="secondary">
                      {t('settings.sync.advanced.desc')}
                    </Text>
                  </span>
                </Accordion.Trigger>
                <Accordion.Content>
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
                                    {t('settings.sync.waitingFor', [connectionLabel(waitingConn)])}
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
                </Accordion.Content>
              </Accordion.Item>
            </Accordion>
          </div>
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
                void run('disconnect', request).then(() => setDisconnectTarget(null));
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
