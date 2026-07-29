import { useCallback, useEffect, useRef, useState } from 'react';
import { SettingsDialogContent } from '@/features/settings/ui/SettingsDialogContent';
import { loadSettings, saveSettings } from '@/shared/lib/storage/settingsStore';
import { onStorageChanged, removeOnStorageChangedListener } from '@/shared/lib/chrome-apis';
import { STORAGE_KEYS } from '@/shared/config/config';
import type { Settings } from '@/entities/media';
import styles from './SettingsTab.module.css';

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])' as const;

/**
 * SettingsTab — renders the full SettingsDialogContent inside the universal panel.
 *
 * Loads settings from chrome.storage.local, keeps them in sync with external
 * changes, and saves mutations. Tokenize controls have moved to the universal
 * panel header (ADR-061) and are no longer bridged here.
 */
export function SettingsTab(): React.JSX.Element | null {
  const [settings, setSettings] = useState<Settings | null>(null);
  const tabRef = useRef<HTMLDivElement>(null);
  const hasFocusedRef = useRef(false);

  // Initial settings load.
  useEffect(() => {
    let cancelled = false;
    void loadSettings().then((s) => {
      if (!cancelled) setSettings(s);
    });
    return () => { cancelled = true; };
  }, []);

  // Keep settings in sync if another context changes them.
  useEffect(() => {
    const handleStorageChange = (changes: Record<string, chrome.storage.StorageChange>, area: string): void => {
      if (area !== 'local') return;
      if (STORAGE_KEYS.SETTINGS in changes) {
        void loadSettings().then((s) => { setSettings(s); });
      }
    };
    onStorageChanged(handleStorageChange);
    return () => { removeOnStorageChangedListener(handleStorageChange); };
  }, []);

  // Move focus into the settings panel once it is rendered. Skip the sidebar
  // navigation and target the first real settings control; fall back to the
  // tab container so screen-reader users land inside the panel content.
  useEffect(() => {
    if (!settings || hasFocusedRef.current || !tabRef.current) return;
    hasFocusedRef.current = true;

    const focusables = Array.from(tabRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    const firstControl = focusables.find((el) => !el.closest('nav'));
    if (firstControl) {
      firstControl.focus();
    } else {
      tabRef.current.focus();
    }
  }, [settings]);

  const handleChange = useCallback((next: Settings) => {
    setSettings(next);
    void saveSettings(next);
  }, []);

  if (!settings) {
    return <div className={styles.settingsTab} data-testid="settings-tab-loading">Loading settings…</div>;
  }

  return (
    <div ref={tabRef} className={styles.settingsTab} data-testid="settings-tab" tabIndex={-1}>
      <SettingsDialogContent
        settings={settings}
        onChange={handleChange}
      />
    </div>
  );
}
