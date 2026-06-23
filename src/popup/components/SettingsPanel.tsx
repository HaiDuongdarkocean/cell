import type { ChangeEvent } from 'react';
import type { Settings, VideoQuality } from '@/types/media';
import styles from './SettingsPanel.module.css';

interface SettingsPanelProps {
  settings: Settings;
  onChange: (settings: Settings) => void;
}

const QUALITY_OPTIONS: readonly VideoQuality[] = [
  'highest',
  '1080p',
  '720p',
  '480p',
  '360p',
  'lowest',
  'auto',
];

const THEME_OPTIONS: readonly Settings['theme'][] = ['light', 'dark'];

export function SettingsPanel({ settings, onChange }: SettingsPanelProps): React.JSX.Element {
  const update = <K extends keyof Settings>(key: K, value: Settings[K]): void => {
    onChange({ ...settings, [key]: value });
  };

  const handleConcurrent = (e: ChangeEvent<HTMLInputElement>): void => {
    update('concurrentDownloads', Number(e.target.value));
  };

  const handleQuality = (e: ChangeEvent<HTMLSelectElement>): void => {
    update('defaultQuality', e.target.value as VideoQuality);
  };

  const handleLanguage = (e: ChangeEvent<HTMLInputElement>): void => {
    update('defaultSubtitleLanguage', e.target.value);
  };

  const handleTheme = (e: ChangeEvent<HTMLSelectElement>): void => {
    update('theme', e.target.value as Settings['theme']);
  };

  return (
    <div className={styles.panel} data-testid="settings-panel">
      <div className={styles.field}>
        <label className={styles.label} htmlFor="concurrent-input">
          Concurrent downloads
        </label>
        <input
          id="concurrent-input"
          className={styles.input}
          type="number"
          min={1}
          max={10}
          value={settings.concurrentDownloads}
          onChange={handleConcurrent}
          data-testid="concurrent-input"
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="quality-select">
          Default quality
        </label>
        <select
          id="quality-select"
          className={styles.input}
          value={settings.defaultQuality}
          onChange={handleQuality}
          data-testid="quality-select"
        >
          {QUALITY_OPTIONS.map((q) => (
            <option key={q} value={q}>
              {q}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="language-input">
          Default subtitle language
        </label>
        <input
          id="language-input"
          className={styles.input}
          type="text"
          value={settings.defaultSubtitleLanguage}
          onChange={handleLanguage}
          data-testid="language-input"
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="theme-select">
          Theme
        </label>
        <select
          id="theme-select"
          className={styles.input}
          value={settings.theme}
          onChange={handleTheme}
          data-testid="theme-select"
        >
          {THEME_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
