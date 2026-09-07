import type React from 'react';
import { Button, Select, Text } from '@/shared/ui';
import type { DictionaryPopupSettings } from '@/entities/settings/types';
import { TRIGGER_OPTIONS, TAB_OPTIONS, SRS_OPTIONS } from './mockData';
import styles from './mockup.module.css';

interface ConceptBProps {
  settings: DictionaryPopupSettings;
  update: (partial: Partial<DictionaryPopupSettings>) => void;
}

export function ConceptB({ settings, update }: ConceptBProps): React.JSX.Element {
  return (
    <div className={styles.conceptFrame}>
      <div className={styles.conceptSection}>
        <Text as="p" color="secondary" className={styles.conceptHint}>
          How do you open a word?
        </Text>
        <div className={styles.conceptSeg} role="group" aria-label="Open with">
          {TRIGGER_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              type="button"
              size="sm"
              shape="pill"
              variant={settings.triggerMode === opt.value ? 'primary' : 'secondary'}
              onClick={() => update({ triggerMode: opt.value as DictionaryPopupSettings['triggerMode'] })}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      <div className={styles.conceptSection}>
        <Text as="p" color="secondary" className={styles.conceptHint}>
          What do you see first?
        </Text>
        <Select
          value={settings.defaultActiveTab ?? ''}
          options={TAB_OPTIONS}
          onChange={(value) => update({ defaultActiveTab: (value || null) as DictionaryPopupSettings['defaultActiveTab'] })}
        />
      </div>

      <div className={styles.conceptSection}>
        <Text as="p" color="secondary" className={styles.conceptHint}>
          Where do saved words go?
        </Text>
        <Select
          value={settings.srsDestination}
          options={SRS_OPTIONS}
          onChange={(value) => update({ srsDestination: value as DictionaryPopupSettings['srsDestination'] })}
        />
      </div>
    </div>
  );
}
