import { useState, useEffect, type ChangeEvent, type InputHTMLAttributes, type ReactNode } from 'react';
import { Button } from './Button';
import { Input } from './Input';
import { Icon } from '@/shared/icons/Icon';
import { t } from '@/shared/i18n';
import styles from './SearchField.module.css';

export interface SearchFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'onChange' | 'value' | 'prefix'> {
  /** Current value. */
  value?: string;
  /** Called with the new value when input changes. */
  onChange?: (value: string) => void;
  /** Called when the user clears the field. */
  onClear?: () => void;
  /** Leading content. Default: search icon. Pass null to hide. */
  prefix?: ReactNode;
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
  prefix,
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
    <Button shape="circle" material="solid" variant="ghost"
      className={styles.clear}
      aria-label={t('ui.searchField.clear')}
      onClick={handleClear}
    >
      <Icon name="x" size={16} />
    </Button>
  ) : undefined;

  return (
    <Input
      type="search"
      value={currentValue}
      onChange={handleChange}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
      prefix={prefix === undefined ? <Icon name="search" size={18} /> : prefix}
      suffix={suffix}
      {...rest}
    />
  );
}
