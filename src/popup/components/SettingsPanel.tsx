import type { ChangeEvent } from 'react';
import type {
  Settings,
  VideoQuality,
  ParallelConversionMode,
  ParallelFallbackMode,
} from '@/types/media';
import {
  MIN_PARALLEL_WORKERS,
  MAX_PARALLEL_WORKERS,
} from '@/constants/config';
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

const PARALLEL_OPTIONS: readonly ParallelConversionMode[] = ['off', 'auto', 'manual'];

const FALLBACK_OPTIONS: readonly ParallelFallbackMode[] = ['sequential', 'save-ts'];

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

  const handleParallelMode = (e: ChangeEvent<HTMLSelectElement>): void => {
    update('parallelConversion', e.target.value as ParallelConversionMode);
  };

  const handleManualWorkers = (e: ChangeEvent<HTMLInputElement>): void => {
    const clamped = Math.max(
      MIN_PARALLEL_WORKERS,
      Math.min(MAX_PARALLEL_WORKERS, Number(e.target.value) || MIN_PARALLEL_WORKERS),
    );
    update('manualWorkerCount', clamped);
  };

  const handleParallelFallback = (e: ChangeEvent<HTMLSelectElement>): void => {
    update('parallelFallback', e.target.value as ParallelFallbackMode);
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

      <div className={styles.field}>
        <label className={styles.label} htmlFor="parallel-mode-select">
          Parallel conversion (experimental)
        </label>
        <select
          id="parallel-mode-select"
          className={styles.input}
          value={settings.parallelConversion}
          onChange={handleParallelMode}
          data-testid="parallel-mode-select"
        >
          {PARALLEL_OPTIONS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      {settings.parallelConversion === 'manual' && (
        <div className={styles.field}>
          <label className={styles.label} htmlFor="manual-workers-input">
            Worker count ({MIN_PARALLEL_WORKERS}–{MAX_PARALLEL_WORKERS})
          </label>
          <input
            id="manual-workers-input"
            className={styles.input}
            type="number"
            min={MIN_PARALLEL_WORKERS}
            max={MAX_PARALLEL_WORKERS}
            value={settings.manualWorkerCount}
            onChange={handleManualWorkers}
            data-testid="manual-workers-input"
          />
        </div>
      )}

      {settings.parallelConversion !== 'off' && (
        <div className={styles.field}>
          <label className={styles.label} htmlFor="parallel-fallback-select">
            Fallback if parallel fails
          </label>
          <select
            id="parallel-fallback-select"
            className={styles.input}
            value={settings.parallelFallback}
            onChange={handleParallelFallback}
            data-testid="parallel-fallback-select"
          >
            {FALLBACK_OPTIONS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
