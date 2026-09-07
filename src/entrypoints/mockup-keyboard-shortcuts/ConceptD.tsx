import { useEffect, useState, useCallback } from 'react';
import { Kbd } from '@/shared/ui/Kbd';
import { GroupHeader, SectionFrame, ConflictDot } from './common';
import {
  KEYBOARD_ROWS,
  SHORTCUT_GROUPS,
  SHORTCUT_LABELS,
  buildConflictSet,
  isConflict,
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

const MODIFIER_KEYS = new Set([
  'control', 'shift', 'alt', 'meta',
  'controlleft', 'shiftleft', 'altleft', 'metaleft',
  'controlright', 'shiftright', 'altright', 'metaright',
]);

function normalizeKey(key: string): string {
  const lower = key.toLowerCase();
  if (MODIFIER_KEYS.has(lower)) return '';
  if (lower === 'arrowleft') return 'arrowleft';
  if (lower === 'arrowright') return 'arrowright';
  if (lower === 'arrowup') return 'arrowup';
  if (lower === 'arrowdown') return 'arrowdown';
  if (key === ' ') return 'space';
  return lower;
}

export function ConceptD({ map, onChange }: Props): React.ReactElement {
  const [selectedAction, setSelectedAction] = useState<keyof ShortcutMap | null>(null);
  const conflicts = buildConflictSet(map);

  const handleKey = useCallback(
    (key: string, modifiers?: { ctrl?: boolean; shift?: boolean; alt?: boolean }) => {
      if (!selectedAction) return;
      const next: ShortcutValue = {
        key,
        ctrl: modifiers?.ctrl || undefined,
        shift: modifiers?.shift || undefined,
        alt: modifiers?.alt || undefined,
      };
      onChange(setShortcut(map, selectedAction, next));
    },
    [map, onChange, selectedAction],
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (!selectedAction) return;
      const key = normalizeKey(e.key);
      if (!key) return;
      e.preventDefault();
      handleKey(key, { ctrl: e.ctrlKey, shift: e.shiftKey, alt: e.altKey });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleKey, selectedAction]);

  const handleClickAction = (action: keyof ShortcutMap): void => {
    setSelectedAction(action);
  };

  const handleClickKey = (key: string): void => {
    if (selectedAction) {
      handleKey(key);
      return;
    }
    // No action selected: find and highlight the first single-key action bound to this key.
    const hit = Object.entries(map).find(([, value]) => {
      if (!value) return false;
      return value.key === key && !value.ctrl && !value.shift && !value.alt;
    });
    if (hit) setSelectedAction(hit[0] as keyof ShortcutMap);
  };

  const keyBindings = new Map<string, (keyof ShortcutMap)[]>();
  for (const [action, value] of Object.entries(map)) {
    if (!value || !value.key) continue;
    const list = keyBindings.get(value.key) ?? [];
    list.push(action as keyof ShortcutMap);
    keyBindings.set(value.key, list);
  }

  return (
    <SectionFrame>
      <div className={styles.mksTwoPane}>
        <div className={styles.mksPaneLeft}>
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.label}>
              <GroupHeader label={group.label} />
              <div className={styles.mksTwoPaneList}>
                {group.actions.map((action) => {
                  const isSelected = selectedAction === action;
                  const conflict = isConflict(map, action);
                  return (
                    <button
                      key={action}
                      type="button"
                      className={[
                        styles.mksTwoPaneRow,
                        isSelected ? styles.mksTwoPaneRowSelected : '',
                      ].join(' ')}
                      onClick={() => handleClickAction(action)}
                      aria-pressed={isSelected}
                    >
                      <span className={styles.mksTwoPaneLabel}>{SHORTCUT_LABELS[action]}</span>
                      <span className={styles.mksTwoPaneValue}>
                        {map[action] ? (
                          <Kbd size="sm">
                            {map[action]?.ctrl ? 'Ctrl+' : ''}
                            {map[action]?.shift ? 'Shift+' : ''}
                            {map[action]?.alt ? 'Alt+' : ''}
                            {map[action]?.key.toUpperCase() ?? ''}
                          </Kbd>
                        ) : (
                          <span className={styles.mksEmptyPill}>—</span>
                        )}
                        <ConflictDot active={conflict} />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className={styles.mksPaneRight}>
          <div className={styles.mksPaneRightHeader}>
            {selectedAction ? (
              <>
                <span className={styles.mksPaneHint}>Press a key or click a keycap</span>
                <span className={styles.mksPaneSelection}>{SHORTCUT_LABELS[selectedAction]}</span>
              </>
            ) : (
              <>
                <span className={styles.mksPaneHint}>Select an action, then press a key</span>
                <span className={styles.mksPaneSelection}>No action selected</span>
              </>
            )}
          </div>
          <div className={styles.mksMiniKeyboard}>
            {KEYBOARD_ROWS.map((row, i) => (
              <div key={i} className={styles.mksKeyboardRow}>
                {row.map((key) => {
                  const bindings = keyBindings.get(key) ?? [];
                  const sig = shortcutSignature({ key });
                  const hasConflict = conflicts.has(sig) && bindings.length > 1;
                  const currentValue = selectedAction ? map[selectedAction] : null;
                  const isActive =
                    currentValue?.key === key &&
                    !currentValue?.ctrl &&
                    !currentValue?.shift &&
                    !currentValue?.alt;
                  const isAssigned = bindings.length > 0;

                  return (
                    <button
                      key={key}
                      type="button"
                      className={[
                        styles.mksMiniKeycap,
                        isAssigned ? styles.mksMiniKeycapActive : '',
                        isActive ? styles.mksMiniKeycapSelected : '',
                        hasConflict ? styles.mksMiniKeycapConflict : '',
                      ].join(' ')}
                      onClick={() => handleClickKey(key)}
                      aria-label={`Key ${key.toUpperCase()}`}
                    >
                      {key.toUpperCase()}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </SectionFrame>
  );
}
