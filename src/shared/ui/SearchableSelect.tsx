import { useState, useRef, useMemo, useEffect, type KeyboardEvent, type ReactElement } from 'react';
import styles from './SearchableSelect.module.css';

/** A single selectable option. */
export interface SearchableSelectOption {
  value: string;
  label: string;
}

/** Props for the SearchableSelect component. */
export interface SearchableSelectProps {
  /** Test-id prefix used for data-testid attributes on sub-elements. */
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
  /** Optional data-testid for the trigger button. */
  dataTestId?: string;
  /** Search input placeholder. Defaults to "Search...". */
  placeholder?: string;
  /** Max height of the option list in pixels. Defaults to 220. */
  maxHeight?: number;
  /** Whether the select is disabled. */
  disabled?: boolean;
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
  maxHeight = 220,
  disabled = false,
}: SearchableSelectProps): ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

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
      handleSelect(filtered[highlightedIndex].value);
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

  // Focus search input when menu opens
  if (isOpen && searchRef.current) {
    searchRef.current.focus();
  }

  return (
    <div className={styles.container} ref={menuRef}>
      {/* Trigger button */}
      <button
        type="button"
        id={id}
        data-testid={dataTestId}
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
        <svg
          className={styles.chevron}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Menu */}
      {isOpen && (
        <div className={styles.menu} role="listbox" style={{ maxHeight }}>
          {/* Search input */}
          <div className={styles.searchWrap}>
            <svg
              className={styles.searchIcon}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref={searchRef}
              type="search"
              className={styles.searchInput}
              placeholder={placeholder}
              aria-label="Search options"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setHighlightedIndex(0);
              }}
              onKeyDown={handleSearchKeyDown}
            />
          </div>

          {/* Options list */}
          <ul className={styles.list} role="listbox">
            {filtered.length > 0 ? (
              filtered.map((opt, index) => (
                <li
                  key={opt.value}
                  className={`${styles.option} ${opt.value === value ? styles.optionSelected : ''} ${index === highlightedIndex ? styles.optionHighlighted : ''}`}
                  role="option"
                  aria-selected={opt.value === value}
                  data-testid={`${testId}-option-${opt.value}`}
                  onClick={() => handleSelect(opt.value)}
                  onKeyDown={(e) => handleOptionKeyDown(e, opt.value)}
                >
                  <span className={styles.optionLabel}>{opt.label}</span>
                  {opt.value === value && (
                    <svg
                      className={styles.checkMark}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
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
