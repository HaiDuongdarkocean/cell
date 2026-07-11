import type { LabelHTMLAttributes, ReactNode } from 'react';
import styles from './Label.module.css';

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  /** Shows a required indicator. */
  required?: boolean;
  /** Renders in a muted/disabled style. */
  disabled?: boolean;
  children: ReactNode;
}

/**
 * Label — form control label with required and disabled states.
 */
export function Label({ required, disabled, children, className, ...rest }: LabelProps): React.JSX.Element {
  const cls = [styles.label, disabled ? styles.disabled : '', className ?? ''].filter(Boolean).join(' ');

  return (
    <label className={cls} {...rest}>
      {children}
      {required && <span className={styles.required} aria-hidden="true">*</span>}
    </label>
  );
}
