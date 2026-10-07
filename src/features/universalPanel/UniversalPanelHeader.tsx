import { useCallback, useRef, useState, type ReactElement } from 'react';
import { Button } from '@/shared/ui/Button';

import { Icon } from '@/shared/ui/Icon';
import { FlagIcon } from '@/shared/ui/FlagIcon';
import { Menu, MenuItem } from '@/shared/ui/Menu';
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
  /** Language profiles for the profile switcher menu. */
  readonly languageProfiles?: readonly { readonly id: string; readonly name: string; readonly target?: string }[];
  /** Active profile id. */
  readonly activeProfileId?: string | null;
  /** Called when user switches active profile. */
  readonly onProfileChange?: (profileId: string) => void;
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
  languageProfiles = [],
  activeProfileId = null,
  onProfileChange,
  activeTab,
}: UniversalPanelHeaderProps): ReactElement {
  const profileTriggerRef = useRef<HTMLButtonElement>(null);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  const handleToggle = useCallback((mode: 'text' | 'media'): void => {
    onToggleTokenize(mode === 'text' ? 'enabled' : 'subtitleEnabled');
  }, [onToggleTokenize]);

  const activeProfile = languageProfiles.find((p) => p.id === activeProfileId);
  const profileName = activeProfile?.name ?? t('panel.profile.select');
  const activeTabLabel = activeTab ? PANEL_TABS.find((tab) => tab.key === activeTab)?.label : undefined;

  return (
    <header className={styles.header} data-cell-id="universal-panel-header">
      {activeProfile && onProfileChange && (
        <>
          <Button
            ref={profileTriggerRef}
            size="md"
            variant="ghost"
            shape="circle"
            className={styles.profileButton}
            onClick={() => setIsProfileMenuOpen(true)}
            aria-label={t('panel.profile.switch', [profileName])}
            aria-haspopup="menu"
            aria-expanded={isProfileMenuOpen}
            title={profileName}
            data-cell-id="universal-panel-profile-button"
          >
            <FlagIcon lang={activeProfile.target ?? ''} title={profileName} />
          </Button>
          <Menu
            open={isProfileMenuOpen}
            onClose={() => setIsProfileMenuOpen(false)}
            triggerRef={profileTriggerRef}
            ariaLabel={t('panel.profileDialog.title')}
            data-cell-id="universal-panel-profile-menu"
          >
            {languageProfiles.map((profile) => (
              <MenuItem
                key={profile.id}
                radio
                selected={profile.id === activeProfileId}
                onSelect={() => {
                  onProfileChange(profile.id);
                  setIsProfileMenuOpen(false);
                }}
                data-cell-id={`universal-panel-profile-option-${profile.id}`}
              >
                {profile.name}
              </MenuItem>
            ))}
          </Menu>
        </>
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
