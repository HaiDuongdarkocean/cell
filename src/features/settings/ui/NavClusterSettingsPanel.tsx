import { useState, type ReactElement } from 'react';
import type { NavClusterSettings, NavClusterButtonSize } from '@/entities/settings';
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
 * 3 sliders (button size, bg opacity, button opacity) + off toggle with confirm.
 * Each control calls onChange(partial) → parent persists → storage.onChanged
 * → content-script updateSettings (realtime).
 *
 * Accessibility: label htmlFor, aria-label, keyboard-navigable sliders.
 */
export function NavClusterSettingsPanel({
  settings,
  onChange,
}: NavClusterSettingsPanelProps): ReactElement {
  const [showOffConfirm, setShowOffConfirm] = useState(false);

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

  const handleOffClick = (): void => {
    setShowOffConfirm(true);
  };

  const handleOffConfirmYes = (): void => {
    onChange({ enabled: false });
    setShowOffConfirm(false);
  };

  const handleOffConfirmNo = (): void => {
    setShowOffConfirm(false);
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

      {/* Off toggle with confirm */}
      {!showOffConfirm ? (
        <button
          type="button"
          className={styles.offToggle}
          onClick={handleOffClick}
          data-testid="nav-cluster-off-toggle"
        >
          Turn off navigation cluster
        </button>
      ) : (
        <div className={styles.confirmDialog} data-testid="nav-cluster-off-confirm">
          <span className={styles.confirmText}>Turn off the navigation cluster?</span>
          <button
            type="button"
            className={`${styles.confirmBtn} ${styles.confirmYes}`}
            onClick={handleOffConfirmYes}
            data-testid="nav-cluster-off-confirm-yes"
          >
            Yes
          </button>
          <button
            type="button"
            className={`${styles.confirmBtn} ${styles.confirmNo}`}
            onClick={handleOffConfirmNo}
            data-testid="nav-cluster-off-confirm-no"
          >
            No
          </button>
        </div>
      )}
    </div>
  );
}
