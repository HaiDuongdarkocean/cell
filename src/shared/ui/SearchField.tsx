import { useState, useEffect, type ChangeEvent, type InputHTMLAttributes } from 'react';
import { Input } from './Input';
import { Icon } from '@/shared/icons/Icon';
import styles from './SearchField.module.css';

export interface SearchFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'onChange' | 'value'> {
  /** Current value. */
  value?: string;
  /** Called with the new value when input changes. */
  onChange?: (value: string) => void;
  /** Called when the user clears the field. */
  onClear?: () => void;
}

/**
 * SearchField — Input with a leading search icon and a clear button.
 */
export function SearchField({
  value,
  onChange,
  onClear,
  placeholder,
  disabled,
  className,
  ...rest
}: SearchFieldProps): React.JSX.Element {
  const [internalValue, setInternalValue] = useState(value ?? '');

  useEffect(() => {
    if (value !== undefined) {
      setInternalValue(value);
    }
  }, [value]);

  const currentValue = value !== undefined ? value : internalValue;

  const handleChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const next = e.target.value;
    if (value === undefined) {
      setInternalValue(next);
    }
    onChange?.(next);
  };

  const handleClear = (): void => {
    if (value === undefined) {
      setInternalValue('');
    }
    onChange?.('');
    onClear?.();
  };

  const suffix = currentValue && !disabled ? (
    <button
      type="button"
      className={styles.clear}
      aria-label="Clear"
      onClick={handleClear}
    >
      <Icon name="x" size={16} />
    </button>
  ) : undefined;

  return (
    <Input
      type="search"
      value={currentValue}
      onChange={handleChange}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
      prefix={<Icon name="search" size={18} />}
      suffix={suffix}
      {...rest}
    />
  );
}
