import type React from 'react';
import { Select } from '@/shared/ui';
import type { DictionaryPopupSettings } from '@/entities/settings/types';
import { TRIGGER_OPTIONS, TAB_OPTIONS, SRS_OPTIONS } from './mockData';
import styles from './mockup.module.css';

interface ConceptCProps {
  settings: DictionaryPopupSettings;
  update: (partial: Partial<DictionaryPopupSettings>) => void;
}

export function ConceptC({ settings, update }: ConceptCProps): React.JSX.Element {
  const steps = [
    { num: 1, label: 'Open a word', id: 'c-open', value: settings.triggerMode, options: TRIGGER_OPTIONS, onChange: (value: string) => ({ triggerMode: value as DictionaryPopupSettings['triggerMode'] }) },
    { num: 2, label: 'Show first', id: 'c-show', value: settings.defaultActiveTab ?? '', options: TAB_OPTIONS, onChange: (value: string) => ({ defaultActiveTab: (value || null) as DictionaryPopupSettings['defaultActiveTab'] }) },
    { num: 3, label: 'Save words to', id: 'c-save', value: settings.srsDestination, options: SRS_OPTIONS, onChange: (value: string) => ({ srsDestination: value as DictionaryPopupSettings['srsDestination'] }) },
  ];

  return (
    <div className={styles.conceptFrame}>
      {steps.map((step) => (
        <div key={step.id} className={styles.conceptTimelineRow}>
          <div className={styles.conceptTimelineNum}>{step.num}</div>
          <div className={styles.conceptTimelineBody}>
            <label htmlFor={step.id} className={styles.conceptTimelineLabel}>
              {step.label}
            </label>
            <Select
              id={step.id}
              value={step.value}
              options={step.options}
              onChange={(value) => update(step.onChange(value))}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
