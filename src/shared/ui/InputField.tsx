import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { Label } from './Label';
import { Input } from './Input';
import styles from './InputField.module.css';

export interface InputFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Field label. */
  label: ReactNode;
  /** Error message; triggers error styling when provided. */
  error?: string;
  /** Helper text shown below the input when no error. */
  helperText?: ReactNode;
  /** Required indicator. */
  required?: boolean;
  /** Optional explicit id; falls back to a generated id. */
  id?: string;
}

/**
 * InputField — molecule combining Label, Input, and helper/error text.
 */
export function InputField({
  id,
  label,
  error,
  helperText,
  required,
  disabled,
  className,
  ...rest
}: InputFieldProps): React.JSX.Element {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <div className={[styles.root, className ?? ''].filter(Boolean).join(' ')}>
      <Label htmlFor={inputId} required={required} disabled={disabled}>
        {label}
      </Label>
      <Input
        id={inputId}
        error={!!error}
        errorMessage={error}
        helperText={!error ? helperText : undefined}
        disabled={disabled}
        {...rest}
      />
    </div>
  );
}
