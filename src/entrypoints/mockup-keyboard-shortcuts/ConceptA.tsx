import { ActionRow, GroupHeader, SectionFrame } from './common';
import { SHORTCUT_GROUPS, setShortcut, type ShortcutMap } from './mockData';
import type { ShortcutValue } from '@/shared/ui/ShortcutInput';
import styles from './mockup.module.css';

interface Props {
  map: ShortcutMap;
  onChange: (next: ShortcutMap) => void;
}

export function ConceptA({ map, onChange }: Props): React.ReactElement {
  const handleChange = (action: keyof ShortcutMap, value: ShortcutValue | null): void => {
    onChange(setShortcut(map, action, value));
  };

  return (
    <SectionFrame>
      <div className={styles.mksList}>
        {SHORTCUT_GROUPS.map((group) => (
          <div key={group.label}>
            <GroupHeader label={group.label} />
            {group.actions.map((action) => (
              <ActionRow
                key={action}
                action={action}
                value={map[action]}
                map={map}
                onChange={handleChange}
              />
            ))}
          </div>
        ))}
      </div>
    </SectionFrame>
  );
}
