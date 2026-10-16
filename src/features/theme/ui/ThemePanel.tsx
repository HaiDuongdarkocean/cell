// ThemePanel — options page tab "Giao diện" (ADR-022, spec F4).
//
// Composes ModeCards + PresetSwitcher. Wires themeStore: switchMode, switchPreset.

import { t } from '@/shared/i18n';
import { useThemeStore } from '@/features/theme/logic/themeStore';
import { SettingsGroup } from '@/shared/ui/SettingsGroup';
import { SettingsPanel } from '@/shared/ui/SettingsPanel';
import { ModeCards } from './ModeCards';
import { PresetSwitcher } from './PresetSwitcher';
import styles from './ThemePanel.module.css';

export function ThemePanel(): React.JSX.Element {
  const { mode, config, switchMode, switchPreset } = useThemeStore();

  return (
    <SettingsPanel className={styles.panel} data-tihoka-id="theme-panel">
      <SettingsGroup label={t('theme.mode.heading')}>
        <ModeCards value={mode} onChange={switchMode} />
      </SettingsGroup>

      <SettingsGroup label={t('theme.preset.heading')}>
        <PresetSwitcher value={config.preset} onChange={switchPreset} data-tihoka-id="theme-preset-switcher" />
      </SettingsGroup>
    </SettingsPanel>
  );
}
