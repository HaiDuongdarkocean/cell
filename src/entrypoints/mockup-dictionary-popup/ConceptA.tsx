import type React from 'react';
import { Select, SettingsRow } from '@/shared/ui';
import type { DictionaryPopupSettings } from '@/entities/settings/types';
import { TRIGGER_OPTIONS, TAB_OPTIONS, SRS_OPTIONS } from './mockData';
import styles from './mockup.module.css';

interface ConceptAProps {
  settings: DictionaryPopupSettings;
  update: (partial: Partial<DictionaryPopupSettings>) => void;
}

export function ConceptA({ settings, update }: ConceptAProps): React.JSX.Element {
  return (
    <div className={styles.conceptFrame}>
      <SettingsRow>
        <label className={styles.conceptLabel} htmlFor="a-open-with">Open with</label>
        <Select
          id="a-open-with"
          value={settings.triggerMode}
          options={TRIGGER_OPTIONS}
          onChange={(value) => update({ triggerMode: value as DictionaryPopupSettings['triggerMode'] })}
        />
      </SettingsRow>
      <SettingsRow divider>
        <label className={styles.conceptLabel} htmlFor="a-show-first">Show first</label>
        <Select
          id="a-show-first"
          value={settings.defaultActiveTab ?? ''}
          options={TAB_OPTIONS}
          onChange={(value) => update({ defaultActiveTab: (value || null) as DictionaryPopupSettings['defaultActiveTab'] })}
        />
      </SettingsRow>
      <SettingsRow divider>
        <label className={styles.conceptLabel} htmlFor="a-save-to">Save words to</label>
        <Select
          id="a-save-to"
          value={settings.srsDestination}
          options={SRS_OPTIONS}
          onChange={(value) => update({ srsDestination: value as DictionaryPopupSettings['srsDestination'] })}
        />
      </SettingsRow>
    </div>
  );
}
