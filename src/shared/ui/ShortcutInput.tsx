import type { InputHTMLAttributes } from 'react';
import styles from './ShortcutInput.module.css';

interface ShortcutInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'type' | 'value' | 'maxLength'> {
  /** Current single-character key (lowercase normalized). */
  value: string;
  /** Called with the normalized lowercase single char when user types. */
  onChange: (key: string) => void;
  /** Accessible label (required — input has no visible label). */
  'aria-label': string;
}

/**
 * ShortcutInput atom — uppercase + center single-char (settings-controls-restyle spec F3).
 *
 * Replaces plain `<input type="text">` in SettingsDialog keyboard shortcuts
 * section (5 actions: prev-cue, next-cue, replay-cue, toggle-overlay, toggle-panel).
 * maxLength 1, normalizes to lowercase slice(0,1) on change.
 *
 * Accessibility: `aria-label` required, focus-visible 2px solid primary + 2px offset.
 */
export function ShortcutInput({
  value,
  onChange,
  className,
  ...rest
}: ShortcutInputProps): React.JSX.Element {
  const handleChange = (e: React.SyntheticEvent<HTMLInputElement>): void => {
    const normalized = e.currentTarget.value.toLowerCase().slice(0, 1);
    onChange(normalized);
  };
  const cls = `${styles.shortcutInput} ${className ?? ''}`.trim();
  return (
    <input
      type="text"
      className={cls}
      value={value}
      onChange={handleChange}
      maxLength={1}
      {...rest}
    />
  );
}
