import { useState, type ReactElement } from 'react';
import { SettingsDialog } from '@/features/settings/ui/SettingsDialog';
import { DEFAULT_SETTINGS } from '@/shared/config/config';
import type { Settings } from '@/entities/media';
import styles from './SettingsPage.module.css';

export function Showcase(): ReactElement {
  const [isOpen, setIsOpen] = useState(true);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  return (
    <div className={styles.wrapper}>
      <div className={styles.controls}>
        <button
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          className={styles.toggleBtn}
        >
          {isOpen ? 'Close Settings' : 'Open Settings'}
        </button>
      </div>
      <div className={styles.pageFrame}>
        <div className={styles.pagePlaceholder}>
          <span>Web Page Content (behind dialog)</span>
        </div>
      </div>
      <SettingsDialog
        isOpen={isOpen}
        settings={settings}
        onChange={setSettings}
        onClose={() => setIsOpen(false)}
      />
    </div>
  );
}

export const showcaseMeta = {
  title: 'Settings Dialog Page',
  description: 'Full settings dialog with 12 sections: Download (quality, format, concurrency, conversion), Subtitle (languages, overlay, auto-load, auto-translate), Theme (mode, colors, contrast, backup), TTS (voice selection, tester), Dictionary Resources (import, delete), Card Creator, Dictionary Popup, Nav Cluster, Shortcuts.',
  level: 'pages' as const,
  category: 'Settings',
  order: 50,
};
