import { useMemo, useState, type ReactElement } from 'react';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { LANGUAGE_OPTIONS, ALL_VALUE, isAll, toggleValue, summaryLabel } from './mockData';
import { SearchField, LangRow } from './common';

interface Props {
  selected: string[];
  onChange: (values: string[]) => void;
}

/**
 * Concept B — collapsed picker.
 *
 * Closed state is one summary row, consistent with the other settings rows.
 * Clicking expands the picker in-flow so the section card grows with it —
 * the same convention the Select/SearchableSelect menus now use.
 */
export function ConceptB({ selected, onChange }: Props): ReactElement {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const all = isAll(selected);
  const specifics = selected.filter((v) => v !== ALL_VALUE);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return LANGUAGE_OPTIONS;
    return LANGUAGE_OPTIONS.filter((o) => o.label.toLowerCase().includes(q));
  }, [query]);

  return (
    <div className="msl-picker">
      <Button
        variant="ghost"
        className="msl-pickerTrigger"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        trailingIcon={<Icon name="chevronDown" size="xs" />}
      >
        <span className="msl-pickerSummary">{summaryLabel(selected)}</span>
      </Button>

      {open && (
        <div className="msl-pickerBody">
          <div className="msl-allRow">
            <span className="msl-allLabel">All languages</span>
            <button
              type="button"
              className={`msl-chipToggle ${all ? 'isOn' : ''}`}
              aria-pressed={all}
              onClick={() => onChange(toggleValue(selected, ALL_VALUE))}
            >
              {all ? 'On' : 'Off'}
            </button>
          </div>
          <SearchField query={query} onQuery={setQuery} count={specifics.length} />
          <div className="msl-listBody msl-listBodyTight" role="listbox" aria-label="Languages">
            {filtered.map((o) => (
              <LangRow key={o.value} opt={o} selected={selected} onChange={onChange} />
            ))}
            {filtered.length === 0 && <div className="msl-empty">No languages found</div>}
          </div>
        </div>
      )}
    </div>
  );
}
