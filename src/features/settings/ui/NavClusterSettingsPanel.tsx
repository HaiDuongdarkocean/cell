import type { ReactElement } from 'react';
import type { NavClusterSettings } from '@/entities/settings';
import { Toggle } from '@/shared/ui/Toggle';
import { Slider } from '@/shared/ui/Slider';
import styles from './NavClusterSettingsPanel.module.css';

interface NavClusterSettingsPanelProps {
  /** Current nav cluster settings. */
  settings: NavClusterSettings;
  /** Called with partial settings update whenever a control changes. */
  onChange: (partial: Partial<NavClusterSettings>) => void;
}

/** Button size slider bounds (ADR-018 D2-rev: free range 10-100px). */
const BUTTON_SIZE_MIN = 10;
const BUTTON_SIZE_MAX = 100;

/**
 * Nav cluster settings panel (ADR-018 D2, spec §A9).
 * Enable toggle + 3 sliders (button size, bg opacity, button opacity).
 * Each control calls onChange(partial) → parent persists → storage.onChanged
 * → content-script updateSettings (realtime).
 *
 * Accessibility: label htmlFor, aria-label, keyboard-navigable sliders + toggle.
 */
export function NavClusterSettingsPanel({
  settings,
  onChange,
}: NavClusterSettingsPanelProps): ReactElement {
  const handleButtonSizeChange = (raw: number): void => {
    onChange({ buttonSize: raw });
  };

  const handleBgOpacityChange = (v: number): void => {
    onChange({ bgOpacity: v });
  };

  const handleButtonOpacityChange = (v: number): void => {
    onChange({ buttonOpacity: v });
  };

  const handleToggleEnabled = (next: boolean): void => {
    onChange({ enabled: next });
  };

  return (
    <div className={styles.container} data-testid="nav-cluster-settings-panel">
      {/* Enable toggle (ADR-018 D2: 2-state ON/OFF, Toggle atom switch pill) */}
      <div className={styles.fieldRow}>
        <span className={styles.rowLabel}>Enable cluster</span>
        <Toggle
          checked={settings.enabled}
          onChange={handleToggleEnabled}
          ariaLabel="Toggle navigation cluster"
          data-testid="nav-cluster-enabled-toggle"
        />
      </div>

      {/* Divider: behavior → visual (settings-dialog-rearrange) */}
      <div className={styles.divider} />

      {/* Button size */}
      <div className={styles.field}>
        <div className={styles.sliderHeader}>
          <label className={styles.label} htmlFor="nav-cluster-button-size">Button size</label>
          <span className={styles.value}>{settings.buttonSize}px</span>
        </div>
        <Slider
          id="nav-cluster-button-size"
          value={settings.buttonSize}
          min={BUTTON_SIZE_MIN}
          max={BUTTON_SIZE_MAX}
          step={1}
          onChange={handleButtonSizeChange}
          aria-label="Nav cluster button size"
          data-testid="nav-cluster-button-size"
        />
      </div>

      {/* Background opacity */}
      <div className={styles.field}>
        <div className={styles.sliderHeader}>
          <label className={styles.label} htmlFor="nav-cluster-bg-opacity">Background opacity</label>
          <span className={styles.value}>{Math.round(settings.bgOpacity * 100)}%</span>
        </div>
        <Slider
          id="nav-cluster-bg-opacity"
          value={settings.bgOpacity}
          min={0}
          max={1}
          step={0.1}
          onChange={handleBgOpacityChange}
          aria-label="Nav cluster background opacity"
          data-testid="nav-cluster-bg-opacity"
        />
      </div>

      {/* Button opacity */}
      <div className={styles.field}>
        <div className={styles.sliderHeader}>
          <label className={styles.label} htmlFor="nav-cluster-button-opacity">Button opacity</label>
          <span className={styles.value}>{Math.round(settings.buttonOpacity * 100)}%</span>
        </div>
        <Slider
          id="nav-cluster-button-opacity"
          value={settings.buttonOpacity}
          min={0}
          max={1}
          step={0.1}
          onChange={handleButtonOpacityChange}
          aria-label="Nav cluster button opacity"
          data-testid="nav-cluster-button-opacity"
        />
      </div>
    </div>
  );
}
