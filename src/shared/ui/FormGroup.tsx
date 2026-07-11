import type { ReactNode } from 'react';
import { Label } from './Label';
import styles from './FormGroup.module.css';

export interface FormGroupProps {
  /** Label text or element. */
  label?: ReactNode;
  /** HTML id to associate with the label. */
  htmlFor?: string;
  /** Required indicator. */
  required?: boolean;
  /** Disabled styling. */
  disabled?: boolean;
  /** Group content. */
  children: ReactNode;
}

/**
 * FormGroup — wraps a label and children with consistent spacing.
 */
export function FormGroup({ label, htmlFor, required, disabled, children }: FormGroupProps): React.JSX.Element {
  return (
    <div className={styles.root}>
      {label && (
        <Label htmlFor={htmlFor} required={required} disabled={disabled}>
          {label}
        </Label>
      )}
      {children}
    </div>
  );
}
