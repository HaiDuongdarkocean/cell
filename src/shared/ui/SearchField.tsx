import { useState, useEffect, type ChangeEvent, type InputHTMLAttributes } from 'react';
import { Input } from './Input';
import { IconButton } from './IconButton';
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

  return (
    <div className={[styles.root, className ?? ''].filter(Boolean).join(' ')}>
      <span className={styles.leadingIcon} aria-hidden="true">
        {/* FIXME: extract to registry once stroke-width variant supported — search circle r=7 differs from ICON_CATALOG.search (r=8) */}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </span>
      <Input
        type="search"
        value={currentValue}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        className={styles.input}
        {...rest}
      />
      {currentValue && !disabled && (
        <IconButton
          type="button"
          className={styles.clear}
          aria-label="Clear"
          variant="ghost"
          size="xs"
          onClick={handleClear}
        >
          <Icon name="x" />
        </IconButton>
      )}
    </div>
  );
}
