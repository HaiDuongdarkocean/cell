import { useCallback, useEffect, useMemo, useState } from 'react';
import { t } from '@/shared/i18n';
import type { Settings } from '@/entities/settings';
import type { AnkiRunEntry, AnkiStatusSyncView } from '@/entities/ankiStatusSync';
import { Accordion } from '@/shared/ui/Accordion';
import { Button } from '@/shared/ui/Button';
import { Donut, Sparkline } from '@/shared/ui/Charts';
import { Icon } from '@/shared/ui/Icon';
import { InputField } from '@/shared/ui/InputField';
import { SettingsRow } from '@/shared/ui/SettingsRow';
import { Spinner } from '@/shared/ui/Spinner';
import { StatusDot } from '@/shared/ui/StatusDot';
import { Text } from '@/shared/ui/Text';
import { Timestamp } from '@/shared/ui/Timestamp';
import { Toggle } from '@/shared/ui/Toggle';
import { createToastHost } from '@/shared/ui/mountToast';
import { ShadowThemeProvider } from '@/features/theme';
import { DEFAULT_ANKI_STATUS_SYNC_SETTINGS } from '@/shared/config/config';
import { getAnkiSyncState, runAnkiSyncNow } from './ankiStatusSyncClient';
import styles from './AnkiStatusSyncPanel.module.css';

const toastHost = createToastHost({ provider: ShadowThemeProvider });
const POLL_MS = 3000;

export interface AnkiStatusSyncPanelProps {
  readonly settings: Settings;
  readonly onChange: (settings: Settings) => void;
}

type HeroTone = 'ok' | 'info' | 'warn' | 'error' | 'neutral';

interface HeroMeta {
  readonly tone: HeroTone;
  readonly pulse: boolean;
  readonly title: string;
  readonly desc: string;
}

function heroFor(
  enabled: boolean,
  view: AnkiStatusSyncView | null,
): HeroMeta {
  if (!enabled) {
    return {
      tone: 'neutral',
      pulse: false,
      title: t('settings.ankiSync.hero.offTitle'),
      desc: t('settings.ankiSync.hero.offDesc'),
    };
  }
  if (view === null || view.lastSyncAt === null) {
    return {
      tone: 'info',
      pulse: false,
      title: t('settings.ankiSync.hero.neverTitle'),
      desc: t('settings.ankiSync.hero.neverDesc'),
    };
  }
  if (view.running) {
    return {
      tone: 'info',
      pulse: true,
      title: t('settings.ankiSync.hero.runningTitle'),
      desc: t('settings.ankiSync.hero.runningDesc'),
    };
  }
  if (view.consecutiveFailures >= 3 || view.errors > 0) {
    return {
      tone: 'error',
      pulse: false,
      title: t('settings.ankiSync.hero.errorTitle'),
      desc: t('settings.ankiSync.failing'),
    };
  }
  return {
    tone: 'ok',
    pulse: false,
    title: t('settings.ankiSync.hero.okTitle'),
    desc: t('settings.ankiSync.hero.okDesc', [view.changed, view.errors]),
  };
}

function dotStatus(tone: HeroTone): 'success' | 'warning' | 'error' | 'info' | 'neutral' {
  switch (tone) {
    case 'ok':
      return 'success';
    case 'warn':
      return 'warning';
    case 'error':
      return 'error';
    case 'info':
      return 'info';
    default:
      return 'neutral';
  }
}

function RunRow({ run }: { readonly run: AnkiRunEntry }): React.JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <li className={styles.runItem}>
      <button
        type="button"
        className={styles.runHead}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className={styles.runTime}>
          {new Date(run.at).toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
        <span className={styles.runSummary}>
          {t('settings.ankiSync.run.summary', [run.changed, run.errors])}
        </span>
        {run.errors > 0 && (
          <Icon name="alertCircle" size="xs" className={styles.runErrorIcon} />
        )}
        <Icon name="chevronDown" size="xs" className={styles.runChevron} />
      </button>
      {open && (
        <div className={styles.runDetail}>
          <span className={styles.runLine}>
            {t('settings.ankiSync.run.detail', [
              run.trigger,
              run.cardsSeen,
              run.writeBacksFlushed,
            ])}
          </span>
          <span className={styles.runLine}>
            {run.addonOnline
              ? t('settings.ankiSync.addon.connected')
              : t('settings.ankiSync.addon.absent')}
            {run.langCode !== null ? ` · ${run.langCode}` : ''}
          </span>
        </div>
      )}
    </li>
  );
}

