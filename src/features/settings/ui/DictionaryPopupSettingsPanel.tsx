// DictionaryPopupSettingsPanel — spec §M1 Settings → Dictionary Popup.
//
// Settings: enabled toggle, trigger mode, default active tab, popup size,
// translate target lang, SRS destination. No hover-delay setting
// (debounce internal — spec D9).

import type React from 'react';
import { DEFAULT_DICTIONARY_POPUP_SETTINGS } from '@/shared/config/config';
import type { DictionaryPopupSettings, BadgePointerTriggerSettings } from '@/entities/settings/types';
import { Slider } from '@/shared/ui/Slider';
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
        <label htmlFor="dp-enabled">
          <input
            id="dp-enabled"
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => update({ enabled: e.target.checked })}
          />
          {' '}
          Enable Dictionary Popup
        </label>
      </div>

      {/* Trigger mode */}
      <div className={styles.field}>
        <label htmlFor="dp-trigger-mode">Trigger mode</label>
        <select
          id="dp-trigger-mode"
          value={settings.triggerMode}
          onChange={(e) => update({ triggerMode: e.target.value as DictionaryPopupSettings['triggerMode'] })}
        >
          {TRIGGER_MODES.map((mode) => (
            <option key={mode} value={mode}>{TRIGGER_LABELS[mode]}</option>
          ))}
        </select>
      </div>

      {/* Orbital badge pointer settings — always visible (orbital is always on). */}
      <div className={styles.field}>
        <label htmlFor="dp-badge-pointer-position">Pointer position</label>
        <select
          id="dp-badge-pointer-position"
          value={settings.badgePointerTrigger?.position ?? DEFAULT_BADGE_POINTER_TRIGGER.position}
          onChange={(e) => {
            const base = settings.badgePointerTrigger ?? DEFAULT_BADGE_POINTER_TRIGGER;
            update({
              badgePointerTrigger: {
                ...base,
                position: e.target.value as BadgePointerTriggerSettings['position'],
              },
            });
          }}
        >
          <option value="top">Top</option>
          <option value="bottom">Bottom</option>
          <option value="left">Left</option>
          <option value="right">Right</option>
          <option value="center">Center</option>
        </select>
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
        <select
          id="dp-default-tab"
          value={settings.defaultActiveTab ?? ''}
          onChange={(e) => update({ defaultActiveTab: (e.target.value || null) as DictionaryPopupSettings['defaultActiveTab'] })}
        >
          <option value="">None (dictionary only)</option>
          {TAB_OPTIONS.map((tab) => (
            <option key={tab} value={tab}>{TAB_LABELS[tab]}</option>
          ))}
        </select>
      </div>

      {/* Popup width */}
      <div className={styles.field}>
        <label htmlFor="dp-width">Popup width (px)</label>
        <input
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
        <input
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
        <select
          id="dp-srs"
          value={settings.srsDestination}
          onChange={(e) => update({ srsDestination: e.target.value as DictionaryPopupSettings['srsDestination'] })}
          disabled
        >
          <option value="anki">Anki</option>
        </select>
        <small className={styles.hint}>
          Cell Memory integration coming soon.
        </small>
      </div>
    </div>
  );
}


