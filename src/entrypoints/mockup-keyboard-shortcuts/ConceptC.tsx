import { useMemo } from 'react';
import { ActionRow, GroupHeader, SectionFrame } from './common';
import {
  MAP_KEYS,
  SHORTCUT_GROUPS,
  setShortcut,
  keyDisplayLabel,
  type ShortcutMap,
  type ShortcutGroup,
} from './mockData';
import type { ShortcutValue } from '@/shared/ui/ShortcutInput';
import styles from './mockup.module.css';

interface Props {
  map: ShortcutMap;
  onChange: (next: ShortcutMap) => void;
}

export function ConceptC({ map, onChange }: Props): React.ReactElement {
  const handleChange = (action: keyof ShortcutMap, value: ShortcutValue | null): void => {
    onChange(setShortcut(map, action, value));
  };

  return (
    <SectionFrame>
      <div className={styles.mksLanes}>
        {SHORTCUT_GROUPS.map((group) => (
          <Lane key={group.label} group={group} map={map} onChange={handleChange} />
        ))}
      </div>
    </SectionFrame>
  );
}

function Lane({
  group,
  map,
  onChange,
}: {
  group: ShortcutGroup;
  map: ShortcutMap;
  onChange: (action: keyof ShortcutMap, value: ShortcutValue | null) => void;
}): React.ReactElement {
  const beads = useMemo(() => {
    const byKey = new Map<string, number>();
    for (const action of group.actions) {
      const value = map[action];
      if (!value || !value.key) continue;
      byKey.set(value.key, (byKey.get(value.key) ?? 0) + 1);
    }
    return MAP_KEYS.map((key, index) => ({
      key,
      index,
      count: byKey.get(key) ?? 0,
    })).filter((b) => b.count > 0);
  }, [group, map]);

  return (
    <div className={styles.mksLane}>
      <div className={styles.mksLaneHeader}>
        <GroupHeader label={group.label} />
      </div>
      <div className={styles.mksLaneBody}>
        <div className={styles.mksLaneRail}>
          <div className={styles.mksRailTicks} aria-hidden="true">
            {MAP_KEYS.map((k) => (
              <span key={k}>{k.toUpperCase()}</span>
            ))}
          </div>
          {beads.map((b) => (
            <span
              key={b.key}
              className={styles.mksBead}
              style={{ '--mks-key-index': b.index } as React.CSSProperties}
              title={`${b.count} action${b.count > 1 ? 's' : ''}`}
            >
              {keyDisplayLabel(b.key)}
              {b.count > 1 && <span className={styles.mksBeadCount}>+{b.count - 1}</span>}
            </span>
          ))}
        </div>
        <div>
          {group.actions.map((action) => (
            <ActionRow
              key={action}
              action={action}
              value={map[action]}
              map={map}
              onChange={onChange}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
