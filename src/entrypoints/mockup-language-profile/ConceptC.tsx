import { useState } from 'react';
import { Icon } from '@/shared/ui/Icon';
import { FlagIcon } from '@/shared/ui/FlagIcon';
import { SearchableSelect } from '@/shared/ui/SearchableSelect';
import { OVERLAY_LANGUAGE_OPTIONS } from '@/shared/config/languageRegistry';
import type { ConceptProps } from './common';
import { EmptyState, KebabMenu, ProfileForm } from './common';
import { langLabel, langShort, resolvedNative } from './mockData';

const LANGUAGE_OPTIONS = OVERLAY_LANGUAGE_OPTIONS.filter((o) => o.value !== '');

/**
 * Concept C — "Outline cards".
 * Color architecture: blue lives only in OUTLINES — the active card keeps its
 * white elevated surface and is marked by a primary border + small accent
 * dot. No fills anywhere, so the eye travels border-first. The two-tone chip
 * is the one interior accent (primary-subtle key cell).
 * Journey: compare card summaries → pick → done.
 */
export function ConceptC({
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
    <div className="cc-panel">
      <div className="cb-field">
        <span className="cb-label">Universal native language</span>
        <SearchableSelect
          options={LANGUAGE_OPTIONS}
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
        <div className="cc-list" role="radiogroup" aria-label="Language profiles">
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
              <div key={p.id} className={`cc-card${isActive ? ' is-active' : ''}`}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  className="cc-main grow"
                  onClick={() => onActivate(p.id)}
                >
                  <FlagIcon lang={p.target} size={28} title={langLabel(p.target)} />
                  <span className="grow">
                    <span className="cc-name ellipsis" style={{ display: 'block' }}>
                      {langLabel(p.target)}
                    </span>
                    <span className="cc-chiprow">
                      <span className="cc-chip">
                        <span className="cc-chipKey">native</span>
                        <span className="cc-chipVal">{langShort(nat)}{p.native ? ' · custom' : ''}</span>
                      </span>
                    </span>
                  </span>
                </button>
                <span className="cc-dot" aria-hidden="true" />
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
