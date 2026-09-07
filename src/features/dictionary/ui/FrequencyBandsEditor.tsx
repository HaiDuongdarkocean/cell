// FrequencyBandsEditor — rank thresholds for the "Độ phổ biến" highlight bands.
//
// Controlled when `value`/`onChange` are provided (SettingsDialogContent wires
// it through settings + onChange). Standalone hosts can render it bare — it
// self-loads via loadSettings and persists via saveSettings.

import { useEffect, useState, type ReactElement } from 'react';
import { Input, Label } from '@/shared/ui';
import { loadSettings, saveSettings } from '@/shared/lib/storage/settingsStore';
import { DEFAULT_FREQUENCY_BANDS } from '@/shared/config/config';
import type { FrequencyBandThresholds } from '@/shared/lib/frequencyBand';
import styles from './FrequencyBandsEditor.module.css';

interface FrequencyBandsEditorProps {
  readonly value?: FrequencyBandThresholds;
  readonly onChange?: (bands: FrequencyBandThresholds) => void;
}

const FIELDS: readonly { key: keyof FrequencyBandThresholds; label: string }[] = [
  { key: 'core', label: 'Phổ biến ≤' },
  { key: 'common', label: 'Thường gặp ≤' },
  { key: 'general', label: 'Chung ≤' },
  { key: 'advanced', label: 'Nâng cao ≤' },
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

  const commit = (key: keyof FrequencyBandThresholds, raw: string): void => {
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 0) return;
    const next: FrequencyBandThresholds = { ...bands, [key]: n };
    if (onChange) {
      onChange(next);
    } else {
      setInternal(next);
      void saveSettings({ frequencyBands: next }).catch(() => { /* keep UI state */ });
    }
  };

  return (
    <div className={styles.bands} data-cell-id="frequency-bands-editor">
      {FIELDS.map(({ key, label }) => (
        <Label key={key} className={styles.bandField}>
          <span className={styles.bandLabel}>{label}</span>
          <Input
            type="number"
            size="sm"
            className={styles.bandInput}
            min={0}
            step={100}
            value={bands[key]}
            onChange={(e) => commit(key, e.target.value)}
            data-cell-id={`band-input-${key}`}
          />
        </Label>
      ))}
    </div>
  );
}
