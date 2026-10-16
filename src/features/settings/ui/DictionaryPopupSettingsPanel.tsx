// DictionaryPopupSettingsPanel — spec §M1 Settings → Dictionary Popup.
//
// Global behavior stays in the step list (trigger mode, default tab,
// example selection). Per-surface settings sit under a tab strip mirroring the
// popup toolbar (audio / image / translate / links) — the links tab hosts the
// external dictionary links manager (spec dict-links-manager REQ-8).

import { useState, type ReactElement } from 'react';
import { DEFAULT_DICTIONARY_POPUP_SETTINGS } from '@/shared/config/config';
import type { DictionaryPopupSettings } from '@/entities/settings/types';
import { Text } from '@/shared/ui/Text';
import { Icon } from '@/shared/ui/Icon';
import { SegmentedControl } from '@/shared/ui/SegmentedControl';
import { SettingsRow } from '@/shared/ui/SettingsRow';
import { SettingsGroup } from '@/shared/ui/SettingsGroup';
import { SettingsPanel } from '@/shared/ui/SettingsPanel';
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

const FREQUENCY_OPTIONS = ['stars', 'rank'] as const;
const FREQUENCY_LABEL_KEYS: Record<string, MessageKey> = {
  stars: 'settings.dictionaryPopup.frequency.stars',
  rank: 'settings.dictionaryPopup.frequency.rank',
};

type SurfaceTab = 'audio' | 'image' | 'translate' | 'links';

const SURFACE_TABS: readonly { key: SurfaceTab; icon: 'audioWave' | 'image' | 'languages' | 'link'; labelKey: MessageKey }[] = [
  { key: 'audio', icon: 'audioWave', labelKey: 'dict.tab.audio' },
  { key: 'image', icon: 'image', labelKey: 'dict.tab.image' },
  { key: 'translate', icon: 'languages', labelKey: 'dict.tab.translate' },
  { key: 'links', icon: 'link', labelKey: 'dict.tab.links' },
];

const STEPS = [
  {
    labelKey: 'settings.dictionaryPopup.openWith' as MessageKey,
    valueKey: 'triggerMode' as const,
    options: TRIGGER_MODES.map((mode) => ({ value: mode, labelKey: TRIGGER_LABEL_KEYS[mode] })),
  },
  {
    labelKey: 'settings.dictionaryPopup.showFirst' as MessageKey,
    valueKey: 'defaultActiveTab' as const,
    options: TAB_OPTIONS.map((tab) => ({ value: tab, labelKey: TAB_LABEL_KEYS[tab] })),
  },
  {
    labelKey: 'settings.dictionaryPopup.examples' as MessageKey,
    valueKey: 'includeAllExamplesOnDefSelect' as const,
    options: EXAMPLE_OPTIONS.map((o) => ({ value: o, labelKey: EXAMPLE_LABEL_KEYS[o] })),
  },
  {
    labelKey: 'settings.dictionaryPopup.frequency' as MessageKey,
    valueKey: 'frequencyDisplay' as const,
    options: FREQUENCY_OPTIONS.map((o) => ({ value: o, labelKey: FREQUENCY_LABEL_KEYS[o] })),
  },
];

export function DictionaryPopupSettingsPanel({
  settings,
  onChange,
}: DictionaryPopupSettingsPanelProps): ReactElement {
  const [surface, setSurface] = useState<SurfaceTab>('links');

  const moveTabFocus = (e: React.KeyboardEvent<HTMLButtonElement>): void => {
    const keys = SURFACE_TABS.map((t2) => t2.key);
    const i = keys.indexOf(surface);
    const next =
      e.key === 'ArrowRight' ? keys[(i + 1) % keys.length]
      : e.key === 'ArrowLeft' ? keys[(i + keys.length - 1) % keys.length]
      : e.key === 'Home' ? keys[0]
      : e.key === 'End' ? keys[keys.length - 1]
      : null;
    if (next == null) return;
    e.preventDefault();
    setSurface(next);
    e.currentTarget.parentElement
      ?.querySelector<HTMLElement>(`#dict-popup-tab-${next}`)
      ?.focus();
  };

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
    <SettingsPanel>
      <SettingsGroup>
        {STEPS.map((step) => {
          const value = step.valueKey === 'defaultActiveTab'
            ? (settings.defaultActiveTab ?? '')
            : step.valueKey === 'includeAllExamplesOnDefSelect'
              ? (settings.includeAllExamplesOnDefSelect ? 'all' : 'manual')
              : step.valueKey === 'frequencyDisplay'
                ? (settings.frequencyDisplay ?? 'stars')
                : settings[step.valueKey];

          return (
            <SettingsRow key={step.valueKey} dense stacked title={t(step.labelKey)}>
              <SegmentedControl
                variant="chips"
                size="lg"
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
            </SettingsRow>
          );
        })}
      </SettingsGroup>

      <div className={styles.tabsBlock}>
      <div className={styles.surfaceTabs} role="tablist" aria-label={t('settings.dictionaryPopup.links.tabsAria')}>
        {SURFACE_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            id={`dict-popup-tab-${tab.key}`}
            aria-controls={`dict-popup-panel-${tab.key}`}
            aria-selected={surface === tab.key}
            tabIndex={surface === tab.key ? 0 : -1}
            className={`${styles.surfaceTab} ${surface === tab.key ? styles.surfaceTabActive : ''}`}
            onClick={() => setSurface(tab.key)}
            onKeyDown={moveTabFocus}
            data-tihoka-id={`dict-popup-tab-${tab.key}`}
          >
            <Icon name={tab.icon} size="xs" />
            <span>{t(tab.labelKey)}</span>
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`dict-popup-panel-${surface}`} aria-labelledby={`dict-popup-tab-${surface}`} tabIndex={0}>
      {surface === 'links' && (
        <DictLinksManager
          links={settings.externalDictLinks ?? DEFAULT_DICTIONARY_POPUP_SETTINGS.externalDictLinks}
          onChange={(externalDictLinks) => update({ externalDictLinks })}
        />
      )}

      {surface === 'translate' && (
        <SettingsGroup>
          <SettingsRow dense stacked title={t('settings.dictionaryPopup.translations')}>
            <SegmentedControl
              variant="chips"
              size="lg"
              options={TRANSLATION_OPTIONS.map((o) => ({ value: o, label: t(TRANSLATION_LABEL_KEYS[o]) }))}
              value={settings.translationVisibility ?? 'hidden'}
              onChange={(nextValue) => update({ translationVisibility: nextValue as 'hidden' | 'shown' })}
              ariaLabel={t('settings.dictionaryPopup.translations')}
            />
          </SettingsRow>
        </SettingsGroup>
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
      </div>

    </SettingsPanel>
  );
}
