// ThemePanel — options page tab "Giao diện" (ADR-022, spec F4).
//
// Composes ModeCards + ColorCustomization + ThemePreview + ContrastBadges +
// ThemeImportExport. Wires themeStore: switchMode, updateColor, setConfig,
// resetTheme. applyTheme chạy realtime qua ThemeProvider (options page boot).

import { useState } from 'react';
import { useThemeStore } from '@/stores/themeStore';
import { resolveMode } from '@/features/theme/logic/themeManager';
import { validateTheme } from '@/features/theme/logic/contrastValidator';
import { Button } from '@/shared/ui';
import { ModeCards } from './ModeCards';
import { PresetSwitcher } from './PresetSwitcher';
import { ColorCustomization } from './ColorCustomization';
import { ThemePreview } from './ThemePreview';
import { ContrastBadges } from './ContrastBadges';
import { ThemeImportExport } from './ThemeImportExport';
import styles from './ThemePanel.module.css';

export function ThemePanel(): React.JSX.Element {
  const { mode, config, switchMode, switchPreset, updateColor, setConfig, resetTheme } = useThemeStore();
  const [confirmReset, setConfirmReset] = useState(false);

  // NOTE: ThemePanel must NOT call applyTheme itself — every real mount already
  // has a provider (ThemeProvider on document root for light-DOM pages,
  // ShadowThemeProvider on the inner container for shadow-mounted UI) that
  // re-applies whenever the store changes. Writing to document.documentElement
  // here leaks theme attributes + inline color tokens onto the host page.

  const resolved = resolveMode(mode);
  const contrastResult = validateTheme(config.customColors[resolved]);

  return (
    <div className={styles.panel} data-cell-id="theme-panel">
      <div className={styles.section}>
        <h2 className={styles.heading}>Mode</h2>
        <ModeCards value={mode} onChange={switchMode} />
      </div>

      <div className={styles.section}>
        <h2 className={styles.heading}>Preset</h2>
        <PresetSwitcher value={config.preset} onChange={switchPreset} data-cell-id="theme-preset-switcher" />
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
          <Button material="solid" variant="destructive" onClick={() => setConfirmReset(true)} data-cell-id="theme-reset-btn">
            Reset to defaults
          </Button>
        ) : (
          <div className={styles.confirmRow} data-cell-id="theme-reset-confirm">
            <span className={styles.confirmText}>Reset all colors to defaults?</span>
            <Button material="solid" variant="destructive" onClick={() => { resetTheme(); setConfirmReset(false); }} data-cell-id="theme-reset-yes">Yes, reset</Button>
            <Button material="solid" variant="secondary" onClick={() => setConfirmReset(false)} data-cell-id="theme-reset-no">Cancel</Button>
          </div>
        )}
      </div>
    </div>
  );
}
