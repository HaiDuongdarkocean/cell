import { useState, useRef, useEffect } from 'react';
import { IconButton } from '@/shared/ui/IconButton';
import { Icon } from '@/shared/ui';
import styles from './LauncherSearchBar.module.css';

export interface LauncherSearchBarProps {
  value?: string;
  placeholder?: string;
  onChange?: (value: string) => void;
  onFocus?: () => void;
}

export function LauncherSearchBar({
  value = '',
  placeholder = 'Search Cell…',
  onChange,
  onFocus,
}: LauncherSearchBarProps) {
  const [internal, setInternal] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setInternal(value);
  }, [value]);

  const displayValue = onChange !== undefined ? value : internal;

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value;
    if (onChange === undefined) {
      setInternal(next);
    }
    onChange?.(next);
  };

  return (
    <div className={styles.searchBar}>
      <span className={styles.icon}>
        <Icon name="search" size="md" />
      </span>
      <input
        ref={inputRef}
        type="search"
        className={styles.input}
        value={displayValue}
        placeholder={placeholder}
        onChange={handleChange}
        onFocus={onFocus}
        autoComplete="off"
        spellCheck={false}
      />
      {displayValue.length > 0 && (
        <IconButton material="solid" variant="ghost"
          className={styles.clear}
          onClick={() => {
            inputRef.current?.focus();
            onChange?.('');
            setInternal('');
          }}
          aria-label="Clear search"
        >
          <Icon name="x" size="sm" />
        </IconButton>
      )}
    </div>
  );
}
