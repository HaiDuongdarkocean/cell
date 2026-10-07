import { useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { BottomSheet } from '@/shared/ui/BottomSheet';
import { Icon } from '@/shared/ui/Icon';
import { MenuItem, MenuSeparator, menuRovingKeyDown } from '@/shared/ui/Menu';
import { t } from '@/shared/i18n';
import { PANEL_BAR_TABS, PANEL_TOOLS_TABS } from './panelTabs';
import type { UniversalPanelTab } from './types';
import styles from './UniversalPanelBottomNav.module.css';

export interface ToolAction {
  id: string;
  icon: 'library' | 'layers' | 'playRoundedRect';
  title: string;
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

/**
 * UniversalPanelBottomNav — mobile bottom bar (4 bar tabs + Tools = 5
 * destinations) plus the Tools bottom sheet, which also carries the demoted
 * tabs as navigation rows (up-mobile-chrome).
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
        {PANEL_BAR_TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <Button
              key={tab.key}
              variant="ghost"
              shape="pill"
              size="md"
              orientation="vertical"
              className={styles.navItem}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => onTabChange(tab.key)}
              data-cell-id={`universal-panel-mobile-tab-${tab.key}`}
              leadingIcon={<Icon name={tab.icon} />}
            >
              {t(tab.shortLabel)}
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
        hideDragHandle
        data-cell-id="universal-panel-tools-sheet"
      >
        <div
          role="menu"
          aria-label={t('panel.tools.sheetTitle')}
          className={styles.toolsList}
          onKeyDown={(e) => menuRovingKeyDown(e, e.currentTarget)}
        >
          {PANEL_TOOLS_TABS.map((tab) => (
            <MenuItem
              key={tab.key}
              radio
              selected={activeTab === tab.key}
              aria-current={activeTab === tab.key ? 'page' : undefined}
              emphasis
              icon={<Icon name={tab.icon} size="md" />}
              onSelect={() => {
                onTabChange(tab.key);
                setIsToolsOpen(false);
              }}
              data-cell-id={`universal-panel-mobile-tab-${tab.key}`}
            >
              {t(tab.label)}
            </MenuItem>
          ))}
          {PANEL_TOOLS_TABS.length > 0 && <MenuSeparator />}
          {tools.map((tool) => (
            <MenuItem
              key={tool.id}
              emphasis
              icon={<Icon name={tool.icon} size="md" />}
              onSelect={() => {
                tool.onClick();
                setIsToolsOpen(false);
              }}
              data-cell-id={tool['data-cell-id']}
            >
              {tool.title}
            </MenuItem>
          ))}
        </div>
      </BottomSheet>
    </>
  );
}
