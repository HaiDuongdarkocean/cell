import { useState, useRef, useMemo, type KeyboardEvent, type ReactElement } from 'react';
import { Icon } from '@/shared/icons/Icon';
import styles from './MultiSelect.module.css';

/** A single selectable option. */
export interface MultiSelectOption {
  value: string;
  label: string;
}

/** Props for the MultiSelect component. */
export interface MultiSelectProps {
  /** Test-id prefix used for data-cell-id attributes on sub-elements. */
  testId: string;
  /** All available options. */
  options: MultiSelectOption[];
  /** Currently selected values. */
  selectedValues: string[];
  /** Called with the new selection array whenever a toggle occurs. */
  onChange: (values: string[]) => void;
  /** Search input placeholder. Defaults to "Search...". */
  placeholder?: string;
  /** Max height of the option list in pixels. Defaults to 220. */
  maxHeight?: number;
}

/**
 * Multi-select with search and iOS-style toggle switches.
 *
 * Filtering matches the option label case-insensitively, including the
 * native name in parentheses (e.g. "Spanish (Español)" matches "español").
 *
 * Design:
 * - Clean search bar with subtle focus ring
 * - Selected items pinned to top with a divider
 * - iOS-style toggle switches (pure CSS, no checkbox)
 * - Smooth transitions, accessible keyboard navigation
 */
export function MultiSelect({
  testId,
  options,
  selectedValues,
  onChange,
  placeholder = 'Search languages...',
  maxHeight,
}: MultiSelectProps): ReactElement {
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const selectedSet = useMemo(
    () => new Set(selectedValues),
    [selectedValues],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((opt) => opt.label.toLowerCase().includes(q));
  }, [options, query]);

  const sorted = useMemo(() => {
    // Selected items follow the order they were added (oldest first, newest last)
    const filteredByValue = new Map(filtered.map((opt) => [opt.value, opt]));
    const selected = selectedValues
      .map((v) => filteredByValue.get(v))
      .filter((opt): opt is MultiSelectOption => Boolean(opt));
    const unselected = filtered.filter((opt) => !selectedSet.has(opt.value));
    return { selected, unselected };
  }, [filtered, selectedSet, selectedValues]);

  const selectedCount = selectedValues.length;

  const toggle = (value: string): void => {
    if (selectedSet.has(value)) {
      onChange(selectedValues.filter((v) => v !== value));
    } else {
      onChange([...selectedValues, value]);
    }
  };

  const handleOptionKeyDown = (e: KeyboardEvent<HTMLLIElement>, value: string): void => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggle(value);
    }
  };

  const handleSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Escape') {
      searchRef.current?.blur();
    }
  };

  const renderOption = (opt: MultiSelectOption, isSelected: boolean): ReactElement => (
    <li
      key={opt.value}
      className={`${styles.option} ${isSelected ? styles.optionSelected : ''}`}
      role="option"
      aria-selected={isSelected}
      data-cell-id={`${testId}-option-${opt.value}`}
      tabIndex={0}
      onClick={() => toggle(opt.value)}
      onKeyDown={(e) => handleOptionKeyDown(e, opt.value)}
    >
      <span className={styles.optionLabel}>{opt.label}</span>
      <span className={styles.toggleSwitch} data-toggle="switch" aria-hidden="true">
        <span className={styles.toggleKnob} />
      </span>
    </li>
  );

  return (
    <div className={styles.container} data-cell-id={testId}>
      {/* Search bar */}
      <div className={styles.searchWrap}>
        <Icon name="search" className={styles.searchIcon} />
        <input
          ref={searchRef}
          type="search"
          className={styles.searchInput}
          placeholder={placeholder}
          aria-label="Search languages"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleSearchKeyDown}
        />
        {selectedCount > 0 && (
          <span className={styles.badge} data-cell-id={`${testId}-count`}>
            {selectedCount}
          </span>
        )}
      </div>

      {/* Options list */}
      <ul
        className={styles.list}
        role="listbox"
        style={maxHeight !== undefined ? { '--list-max-height': `${maxHeight}px` } as React.CSSProperties : undefined}
      >
        {sorted.selected.length > 0 && (
          <>
            <li className={styles.sectionHeader} role="presentation">
              <span>Selected</span>
              <span className={styles.sectionCount}>{sorted.selected.length}</span>
            </li>
            {sorted.selected.map((opt) => renderOption(opt, true))}
            {sorted.unselected.length > 0 && <li className={styles.divider} role="presentation" />}
          </>
        )}
        {sorted.unselected.length > 0 && (
          <>
            <li className={styles.sectionHeader} role="presentation">
              <span>{query ? 'Results' : 'All languages'}</span>
              <span className={styles.sectionCount}>{sorted.unselected.length}</span>
            </li>
            {sorted.unselected.map((opt) => renderOption(opt, false))}
          </>
        )}
        {filtered.length === 0 && (
          <li className={styles.emptyState} role="presentation">
            No languages found
          </li>
        )}
      </ul>
    </div>
  );
}
