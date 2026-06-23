import { useEffect, useRef } from 'react';
import type { ChangeEvent } from 'react';
import type { Settings, VideoQuality } from '@/types/media';
import { Button } from '../ui/Button';
import styles from './SettingsDialog.module.css';

interface SettingsDialogProps {
  isOpen: boolean;
  settings: Settings;
  onChange: (settings: Settings) => void;
  onClose: () => void;
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

export function SettingsDialog({
  isOpen,
  settings,
  onChange,
  onClose,
}: SettingsDialogProps): React.JSX.Element {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Focus management
  useEffect(() => {
    if (isOpen) {
      closeButtonRef.current?.focus();
      // Trap focus within dialog
      const handleTab = (e: KeyboardEvent): void => {
        if (e.key === 'Tab') {
          const focusableElements = dialogRef.current?.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
          );
          if (focusableElements && focusableElements.length > 0) {
            const firstElement = focusableElements[0] as HTMLElement;
            const lastElement = focusableElements[
              focusableElements.length - 1
            ] as HTMLElement;

            if (e.shiftKey) {
              if (document.activeElement === firstElement) {
                e.preventDefault();
                lastElement.focus();
              }
            } else {
              if (document.activeElement === lastElement) {
                e.preventDefault();
                firstElement.focus();
              }
            }
          }
        }
      };

      document.addEventListener('keydown', handleTab);
      return () => document.removeEventListener('keydown', handleTab);
    }
  }, [isOpen]);

  if (!isOpen) return <div />;

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
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()} ref={dialogRef}>
        <div className={styles.dialogHeader}>
          <h2 id="settings-title" className={styles.dialogTitle}>Settings</h2>
          <button
            ref={closeButtonRef}
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close settings"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className={styles.dialogBody}>
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
            <span className={styles.helper}>
              Number of simultaneous downloads (1-10)
            </span>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="quality-select">
              Default quality
            </label>
            <select
              id="quality-select"
              className={styles.select}
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
              placeholder="e.g., en, vi, ja"
            />
            <span className={styles.helper}>
              Language code for preferred subtitles
            </span>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="theme-select">
              Theme
            </label>
            <select
              id="theme-select"
              className={styles.select}
              value={settings.theme}
              onChange={handleTheme}
              data-testid="theme-select"
            >
              {THEME_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.dialogFooter}>
          <Button variant="primary" size="md" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}