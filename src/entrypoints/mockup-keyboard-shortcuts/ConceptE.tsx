import { useEffect, useState, useCallback } from 'react';
import { Kbd } from '@/shared/ui/Kbd';
import { SectionFrame, ConflictDot } from './common';
import {
  SHORTCUT_GROUPS,
  SHORTCUT_LABELS,
  isConflict,
  keyDisplayLabel,
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

function formatCaptured(value: ShortcutValue | null): string {
  if (!value || !value.key) return '';
  const parts = [];
  if (value.ctrl) parts.push('Ctrl');
  if (value.shift) parts.push('Shift');
  if (value.alt) parts.push('Alt');
  parts.push(keyDisplayLabel(value.key));
  return parts.join(' + ');
}

export function ConceptE({ map, onChange }: Props): React.ReactElement {
  const [captureActive, setCaptureActive] = useState(false);
  const [captured, setCaptured] = useState<ShortcutValue | null>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent): void => {
      if (!captureActive) return;
      const key = normalizeKey(e.key);
      if (!key) return;
      e.preventDefault();
      setCaptured({
        key,
        ctrl: e.ctrlKey || undefined,
        shift: e.shiftKey || undefined,
        alt: e.altKey || undefined,
      });
      setCaptureActive(false);
    },
    [captureActive],
  );

  useEffect(() => {
    if (!captureActive) return;
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown, captureActive]);

  const assign = (action: keyof ShortcutMap): void => {
    if (!captured) return;
    onChange(setShortcut(map, action, captured));
  };

  const isCapturedConflict = (action: keyof ShortcutMap): boolean => {
    if (!captured) return false;
    const sig = shortcutSignature(captured);
    const match = Object.entries(map).find(([a, value]) => a !== action && shortcutSignature(value) === sig);
    return !!match;
  };

  return (
    <SectionFrame>
      <div className={styles.mksRecorder}>
        <button
          type="button"
          className={[styles.mksCapture, captureActive ? styles.mksCaptureActive : ''].join(' ')}
          onClick={() => setCaptureActive(true)}
          aria-pressed={captureActive}
        >
          {captured ? (
            <>
              <span className={styles.mksCaptureLabel}>Captured</span>
              <span className={styles.mksCaptureKeys}>
                {captured.ctrl && <Kbd size="sm">Ctrl</Kbd>}
                {captured.shift && <Kbd size="sm">Shift</Kbd>}
                {captured.alt && <Kbd size="sm">Alt</Kbd>}
                <Kbd size="md">{keyDisplayLabel(captured.key)}</Kbd>
              </span>
              <span className={styles.mksCaptureHint}>Click to capture a different key</span>
            </>
          ) : captureActive ? (
            <>
              <span className={styles.mksCaptureLabel}>Listening...</span>
              <span className={styles.mksCaptureHint}>Press any key (with optional modifiers)</span>
            </>
          ) : (
            <>
              <span className={styles.mksCaptureLabel}>Press a key first</span>
              <span className={styles.mksCaptureHint}>Click here, then press the key you want to assign</span>
            </>
          )}
        </button>

        <div className={styles.mksRecorderList}>
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.label}>
              <div className={styles.mksGroupLabel}>{group.label}</div>
              {group.actions.map((action) => {
                const value = map[action];
                const conflict = isConflict(map, action);
                const capturedConflict = isCapturedConflict(action);
                const assignedToCaptured = captured && shortcutSignature(map[action]) === shortcutSignature(captured);
                return (
                  <div
                    key={action}
                    className={[
                      styles.mksRecorderRow,
                      assignedToCaptured ? styles.mksRecorderRowSelected : '',
                    ].join(' ')}
                  >
                    <span className={styles.mksActionLabel}>{SHORTCUT_LABELS[action]}</span>
                    <span className={styles.mksActionInput}>
                      {value ? (
                        <Kbd size="sm">
                          {value.ctrl ? 'Ctrl+' : ''}
                          {value.shift ? 'Shift+' : ''}
                          {value.alt ? 'Alt+' : ''}
                          {value.key.toUpperCase()}
                        </Kbd>
                      ) : (
                        <span className={styles.mksEmptyPill}>—</span>
                      )}
                      {captured && (
                        <button
                          type="button"
                          className={styles.mksAssignBtn}
                          onClick={() => assign(action)}
                          aria-label={`Assign ${formatCaptured(captured)} to ${SHORTCUT_LABELS[action]}`}
                        >
                          Assign
                        </button>
                      )}
                      <ConflictDot active={conflict || capturedConflict} />
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </SectionFrame>
  );
}
