import { useState } from 'react';
import { Icon } from '@/shared/ui/Icon';
import { FlagIcon } from '@/shared/ui/FlagIcon';
import type { ConceptProps } from './common';
import { EmptyState, KebabMenu, NativeBanner, ProfileForm } from './common';
import { langLabel, langShort, resolvedNative } from './mockData';

/**
 * Selected direction — "Selectable cards".
 * IA model: the list IS the switcher. Clicking a card activates the profile
 * (radio semantics); all secondary actions collapse into one kebab menu.
 * "New profile" lives in a persistent toolbar above the list and opens the
 * add-form inline at the top — reachable without scrolling.
 */
export function ConceptA({
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
    <div>
      <NativeBanner universalNative={universalNative} onChange={onUniversalChange} />

      {profiles.length > 0 && (
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
      )}

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
        <div className="ca-list" role="radiogroup" aria-label="Language profiles">
          {profiles.map((p, i) => {
            const isActive = p.id === activeId;
            const nat = resolvedNative(p, universalNative);
            // Edit = in-place: the card morphs into the identity form.
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
              <div key={p.id} className="row" style={{ gap: 'var(--space-1)' }}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  className="ca-card grow"
                  onClick={() => onActivate(p.id)}
                >
                  <span className="ca-radio" aria-hidden="true" />
                  <span className="ca-flags">
                    <FlagIcon lang={nat} size={20} title={langLabel(nat)} />
                    <Icon name="chevronRight" size="xs" />
                    <FlagIcon lang={p.target} size={28} title={langLabel(p.target)} />
                  </span>
                  <span className="grow">
                    <span className="ca-name ellipsis" style={{ display: 'block' }}>
                      {langLabel(p.target)}
                    </span>
                    <span className="ca-meta ellipsis" style={{ display: 'block' }}>
                      Native: {langShort(nat)}{p.native ? ' · custom' : ''}
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
