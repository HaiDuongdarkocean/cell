import type React from 'react';
import type { DictionaryPopupSettings } from '@/entities/settings/types';
import { TRIGGER_OPTIONS, TAB_OPTIONS, SRS_OPTIONS } from './mockData';
import styles from './mockup.module.css';

interface PillGroupProps {
  options: readonly { value: string; label: React.ReactNode }[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
}

function PillGroup({ options, value, onChange, ariaLabel }: PillGroupProps): React.JSX.Element {
  return (
    <div className={styles.pillGroup} role="radiogroup" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          className={`${styles.pill} ${value === option.value ? styles.pillActive : ''}`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

interface ConceptC2Props {
  settings: DictionaryPopupSettings;
  update: (partial: Partial<DictionaryPopupSettings>) => void;
}

const STEPS = [
  { num: 1, label: 'Open a word', id: 'c2-open', valueKey: 'triggerMode', options: TRIGGER_OPTIONS, ariaLabel: 'Open with' },
  { num: 2, label: 'Show first', id: 'c2-show', valueKey: 'defaultActiveTab', options: TAB_OPTIONS, ariaLabel: 'Show first' },
  { num: 3, label: 'Save words to', id: 'c2-save', valueKey: 'srsDestination', options: SRS_OPTIONS, ariaLabel: 'Save words to' },
] as const;

export function ConceptC2({ settings, update }: ConceptC2Props): React.JSX.Element {
  return (
    <div className={styles.conceptFrame}>
      <div className={styles.conceptTimelineConnected}>
        {STEPS.map((step, index) => {
          const isLast = index === STEPS.length - 1;
          const value = step.valueKey === 'defaultActiveTab' ? (settings.defaultActiveTab ?? '') : settings[step.valueKey];
          return (
            <div key={step.id} className={styles.conceptTimelineItem}>
              <div className={styles.conceptTimelineTrack}>
                <div className={styles.conceptTimelineDot}>{step.num}</div>
                {!isLast && <div className={styles.conceptTimelineLine} />}
              </div>
              <div className={styles.conceptTimelineContent}>
                <label htmlFor={step.id} className={styles.conceptTimelineLabel}>
                  {step.label}
                </label>
                <PillGroup
                  options={step.options}
                  value={value}
                  onChange={(next) => {
                    if (step.valueKey === 'defaultActiveTab') {
                      update({ defaultActiveTab: (next || null) as DictionaryPopupSettings['defaultActiveTab'] });
                    } else {
                      update({ [step.valueKey]: next as string } as Partial<DictionaryPopupSettings>);
                    }
                  }}
                  ariaLabel={step.ariaLabel}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
