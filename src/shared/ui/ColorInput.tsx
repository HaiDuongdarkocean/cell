import type { InputHTMLAttributes } from 'react';
import styles from './ColorInput.module.css';

export type ColorInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

/**
 * ColorInput — shared color-picker atom wrapping native `input[type=color]`.
 * Applies design-token swatch chrome (border, radius, focus ring).
 * Promoted from SubtitleStylePanel when a second style control needed it.
 */
export function ColorInput({ className, ...rest }: ColorInputProps): React.JSX.Element {
  const cls = [styles.colorInput, className ?? ''].filter(Boolean).join(' ');
  return <input type="color" className={cls} {...rest} />;
}
