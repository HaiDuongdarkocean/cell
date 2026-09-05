import { useState, useRef, useMemo, useEffect, useId, type KeyboardEvent, type ReactElement } from 'react';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/icons/Icon';
import styles from './SearchableSelect.module.css';

/** A single selectable option. */
export interface SearchableSelectOption {
  value: string;
  label: string;
}

/** Props for the SearchableSelect component. */
export interface SearchableSelectProps {
  /** Test-id prefix used for data-cell-id attributes on sub-elements. */
  testId?: string;
  /** All available options. */
  options: SearchableSelectOption[];
  /** Currently selected value. */
  value: string;
  /** Called with the new value when selection changes. */
  onChange: (value: string) => void;
  /** Accessible label for the trigger button. */
  ariaLabel: string;
  /** Optional HTML id. */
  id?: string;
  /** Optional data-cell-id for the trigger button. */
  dataTestId?: string;
  /** Search input placeholder. Defaults to "Search...". */
  placeholder?: string;
  /** Max height of the option list in pixels. Defaults to 220. */
  maxHeight?: number;
  /** Whether the select is disabled. */
  disabled?: boolean;
  /** Menu alignment relative to trigger. Default: left (opens rightward). Use right when trigger sits on the right side of a row. */
  menuAlign?: 'left' | 'right';
}

/**
 * SearchableSelect — single-select dropdown with embedded search
 * (settings-controls-restyle spec F5).
 *
 * Reuses MultiSelect filter logic (case-insensitive, matches label incl.
 * native name in parens) but single-select semantics with check mark.
 *
 * Design:
 * - Trigger button (same visual as CustomSelect)
 * - Menu opens with search input auto-focused
 * - Type to filter, Arrow Up/Down to navigate, Enter to select, Esc to close
 * - Selected item shows check mark (single-select, not toggle)
 * - "No languages found" empty state
 */
export function SearchableSelect({
  testId = 'searchable-select',
  options,
  value,
  onChange,
  ariaLabel,
  id,
  dataTestId,
  placeholder = 'Search...',
  maxHeight,
  disabled = false,
  menuAlign = 'left',
}: SearchableSelectProps): ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listboxId = `${useId()}-listbox`;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((opt) => opt.label.toLowerCase().includes(q));
  }, [options, query]);

  const selectedOption = options.find((opt) => opt.value === value);

  const handleTriggerClick = (): void => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setQuery('');
      setHighlightedIndex(0);
    }
  };

  const handleSelect = (selectedValue: string): void => {
    onChange(selectedValue);
    setIsOpen(false);
    setQuery('');
  };

  const handleSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && filtered.length > 0) {
      e.preventDefault();
      const clampedIndex = Math.min(highlightedIndex, filtered.length - 1);
      handleSelect(filtered[clampedIndex].value);
    }
  };

  const handleOptionKeyDown = (e: KeyboardEvent<HTMLLIElement>, optValue: string): void => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleSelect(optValue);
    }
  };

  // Close menu when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: Event): void => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Clamp highlighted index when the filtered list shrinks (e.g. search query narrows).
  useEffect(() => {
    setHighlightedIndex((prev) => Math.min(prev, Math.max(filtered.length - 1, 0)));
  }, [filtered.length]);

  // Focus search input when menu opens (side effect in useEffect, not during render)
  useEffect(() => {
    if (isOpen) {
      searchRef.current?.focus();
    }
  }, [isOpen]);

  return (
    <div className={styles.container} ref={menuRef}>
      {/* Trigger button */}
      <Button material="solid" variant="secondary"
        id={id}
        data-cell-id={dataTestId}
        className={`${styles.trigger} ${isOpen ? styles.triggerOpen : ''} ${disabled ? styles.triggerDisabled : ''}`}
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        onClick={disabled ? undefined : handleTriggerClick}
        disabled={disabled}
      >
        <span className={styles.value}>
          {selectedOption?.label || placeholder}
        </span>
        <Icon name="chevronDown" className={styles.chevron} />
      </Button>

      {/* Menu */}
      {isOpen && (
        <div
          className={`${styles.menu} ${menuAlign === 'right' ? styles.menuAlignRight : styles.menuAlignLeft}`}
          style={maxHeight !== undefined ? { '--searchable-select-max-height': `${maxHeight}px` } as React.CSSProperties : undefined}
        >
          {/* Search input */}
          <div className={styles.searchWrap}>
            <Icon name="search" className={styles.searchIcon} />
            <input
              ref={searchRef}
              type="search"
              className={styles.searchInput}
              placeholder={placeholder}
              aria-label="Search options"
              role="combobox"
              aria-expanded={isOpen}
              aria-controls={listboxId}
              aria-activedescendant={filtered.length > 0 ? `${listboxId}-option-${highlightedIndex}` : undefined}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setHighlightedIndex(0);
              }}
              onKeyDown={handleSearchKeyDown}
            />
          </div>

          {/* Options list */}
          <ul className={styles.list} role="listbox" id={listboxId}>
            {filtered.length > 0 ? (
              filtered.map((opt, index) => (
                <li
                  key={opt.value}
                  id={`${listboxId}-option-${index}`}
                  className={`${styles.option} ${opt.value === value ? styles.optionSelected : ''} ${index === highlightedIndex ? styles.optionHighlighted : ''}`}
                  role="option"
                  aria-selected={opt.value === value}
                  data-cell-id={`${testId}-option-${opt.value}`}
                  onClick={() => handleSelect(opt.value)}
                  onKeyDown={(e) => handleOptionKeyDown(e, opt.value)}
                >
                  <span className={styles.optionLabel}>{opt.label}</span>
                  {opt.value === value && (
                    <Icon name="check" className={styles.checkMark} />
                  )}
                </li>
              ))
            ) : (
              <li className={styles.emptyState} role="presentation">
                No languages found
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
