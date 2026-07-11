import type { ReactElement } from 'react';
import type { NavClusterSettings } from '@/entities/settings';
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
 * Nav cluster settings panel (ADR-018 D2, ADR-025).
 * Button size + button opacity (bg opacity moved to Subtitle Block).
 * Each control calls onChange(partial) → parent persists → storage.onChanged
 * → content-script updateSettings (realtime).
 *
 * Accessibility: label htmlFor, aria-label, keyboard-navigable sliders.
 */
export function NavClusterSettingsPanel({
  settings,
  onChange,
}: NavClusterSettingsPanelProps): ReactElement {
  const handleButtonSizeChange = (raw: number): void => {
    onChange({ buttonSize: raw });
  };

  const handleButtonOpacityChange = (v: number): void => {
    onChange({ buttonOpacity: v });
  };

  return (
    <div className={styles.container} data-testid="nav-cluster-settings-panel">
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
