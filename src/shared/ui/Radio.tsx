import type { InputHTMLAttributes, ReactNode } from 'react';
import styles from './Radio.module.css';

export interface RadioProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Label text or element shown next to the radio. */
  label?: ReactNode;
  /** Error state. */
  error?: boolean;
  /** Helper text shown below the label. */
  helperText?: ReactNode;
}

/**
 * Radio — accessible form control with label, error, and disabled states.
 */
export function Radio({ label, error, disabled, helperText, className, ...rest }: RadioProps): React.JSX.Element {
  const rootClass = [styles.root, error ? styles.error : '', disabled ? styles.disabled : '', className ?? '']
    .filter(Boolean)
    .join(' ');
  const inputClass = [styles.input, error ? styles.error : ''].filter(Boolean).join(' ');

  return (
    <label className={rootClass}>
      <input
        type="radio"
        className={inputClass}
        disabled={disabled}
        aria-invalid={error || undefined}
        {...rest}
      />
      <span className={styles.box} aria-hidden="true" />
      {label && <span className={styles.labelText}>{label}</span>}
      {helperText && <span className={styles.helper}>{helperText}</span>}
    </label>
  );
}
