import { type ReactElement } from 'react';
import { Icon } from '@/shared/ui/Icon';
import { Toggle } from '@/shared/ui/Toggle';
import type { MultiSelectOption } from '@/shared/ui/MultiSelect';
import { toggleValue } from './mockData';

/** Search field with a single focus ring on the wrap (input has no own ring). */
export function SearchField({
  query,
  onQuery,
  count,
  placeholder = 'Search languages…',
}: {
  query: string;
  onQuery: (q: string) => void;
  count: number;
  placeholder?: string;
}): ReactElement {
  return (
    <div className="msl-search">
      <Icon name="search" size="xs" className="msl-searchIcon" />
      <input
        type="search"
        className="msl-searchInput"
        placeholder={placeholder}
        aria-label="Search languages"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
      />
      {count > 0 && <span className="msl-badge">{count}</span>}
    </div>
  );
}

/** One language row — label + shared Toggle atom. Row click delegates to the toggle. */
export function LangRow({
  opt,
  selected,
  onChange,
  disabled,
}: {
  opt: MultiSelectOption;
  selected: string[];
  onChange: (values: string[]) => void;
  disabled?: boolean;
}): ReactElement {
  const on = selected.includes(opt.value);
  return (
    <div
      className={`msl-langRow ${on ? 'isOn' : ''} ${disabled ? 'isDisabled' : ''}`}
      role="option"
      aria-selected={on}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : 0}
      onClick={(e) => {
        if (disabled || (e.target as HTMLElement).closest('label')) return;
        onChange(toggleValue(selected, opt.value));
      }}
      onKeyDown={(e) => {
        if (disabled || (e.key !== 'Enter' && e.key !== ' ')) return;
        e.preventDefault();
        onChange(toggleValue(selected, opt.value));
      }}
    >
      <span className="msl-langName">{opt.label}</span>
      <Toggle
        checked={on}
        onChange={() => onChange(toggleValue(selected, opt.value))}
        ariaLabel={`Toggle ${opt.label}`}
        disabled={disabled}
      />
    </div>
  );
}
