// FrequencyBandsEditor — rank thresholds for the "Độ phổ biến" highlight bands.
//
// Controlled when `value`/`onChange` are provided (SettingsDialogContent wires
// it through settings + onChange). Standalone hosts can render it bare — it
// self-loads via loadSettings and persists via saveSettings.

import { useEffect, useState, type ReactElement } from 'react';
import { Button, Input } from '@/shared/ui';
import { loadSettings, saveSettings } from '@/shared/lib/storage/settingsStore';
import { DEFAULT_FREQUENCY_BANDS } from '@/shared/config/config';
import type { FrequencyBandThresholds } from '@/shared/lib/frequencyBand';
import styles from './FrequencyBandsEditor.module.css';

interface FrequencyBandsEditorProps {
  readonly value?: FrequencyBandThresholds;
  readonly onChange?: (bands: FrequencyBandThresholds) => void;
}

const FIELDS: readonly { key: keyof FrequencyBandThresholds; label: string; hint: string }[] = [
  { key: 'core', label: 'Phổ biến', hint: 'từ dùng hằng ngày' },
  { key: 'common', label: 'Thường gặp', hint: 'hay gặp trong sách và phim' },
  { key: 'general', label: 'Chung', hint: 'vốn từ của người lớn' },
  { key: 'advanced', label: 'Nâng cao', hint: 'từ học thuật, ít gặp' },
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
        <span className={styles.bandsTitle}>Ngưỡng độ phổ biến</span>
        <p className={styles.bandsHint}>
          Mỗi từ có một hạng trong danh sách — hạng càng nhỏ từ càng phổ biến.
        </p>
      </div>

      <div className={styles.bandRows}>
        {FIELDS.map(({ key, label, hint }) => (
          <div key={key} className={styles.bandRow}>
            <span className={styles.bandName}>{label}</span>
            <span className={styles.bandDesc}>{hint}</span>
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
                aria-label={`Ngưỡng ${label}`}
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
          Đặt lại mặc định
        </Button>
      )}
    </div>
  );
}