export function AnkiStatusSyncPanel({
  settings,
  onChange,
}: AnkiStatusSyncPanelProps): React.JSX.Element {
  const cfg = settings.ankiStatusSync ?? DEFAULT_ANKI_STATUS_SYNC_SETTINGS;
  const [view, setView] = useState<AnkiStatusSyncView | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      setView(await getAnkiSyncState());
    } catch {
      setView(null);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const running = view?.running === true || busy;
  useEffect(() => {
    if (!running) return undefined;
    const id = window.setInterval(() => void refresh(), POLL_MS);
    return () => window.clearInterval(id);
  }, [running, refresh]);

  const update = useCallback(
    (patch: Partial<typeof cfg>): void => {
      onChange({ ...settings, ankiStatusSync: { ...cfg, ...patch } });
    },
    [cfg, settings, onChange],
  );

  const syncNow = useCallback(async (): Promise<void> => {
    setBusy(true);
    try {
      setView(await runAnkiSyncNow());
    } catch (err) {
      toastHost.showToast(err instanceof Error ? err.message : String(err), 'error', {
        actionId: 'anki-sync-now',
      });
    } finally {
      setBusy(false);
    }
  }, []);

  const hero = heroFor(cfg.enabled, view);

  const stats = useMemo(() => {
    if (view === null || view.lastSyncAt === null) return null;
    const unchanged = Math.max(view.cardsSeen - view.changed - view.errors, 0);
    const changes = [...view.history]
      .sort((a, b) => a.at - b.at)
      .map((r) => r.changed);
    const errors = [...view.history]
      .sort((a, b) => a.at - b.at)
      .map((r) => r.errors);
    return { unchanged, changes, errors };
  }, [view]);

  const addonLabel =
    view?.addonOnline === true
      ? t('settings.ankiSync.addon.connected')
      : view?.addonOnline === false
        ? t('settings.ankiSync.addon.absent')
        : t('settings.ankiSync.addon.unknown');

  const heroAction = (() => {
    if (!cfg.enabled) {
      return (
        <Button
          variant="primary"
          size="sm"
          leadingIcon={<Icon name="power" />}
          onClick={() => update({ enabled: true })}
        >
          {t('settings.ankiSync.action.turnOn')}
        </Button>
      );
    }
    return (
      <Button
        variant={hero.tone === 'error' ? 'primary' : 'secondary'}
        size="sm"
        leadingIcon={running ? undefined : <Icon name="repeat" />}
        loading={running}
        onClick={() => void syncNow()}
      >
        {hero.tone === 'error'
          ? t('settings.sync.error.tryAgain')
          : t('settings.ankiSync.syncNow')}
      </Button>
    );
  })();

  return (
    <div className={styles.root}>
      <div className={`${styles.hero} ${styles[`hero-${hero.tone}`]}`} role="status">
        <StatusDot
          status={dotStatus(hero.tone)}
          pulse={hero.pulse}
          aria-label={hero.title}
          className={styles.heroDot}
        />
        <div className={styles.heroText}>
          <span className={styles.heroTitle}>{hero.title}</span>
          <span className={styles.heroDesc}>
            {hero.desc}
            {view?.lastSyncAt != null && hero.tone === 'ok' && (
              <>
                {' · '}
                <Timestamp value={view.lastSyncAt} />
              </>
            )}
          </span>
        </div>
        <div className={styles.heroAction}>{heroAction}</div>
      </div>

      {cfg.enabled && (
        <div className={styles.bridgeRow}>
          <StatusDot
            size="sm"
            status={
              view?.addonOnline === true
                ? 'success'
                : view?.addonOnline === false
                  ? 'warning'
                  : 'neutral'
            }
            aria-label={addonLabel}
          />
          <Text variant="supporting" color="secondary" as="span">
            {t('settings.ankiSync.addon.label')} — {addonLabel}
            {view?.addonOnline === false
              ? ` ${t('settings.ankiSync.bridge.polling')}`
              : ''}
          </Text>
          {view !== null && view.pendingWriteBacks > 0 && (
            <Text variant="supporting" color="secondary" as="span">
              {t('settings.ankiSync.queue.pending', [view.pendingWriteBacks])}
            </Text>
          )}
        </div>
      )}

      {cfg.enabled && stats !== null && view !== null && (
        <div className={styles.chartCard}>
          <div className={styles.chartHead}>
            <Text variant="label" color="secondary">
              {t('settings.ankiSync.stats.title')}
            </Text>
            <Text variant="supporting" color="secondary">
              {t('settings.ankiSync.stats.lastRun', [
                view.cardsSeen,
                view.changed,
                view.errors,
              ])}
            </Text>
          </div>
          <div className={styles.statGrid}>
            <div className={styles.statCell}>
              <Donut
                caption={t('settings.ankiSync.stats.cardsCaption')}
                center={view.cardsSeen.toLocaleString('en')}
                segments={[
                  {
                    value: view.changed,
                    tone: 'primary',
                    label: t('settings.ankiSync.legend.updated'),
                  },
                  {
                    value: view.errors,
                    tone: 'error',
                    label: t('settings.ankiSync.legend.errors'),
                  },
                  {
                    value: stats.unchanged,
                    tone: 'muted',
                    label: t('settings.ankiSync.legend.unchanged'),
                  },
                ]}
              />
              <div className={styles.legend}>
                <span className={styles.legendItem}>
                  <i className={`${styles.legendKey} ${styles.legendPrimary}`} />
                  {t('settings.ankiSync.legend.updatedN', [view.changed])}
                </span>
                <span className={styles.legendItem}>
                  <i className={`${styles.legendKey} ${styles.legendError}`} />
                  {t('settings.ankiSync.legend.errorsN', [view.errors])}
                </span>
                <span className={styles.legendItem}>
                  <i className={`${styles.legendKey} ${styles.legendMuted}`} />
                  {t('settings.ankiSync.legend.unchangedN', [stats.unchanged])}
                </span>
              </div>
            </div>
            {stats.changes.length > 1 && (
              <div className={styles.statCell}>
                <Text variant="supporting" color="secondary">
                  {t('settings.ankiSync.chart.perRun')}
                </Text>
                <Sparkline
                  values={stats.changes}
                  label={t('settings.ankiSync.chart.perRunAria')}
                />
                {stats.errors.some((e) => e > 0) && (
                  <Sparkline
                    values={stats.errors}
                    tone="error"
                    label={t('settings.ankiSync.chart.errorsAria')}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {cfg.enabled && view !== null && view.history.length > 0 && (
        <div className={styles.runsCard}>
          <Text variant="label" color="secondary">
            {t('settings.ankiSync.runs.title')}
          </Text>
          <ul className={styles.runList}>
            {view.history.slice(0, 5).map((run, i) => (
              <RunRow key={`${run.at}-${i}`} run={run} />
            ))}
          </ul>
        </div>
      )}

      {cfg.enabled && view !== null && view.writeBackQueue.length > 0 && (
        <div className={styles.runsCard}>
          <Text variant="label" color="secondary">
            {t('settings.ankiSync.queue.title', [view.pendingWriteBacks])}
          </Text>
          <ul className={styles.runList}>
            {view.writeBackQueue.slice(0, 8).map((task) => (
              <li key={task.cardId} className={styles.runLine}>
                {task.term}
                {task.attempts > 0
                  ? ` · ${t('settings.ankiSync.queue.attempts', [task.attempts])}`
                  : ''}
              </li>
            ))}
          </ul>
        </div>
      )}

      {cfg.enabled && view !== null && view.writeBackLog.length > 0 && (
        <div className={styles.runsCard}>
          <Text variant="label" color="secondary">
            {t('settings.ankiSync.log.title')}
          </Text>
          <ul className={styles.runList}>
            {view.writeBackLog.slice(0, 8).map((entry) => (
              <li key={`${entry.at}-${entry.cardId}`} className={styles.runLine}>
                <span className={entry.ok ? undefined : styles.statusWarn}>
                  {entry.term} — {entry.ok ? '✓' : '✗'} {entry.reason}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {cfg.enabled && view === null && (
        <div className={styles.chartCard}>
          <Spinner size="md" />
        </div>
      )}

      <div className={styles.flat}>
        <Accordion>
          <Accordion.Item value="advanced">
            <Accordion.Trigger>
              <span className={styles.advTrigger}>
                {t('settings.ankiSync.advanced.title')}
                <Text as="span" variant="supporting" color="secondary">
                  {cfg.enabled
                    ? t('settings.ankiSync.advanced.onDesc', [cfg.addonPort])
                    : t('settings.ankiSync.advanced.offDesc')}
                </Text>
              </span>
            </Accordion.Trigger>
            <Accordion.Content>
              <SettingsRow
                dense
                title={t('settings.ankiSync.enabled')}
                description={t('settings.ankiSync.enabled.hint')}
                data-tihoka-id="anki-status-sync"
              >
                <Toggle
                  checked={cfg.enabled}
                  onChange={(next) => update({ enabled: next })}
                  ariaLabel={t('settings.ankiSync.enabled')}
                />
              </SettingsRow>
              <SettingsRow
                dense
                title={t('settings.ankiSync.writeBack')}
                description={t('settings.ankiSync.writeBack.hint')}
              >
                <Toggle
                  checked={cfg.writeBackEnabled}
                  disabled={!cfg.enabled}
                  onChange={(next) => update({ writeBackEnabled: next })}
                  ariaLabel={t('settings.ankiSync.writeBack')}
                />
              </SettingsRow>
              <SettingsRow dense stacked className={styles.portRow}>
                <InputField
                  label={t('settings.ankiSync.addonPort')}
                  type="number"
                  min={1}
                  max={65535}
                  inputMode="numeric"
                  value={String(cfg.addonPort)}
                  disabled={!cfg.enabled}
                  helperText={t('settings.ankiSync.addonPort.hint')}
                  onChange={(e) => {
                    const port = Number(e.target.value);
                    if (Number.isInteger(port) && port >= 1 && port <= 65535) {
                      update({ addonPort: port });
                    }
                  }}
                />
              </SettingsRow>
              {view?.addonOnline === false && (
                <Text
                  as="p"
                  variant="supporting"
                  color="secondary"
                  className={styles.fallback}
                >
                  {t('settings.ankiSync.addon.fallback')}
                </Text>
              )}
              {view?.writeBackUnsupportedNotified === true && (
                <Text as="p" variant="supporting" className={styles.statusWarn}>
                  {t('settings.ankiSync.writeBack.unsupported')}
                </Text>
              )}
            </Accordion.Content>
          </Accordion.Item>
        </Accordion>
      </div>
    </div>
  );
}
