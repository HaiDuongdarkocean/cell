import { useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { BottomSheet } from '@/shared/ui/BottomSheet';
import { Icon } from '@/shared/ui/Icon';
import { t, type MessageKey } from '@/shared/i18n';
import type { UniversalPanelTab } from './types';
import styles from './UniversalPanelBottomNav.module.css';

export interface ToolAction {
  id: string;
  icon: 'library' | 'layers' | 'playRoundedRect';
  title: string;
  description: string;
  onClick: () => void;
  'data-cell-id'?: string;
}

export interface UniversalPanelBottomNavProps {
  /** Currently active tab. */
  activeTab: UniversalPanelTab;
  /** Called when user switches tab. */
  onTabChange: (tab: UniversalPanelTab) => void;
  /** Tools shown in the bottom sheet. */
  tools: ToolAction[];
  /** Optional class name. */
  className?: string;
}

const TABS: ReadonlyArray<{ key: UniversalPanelTab; icon: 'audioWave' | 'bookOpen' | 'clock' | 'scanText' | 'slidersHorizontal' | 'settings'; label: MessageKey }> = [
  { key: 'dictionary', icon: 'bookOpen', label: 'panel.tab.dictionary' },
  { key: 'vocabulary', icon: 'scanText', label: 'panel.tab.vocabularyShort' },
  { key: 'studyModes', icon: 'slidersHorizontal', label: 'panel.tab.studyModesShort' },
  { key: 'playlist', icon: 'audioWave', label: 'panel.tab.playlistShort' },
  { key: 'recap', icon: 'clock', label: 'panel.tab.recapShort' },
  { key: 'settings', icon: 'settings', label: 'panel.tab.settings' },
];

/**
 * UniversalPanelBottomNav — mobile bottom bar (Dictionary · Study · Settings · Tools)
 * plus the Tools bottom sheet.
 */
export function UniversalPanelBottomNav({
  activeTab,
  onTabChange,
  tools,
  className,
}: UniversalPanelBottomNavProps): React.JSX.Element {
  const [isToolsOpen, setIsToolsOpen] = useState(false);

  return (
    <>
      <nav className={`${styles.bottomNav} ${className ?? ''}`.trim()} aria-label={t('panel.nav.aria')} data-cell-id="universal-panel-bottom-nav">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <Button
              key={tab.key}
              variant="ghost"
              shape="pill"
              size="md"
              orientation="vertical"
              className={styles.navItem}
              aria-current={isActive ? 'true' : undefined}
              onClick={() => onTabChange(tab.key)}
              data-cell-id={`universal-panel-mobile-tab-${tab.key}`}
              leadingIcon={<Icon name={tab.icon} />}
            >
              {t(tab.label)}
            </Button>
          );
        })}
        <Button
          variant="ghost"
          shape="pill"
          size="md"
          orientation="vertical"
          className={styles.navItem}
          aria-expanded={isToolsOpen}
          aria-haspopup="dialog"
          onClick={() => setIsToolsOpen(true)}
          data-cell-id="universal-panel-mobile-tools"
          leadingIcon={<Icon name="layoutGrid" />}
        >
          {t('panel.tools.title')}
        </Button>
      </nav>

      <BottomSheet
        open={isToolsOpen}
        onOpenChange={setIsToolsOpen}
        title={t('panel.tools.sheetTitle')}
        data-cell-id="universal-panel-tools-sheet"
      >
        <ul className={styles.toolsList}>
          {tools.map((tool) => (
            <li key={tool.id}>
              <Button
                variant="ghost"
                shape="pill"
                className={styles.toolRow}
                leadingIcon={<Icon name={tool.icon} size="md" />}
                onClick={() => {
                  tool.onClick();
                  setIsToolsOpen(false);
                }}
                data-cell-id={tool['data-cell-id']}
              >
                <span className={styles.toolBody}>
                  <span className={styles.toolTitle}>{tool.title}</span>
                  <span className={styles.toolDesc}>{tool.description}</span>
                </span>
              </Button>
            </li>
          ))}
        </ul>
      </BottomSheet>
    </>
  );
}
