import { useMemo, useState, type ReactElement } from 'react';
import { Toggle } from '@/shared/ui/Toggle';
import { LANGUAGE_OPTIONS, ALL_VALUE, isAll, toggleValue } from './mockData';
import { SearchField, LangRow } from './common';

interface Props {
  selected: string[];
  onChange: (values: string[]) => void;
}

/**
 * Concept A — refined open checklist.
 *
 * Same always-open list as today, but fixes the IA flaw: "All languages" is an
 * exclusive mode row pinned above the list — not a sibling option. Rows use the
 * shared Toggle atom (xs, primary-driven); the search field has a single ring.
 */
export function ConceptA({ selected, onChange }: Props): ReactElement {
  const [query, setQuery] = useState('');
  const all = isAll(selected);
  const specifics = selected.filter((v) => v !== ALL_VALUE);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return LANGUAGE_OPTIONS;
    return LANGUAGE_OPTIONS.filter((o) => o.label.toLowerCase().includes(q));
  }, [query]);

  const { pinned, rest } = useMemo(() => {
    const set = new Set(specifics);
    return {
      pinned: filtered.filter((o) => set.has(o.value)),
      rest: filtered.filter((o) => !set.has(o.value)),
    };
  }, [filtered, specifics]);

  return (
    <div className="msl-panel">
      {/* Exclusive mode row — 'all' is a state, not an item */}
      <div className="msl-allRow">
        <span className="msl-allLabel">
          All languages
          <span className="msl-allHint">Accept every detected subtitle</span>
        </span>
        <Toggle
          checked={all}
          onChange={() => onChange(toggleValue(selected, ALL_VALUE))}
          ariaLabel="Accept all subtitle languages"
        />
      </div>

      <div className={`msl-list ${all ? 'isMuted' : ''}`} aria-hidden={all}>
        <SearchField query={query} onQuery={setQuery} count={specifics.length} />
        <div className="msl-listBody" role="listbox" aria-label="Specific languages">
          {!query && pinned.length > 0 && (
            <>
              <div className="msl-sec">Selected · {pinned.length}</div>
              {pinned.map((o) => (
                <LangRow key={o.value} opt={o} selected={selected} onChange={onChange} disabled={all} />
              ))}
            </>
          )}
          {rest.length > 0 && (
            <>
              <div className="msl-sec">{query ? `Results · ${filtered.length}` : `All · ${rest.length}`}</div>
              {rest.map((o) => (
                <LangRow key={o.value} opt={o} selected={selected} onChange={onChange} disabled={all} />
              ))}
            </>
          )}
          {filtered.length === 0 && <div className="msl-empty">No languages found</div>}
        </div>
      </div>
    </div>
  );
}
