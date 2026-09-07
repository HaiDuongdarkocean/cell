// ThemePanel — options page tab "Giao diện" (ADR-022, spec F4).
//
// Composes ModeCards + PresetSwitcher. Wires themeStore: switchMode, switchPreset.

import { useThemeStore } from '@/stores/themeStore';
import { ModeCards } from './ModeCards';
import { PresetSwitcher } from './PresetSwitcher';
import styles from './ThemePanel.module.css';

export function ThemePanel(): React.JSX.Element {
  const { mode, config, switchMode, switchPreset } = useThemeStore();

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
    </div>
  );
}
