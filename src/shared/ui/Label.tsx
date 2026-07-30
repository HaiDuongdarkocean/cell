import type { LabelHTMLAttributes, ReactNode } from 'react';
import styles from './Label.module.css';

type LabelSize = 'sm' | 'md' | 'lg';

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  /** Shows a required indicator. */
  required?: boolean;
  /** Renders in a muted/disabled style. */
  disabled?: boolean;
  /** Font size. Default: md. */
  size?: LabelSize;
  children: ReactNode;
}

/**
 * Label — form control label with required, disabled, and size states.
 */
export function Label({ required, disabled, size = 'md', children, className, ...rest }: LabelProps): React.JSX.Element {
  const cls = [styles.label, styles[size], disabled ? styles.disabled : '', className ?? ''].filter(Boolean).join(' ');

  return (
    <label className={cls} {...rest}>
      {children}
      {required && <span className={styles.required} aria-hidden="true">*</span>}
    </label>
  );
}
