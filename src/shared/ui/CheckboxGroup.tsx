import type { ReactNode } from 'react';
import { Checkbox } from './Checkbox';
import styles from './CheckboxGroup.module.css';

export interface CheckboxGroupOption {
  value: string;
  label: ReactNode;
  disabled?: boolean;
}

export interface CheckboxGroupProps {
  /** Optional shared name for checkboxes. */
  name?: string;
  /** Options list. */
  options: CheckboxGroupOption[];
  /** Selected values. */
  value?: string[];
  /** Called with updated selected values. */
  onChange?: (value: string[]) => void;
  /** Disabled state. */
  disabled?: boolean;
  /** Error state. */
  error?: boolean;
}

/**
 * CheckboxGroup — managed list of checkboxes.
 */
export function CheckboxGroup({
  name,
  options,
  value = [],
  onChange,
  disabled,
  error,
}: CheckboxGroupProps): React.JSX.Element {
  const toggle = (optValue: string): void => {
    const next = value.includes(optValue) ? value.filter((v) => v !== optValue) : [...value, optValue];
    onChange?.(next);
  };

  return (
    <div className={styles.root} role="group">
      {options.map((opt) => (
        <Checkbox
          key={opt.value}
          name={name}
          value={opt.value}
          label={opt.label}
          checked={value.includes(opt.value)}
          disabled={disabled || opt.disabled}
          error={error}
          onChange={() => toggle(opt.value)}
        />
      ))}
    </div>
  );
}
