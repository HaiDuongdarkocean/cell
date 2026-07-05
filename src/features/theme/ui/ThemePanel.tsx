// ThemePanel — options page tab "Giao diện" (ADR-022, spec F4).
//
// Composes ModeCards + ColorCustomization + ThemePreview + ContrastBadges +
// ThemeImportExport. Wires themeStore: switchMode, updateColor, setConfig,
// resetTheme. applyTheme chạy realtime qua ThemeProvider (options page boot).

import { useState, useEffect } from 'react';
import { useThemeStore } from '@/stores/themeStore';
import { applyTheme, resolveMode } from '@/features/theme/logic/themeManager';
import { validateTheme } from '@/features/theme/logic/contrastValidator';
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
    <div className={styles.panel} data-testid="theme-panel">
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
          <button className={styles.resetBtn} onClick={() => setConfirmReset(true)} data-testid="theme-reset-btn">
            Reset to defaults
          </button>
        ) : (
          <div className={styles.confirmRow} data-testid="theme-reset-confirm">
            <span className={styles.confirmText}>Reset all colors to defaults?</span>
            <button className={styles.resetBtn} onClick={() => { resetTheme(); setConfirmReset(false); }} data-testid="theme-reset-yes">Yes, reset</button>
            <button className={styles.resetBtn} onClick={() => setConfirmReset(false)} data-testid="theme-reset-no" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)' }}>Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}
