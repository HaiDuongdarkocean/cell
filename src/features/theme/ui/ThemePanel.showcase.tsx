import type { ReactElement } from 'react';
import { ThemePanel } from '@/features/theme/ui/ThemePanel';
import { ThemeProvider } from '@/features/theme/ui/ThemeProvider';
import styles from './ThemePanel.showcase.module.css';

export function Showcase(): ReactElement {
  return (
    <div className={styles.wrapper}>
      <div className={styles.panelFrame}>
        {/* Standalone showcase has no app-level provider — wrap so live theme
            apply still works, matching the options-page composition. */}
        <ThemeProvider>
          <ThemePanel />
        </ThemeProvider>
      </div>
    </div>
  );
}

export const showcaseMeta = {
  title: 'Theme Panel',
  description: 'Theme customization panel: ModeCards (light/dark/system), ColorCustomization (primary, background, text, border), ThemePreview (live preview), ContrastBadges (WCAG AA/AAA), ThemeImportExport (JSON backup/restore), Reset to defaults with confirm.',
  level: 'organisms' as const,
  category: 'Theme',
  order: 10,
};
