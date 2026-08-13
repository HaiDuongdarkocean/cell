import type { ReactElement } from 'react';
import type { NavClusterSettings } from '@/entities/settings';
import { Slider } from '@/shared/ui/Slider';
import { Button } from '@/shared/ui/Button';
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

/** Overlay appearance presets (feather blur 1px hardcoded). */
const PRESETS: ReadonlyArray<{ label: string; textOpacity: number; bgOpacity: number }> = [
  { label: 'Frosted', textOpacity: 1, bgOpacity: 0.2 },
  { label: 'Glass', textOpacity: 1, bgOpacity: 0 },
  { label: 'Muted', textOpacity: 0.8, bgOpacity: 0.4 },
  { label: 'Solid', textOpacity: 0.6, bgOpacity: 0.8 },
];

/**
 * Nav cluster settings panel (ADR-018 D2, ADR-025).
 * Button size + text opacity + bg opacity (overlay appearance refactor).
 * 4 presets: Frosted / Glass / Muted / Solid.
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

  const handleTextOpacityChange = (v: number): void => {
    onChange({ textOpacity: v });
  };

  const handleBgOpacityChange = (v: number): void => {
    onChange({ bgOpacity: v });
  };

  const handlePreset = (preset: { textOpacity: number; bgOpacity: number }): void => {
    onChange({ textOpacity: preset.textOpacity, bgOpacity: preset.bgOpacity });
  };

  return (
    <div className={styles.container} data-cell-id="nav-cluster-settings-panel">
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
          aria-label="Button size"
          data-cell-id="nav-cluster-button-size"
        />
      </div>

      {/* Icon opacity */}
      <div className={styles.field}>
        <div className={styles.sliderHeader}>
          <label className={styles.label} htmlFor="nav-cluster-text-opacity">Icon opacity</label>
          <span className={styles.value}>{Math.round(settings.textOpacity * 100)}%</span>
        </div>
        <Slider
          id="nav-cluster-text-opacity"
          value={settings.textOpacity}
          min={0}
          max={1}
          step={0.05}
          onChange={handleTextOpacityChange}
          aria-label="Icon opacity"
          data-cell-id="nav-cluster-text-opacity"
        />
      </div>

      {/* Button opacity */}
      <div className={styles.field}>
        <div className={styles.sliderHeader}>
          <label className={styles.label} htmlFor="nav-cluster-bg-opacity">Button opacity</label>
          <span className={styles.value}>{Math.round(settings.bgOpacity * 100)}%</span>
        </div>
        <Slider
          id="nav-cluster-bg-opacity"
          value={settings.bgOpacity}
          min={0}
          max={1}
          step={0.05}
          onChange={handleBgOpacityChange}
          aria-label="Button opacity"
          data-cell-id="nav-cluster-bg-opacity"
        />
      </div>

      {/* Presets */}
      <div className={styles.field}>
        <span className={styles.label}>Presets</span>
        <div className={styles.presetRow} role="group" aria-label="Overlay appearance presets">
          {PRESETS.map((preset) => {
            const isActive =
              settings.textOpacity === preset.textOpacity &&
              settings.bgOpacity === preset.bgOpacity;
            return (
              <Button
                key={preset.label}
                variant={isActive ? 'primary' : 'outline'}
                size="sm"
                onClick={() => handlePreset(preset)}
                aria-pressed={isActive}
                data-cell-id={`nav-cluster-preset-${preset.label.toLowerCase()}`}
              >
                {preset.label}
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
