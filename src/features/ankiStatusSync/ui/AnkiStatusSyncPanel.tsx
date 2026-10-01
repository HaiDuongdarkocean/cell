import { useCallback, useEffect, useState } from 'react';
import { t } from '@/shared/i18n';
import type { Settings } from '@/entities/settings';
import type { AnkiStatusSyncState } from '@/entities/ankiStatusSync';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';
import { HintIcon } from '@/shared/ui/HintIcon';
import { InputField } from '@/shared/ui/InputField';
import { SectionHeader } from '@/shared/ui/SectionHeader';
import { SettingsRow } from '@/shared/ui/SettingsRow';
import { StatusDot } from '@/shared/ui/StatusDot';
import { Text } from '@/shared/ui/Text';
import { Timestamp } from '@/shared/ui/Timestamp';
import { Toggle } from '@/shared/ui/Toggle';
import { DEFAULT_ANKI_STATUS_SYNC_SETTINGS } from '@/shared/config/config';
import { getAnkiSyncState, runAnkiSyncNow } from './ankiStatusSyncClient';
import styles from './AnkiStatusSyncPanel.module.css';

export interface AnkiStatusSyncPanelProps {
  readonly settings: Settings;
  readonly onChange: (settings: Settings) => void;
}

export function AnkiStatusSyncPanel({
  settings,
  onChange,
}: AnkiStatusSyncPanelProps): React.JSX.Element {
  const cfg = settings.ankiStatusSync ?? DEFAULT_ANKI_STATUS_SYNC_SETTINGS;
  const [state, setState] = useState<AnkiStatusSyncState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      setState(await getAnkiSyncState());
    } catch {
      setState(null);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const update = useCallback(
    (patch: Partial<typeof cfg>): void => {
      onChange({ ...settings, ankiStatusSync: { ...cfg, ...patch } });
    },
    [cfg, settings, onChange],
  );

  const syncNow = useCallback(async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      setState(await runAnkiSyncNow());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, []);

  const addonLabel =
    state?.addonOnline === true
      ? t('settings.ankiSync.addon.connected')
      : state?.addonOnline === false
        ? t('settings.ankiSync.addon.absent')
        : t('settings.ankiSync.addon.unknown');

  return (
    <section className={styles.root} aria-label={t('settings.ankiSync.title')}>
      <SectionHeader
        title={t('settings.ankiSync.title')}
        subtitle={t('settings.ankiSync.desc')}
        data-cell-id="anki-status-sync"
      />
      <SettingsRow dense>
        <span className={styles.rowLabel}>
          {t('settings.ankiSync.enabled')}
          <HintIcon
            hint={t('settings.ankiSync.enabled.hint')}
            ariaLabel={t('settings.hint.aria', [t('settings.ankiSync.enabled')])}
          />
        </span>
        <Toggle
          checked={cfg.enabled}
          onChange={(next) => update({ enabled: next })}
          ariaLabel={t('settings.ankiSync.enabled')}
        />
      </SettingsRow>
      <SettingsRow dense>
        <span className={styles.rowLabel}>
          {t('settings.ankiSync.writeBack')}
          <HintIcon
            hint={t('settings.ankiSync.writeBack.hint')}
            ariaLabel={t('settings.hint.aria', [t('settings.ankiSync.writeBack')])}
          />
        </span>
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
      <SettingsRow dense>
        <span className={styles.rowLabel}>
          <StatusDot
            status={state?.addonOnline === true ? 'success' : 'neutral'}
            aria-label={addonLabel}
          />
          {t('settings.ankiSync.addon.label')}
        </span>
        <Text as="span" variant="supporting" color="secondary">
          {addonLabel}
        </Text>
      </SettingsRow>
      {state?.addonOnline === false && (
        <Text as="p" variant="supporting" color="secondary" className={styles.fallback}>
          {t('settings.ankiSync.addon.fallback')}
        </Text>
      )}
      {state?.writeBackUnsupportedNotified && (
        <Alert variant="warning">{t('settings.ankiSync.writeBack.unsupported')}</Alert>
      )}
      {state !== null && state.consecutiveFailures >= 3 && (
        <Alert variant="warning">{t('settings.ankiSync.failing')}</Alert>
      )}
      <SettingsRow dense>
        <span className={styles.rowLabel}>
          {state?.lastSyncAt ? (
            <>
              <Timestamp value={state.lastSyncAt} />{' '}
              {t('settings.ankiSync.lastSummary', [state.changed, state.errors])}
            </>
          ) : (
            t('settings.ankiSync.never')
          )}
        </span>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void syncNow()}
          disabled={!cfg.enabled || busy}
          loading={busy}
        >
          {t('settings.ankiSync.syncNow')}
        </Button>
      </SettingsRow>
      {error !== null && <Alert variant="error">{error}</Alert>}
    </section>
  );
}
