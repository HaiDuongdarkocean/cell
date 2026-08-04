import { Icon } from '@/shared/icons/Icon';
import styles from './DictionaryPanelView.module.css';
import type { PopupTab } from '../types';

type IconName = React.ComponentProps<typeof Icon>['name'];

const TABS: { key: PopupTab; icon: IconName; label: string }[] = [
  { key: 'audio', icon: 'audioWave', label: 'Audio' },
  { key: 'image', icon: 'image', label: 'Image' },
  { key: 'translate', icon: 'languages', label: 'Translate' },
  { key: 'links', icon: 'link', label: 'Links' },
];

export interface DictionaryToolbarProps {
  readonly activeTab: PopupTab | null;
  readonly onSelect: (tab: PopupTab) => void;
  readonly counts: {
    readonly audio?: number;
    readonly image?: number;
    readonly translate?: number;
    readonly links?: number;
  };
}

export function DictionaryToolbar({
  activeTab,
  onSelect,
  counts,
}: DictionaryToolbarProps): React.JSX.Element {
  return (
    <div className={styles.cellToolbar} role="tablist" aria-label="Dictionary materials" data-cell-id="dictionary-toolbar">
      {TABS.map((tab) => {
        const active = activeTab === tab.key;
        const count = counts[tab.key] ?? 0;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={active}
            aria-pressed={active}
            aria-label={tab.label}
            title={tab.label}
            className={`btn ${active ? 'btn--primary' : 'btn--ghost'} ${styles.cellToolbarTab}`}
            onClick={() => onSelect(tab.key)}
            data-cell-id={`dictionary-tab-${tab.key}`}
          >
            <Icon name={tab.icon} size={20} />
            <span className={`${styles.cellToolbarLabel} ${styles.cellLabel}`}>{tab.label}</span>
            {count > 0 && tab.key !== 'links' && <span className={styles.cellToolbarBadge}>{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
