import { useMemo, useState } from 'react';
import { ActionRow, SectionFrame } from './common';
import {
  KEYBOARD_ROWS,
  SHORTCUT_GROUPS,
  SHORTCUT_LABELS,
  buildConflictSet,
  setShortcut,
  shortcutSignature,
  type ShortcutMap,
} from './mockData';
import type { ShortcutValue } from '@/shared/ui/ShortcutInput';
import styles from './mockup.module.css';

interface Props {
  map: ShortcutMap;
  onChange: (next: ShortcutMap) => void;
}

export function ConceptB({ map, onChange }: Props): React.ReactElement {
  const [query, setQuery] = useState('');
  const [activeGroup, setActiveGroup] = useState<string>('all');
  const conflicts = buildConflictSet(map);

  const filteredActions = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SHORTCUT_GROUPS.filter(
      (g) => activeGroup === 'all' || g.label === activeGroup,
    ).flatMap((g) => g.actions.filter((a) => SHORTCUT_LABELS[a].toLowerCase().includes(q)));
  }, [query, activeGroup]);

  const keyBindings = useMemo(() => {
    const byKey = new Map<string, { action: keyof ShortcutMap; value: ShortcutValue }[]>();
    for (const [action, value] of Object.entries(map)) {
      if (!value || !value.key) continue;
      const list = byKey.get(value.key) ?? [];
      list.push({ action: action as keyof ShortcutMap, value });
      byKey.set(value.key, list);
    }
    return byKey;
  }, [map]);

  const handleChange = (action: keyof ShortcutMap, value: ShortcutValue | null): void => {
    onChange(setShortcut(map, action, value));
  };

  return (
    <SectionFrame>
      <div className={styles.mksMapTools}>
        <div className={styles.mksSearch}>
          <input
            type="text"
            className={styles.mksSearchInput}
            placeholder="Find action..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search actions"
          />
        </div>
        <div className={styles.mksChips} role="group" aria-label="Filter by group">
          <button
            type="button"
            className={styles.mksChip}
            aria-pressed={activeGroup === 'all'}
            onClick={() => setActiveGroup('all')}
          >
            All
          </button>
          {SHORTCUT_GROUPS.map((g) => (
            <button
              key={g.label}
              type="button"
              className={styles.mksChip}
              aria-pressed={activeGroup === g.label}
              onClick={() => setActiveGroup(g.label)}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.mksKeyboard}>
        {KEYBOARD_ROWS.map((row, i) => (
          <div key={i} className={styles.mksKeyboardRow}>
            {row.map((key) => {
              const bindings = keyBindings.get(key) ?? [];
              const sigs = new Set(bindings.map((b) => shortcutSignature(b.value)));
              const hasConflict = [...sigs].some((s) => conflicts.has(s));
              const comboCount = bindings.filter((b) => b.value.ctrl || b.value.shift || b.value.alt).length;
              const singleCount = bindings.length - comboCount;
              const active = singleCount > 0;

              return (
                <button
                  key={key}
                  type="button"
                  className={[
                    styles.mksKeycap,
                    active ? styles.mksKeycapActive : '',
                    hasConflict ? styles.mksKeycapConflict : '',
                  ].join(' ')}
                  aria-label={`Key ${key.toUpperCase()}`}
                >
                  {key.toUpperCase()}
                  {comboCount > 0 && (
                    <span className={styles.mksKeycapBadge}>+{comboCount}</span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className={styles.mksMapActions}>
        {filteredActions.length === 0 ? (
          <div className={styles.mksEmptyPill}>No actions match</div>
        ) : (
          filteredActions.map((action) => (
            <ActionRow
              key={action}
              action={action}
              value={map[action]}
              map={map}
              onChange={handleChange}
            />
          ))
        )}
      </div>
    </SectionFrame>
  );
}
