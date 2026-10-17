import { Icon } from '@/shared/ui/Icon';
import { Button } from '@/shared/ui/Button';
import styles from './DictionaryToolbar.module.css';
import type { PopupTab } from '@/entities/dictionary';
import { t, type MessageKey } from '@/shared/i18n';

type IconName = React.ComponentProps<typeof Icon>['name'];

const TABS: { key: PopupTab; icon: IconName; labelKey: MessageKey }[] = [
  { key: 'audio', icon: 'audioWave', labelKey: 'dict.tab.audio' },
  { key: 'image', icon: 'image', labelKey: 'dict.tab.image' },
  { key: 'translate', icon: 'languages', labelKey: 'dict.tab.translate' },
  { key: 'ai', icon: 'atom', labelKey: 'dict.tab.ai' },
  { key: 'breakdown', icon: 'scanText', labelKey: 'dict.tab.breakdown' },
  { key: 'links', icon: 'link', labelKey: 'dict.tab.links' },
];

export interface DictionaryToolbarProps {
  readonly activeTab: PopupTab | null;
  readonly onSelect: (tab: PopupTab) => void;
  readonly counts: {
    readonly audio?: number;
    readonly image?: number;
    readonly translate?: number;
    readonly ai?: number;
    readonly breakdown?: number;
    readonly links?: number;
  };
}

export function DictionaryToolbar({
  activeTab,
  onSelect,
  counts,
}: DictionaryToolbarProps): React.JSX.Element {
  return (
    <div className={styles.TihokaToolbar} role="tablist" aria-label={t('dict.toolbar.aria')} data-tihoka-id="dictionary-toolbar">
      {TABS.map((tab) => {
        const active = activeTab === tab.key;
        const count = counts[tab.key] ?? 0;
        /* Badge must escape .button's overflow:hidden (needed for the
           ripple), so it lives on a sibling wrapper — also keeps it
           undimmed while the tab sits at dimmed opacity. */
        return (
          <span key={tab.key} className={styles.TihokaToolbarItem} role="presentation">
            <Button variant="primary" dimmed={!active}
              role="tab"
              aria-selected={active}
              aria-pressed={active}
              aria-label={t(tab.labelKey)}
              className={styles.TihokaToolbarTab}
              onClick={() => onSelect(tab.key)}
              data-tihoka-id={`dictionary-tab-${tab.key}`}
            >
              <Icon name={tab.icon}  />
              <span className={`${styles.TihokaToolbarLabel} ${styles.TihokaLabel}`}>{t(tab.labelKey)}</span>
            </Button>
            {/* Links are static shortcuts, not selected materials — no count badge. */}
            {count > 0 && tab.key !== 'links' && (
              <span className={styles.TihokaToolbarBadge} data-tihoka-id={`dictionary-badge-${tab.key}`}>{count}</span>
            )}
          </span>
        );
      })}
    </div>
  );
}
