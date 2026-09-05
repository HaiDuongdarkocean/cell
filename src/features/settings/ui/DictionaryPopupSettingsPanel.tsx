// DictionaryPopupSettingsPanel — spec §M1 Settings → Dictionary Popup.
//
// Settings: enabled toggle, trigger mode, default active tab, popup size,
// translate target lang, SRS destination. No hover-delay setting
// (debounce internal — spec D9).

import type React from 'react';
import { DEFAULT_DICTIONARY_POPUP_SETTINGS } from '@/shared/config/config';
import type { DictionaryPopupSettings, BadgePointerTriggerSettings } from '@/entities/settings/types';
import { Slider } from '@/shared/ui/Slider';
import { Toggle } from '@/shared/ui/Toggle';
import { Select } from '@/shared/ui/Select';
import { Input } from '@/shared/ui/Input';
import { Text } from '@/shared/ui/Text';
import styles from './DictionaryPopupSettingsPanel.module.css';

interface DictionaryPopupSettingsPanelProps {
  readonly settings: DictionaryPopupSettings;
  readonly onChange: (settings: DictionaryPopupSettings) => void;
}

const DEFAULT_BADGE_POINTER_TRIGGER: BadgePointerTriggerSettings = { position: 'center', size: 36, pointerScale: 0.25 };

const TRIGGER_MODES = ['click', 'hover', 'hover-ctrl', 'hover-shift', 'hover-alt'] as const;
const TRIGGER_LABELS: Record<string, string> = {
  click: 'Click',
  hover: 'Hover',
  'hover-ctrl': 'Hover + Ctrl',
  'hover-shift': 'Hover + Shift',
  'hover-alt': 'Hover + Alt',
};

const TAB_OPTIONS = ['audio', 'image', 'translate', 'links', 'pronunciation'] as const;
const TAB_LABELS: Record<string, string> = {
  audio: 'Audio',
  image: 'Image',
  translate: 'Translate',
  links: 'Links',
  pronunciation: 'Phonemes',
};

export function DictionaryPopupSettingsPanel({
  settings,
  onChange,
}: DictionaryPopupSettingsPanelProps): React.JSX.Element {
  const update = (partial: Partial<DictionaryPopupSettings>): void => {
    // Merge with defaults so optional fields (e.g. tts, per-lang overrides)
    // stay populated. When the user changes the global defaultActiveTab,
    // clear any stale per-language override — there is no UI to manage it,
    // and an old/stale per-lang value would silently win over the user's
    // new global choice (spec D2: per-lang overrides global when present).
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
      {/* Enabled toggle */}
      <div className={styles.field}>
        <Toggle
          checked={settings.enabled}
          onChange={(next) => update({ enabled: next })}
          ariaLabel="Enable Dictionary Popup"
          dataTestId="dp-enabled"
        />
        {' '}
        Enable Dictionary Popup
      </div>

      {/* Trigger mode */}
      <div className={styles.field}>
        <label htmlFor="dp-trigger-mode">Trigger mode</label>
        <Select
          id="dp-trigger-mode"
          value={settings.triggerMode}
          options={TRIGGER_MODES.map((mode) => ({ value: mode, label: TRIGGER_LABELS[mode] }))}
          onChange={(mode) => update({ triggerMode: mode as DictionaryPopupSettings['triggerMode'] })}
        />
      </div>

      {/* Orbital badge pointer settings — always visible (orbital is always on). */}
      <div className={styles.field}>
        <label htmlFor="dp-badge-pointer-position">Pointer position</label>
        <Select
          id="dp-badge-pointer-position"
          value={settings.badgePointerTrigger?.position ?? DEFAULT_BADGE_POINTER_TRIGGER.position}
          options={[
            { value: 'top', label: 'Top' },
            { value: 'bottom', label: 'Bottom' },
            { value: 'left', label: 'Left' },
            { value: 'right', label: 'Right' },
            { value: 'center', label: 'Center' },
          ]}
          onChange={(pos) => {
            const base = settings.badgePointerTrigger ?? DEFAULT_BADGE_POINTER_TRIGGER;
            update({
              badgePointerTrigger: {
                ...base,
                position: pos as BadgePointerTriggerSettings['position'],
              },
            });
          }}
        />
      </div>
      <div className={styles.field}>
        <div className={styles.sliderHeader}>
          <label className={styles.label} htmlFor="dp-badge-pointer-size">Badge size</label>
          <span className={styles.value}>{settings.badgePointerTrigger?.size ?? DEFAULT_BADGE_POINTER_TRIGGER.size}px</span>
        </div>
        <Slider
          id="dp-badge-pointer-size"
          value={settings.badgePointerTrigger?.size ?? DEFAULT_BADGE_POINTER_TRIGGER.size}
          min={10}
          max={200}
          step={1}
          aria-label="Orbital badge size"
          data-cell-id="dp-badge-pointer-size"
          onChange={(value) => {
            const base = settings.badgePointerTrigger ?? DEFAULT_BADGE_POINTER_TRIGGER;
            update({
              badgePointerTrigger: {
                ...base,
                size: value,
              },
            });
          }}
        />
      </div>

      {/* Default active tab */}
      <div className={styles.field}>
        <label htmlFor="dp-default-tab">Default active tab</label>
        <Select
          id="dp-default-tab"
          value={settings.defaultActiveTab ?? ''}
          options={[
            { value: '', label: 'None (dictionary only)' },
            ...TAB_OPTIONS.map((tab) => ({ value: tab, label: TAB_LABELS[tab] })),
          ]}
          onChange={(tab) => update({ defaultActiveTab: (tab || null) as DictionaryPopupSettings['defaultActiveTab'] })}
        />
      </div>

      {/* Popup width */}
      <div className={styles.field}>
        <label htmlFor="dp-width">Popup width (px)</label>
        <Input
          id="dp-width"
          type="number"
          min={320}
          max={1200}
          value={settings.popupWidthPx}
          onChange={(e) => update({ popupWidthPx: Math.max(320, Math.min(1200, Number(e.target.value) || 560)) })}
        />
      </div>

      {/* Popup max height */}
      <div className={styles.field}>
        <label htmlFor="dp-max-height">Popup max height (px)</label>
        <Input
          id="dp-max-height"
          type="number"
          min={200}
          max={800}
          value={settings.popupMaxHeightPx}
          onChange={(e) => update({ popupMaxHeightPx: Math.max(200, Math.min(800, Number(e.target.value) || 480)) })}
        />
      </div>

      {/* SRS destination */}
      <div className={styles.field}>
        <label htmlFor="dp-srs">SRS destination</label>
        <Select
          id="dp-srs"
          value={settings.srsDestination}
          options={[
            { value: 'anki', label: 'Anki' },
            { value: 'ocean-srs', label: 'Ocean SRS' },
          ]}
          onChange={(dest) => update({ srsDestination: dest as DictionaryPopupSettings['srsDestination'] })}
        />
        <Text as="small" color="secondary" className={styles.hint}>
          Choose where Quick Add sends cards.
        </Text>
      </div>
    </div>
  );
}


