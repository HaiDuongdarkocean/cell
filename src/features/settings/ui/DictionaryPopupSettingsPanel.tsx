// DictionaryPopupSettingsPanel — spec §M1 Settings → Dictionary Popup.
//
// Settings: enabled toggle, trigger mode, default active tab, popup size,
// translate target lang, SRS destination. No hover-delay setting
// (debounce internal — spec D9).

import type React from 'react';
import type { DictionaryPopupSettings, Settings } from '@/entities/settings/types';
import styles from './DictionaryPopupSettingsPanel.module.css';

interface DictionaryPopupSettingsPanelProps {
  readonly settings: DictionaryPopupSettings;
  readonly onChange: (settings: DictionaryPopupSettings) => void;
}

const TRIGGER_MODES = ['click', 'hover', 'hover-ctrl', 'hover-shift', 'hover-alt'] as const;
const TRIGGER_LABELS: Record<string, string> = {
  click: 'Click',
  hover: 'Hover',
  'hover-ctrl': 'Hover + Ctrl',
  'hover-shift': 'Hover + Shift',
  'hover-alt': 'Hover + Alt',
};

const TAB_OPTIONS = ['audio', 'image', 'translate', 'links'] as const;
const TAB_LABELS: Record<string, string> = {
  audio: 'Audio',
  image: 'Image',
  translate: 'Translate',
  links: 'Links',
};

export function DictionaryPopupSettingsPanel({
  settings,
  onChange,
}: DictionaryPopupSettingsPanelProps): React.JSX.Element {
  const update = (partial: Partial<DictionaryPopupSettings>): void => {
    onChange({ ...settings, ...partial });
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

      {/* Translate target language */}
      <div className={styles.field}>
        <label htmlFor="dp-translate-lang">Translate target language</label>
        <input
          id="dp-translate-lang"
          type="text"
          value={settings.translateTargetLang}
          onChange={(e) => update({ translateTargetLang: e.target.value })}
          placeholder="vi, en, zh, ..."
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

/** Helper: update the dictionaryPopup slice in Settings. */
export function updateDictionaryPopupSettings(
  settings: Settings,
  dictionaryPopup: DictionaryPopupSettings,
): Settings {
  return { ...settings, dictionaryPopup };
}
