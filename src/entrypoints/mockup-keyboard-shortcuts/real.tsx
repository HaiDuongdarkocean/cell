import { ShortcutInput, type ShortcutValue } from '@/shared/ui/ShortcutInput';
import { SectionFrame, GroupHeader, ConflictDot } from './common';
import {
  SHORTCUT_GROUPS,
  SHORTCUT_LABELS,
  isConflict,
  type ShortcutMap,
} from './mockData';
import styles from './mockup.module.css';

interface RealPanelProps {
  map: ShortcutMap;
  onChange: (action: keyof ShortcutMap, value: ShortcutValue | null) => void;
}

function RealField({
  action,
  value,
  map,
  onChange,
}: {
  action: keyof ShortcutMap;
  value: ShortcutValue | null;
  map: ShortcutMap;
  onChange: (action: keyof ShortcutMap, value: ShortcutValue | null) => void;
}): React.ReactElement {
  return (
    <div className={styles.mksRealField}>
      <label className={styles.mksActionLabel} htmlFor={`mks-real-${String(action)}`}>
        {SHORTCUT_LABELS[action]}
      </label>
      <span className={styles.mksActionInput}>
        <ShortcutInput
          id={`mks-real-${String(action)}`}
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

export function RealPanel({ map, onChange }: RealPanelProps): React.ReactElement {
  return (
    <SectionFrame>
      <div className={styles.mksRealGroupList}>
        {SHORTCUT_GROUPS.map((group) => (
          <div key={group.label} className={styles.mksRealGroup}>
            <GroupHeader label={group.label} />
            <div className={styles.mksRealGrid}>
              {group.actions.map((action) => (
                <RealField
                  key={action}
                  action={action}
                  value={map[action]}
                  map={map}
                  onChange={onChange}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </SectionFrame>
  );
}
