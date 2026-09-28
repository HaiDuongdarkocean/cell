// DictionaryPopupSettingsPanel — spec §M1 Settings → Dictionary Popup.
//
// Global behavior stays in the numbered timeline (trigger mode, default tab,
// example selection). Per-surface settings sit under a tab strip mirroring the
// popup toolbar (audio / image / translate / links) — the links tab hosts the
// external dictionary links manager (spec dict-links-manager REQ-8).
//
// Visual model: connected timeline + pill groups (one-tap selection).

import { useState, type ReactElement } from 'react';
import { DEFAULT_DICTIONARY_POPUP_SETTINGS } from '@/shared/config/config';
import type { DictionaryPopupSettings } from '@/entities/settings/types';
import { Text } from '@/shared/ui/Text';
import { Icon } from '@/shared/ui/Icon';
import { t, type MessageKey } from '@/shared/i18n';
import { DictLinksManager } from './DictLinksManager';
import styles from './DictionaryPopupSettingsPanel.module.css';

interface DictionaryPopupSettingsPanelProps {
  readonly settings: DictionaryPopupSettings;
  readonly onChange: (settings: DictionaryPopupSettings) => void;
}

const TRIGGER_MODES = ['click', 'hover', 'hover-ctrl', 'hover-shift', 'hover-alt'] as const;
const TRIGGER_LABEL_KEYS: Record<string, MessageKey> = {
  click: 'settings.dictionaryPopup.openWith.click',
  hover: 'settings.dictionaryPopup.openWith.hover',
  'hover-ctrl': 'settings.dictionaryPopup.openWith.hoverCtrl',
  'hover-shift': 'settings.dictionaryPopup.openWith.hoverShift',
  'hover-alt': 'settings.dictionaryPopup.openWith.hoverAlt',
};

const TAB_OPTIONS = ['', 'audio', 'image', 'translate', 'links', 'pronunciation'] as const;
const TAB_LABEL_KEYS: Record<string, MessageKey> = {
  '': 'settings.dictionaryPopup.showFirst.none',
  audio: 'settings.dictionaryPopup.showFirst.audio',
  image: 'settings.dictionaryPopup.showFirst.image',
  translate: 'settings.dictionaryPopup.showFirst.translate',
  links: 'settings.dictionaryPopup.showFirst.links',
  pronunciation: 'settings.dictionaryPopup.showFirst.pronunciation',
};

const TRANSLATION_OPTIONS = ['hidden', 'shown'] as const;
const TRANSLATION_LABEL_KEYS: Record<string, MessageKey> = {
  hidden: 'settings.dictionaryPopup.translations.hidden',
  shown: 'settings.dictionaryPopup.translations.shown',
};

const EXAMPLE_OPTIONS = ['manual', 'all'] as const;
const EXAMPLE_LABEL_KEYS: Record<string, MessageKey> = {
  manual: 'settings.dictionaryPopup.examples.manual',
  all: 'settings.dictionaryPopup.examples.all',
};

type SurfaceTab = 'audio' | 'image' | 'translate' | 'links';

const SURFACE_TABS: readonly { key: SurfaceTab; icon: 'audioWave' | 'image' | 'languages' | 'link'; labelKey: MessageKey }[] = [
  { key: 'audio', icon: 'audioWave', labelKey: 'dict.tab.audio' },
  { key: 'image', icon: 'image', labelKey: 'dict.tab.image' },
  { key: 'translate', icon: 'languages', labelKey: 'dict.tab.translate' },
  { key: 'links', icon: 'link', labelKey: 'dict.tab.links' },
];

interface PillGroupProps {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
}

