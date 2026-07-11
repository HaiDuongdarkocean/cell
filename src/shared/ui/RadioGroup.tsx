import type { ReactNode } from 'react';
import { Radio } from './Radio';
import styles from './RadioGroup.module.css';

export interface RadioGroupOption {
  value: string;
  label: ReactNode;
  disabled?: boolean;
}

export interface RadioGroupProps {
  /** Shared name for radios. */
  name?: string;
  /** Options list. */
  options: RadioGroupOption[];
  /** Selected value. */
  value?: string;
  /** Called with the selected value. */
  onChange?: (value: string) => void;
  /** Disabled state. */
  disabled?: boolean;
  /** Error state. */
  error?: boolean;
}

/**
 * RadioGroup — managed list of radios.
 */
export function RadioGroup({
  name,
  options,
  value,
  onChange,
  disabled,
  error,
}: RadioGroupProps): React.JSX.Element {
  return (
    <div className={styles.root} role="radiogroup">
      {options.map((opt) => (
        <Radio
          key={opt.value}
          name={name}
          value={opt.value}
          label={opt.label}
          checked={value === opt.value}
          disabled={disabled || opt.disabled}
          error={error}
          onChange={() => onChange?.(opt.value)}
        />
      ))}
    </div>
  );
}
