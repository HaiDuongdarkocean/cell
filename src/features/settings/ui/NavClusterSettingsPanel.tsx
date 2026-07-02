import type { ReactElement } from 'react';
import type { NavClusterSettings, NavClusterButtonSize } from '@/entities/settings';
import { IconButton } from '@/shared/ui/IconButton';
import styles from './NavClusterSettingsPanel.module.css';

interface NavClusterSettingsPanelProps {
  /** Current nav cluster settings. */
  settings: NavClusterSettings;
  /** Called with partial settings update whenever a control changes. */
  onChange: (partial: Partial<NavClusterSettings>) => void;
}

const BUTTON_SIZE_PRESETS: readonly NavClusterButtonSize[] = [40, 48, 56];

/** Snap a numeric button size to the nearest valid preset (ADR-018 D2). */
function snapButtonSize(size: number): NavClusterButtonSize {
  return BUTTON_SIZE_PRESETS.reduce<NavClusterButtonSize>(
    (best, preset) => (Math.abs(preset - size) <= Math.abs(best - size) ? preset : best),
    48,
  );
}

/**
 * Nav cluster settings panel (ADR-018 D2, spec §A9).
 * 3 sliders (button size, bg opacity, button opacity) + enable toggle.
 * Each control calls onChange(partial) → parent persists → storage.onChanged
 * → content-script updateSettings (realtime).
 *
 * Accessibility: label htmlFor, aria-label, keyboard-navigable sliders + toggle.
 */
export function NavClusterSettingsPanel({
  settings,
  onChange,
}: NavClusterSettingsPanelProps): ReactElement {
  const handleButtonSizeChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const raw = Number(e.target.value);
    onChange({ buttonSize: snapButtonSize(raw) });
  };

  const handleBgOpacityChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    onChange({ bgOpacity: Number(e.target.value) });
  };

  const handleButtonOpacityChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    onChange({ buttonOpacity: Number(e.target.value) });
  };

  const handleToggleEnabled = (): void => {
    onChange({ enabled: !settings.enabled });
  };

  return (
    <div className={styles.container} data-testid="nav-cluster-settings-panel">
      {/* Button size */}
      <div className={styles.field}>
        <label className={styles.label} htmlFor="nav-cluster-button-size">
          <span>Button size</span>
          <span className={styles.value}>{settings.buttonSize}px</span>
        </label>
        <input
          id="nav-cluster-button-size"
          type="range"
          min={40}
          max={56}
          step={1}
          value={settings.buttonSize}
          onChange={handleButtonSizeChange}
          className={styles.slider}
          data-testid="nav-cluster-button-size"
          aria-label="Nav cluster button size"
        />
      </div>

      {/* Background opacity */}
      <div className={styles.field}>
        <label className={styles.label} htmlFor="nav-cluster-bg-opacity">
          <span>Background opacity</span>
          <span className={styles.value}>{Math.round(settings.bgOpacity * 100)}%</span>
        </label>
        <input
          id="nav-cluster-bg-opacity"
          type="range"
          min={0}
          max={1}
          step={0.1}
          value={settings.bgOpacity}
          onChange={handleBgOpacityChange}
          className={styles.slider}
          data-testid="nav-cluster-bg-opacity"
          aria-label="Nav cluster background opacity"
        />
      </div>

      {/* Button opacity */}
      <div className={styles.field}>
        <label className={styles.label} htmlFor="nav-cluster-button-opacity">
          <span>Button opacity</span>
          <span className={styles.value}>{Math.round(settings.buttonOpacity * 100)}%</span>
        </label>
        <input
          id="nav-cluster-button-opacity"
          type="range"
          min={0}
          max={1}
          step={0.1}
          value={settings.buttonOpacity}
          onChange={handleButtonOpacityChange}
          className={styles.slider}
          data-testid="nav-cluster-button-opacity"
          aria-label="Nav cluster button opacity"
        />
      </div>

      {/* Enable toggle (ADR-018 D2: 2-state ON/OFF, reuse IconButton pattern) */}
      <div className={styles.field}>
        <label className={styles.label} htmlFor="nav-cluster-enabled">
          <span>Navigation cluster</span>
          <span className={styles.value}>{settings.enabled ? 'ON' : 'OFF'}</span>
        </label>
        <IconButton
          id="nav-cluster-enabled"
          size="sm"
          active={settings.enabled}
          onClick={handleToggleEnabled}
          aria-pressed={settings.enabled}
          aria-label="Toggle navigation cluster"
          title={`Navigation cluster: ${settings.enabled ? 'ON' : 'OFF'}`}
          data-testid="nav-cluster-enabled-toggle"
        >
          <svg className={styles.toggleIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 3L13.5 8.5L19 10L13.5 11.5L12 17L10.5 11.5L5 10L10.5 8.5L12 3Z" />
            <path d="M19 15L19.5 16.5L21 17L19.5 17.5L19 19L18.5 17.5L17 17L18.5 16.5L19 15Z" />
          </svg>
        </IconButton>
      </div>
    </div>
  );
}
