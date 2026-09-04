import { useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { BottomSheet } from '@/shared/ui/BottomSheet';
import { Icon } from '@/shared/icons/Icon';
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
  activeTab: 'dictionary' | 'studyModes' | 'settings';
  /** Called when user switches tab. */
  onTabChange: (tab: 'dictionary' | 'studyModes' | 'settings') => void;
  /** Tools shown in the bottom sheet. */
  tools: ToolAction[];
  /** Optional class name. */
  className?: string;
}

const TABS = [
  { key: 'dictionary' as const, icon: 'bookOpen' as const, label: 'Dictionary' },
  { key: 'studyModes' as const, icon: 'slidersHorizontal' as const, label: 'Study' },
  { key: 'settings' as const, icon: 'settings' as const, label: 'Settings' },
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
      <nav className={`${styles.bottomNav} ${className ?? ''}`.trim()} aria-label="Panel navigation" data-cell-id="universal-panel-bottom-nav">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <Button
              key={tab.key}
              material="solid"
              variant="ghost"
              shape="pill"
              size="md"
              aria-pressed={isActive}
              data-active={String(isActive)}
              className={styles.navItem}
              aria-label={tab.label}
              onClick={() => onTabChange(tab.key)}
              data-cell-id={`universal-panel-mobile-tab-${tab.key}`}
            >
              <Icon name={tab.icon} size={20} />
              <span className={styles.label}>{tab.label}</span>
            </Button>
          );
        })}
        <Button
          material="solid"
          variant="ghost"
          shape="pill"
          size="md"
          className={`${styles.navItem} ${styles.toolsItem}`}
          aria-label="Tools"
          aria-expanded={isToolsOpen}
          onClick={() => setIsToolsOpen(true)}
          data-cell-id="universal-panel-mobile-tools"
        >
          <Icon name="chevronDown" size={20} />
          <span className={styles.label}>Tools</span>
        </Button>
      </nav>

      <BottomSheet
        open={isToolsOpen}
        onOpenChange={setIsToolsOpen}
        title="Quick tools"
        data-cell-id="universal-panel-tools-sheet"
      >
        <div className={styles.toolsList} role="list">
          {tools.map((tool) => (
            <Button
              key={tool.id}
              material="solid"
              variant="outline"
              shape="pill"
              className={styles.toolRow}
              leadingIcon={<Icon name={tool.icon} size={24} />}
              onClick={() => {
                tool.onClick();
                setIsToolsOpen(false);
              }}
              data-cell-id={tool['data-cell-id']}
            >
              <div className={styles.toolBody}>
                <span className={styles.toolTitle}>{tool.title}</span>
                <span className={styles.toolDesc}>{tool.description}</span>
              </div>
            </Button>
          ))}
        </div>
      </BottomSheet>
    </>
  );
}
