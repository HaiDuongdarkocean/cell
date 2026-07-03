import type { ButtonHTMLAttributes } from 'react';
import styles from './Toggle.module.css';

interface ToggleProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  /** Current checked state. */
  checked: boolean;
  /** Called with the next checked state when user clicks. */
  onChange: (next: boolean) => void;
  /** Accessible label (required — toggle has no visible text). */
  'aria-label': string;
}

/**
 * Toggle atom — switch pill 32×18px (settings-controls-restyle spec F1).
 *
 * Replaces IconButton star-icon toggles in SettingsDialog (auto-select, overlay
 * auto-load) and NavClusterSettingsPanel (enable). Slide animation via CSS
 * transform on the thumb. Consumes tokens only — no raw hex/radius.
 *
 * Accessibility: `aria-pressed` reflects checked state, focus-visible 2px solid
 * primary + 2px offset. Keyboard: Space/Enter toggles (native button).
 */
export function Toggle({
  checked,
  onChange,
  className,
  ...rest
}: ToggleProps): React.JSX.Element {
  const cls = `${styles.toggle} ${checked ? styles.on : ''} ${className ?? ''}`.trim();
  return (
    <button
      type="button"
      role="switch"
      className={cls}
      aria-checked={checked}
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
      {...rest}
    >
      <span className={styles.thumb} aria-hidden="true" />
    </button>
  );
}
