// ThemePanel — options page tab "Giao diện" (ADR-022, spec F4).
//
// Composes ModeCards + ColorCustomization + ThemePreview + ContrastBadges +
// ThemeImportExport. Wires themeStore: switchMode, updateColor, setConfig,
// resetTheme. applyTheme chạy realtime qua ThemeProvider (options page boot).

import { useState, useEffect } from 'react';
import { useThemeStore } from '@/stores/themeStore';
import { applyTheme, resolveMode } from '@/features/theme/logic/themeManager';
import { validateTheme } from '@/features/theme/logic/contrastValidator';
import { Button } from '@/shared/ui';
import { ModeCards } from './ModeCards';
import { ColorCustomization } from './ColorCustomization';
import { ThemePreview } from './ThemePreview';
import { ContrastBadges } from './ContrastBadges';
import { ThemeImportExport } from './ThemeImportExport';
import styles from './ThemePanel.module.css';

export function ThemePanel(): React.JSX.Element {
  const { mode, config, switchMode, updateColor, setConfig, resetTheme } = useThemeStore();
  const [confirmReset, setConfirmReset] = useState(false);

  // Realtime apply khi mode/config đổi (options page đã có ThemeProvider boot,
  // nhưng ThemePanel re-apply để preview live ngay cả trước khi store persist).
  useEffect(() => {
    applyTheme(resolveMode(mode), config);
  }, [mode, config]);

  const resolved = resolveMode(mode);
  const contrastResult = validateTheme(config.customColors[resolved]);

  return (
    <div className={styles.panel} data-cell-id="theme-panel">
      <div className={styles.section}>
        <h2 className={styles.heading}>Mode</h2>
        <ModeCards value={mode} onChange={switchMode} />
      </div>

      <div className={styles.section}>
        <h2 className={styles.heading}>Colors</h2>
        <ColorCustomization config={config} onColorChange={updateColor} />
        <ContrastBadges result={contrastResult} />
      </div>

      <div className={styles.section}>
        <h2 className={styles.heading}>Preview</h2>
        <ThemePreview />
      </div>

      <div className={styles.section}>
        <h2 className={styles.heading}>Backup</h2>
        <ThemeImportExport config={config} onApply={setConfig} />
      </div>

      <div className={styles.section}>
        <h2 className={styles.heading}>Reset</h2>
        {!confirmReset ? (
          <Button variant="destructive" onClick={() => setConfirmReset(true)} data-cell-id="theme-reset-btn">
            Reset to defaults
          </Button>
        ) : (
          <div className={styles.confirmRow} data-cell-id="theme-reset-confirm">
            <span className={styles.confirmText}>Reset all colors to defaults?</span>
            <Button variant="destructive" onClick={() => { resetTheme(); setConfirmReset(false); }} data-cell-id="theme-reset-yes">Yes, reset</Button>
            <Button variant="secondary" onClick={() => setConfirmReset(false)} data-cell-id="theme-reset-no">Cancel</Button>
          </div>
        )}
      </div>
    </div>
  );
}
