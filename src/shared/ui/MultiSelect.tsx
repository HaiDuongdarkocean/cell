import { useMemo, useRef, useState, type KeyboardEvent, type ReactElement } from 'react';
import { Icon } from '@/shared/ui/Icon';
import { t } from '@/shared/i18n';
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
  options: readonly MultiSelectOption[];
  /** Currently selected values. */
  selectedValues: readonly string[];
  /** Called with the new selection array whenever a chip is added/removed. */
  onChange: (values: string[]) => void;
  /** Search input placeholder. Defaults to the i18n placeholder. */
  placeholder?: string;
  /** Max height of the suggestion list in pixels. */
  maxHeight?: number;
  /**
   * Values that are mutually exclusive with every other selection
   * (e.g. an 'all' sentinel): adding one clears the rest, adding a
   * specific value drops all exclusive values.
   */
  exclusiveValues?: readonly string[];
  /** Quick-pick values shown as chips when nothing is selected. */
  popularValues?: readonly string[];
}

/**
 * Multi-select as a tag field (Concept C).
 *
 * Selected values are removable chips inside the input; typing filters an
 * in-flow suggestion list; Enter adds the first match, Backspace removes the
 * last chip, Escape blurs. Exclusive values (e.g. 'all') behave as a mode,
 * not a sibling item.
 */
export function MultiSelect({
  testId,
  options,
  selectedValues,
  onChange,
  placeholder,
  maxHeight,
  exclusiveValues = [],
  popularValues = [],
}: MultiSelectProps): ReactElement {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedSet = useMemo(() => new Set(selectedValues), [selectedValues]);
  const exclusiveSet = useMemo(() => new Set(exclusiveValues), [exclusiveValues]);
  const optionByValue = useMemo(
    () => new Map(options.map((o) => [o.value, o])),
    [options],
  );

  const add = (value: string): void => {
    if (selectedSet.has(value)) return;
    const base = exclusiveSet.has(value)
      ? []
      : selectedValues.filter((v) => !exclusiveSet.has(v));
    onChange([...base, value]);
    setQuery('');
    inputRef.current?.focus();
  };

  const remove = (value: string): void => {
    onChange(selectedValues.filter((v) => v !== value));
  };

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    return options.filter(
      (o) => !selectedSet.has(o.value) && (!q || o.label.toLowerCase().includes(q)),
    );
  }, [options, selectedSet, query]);

  const popular = useMemo(
    () =>
      popularValues
        .map((v) => optionByValue.get(v))
        .filter((o): o is MultiSelectOption => o !== undefined && !selectedSet.has(o.value)),
    [popularValues, optionByValue, selectedSet],
  );

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter' && suggestions[0]) {
      e.preventDefault();
      add(suggestions[0].value);
    } else if (e.key === 'Backspace' && !query && selectedValues.length > 0) {
      remove(selectedValues[selectedValues.length - 1]);
    } else if (e.key === 'Escape') {
      // The first Escape only blurs the input — consume it so an ancestor
      // surface (e.g. UniversalPanel) doesn't close on the same keypress.
      e.stopPropagation();
      inputRef.current?.blur();
    }
  };

  const showSuggestions = focused || query.trim().length > 0;

  return (
    <div className={styles.container} data-cell-id={testId}>
      {/* Chip field — the selection itself */}
      <div
        className={`${styles.field} ${focused ? styles.fieldFocused : ''}`}
        onClick={() => inputRef.current?.focus()}
      >
        <Icon name="search" size="xs" className={styles.searchIcon} />
        {selectedValues.map((value) => {
          const opt = optionByValue.get(value);
          const label = opt?.label ?? value;
          return (
            <span
              key={value}
              className={`${styles.chip} ${exclusiveSet.has(value) ? styles.chipExclusive : ''}`}
              data-cell-id={`${testId}-chip-${value}`}
            >
              {label}
              <button
                type="button"
                className={styles.chipRemove}
                aria-label={t('ui.multiSelect.removeChip', [label])}
                data-cell-id={`${testId}-remove-${value}`}
                onClick={(e) => {
                  e.stopPropagation();
                  remove(value);
                }}
              >
                <Icon name="x" size="xs" />
              </button>
            </span>
          );
        })}
        <input
          ref={inputRef}
          type="search"
          className={styles.input}
          placeholder={selectedValues.length > 0 ? '' : (placeholder ?? t('ui.multiSelect.searchPlaceholder'))}
          aria-label={t('ui.multiSelect.addAria')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </div>

      {/* Popular quick-picks when the field is empty */}
      {selectedValues.length === 0 && !query && popular.length > 0 && (
        <div className={styles.popular}>
          <span className={styles.popularLabel}>{t('ui.multiSelect.popular')}</span>
          {popular.map((o) => (
            <button
              key={o.value}
              type="button"
              className={styles.popChip}
              data-cell-id={`${testId}-popular-${o.value}`}
              onClick={() => add(o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}

      {/* Suggestions — in-flow so the parent card grows with the list */}
      {showSuggestions && (
        <ul
          className={styles.suggestions}
          role="listbox"
          aria-label={t('common.searchOptions.aria')}
          style={maxHeight !== undefined ? ({ '--multi-select-max-height': `${maxHeight}px` } as React.CSSProperties) : undefined}
        >
          {suggestions.map((o) => (
            <li key={o.value} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={false}
                className={styles.suggest}
                data-cell-id={`${testId}-option-${o.value}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => add(o.value)}
              >
                <span className={styles.suggestLabel}>{o.label}</span>
                <Icon name="plus" size="xs" className={styles.suggestAdd} />
              </button>
            </li>
          ))}
          {suggestions.length === 0 && (
            <li className={styles.empty} role="presentation">
              {t('common.noResults')}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
