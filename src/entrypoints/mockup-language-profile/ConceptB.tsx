import { useState } from 'react';
import { Icon } from '@/shared/ui/Icon';
import { FlagIcon } from '@/shared/ui/FlagIcon';
import { SearchableSelect } from '@/shared/ui/SearchableSelect';
import { OVERLAY_LANGUAGE_OPTIONS } from '@/shared/config/languageRegistry';
import type { ConceptProps } from './common';
import { EmptyState, KebabMenu, ProfileForm } from './common';
import { langLabel, langShort, resolvedNative } from './mockData';

/**
 * Concept B — "Popup list rows".
 * IA model: one grouped container holds every profile — the dictionary popup's
 * definition-list grammar. Rows are thin: target flag + name + a compact
 * native chip + quiet kebab. Selection is a tint + accent check, not a radio.
 */
export function ConceptB({
  profiles,
  activeId,
  universalNative,
  onActivate,
  onDelete,
  onMove,
  onAdd,
  onUpdate,
  onUniversalChange,
}: ConceptProps): React.JSX.Element {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="cb-panel">
      <div className="cb-field">
        <span className="cb-label">Universal native language</span>
        <SearchableSelect
          options={OVERLAY_LANGUAGE_OPTIONS}
          value={universalNative}
          onChange={onUniversalChange}
          ariaLabel="Universal native language"
          placeholder="Search languages..."
        />
      </div>

      <div className="list-toolbar">
        <span className="section-label">Profiles · {profiles.length}</span>
        <button
          type="button"
          className="link-btn"
          aria-expanded={adding}
          onClick={() => {
            setEditingId(null);
            setAdding((v) => !v);
          }}
        >
          <Icon name={adding ? 'x' : 'plus'} size="xs" /> {adding ? 'Close' : 'New profile'}
        </button>
      </div>

      {adding && (
        <ProfileForm
          universalNative={universalNative}
          activeName={profiles.find((p) => p.id === activeId)?.name ?? null}
          onCancel={() => setAdding(false)}
          onSubmit={(t, n, c) => {
            onAdd(t, n, c);
            setAdding(false);
          }}
        />
      )}

      {profiles.length === 0 && !adding ? (
        <EmptyState onAdd={() => setAdding(true)} />
      ) : (
        <div className="cb-group" role="radiogroup" aria-label="Language profiles">
          {profiles.map((p, i) => {
            const isActive = p.id === activeId;
            const nat = resolvedNative(p, universalNative);
            if (editingId === p.id) {
              return (
                <ProfileForm
                  key={p.id}
                  mode="edit"
                  initialTarget={p.target}
                  initialNative={p.native}
                  universalNative={universalNative}
                  activeName={null}
                  onCancel={() => setEditingId(null)}
                  onSubmit={(t, n) => {
                    onUpdate(p.id, t, n);
                    setEditingId(null);
                  }}
                />
              );
            }
            return (
              <div key={p.id} className={`cb-item${isActive ? ' is-active' : ''}`}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  className="cb-row grow"
                  onClick={() => onActivate(p.id)}
                >
                  <span className="cb-check" aria-hidden="true">
                    {isActive && <Icon name="check" size="xs" />}
                  </span>
                  <FlagIcon lang={p.target} size={22} title={langLabel(p.target)} />
                  <span className="cb-text grow">
                    <span className="cb-name ellipsis">{langLabel(p.target)}</span>
                    <span className="cb-chip">
                      native · {langShort(nat)}{p.native ? ' · custom' : ''}
                    </span>
                  </span>
                </button>
                <KebabMenu
                  label={`Actions for ${p.name}`}
                  items={[
                    { key: 'edit', label: 'Edit', icon: 'pencil', onSelect: () => { setAdding(false); setEditingId(p.id); } },
                    { key: 'up', label: 'Move up', icon: 'moveVertical', disabled: i === 0, onSelect: () => onMove(p.id, -1) },
                    { key: 'down', label: 'Move down', icon: 'moveVertical', disabled: i === profiles.length - 1, onSelect: () => onMove(p.id, 1) },
                    { key: 'delete', label: 'Delete', icon: 'trash', danger: true, onSelect: () => onDelete(p.id) },
                  ]}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
