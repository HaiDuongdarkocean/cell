// DictionaryPopupSettingsPanel — spec §M1 Settings → Dictionary Popup.
//
// Reduced to the two core behavioral decisions:
// 1. How do I open a word?  (trigger mode)
// 2. What do I see first?   (default active tab)
//
// SRS destination has moved to Card Creator settings.
//
// Visual model: connected timeline + pill groups (one-tap selection).

import type React from 'react';
import { DEFAULT_DICTIONARY_POPUP_SETTINGS } from '@/shared/config/config';
import type { DictionaryPopupSettings } from '@/entities/settings/types';
import { Text } from '@/shared/ui/Text';
import { t } from '@/shared/i18n';
import styles from './DictionaryPopupSettingsPanel.module.css';

interface DictionaryPopupSettingsPanelProps {
  readonly settings: DictionaryPopupSettings;
  readonly onChange: (settings: DictionaryPopupSettings) => void;
}

const TRIGGER_MODES = ['click', 'hover', 'hover-ctrl', 'hover-shift', 'hover-alt'] as const;
const TRIGGER_LABELS: Record<string, string> = {
  click: t('settings.dictionaryPopup.openWith.click'),
  hover: t('settings.dictionaryPopup.openWith.hover'),
  'hover-ctrl': t('settings.dictionaryPopup.openWith.hoverCtrl'),
  'hover-shift': t('settings.dictionaryPopup.openWith.hoverShift'),
  'hover-alt': t('settings.dictionaryPopup.openWith.hoverAlt'),
};

const TAB_OPTIONS = ['', 'audio', 'image', 'translate', 'links', 'pronunciation'] as const;
const TAB_LABELS: Record<string, string> = {
  '': t('settings.dictionaryPopup.showFirst.none'),
  audio: t('settings.dictionaryPopup.showFirst.audio'),
  image: t('settings.dictionaryPopup.showFirst.image'),
  translate: t('settings.dictionaryPopup.showFirst.translate'),
  links: t('settings.dictionaryPopup.showFirst.links'),
  pronunciation: t('settings.dictionaryPopup.showFirst.pronunciation'),
};

interface PillGroupProps {
  options: { value: string; label: string }[];
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

const STEPS = [
  {
    num: 1,
    label: t('settings.dictionaryPopup.openWith'),
    ariaLabel: t('settings.dictionaryPopup.openWith'),
    valueKey: 'triggerMode' as const,
    options: TRIGGER_MODES.map((mode) => ({ value: mode, label: TRIGGER_LABELS[mode] })),
  },
  {
    num: 2,
    label: t('settings.dictionaryPopup.showFirst'),
    ariaLabel: t('settings.dictionaryPopup.showFirst'),
    valueKey: 'defaultActiveTab' as const,
    options: TAB_OPTIONS.map((tab) => ({ value: tab, label: TAB_LABELS[tab] })),
  },
];

export function DictionaryPopupSettingsPanel({
  settings,
  onChange,
}: DictionaryPopupSettingsPanelProps): React.JSX.Element {
  const update = (partial: Partial<DictionaryPopupSettings>): void => {
    const next: DictionaryPopupSettings = {
      ...DEFAULT_DICTIONARY_POPUP_SETTINGS,
      ...settings,
      ...partial,
      defaultActiveTabPerLang: 'defaultActiveTab' in partial ? undefined : settings.defaultActiveTabPerLang,
    };
    onChange(next);
  };

  return (
    <div className={styles.panel}>
      <div className={styles.timeline}>
        {STEPS.map((step, index) => {
          const isLast = index === STEPS.length - 1;
          const value = step.valueKey === 'defaultActiveTab'
            ? (settings.defaultActiveTab ?? '')
            : settings[step.valueKey];

          return (
            <div key={step.valueKey} className={styles.timelineItem}>
              <div className={styles.timelineTrack}>
                <div className={styles.timelineDot}>{step.num}</div>
                {!isLast && <div className={styles.timelineLine} />}
              </div>
              <div className={styles.timelineContent}>
                <Text as="span" className={styles.timelineLabel}>
                  {step.label}
                </Text>
                <PillGroup
                  options={step.options}
                  value={value}
                  onChange={(nextValue) => {
                    if (step.valueKey === 'defaultActiveTab') {
                      update({ defaultActiveTab: (nextValue || null) as DictionaryPopupSettings['defaultActiveTab'] });
                    } else {
                      update({ [step.valueKey]: nextValue } as Partial<DictionaryPopupSettings>);
                    }
                  }}
                  ariaLabel={step.ariaLabel}
                />
              </div>
            </div>
          );
        })}
      </div>

      <Text as="p" color="secondary" className={styles.hint}>
        {t('settings.dictionaryPopup.saveHint')}
      </Text>
    </div>
  );
}
