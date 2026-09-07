import type React from 'react';
import { Card, Select, Text } from '@/shared/ui';
import type { DictionaryPopupSettings } from '@/entities/settings/types';
import { TRIGGER_OPTIONS, TAB_OPTIONS, SRS_OPTIONS } from './mockData';
import styles from './mockup.module.css';

interface ConceptC3Props {
  settings: DictionaryPopupSettings;
  update: (partial: Partial<DictionaryPopupSettings>) => void;
}

const STEPS = [
  { num: 1, label: 'Open a word', id: 'c3-open', valueKey: 'triggerMode', options: TRIGGER_OPTIONS },
  { num: 2, label: 'Show first', id: 'c3-show', valueKey: 'defaultActiveTab', options: TAB_OPTIONS },
  { num: 3, label: 'Save words to', id: 'c3-save', valueKey: 'srsDestination', options: SRS_OPTIONS },
] as const;

export function ConceptC3({ settings, update }: ConceptC3Props): React.JSX.Element {
  return (
    <div className={styles.conceptFrame}>
      <div className={styles.conceptStepCards}>
        {STEPS.map((step) => {
          const value = step.valueKey === 'defaultActiveTab' ? (settings.defaultActiveTab ?? '') : settings[step.valueKey];
          return (
            <Card key={step.id} className={styles.conceptStepCard}>
              <div className={styles.conceptStepHeader}>
                <span className={styles.conceptStepNum}>{step.num}</span>
                <Text as="span" className={styles.conceptStepTitle}>{step.label}</Text>
              </div>
              <Select
                id={step.id}
                value={value}
                options={step.options}
                onChange={(next) => {
                  if (step.valueKey === 'defaultActiveTab') {
                    update({ defaultActiveTab: (next || null) as DictionaryPopupSettings['defaultActiveTab'] });
                  } else {
                    update({ [step.valueKey]: next as string } as Partial<DictionaryPopupSettings>);
                  }
                }}
              />
            </Card>
          );
        })}
      </div>
    </div>
  );
}