function PillGroup({ options, value, onChange, ariaLabel }: PillGroupProps): ReactElement {
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
    labelKey: 'settings.dictionaryPopup.openWith' as MessageKey,
    valueKey: 'triggerMode' as const,
    options: TRIGGER_MODES.map((mode) => ({ value: mode, labelKey: TRIGGER_LABEL_KEYS[mode] })),
  },
  {
    num: 2,
    labelKey: 'settings.dictionaryPopup.showFirst' as MessageKey,
    valueKey: 'defaultActiveTab' as const,
    options: TAB_OPTIONS.map((tab) => ({ value: tab, labelKey: TAB_LABEL_KEYS[tab] })),
  },
  {
    num: 3,
    labelKey: 'settings.dictionaryPopup.examples' as MessageKey,
    valueKey: 'includeAllExamplesOnDefSelect' as const,
    options: EXAMPLE_OPTIONS.map((o) => ({ value: o, labelKey: EXAMPLE_LABEL_KEYS[o] })),
  },
];

export function DictionaryPopupSettingsPanel({
  settings,
  onChange,
}: DictionaryPopupSettingsPanelProps): ReactElement {
  const [surface, setSurface] = useState<SurfaceTab>('links');

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
            : step.valueKey === 'includeAllExamplesOnDefSelect'
              ? (settings.includeAllExamplesOnDefSelect ? 'all' : 'manual')
              : settings[step.valueKey];

          return (
            <div key={step.valueKey} className={styles.timelineItem}>
              <div className={styles.timelineTrack}>
                <div className={styles.timelineDot}>{step.num}</div>
                {!isLast && <div className={styles.timelineLine} />}
              </div>
              <div className={styles.timelineContent}>
                <Text as="span" className={styles.timelineLabel}>
                  {t(step.labelKey)}
                </Text>
                <PillGroup
                  options={step.options.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
                  value={value}
                  onChange={(nextValue) => {
                    if (step.valueKey === 'defaultActiveTab') {
                      update({ defaultActiveTab: (nextValue || null) as DictionaryPopupSettings['defaultActiveTab'] });
                    } else if (step.valueKey === 'includeAllExamplesOnDefSelect') {
                      update({ includeAllExamplesOnDefSelect: nextValue === 'all' });
                    } else {
                      update({ [step.valueKey]: nextValue } as Partial<DictionaryPopupSettings>);
                    }
                  }}
                  ariaLabel={t(step.labelKey)}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className={styles.surfaceTabs} role="tablist" aria-label={t('settings.dictionaryPopup.links.tabsAria')}>
        {SURFACE_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={surface === tab.key}
            className={`${styles.surfaceTab} ${surface === tab.key ? styles.surfaceTabActive : ''}`}
            onClick={() => setSurface(tab.key)}
            data-cell-id={`dict-popup-tab-${tab.key}`}
          >
            <Icon name={tab.icon} size="xs" />
            <span>{t(tab.labelKey)}</span>
          </button>
        ))}
      </div>

      {surface === 'links' && (
        <DictLinksManager
          links={settings.externalDictLinks ?? DEFAULT_DICTIONARY_POPUP_SETTINGS.externalDictLinks}
          onChange={(externalDictLinks) => update({ externalDictLinks })}
        />
      )}

      {surface === 'translate' && (
        <div className={styles.tabBody}>
          <Text as="span" className={styles.timelineLabel}>
            {t('settings.dictionaryPopup.translations')}
          </Text>
          <PillGroup
            options={TRANSLATION_OPTIONS.map((o) => ({ value: o, label: t(TRANSLATION_LABEL_KEYS[o]) }))}
            value={settings.translationVisibility ?? 'hidden'}
            onChange={(nextValue) => update({ translationVisibility: nextValue as 'hidden' | 'shown' })}
            ariaLabel={t('settings.dictionaryPopup.translations')}
          />
        </div>
      )}

      {surface === 'audio' && (
        <Text as="p" color="secondary" className={styles.tabEmpty}>
          {t('settings.dictionaryPopup.links.tabEmpty.audio')}
        </Text>
      )}

      {surface === 'image' && (
        <Text as="p" color="secondary" className={styles.tabEmpty}>
          {t('settings.dictionaryPopup.links.tabEmpty.image')}
        </Text>
      )}

    </div>
  );
}
