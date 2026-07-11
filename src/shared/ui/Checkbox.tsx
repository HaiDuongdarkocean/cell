import { useEffect, useRef, type InputHTMLAttributes, type ReactNode } from 'react';
import styles from './Checkbox.module.css';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Label text or element shown next to the checkbox. */
  label?: ReactNode;
  /** Render as indeterminate (mixed state). */
  indeterminate?: boolean;
  /** Error state. */
  error?: boolean;
  /** Helper text shown below the label. */
  helperText?: ReactNode;
}

/**
 * Checkbox — accessible form control with label, indeterminate, error, and disabled states.
 */
export function Checkbox({
  label,
  indeterminate,
  error,
  disabled,
  helperText,
  className,
  ...rest
}: CheckboxProps): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = !!indeterminate;
    }
  }, [indeterminate]);

  const rootClass = [styles.root, error ? styles.error : '', disabled ? styles.disabled : '', className ?? '']
    .filter(Boolean)
    .join(' ');
  const inputClass = [styles.input, error ? styles.error : ''].filter(Boolean).join(' ');

  return (
    <label className={rootClass}>
      <input
        ref={inputRef}
        type="checkbox"
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
