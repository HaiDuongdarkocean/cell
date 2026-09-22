// FrequencyBandsEditor — rank thresholds for the "Độ phổ biến" highlight bands.
//
// Controlled when `value`/`onChange` are provided (SettingsDialogContent wires
// it through settings + onChange). Standalone hosts can render it bare — it
// self-loads via loadSettings and persists via saveSettings.

import { useEffect, useState, type ReactElement } from 'react';
import { t, type MessageKey } from '@/shared/i18n';
import { Button, Input } from '@/shared/ui';
import { loadSettings, saveSettings } from '@/shared/lib/storage/settingsStore';
import { DEFAULT_FREQUENCY_BANDS } from '@/shared/config/config';
import type { FrequencyBandThresholds } from '@/shared/lib/frequencyBand';
import styles from './FrequencyBandsEditor.module.css';

interface FrequencyBandsEditorProps {
  readonly value?: FrequencyBandThresholds;
  readonly onChange?: (bands: FrequencyBandThresholds) => void;
}

const FIELDS: readonly { key: keyof FrequencyBandThresholds; label: MessageKey; hint: MessageKey }[] = [
  { key: 'core', label: 'resources.bands.core', hint: 'resources.bands.core.hint' },
  { key: 'common', label: 'resources.bands.common', hint: 'resources.bands.common.hint' },
  { key: 'general', label: 'resources.bands.general', hint: 'resources.bands.general.hint' },
  { key: 'advanced', label: 'resources.bands.advanced', hint: 'resources.bands.advanced.hint' },
];

export function FrequencyBandsEditor({ value, onChange }: FrequencyBandsEditorProps): ReactElement {
  const [internal, setInternal] = useState<FrequencyBandThresholds>(DEFAULT_FREQUENCY_BANDS);
  const controlled = value !== undefined || onChange !== undefined;
  const bands = value ?? internal;

  // Standalone mode: hydrate from persisted settings once.
  useEffect(() => {
    if (controlled) return;
    let alive = true;
    void loadSettings()
      .then((s) => {
        if (alive && s.frequencyBands) {
          setInternal({ ...DEFAULT_FREQUENCY_BANDS, ...s.frequencyBands });
        }
      })
      .catch(() => { /* keep defaults */ });
    return () => { alive = false; };
  }, [controlled]);

  const apply = (next: FrequencyBandThresholds): void => {
    if (onChange) {
      onChange(next);
    } else {
      setInternal(next);
      void saveSettings({ frequencyBands: next }).catch(() => { /* keep UI state */ });
    }
  };

  const commit = (key: keyof FrequencyBandThresholds, raw: string): void => {
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 0) return;
    apply({ ...bands, [key]: n });
  };

  const reset = (): void => apply({ ...DEFAULT_FREQUENCY_BANDS });

  const isDefault = FIELDS.every(({ key }) => bands[key] === DEFAULT_FREQUENCY_BANDS[key]);

  return (
    <div className={styles.bands} data-cell-id="frequency-bands-editor">
      <div className={styles.bandsHead}>
        <span className={styles.bandsTitle}>{t('resources.bands.title')}</span>
        <p className={styles.bandsHint}>
          {t('resources.bands.hint')}
        </p>
      </div>

      <div className={styles.bandRows}>
        {FIELDS.map(({ key, label, hint }) => (
          <div key={key} className={styles.bandRow}>
            <span className={styles.bandName}>{t(label)}</span>
            <span className={styles.bandDesc}>{t(hint)}</span>
            <span className={styles.bandInputWrap}>
              <span className={styles.bandPrefix}>top ≤</span>
              <Input
                type="number"
                size="sm"
                className={styles.bandInput}
                min={0}
                step={100}
                value={bands[key]}
                onChange={(e) => commit(key, e.target.value)}
                aria-label={t('resources.bands.aria', [t(label)])}
                data-cell-id={`band-input-${key}`}
              />
            </span>
          </div>
        ))}
      </div>

      {!isDefault && (
        <Button
          variant="ghost"
          size="sm"
          onClick={reset}
          data-cell-id="bands-reset"
        >
          {t('resources.bands.reset')}
        </Button>
      )}
    </div>
  );
}
