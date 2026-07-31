import type { InputHTMLAttributes } from 'react';
import styles from './Slider.module.css';

interface SliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'type' | 'value'> {
  /** Current numeric value. */
  value: number;
  /** Minimum value. */
  min: number;
  /** Maximum value. */
  max: number;
  /** Step increment. */
  step: number;
  /** Called with the new numeric value when user drags/changes. */
  onChange: (value: number) => void;
  /** Accessible label (required — slider has no visible label). */
  'aria-label': string;
}

/**
 * Slider atom — styled range input (settings-controls-restyle spec F2).
 *
 * Replaces native `<input type="range">` + `accent-color` in
 * NavClusterSettingsPanel (button size, bg opacity, button opacity).
 * Atom only renders + emits numeric value — snap logic stays in caller
 * (button size 40/48/56 presets per ADR-018 D2).
 *
 * Design-system updates:
 * - Track uses semantic `--color-track`; filled portion uses `--color-primary`.
 * - Thumb floats with `--shadow-floating`, scales on hover/active.
 * - Track + thumb are vertically centered inside `--touch-target` via padding.
 * - Keyboard: Arrow Up/Down/Left/Right adjusts (native range).
 *
 * Accessibility: `aria-label` required; `aria-valuenow` set explicitly;
 * focus-visible 2px solid primary + 2px offset.
 */
export function Slider({
  value,
  min,
  max,
  step,
  onChange,
  className,
  ...rest
}: SliderProps): React.JSX.Element {
  const progress = ((value - min) / (max - min)) * 100;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    onChange(Number(e.currentTarget.value));
  };

  const cls = `${styles.slider} ${className ?? ''}`.trim();

  const sliderStyle = {
    ...(rest.style ?? {}),
    '--progress': `${progress}%`,
  } as React.CSSProperties;

  return (
    <input
      type="range"
      className={cls}
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={handleChange}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      {...rest}
      style={sliderStyle}
    />
  );
}
