import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/shared/ui/Icon';
import type { IconCatalogKey } from '@/shared/icons';
import { FlagIcon } from '@/shared/ui/FlagIcon';
import { SearchableSelect } from '@/shared/ui/SearchableSelect';
import { OVERLAY_LANGUAGE_OPTIONS } from '@/shared/config/languageRegistry';
import type { MockProfile } from './mockData';
import { langLabel, langShort } from './mockData';

const UNIVERSAL_SENTINEL = '__universal__';

export interface ConceptProps {
  profiles: MockProfile[];
  activeId: string | null;
  universalNative: string;
  onActivate: (id: string) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onAdd: (target: string, nativeOverride: string, copyFromActive: boolean) => void;
  onUpdate: (id: string, target: string, nativeOverride: string) => void;
  onUniversalChange: (code: string) => void;
}

/** Kebab menu: ⋮ button + popover with actions. Closes on outside click / Esc. */
export function KebabMenu({
  label,
  items,
}: {
  label: string;
  items: { key: string; label: string; icon?: IconCatalogKey; danger?: boolean; disabled?: boolean; onSelect: () => void }[];
}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="menu-wrap" ref={ref}>
      <button
        type="button"
        className="icon-btn"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <Icon name="ellipsisVertical" size="xs" />
      </button>
      {open && (
        <div className="menu-pop" role="menu">
          {items.map((it) => (
            <button
              key={it.key}
              type="button"
              role="menuitem"
              className={it.danger ? 'danger' : undefined}
              disabled={it.disabled}
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                it.onSelect();
              }}
            >
              {it.icon && <Icon name={it.icon} size="xs" />}
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Universal-native banner: clearly separates the global setting from per-profile data.
 *  View mode: flag + label + value + Change. Edit mode takes the whole banner —
 *  full-width select (room for long names) + explicit Cancel/Save. */
export function NativeBanner({
  universalNative,
  onChange,
}: {
  universalNative: string;
  onChange: (code: string) => void;
}): React.JSX.Element {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(universalNative);

  if (editing) {
    return (
      <div className="native-banner editing">
        <div className="row">
          <FlagIcon lang={draft} size={22} title={langLabel(draft)} />
          <div className="grow">
            <div className="label">Universal native language</div>
            <div className="value ellipsis">{langShort(draft)}</div>
          </div>
        </div>
        <SearchableSelect
          options={OVERLAY_LANGUAGE_OPTIONS}
          value={draft}
          onChange={setDraft}
          ariaLabel="Change universal native language"
          placeholder="Search languages..."
        />
        <div className="row" style={{ justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
          <button type="button" className="ghost-btn" onClick={() => setEditing(false)}>
            Cancel
          </button>
          <button
            type="button"
            className="primary-btn"
            onClick={() => {
              onChange(draft);
              setEditing(false);
            }}
          >
            Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="native-banner">
      <FlagIcon lang={universalNative} size={22} title={langLabel(universalNative)} />
      <div className="grow">
        <div className="label">Universal native language</div>
        <div className="value ellipsis">{langShort(universalNative)}</div>
      </div>
      <button
        type="button"
        className="ghost-btn"
        onClick={() => {
          setDraft(universalNative);
          setEditing(true);
        }}
      >
        Change
      </button>
    </div>
  );
}

/** Inline profile form — 'add' mode (with Advanced) or 'edit' mode (identity only). */
export function ProfileForm({
  universalNative,
  activeName,
  onCancel,
  onSubmit,
  mode = 'add',
  initialTarget = '',
  initialNative,
}: {
  universalNative: string;
  /** Name of the active profile (for the "copy settings" choice), null when none. */
  activeName: string | null;
  onCancel: () => void;
  onSubmit: (target: string, nativeOverride: string, copyFromActive: boolean) => void;
  /** 'add' = new profile (with Advanced); 'edit' = identity only, in-place. */
  mode?: 'add' | 'edit';
  initialTarget?: string;
  /** '' = inherit universal native; undefined → default to inherit (add mode). */
  initialNative?: string;
}): React.JSX.Element {
  const isEdit = mode === 'edit';
  const [target, setTarget] = useState(initialTarget);
  const [nativeChoice, setNativeChoice] = useState(
    initialNative === undefined || initialNative === '' ? UNIVERSAL_SENTINEL : initialNative,
  );
  const [startFrom, setStartFrom] = useState<'clean' | 'copy'>('clean');
  const [advOpen, setAdvOpen] = useState(false);
  const [error, setError] = useState('');

  const nativeOptions = [
    { value: UNIVERSAL_SENTINEL, label: `Universal — ${langLabel(universalNative)}` },
    ...OVERLAY_LANGUAGE_OPTIONS.filter((o) => o.value !== ''),
  ];

  const save = () => {
    if (!target) {
      setError('Please select a target language.');
      return;
    }
    onSubmit(target, nativeChoice === UNIVERSAL_SENTINEL ? '' : nativeChoice, startFrom === 'copy');
  };

  return (
    <div className="add-form" role="group" aria-label={isEdit ? 'Edit language profile' : 'Add language profile'}>
      {error && <div className="error" role="alert">{error}</div>}

      {/* Step 1 — required */}
      <div className="field">
        <div className="field-label">Target language *</div>
        <SearchableSelect
          options={OVERLAY_LANGUAGE_OPTIONS.filter((o) => o.value !== '')}
          value={target}
          onChange={setTarget}
          ariaLabel="Select target language"
          placeholder="Search languages..."
        />
        <div className="hint">The language you are learning.</div>
      </div>

      {/* Step 2 — inherit-or-override as a single select, no toggle */}
      <div className="field">
        <div className="field-label">Native language</div>
        <SearchableSelect
          options={nativeOptions}
          value={nativeChoice}
          onChange={setNativeChoice}
          ariaLabel="Select native language"
        />
        <div className="hint">Used for translations and dictionary results.</div>
      </div>

      {/* Advanced — add mode only; edit is identity-only by design (settings
          live in the shared sections for the active profile) */}
      {!isEdit && activeName && (
        <div className="field">
          <button
            type="button"
            className="disclosure"
            aria-expanded={advOpen}
            onClick={() => setAdvOpen((v) => !v)}
          >
            <Icon name={advOpen ? 'chevronDown' : 'chevronRight'} size="xs" />
            Advanced
            <span className="hint">copy settings from an existing profile</span>
          </button>
          {advOpen && (
            <div className="choice-grid" role="radiogroup" aria-label="Start from">
              <button
                type="button"
                role="radio"
                aria-checked={startFrom === 'clean'}
                className="choice"
                onClick={() => setStartFrom('clean')}
              >
                <span className="choice-title">Clean defaults</span>
                <span className="choice-desc">Fresh subtitle &amp; dictionary settings</span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={startFrom === 'copy'}
                className="choice"
                onClick={() => setStartFrom('copy')}
              >
                <span className="choice-title">Copy from {activeName}</span>
                <span className="choice-desc">Reuse the active profile&rsquo;s settings</span>
              </button>
            </div>
          )}
        </div>
      )}

      <div className="actions">
        <button type="button" className="ghost-btn" onClick={onCancel}>Cancel</button>
        <button type="button" className="primary-btn" onClick={save} disabled={!target}>
          {isEdit ? 'Save' : 'Add profile'}
        </button>
      </div>
    </div>
  );
}

export function EmptyState({ onAdd }: { onAdd: () => void }): React.JSX.Element {
  return (
    <div className="empty-state">
      <span className="icon"><Icon name="languages" size="lg" /></span>
      <div className="title">No language profiles yet</div>
      <div>Each profile saves subtitle, dictionary, and resource settings for one language.</div>
      <button type="button" className="primary-btn" onClick={onAdd} style={{ marginTop: 'var(--space-2)' }}>
        <Icon name="plus" size="xs" /> Create your first profile
      </button>
    </div>
  );
}
