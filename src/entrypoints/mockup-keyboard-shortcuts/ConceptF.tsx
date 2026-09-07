import { useRef } from 'react';
import { ShortcutInput, type ShortcutValue } from '@/shared/ui/ShortcutInput';
import { SectionFrame, ConflictDot } from './common';
import {
  SHORTCUT_GROUPS,
  SHORTCUT_LABELS,
  isConflict,
  setShortcut,
  type ShortcutMap,
} from './mockData';
import styles from './mockup.module.css';

interface Props {
  map: ShortcutMap;
  onChange: (next: ShortcutMap) => void;
}

const GROUP_TINTS: Record<string, { bg: string; border: string }> = {
  Navigation: { bg: 'var(--color-tint-blue-background)', border: 'var(--color-tint-blue-border)' },
  Toggle: { bg: 'var(--color-tint-cyan-background)', border: 'var(--color-tint-cyan-border)' },
  Generate: { bg: 'var(--color-tint-green-background)', border: 'var(--color-tint-green-border)' },
  'Card Creator': { bg: 'var(--color-tint-orange-background)', border: 'var(--color-tint-orange-border)' },
};

function BentoTile({
  action,
  group,
  value,
  map,
  onChange,
}: {
  action: keyof ShortcutMap;
  group: string;
  value: ShortcutValue | null;
  map: ShortcutMap;
  onChange: (action: keyof ShortcutMap, value: ShortcutValue | null) => void;
}): React.ReactElement {
  const inputRef = useRef<HTMLDivElement>(null);
  const tint = GROUP_TINTS[group];
  const conflict = isConflict(map, action);

  return (
    <div
      className={styles.mksBentoTile}
      onClick={(e) => {
        if (e.target === e.currentTarget) inputRef.current?.focus();
      }}
    >
      <div
        className={styles.mksBentoAccent}
        style={{ background: tint.bg, borderBottom: `var(--border-width-hairline) solid ${tint.border}` }}
      />
      <span className={styles.mksBentoLabel}>{SHORTCUT_LABELS[action]}</span>
      <span className={styles.mksBentoValue}>
        <span ref={inputRef}>
          <ShortcutInput
            value={value ?? { key: '' }}
            onChange={(next) => {
              onChange(action, next.key ? next : null);
            }}
            aria-label={SHORTCUT_LABELS[action]}
          />
        </span>
        <ConflictDot active={conflict} />
      </span>
    </div>
  );
}

export function ConceptF({ map, onChange }: Props): React.ReactElement {
  const handleChange = (action: keyof ShortcutMap, value: ShortcutValue | null): void => {
    onChange(setShortcut(map, action, value));
  };

  return (
    <SectionFrame>
      <div className={styles.mksBento}>
        {SHORTCUT_GROUPS.map((group) =>
          group.actions.map((action) => (
            <BentoTile
              key={action}
              action={action}
              group={group.label}
              value={map[action]}
              map={map}
              onChange={handleChange}
            />
          )),
        )}
      </div>
    </SectionFrame>
  );
}
