import { useMemo, useRef, useState, type KeyboardEvent, type ReactElement } from 'react';
import { Icon } from '@/shared/ui/Icon';
import { LANGUAGE_OPTIONS, ALL_VALUE, isAll, labelOf, POPULAR_VALUES } from './mockData';

interface Props {
  selected: string[];
  onChange: (values: string[]) => void;
}

/**
 * Concept C — tag field (combobox).
 *
 * Selected languages are removable chips inside the input; typing filters a
 * suggestion list that expands in-flow. 'All languages' is a single locked
 * chip — removing it or adding a specific language leaves all-mode.
 */
export function ConceptC({ selected, onChange }: Props): ReactElement {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const all = isAll(selected);
  const specifics = selected.filter((v) => v !== ALL_VALUE);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    const chosen = new Set(selected);
    const pool = q
      ? LANGUAGE_OPTIONS.filter((o) => o.label.toLowerCase().includes(q))
      : LANGUAGE_OPTIONS;
    return pool.filter((o) => !chosen.has(o.value)).slice(0, q ? 12 : 8);
  }, [query, selected]);

  const popular = useMemo(
    () =>
      POPULAR_VALUES.map((v) => LANGUAGE_OPTIONS.find((o) => o.value === v)).filter(
        (o): o is (typeof LANGUAGE_OPTIONS)[number] =>
          o !== undefined && !selected.includes(o.value),
      ),
    [selected],
  );

  const add = (value: string): void => {
    onChange([...specifics, value]);
    setQuery('');
    inputRef.current?.focus();
  };

  const remove = (value: string): void => {
    if (value === ALL_VALUE) onChange([]);
    else onChange(specifics.filter((v) => v !== value));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter' && suggestions[0]) {
      e.preventDefault();
      add(suggestions[0].value);
    } else if (e.key === 'Backspace' && !query && specifics.length > 0) {
      remove(specifics[specifics.length - 1]);
    } else if (e.key === 'Escape') {
      inputRef.current?.blur();
    }
  };

  return (
    <div className="msl-tagfield">
      {/* Chip field */}
      <div className={`msl-chipField ${focused ? 'isFocused' : ''}`} onClick={() => inputRef.current?.focus()}>
        <Icon name="search" size="xs" className="msl-searchIcon" />
        {all && (
          <span className="msl-chip msl-chipAll">
            {labelOf(ALL_VALUE)}
            <button type="button" className="msl-chipX" aria-label="Remove All languages" onClick={(e) => { e.stopPropagation(); remove(ALL_VALUE); }}>
              <Icon name="x" size="xs" />
            </button>
          </span>
        )}
        {specifics.map((v) => (
          <span key={v} className="msl-chip">
            {labelOf(v)}
            <button type="button" className="msl-chipX" aria-label={`Remove ${labelOf(v)}`} onClick={(e) => { e.stopPropagation(); remove(v); }}>
              <Icon name="x" size="xs" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          className="msl-chipInput"
          placeholder={all || specifics.length > 0 ? '' : 'Add languages…'}
          aria-label="Add subtitle language"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </div>

      {/* Popular quick-picks when field is empty */}
      {!all && specifics.length === 0 && !query && (
        <div className="msl-popular">
          <span className="msl-popularLabel">Popular</span>
          {popular.map((o) => (
            <button key={o.value} type="button" className="msl-popChip" onClick={() => add(o.value)}>
              {o.label}
            </button>
          ))}
        </div>
      )}

      {/* Suggestions */}
      {(focused || query) && suggestions.length > 0 && (
        <ul className="msl-suggests" role="listbox" aria-label="Suggestions">
          {suggestions.map((o) => (
            <li key={o.value}>
              <button
                type="button"
                className="msl-suggest"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => add(o.value)}
              >
                <span className="msl-langName">{o.label}</span>
                <Icon name="plus" size="xs" className="msl-suggestAdd" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {query && suggestions.length === 0 && <div className="msl-empty">No languages found</div>}
    </div>
  );
}
