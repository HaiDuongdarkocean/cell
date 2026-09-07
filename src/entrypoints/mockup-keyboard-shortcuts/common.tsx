import type { ShortcutAction } from '@/entities/settings';
import type { ShortcutValue } from '@/shared/ui/ShortcutInput';
import { Heading } from '@/shared/ui/Heading';
import { Text } from '@/shared/ui/Text';
import { Kbd } from '@/shared/ui/Kbd';
import { ShortcutInput } from '@/shared/ui/ShortcutInput';
import { isConflict, keyDisplayLabel, SHORTCUT_LABELS } from './mockData';
import styles from './mockup.module.css';

interface SectionFrameProps {
  children: React.ReactNode;
}

export function SectionFrame({ children }: SectionFrameProps): React.ReactElement {
  return (
    <div className={styles.mksCard}>
      <div className={styles.mksCardHeader}>
        <Heading level={4} size={4} className={styles.mksCardTitle}>
          Keyboard Shortcuts
        </Heading>
        <Text as="p" color="secondary" className={styles.mksCardDesc}>
          Remap keys for subtitle panel navigation actions.
        </Text>
      </div>
      <div className={styles.mksCardBody}>{children}</div>
    </div>
  );
}

interface GroupHeaderProps {
  label: string;
}

export function GroupHeader({ label }: GroupHeaderProps): React.ReactElement {
  return <div className={styles.mksGroupLabel}>{label}</div>;
}

interface ConflictDotProps {
  active: boolean;
}

export function ConflictDot({ active }: ConflictDotProps): React.ReactElement | null {
  if (!active) return null;
  return <span className={styles.mksConflictDot} title="This key is already used by another action" />;
}

interface ShortcutPillProps {
  value: ShortcutValue | null;
}

export function ShortcutPill({ value }: ShortcutPillProps): React.ReactElement {
  if (!value || !value.key) {
    return <span className={styles.mksEmptyPill}>—</span>;
  }
  const mods: ('ctrl' | 'shift' | 'alt')[] = [];
  if (value.ctrl) mods.push('ctrl');
  if (value.shift) mods.push('shift');
  if (value.alt) mods.push('alt');
  return (
    <span className={styles.mksPill}>
      {mods.map((mod) => (
        <Kbd key={mod} size="sm">
          {mod === 'ctrl' ? 'Ctrl' : mod === 'shift' ? 'Shift' : 'Alt'}
        </Kbd>
      ))}
      <Kbd size="sm" className={mods.length ? styles.mksPillKey : ''}>
        {keyDisplayLabel(value.key)}
      </Kbd>
    </span>
  );
}

interface ActionRowProps {
  action: ShortcutAction;
  value: ShortcutValue | null;
  map: Record<ShortcutAction, ShortcutValue | null>;
  onChange: (action: ShortcutAction, value: ShortcutValue | null) => void;
}

export function ActionRow({ action, value, map, onChange }: ActionRowProps): React.ReactElement {
  return (
    <div className={styles.mksActionRow}>
      <label className={styles.mksActionLabel} htmlFor={`mks-${action}`}>
        {SHORTCUT_LABELS[action]}
      </label>
      <span className={styles.mksActionInput}>
        <ShortcutInput
          id={`mks-${action}`}
          value={value ?? { key: '' }}
          onChange={(next) => {
            onChange(action, next.key ? next : null);
          }}
          aria-label={SHORTCUT_LABELS[action]}
        />
        <ConflictDot active={isConflict(map, action)} />
      </span>
    </div>
  );
}
