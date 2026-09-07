import type React from 'react';
import { Button, Select, Text } from '@/shared/ui';
import type { DictionaryPopupSettings } from '@/entities/settings/types';
import { TRIGGER_OPTIONS, TAB_OPTIONS, SRS_OPTIONS } from './mockData';
import styles from './mockup.module.css';

interface ConceptDProps {
  settings: DictionaryPopupSettings;
  update: (partial: Partial<DictionaryPopupSettings>) => void;
  applyPreset: (preset: 'watch' | 'translate' | 'speed' | 'power') => void;
}

const PRESETS = [
  { id: 'watch', label: 'Watch & learn' },
  { id: 'translate', label: 'Translate first' },
  { id: 'speed', label: 'Speed look-up' },
  { id: 'power', label: 'Power Anki' },
] as const;

export function ConceptD({ settings, update, applyPreset }: ConceptDProps): React.JSX.Element {
  return (
    <div className={styles.conceptFrame}>
      <div className={styles.conceptSection}>
        <Text as="p" color="secondary" className={styles.conceptHint}>
          Quick setup — pick one
        </Text>
        <div className={styles.conceptChips}>
          {PRESETS.map((preset) => (
            <Button
              key={preset.id}
              type="button"
              size="sm"
              shape="pill"
              variant="secondary"
              onClick={() => applyPreset(preset.id)}
            >
              {preset.label}
            </Button>
          ))}
        </div>
      </div>

      <div className={styles.conceptSection}>
        <Text as="p" color="secondary" className={styles.conceptHint}>
          Or set manually
        </Text>
        <div className={styles.conceptField}>
          <label className={styles.conceptLabel} htmlFor="d-open-with">Open with</label>
          <Select
            id="d-open-with"
            value={settings.triggerMode}
            options={TRIGGER_OPTIONS}
            onChange={(value) => update({ triggerMode: value as DictionaryPopupSettings['triggerMode'] })}
          />
        </div>
        <div className={styles.conceptField}>
          <label className={styles.conceptLabel} htmlFor="d-show-first">Show first</label>
          <Select
            id="d-show-first"
            value={settings.defaultActiveTab ?? ''}
            options={TAB_OPTIONS}
            onChange={(value) => update({ defaultActiveTab: (value || null) as DictionaryPopupSettings['defaultActiveTab'] })}
          />
        </div>
        <div className={styles.conceptField}>
          <label className={styles.conceptLabel} htmlFor="d-save-to">Save words to</label>
          <Select
            id="d-save-to"
            value={settings.srsDestination}
            options={SRS_OPTIONS}
            onChange={(value) => update({ srsDestination: value as DictionaryPopupSettings['srsDestination'] })}
          />
        </div>
      </div>
    </div>
  );
}
