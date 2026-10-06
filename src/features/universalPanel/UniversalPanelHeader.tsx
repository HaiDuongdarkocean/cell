import { useCallback, type ReactElement } from 'react';
import { Button } from '@/shared/ui/Button';

import { Icon } from '@/shared/ui/Icon';
import { FlagIcon } from '@/shared/ui/FlagIcon';
import { TokenizeControls } from './TokenizeControls';
import { PANEL_TABS } from './panelTabs';
import { t } from '@/shared/i18n';
import type { TokenizePanelState } from '@/features/tokenize';
import type { UniversalPanelTab } from './types';
import styles from './UniversalPanelHeader.module.css';

export interface UniversalPanelHeaderProps {
  /** Tokenize runtime state (enabled + showStatus + showFrequency + subtitleEnabled). */
  readonly tokenizeState: TokenizePanelState;
  /** Toggle one of the four tokenize keys. */
  readonly onToggleTokenize: (key: 'enabled' | 'showStatus' | 'showFrequency' | 'subtitleEnabled') => void;
  /** Called when the close button is clicked. */
  readonly onClose: () => void;
  /** Whether the current page has a video (disables the Media half). */
  readonly hasMedia?: boolean;
  /** Active language profile for the header profile button. */
  readonly activeProfile?: { readonly name: string; readonly target?: string } | null;
  /** Called when the profile button is clicked. */
  readonly onProfileClick?: () => void;
  /** Active tab — the header names it (full `panel.tab.*` label) on mobile widths. */
  readonly activeTab?: UniversalPanelTab;
}

/**
 * UniversalPanelHeader — minimal horizontal header above the panel content.
 *
 * Layout (left → right): language profile select (optional) … active-tab title
 * (≤839px only) … tokenize split capsule (Text / Media) … close button (right edge).
 */
export function UniversalPanelHeader({
  tokenizeState,
  onToggleTokenize,
  onClose,
  hasMedia = true,
  activeProfile,
  onProfileClick,
  activeTab,
}: UniversalPanelHeaderProps): ReactElement {
  const handleToggle = useCallback((mode: 'text' | 'media'): void => {
    onToggleTokenize(mode === 'text' ? 'enabled' : 'subtitleEnabled');
  }, [onToggleTokenize]);

  const profileName = activeProfile?.name ?? t('panel.profile.select');
  const activeTabLabel = activeTab ? PANEL_TABS.find((tab) => tab.key === activeTab)?.label : undefined;

  return (
    <header className={styles.header} data-cell-id="universal-panel-header">
      {activeProfile && onProfileClick && (
        <Button
          size="md"
          variant="ghost"
          shape="circle"
          className={styles.profileButton}
          onClick={onProfileClick}
          aria-label={t('panel.profile.switch', [profileName])}
          title={profileName}
          data-cell-id="universal-panel-profile-button"
        >
          <FlagIcon lang={activeProfile.target ?? ''} title={profileName} />
        </Button>
      )}

      {activeTabLabel && (
        <span className={styles.headerTitle} data-cell-id="universal-panel-header-title">
          {t(activeTabLabel)}
        </span>
      )}

      <TokenizeControls
        text={tokenizeState.enabled}
        media={tokenizeState.subtitleEnabled}
        hasMedia={hasMedia}
        onToggle={handleToggle}
      />

      <Button shape="circle"
        size="md"
        variant="ghost"
        aria-label={t('panel.close')}
        className={styles.closeButton}
        onClick={onClose}
        data-cell-id="universal-panel-close"
      >
        <Icon name="x" />
      </Button>
    </header>
  );
}
