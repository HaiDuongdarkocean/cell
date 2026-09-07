import { useState, useRef, useEffect } from 'react';

import { Button, Icon, Input } from '@/shared/ui';
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
      <Input
        ref={inputRef}
        type="search"
        variant="ghost"
        className={styles.input}
        prefix={<Icon name="search" size="md" />}
        suffix={
          displayValue.length > 0 ? (
            <Button shape="circle" variant="ghost"
              className={styles.clear}
              onClick={() => {
                inputRef.current?.focus();
                onChange?.('');
                setInternal('');
              }}
              aria-label="Clear search"
            >
              <Icon name="x" size="sm" />
            </Button>
          ) : undefined
        }
        value={displayValue}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={handleChange}
        onFocus={onFocus}
        autoComplete="off"
        spellCheck={false}
      />
    </div>
  );
}
