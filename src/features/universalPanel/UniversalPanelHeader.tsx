import { useCallback, useRef, useState, type ReactElement } from 'react';
import { Button } from '@/shared/ui/Button';

import { Icon } from '@/shared/ui/Icon';
import { FlagIcon } from '@/shared/ui/FlagIcon';
import { Menu } from '@/shared/ui/Menu';
import { TokenizeControls } from './TokenizeControls';
import { LanguageProfileCard, LanguageProfileCardList } from '@/features/settings';
import { t } from '@/shared/i18n';
import type { TokenizePanelState } from '@/features/tokenize';
import type { LanguageProfile } from '@/entities/settings';
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
  readonly languageProfiles?: readonly LanguageProfile[];
  /** Universal native language — resolves empty profile.native on the cards. */
  readonly universalNativeLanguage?: string;
  /** Active profile id. */
  readonly activeProfileId?: string | null;
  /** Called when user switches active profile. */
  readonly onProfileChange?: (profileId: string) => void;
  /** Deep-link into the panel's Settings → language profiles section. */
  readonly onOpenProfileSettings?: () => void;
  /** Pointer entering the text-tokenize half — prewarms the SW before the click. */
  readonly onHoverTokenizeText?: () => void;
}

/**
 * UniversalPanelHeader — minimal horizontal header above the panel content.
 *
 * Layout (left → right): language profile select (optional) … tokenize split
 * capsule (Text / Media) … close button (right edge).
 */
export function UniversalPanelHeader({
  tokenizeState,
  onToggleTokenize,
  onClose,
  hasMedia = true,
  languageProfiles = [],
  universalNativeLanguage = '',
  activeProfileId = null,
  onProfileChange,
  onOpenProfileSettings,
  onHoverTokenizeText,
}: UniversalPanelHeaderProps): ReactElement {
  const profileTriggerRef = useRef<HTMLButtonElement>(null);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  const handleToggle = useCallback((mode: 'text' | 'media'): void => {
    onToggleTokenize(mode === 'text' ? 'enabled' : 'subtitleEnabled');
  }, [onToggleTokenize]);

  const ordered = [...languageProfiles].sort((a, b) => a.order - b.order);
  const activeProfile = ordered.find((p) => p.id === activeProfileId);
  const profileName = activeProfile?.name ?? t('panel.profile.select');

  return (
    <header className={styles.header} data-tihoka-id="universal-panel-header">
      {onProfileChange && (
        <>
          <Button
            ref={profileTriggerRef}
            size="md"
            variant="ghost"
            shape="circle"
            className={styles.profileButton}
            onClick={() => (ordered.length > 0 ? setIsProfileMenuOpen(true) : onOpenProfileSettings?.())}
            aria-label={t('panel.profile.switch', [profileName])}
            aria-haspopup="menu"
            aria-expanded={isProfileMenuOpen}
            title={profileName}
            data-tihoka-id="universal-panel-profile-button"
          >
            {activeProfile ? (
              <FlagIcon lang={activeProfile.target} title={profileName} />
            ) : (
              <span className={styles.profileMissing} aria-hidden="true">?</span>
            )}
          </Button>
          <Menu
            open={isProfileMenuOpen}
            onClose={() => setIsProfileMenuOpen(false)}
            triggerRef={profileTriggerRef}
            ariaLabel={t('panel.profileDialog.title')}
            data-tihoka-id="universal-panel-profile-menu"
          >
            <div className={styles.profileMenuHead}>
              <span className={styles.profileMenuCount}>
                {t('settings.profiles.list.label', [String(ordered.length)])}
              </span>
              <Button
                variant="ghost"
                size="sm"
                shape="circle"
                aria-label={t('settings.nav.languageProfile')}
                onClick={() => {
                  setIsProfileMenuOpen(false);
                  onOpenProfileSettings?.();
                }}
                data-tihoka-id="universal-panel-profile-settings"
              >
                <Icon name="settings" />
              </Button>
            </div>
            <LanguageProfileCardList>
              {ordered.map((profile, index) => (
                <LanguageProfileCard
                  key={profile.id}
                  profile={profile}
                  universalNative={universalNativeLanguage}
                  selected={profile.id === activeProfileId}
                  tabIndex={profile.id === activeProfileId || (!activeProfile && index === 0) ? 0 : -1}
                  onSelect={() => {
                    onProfileChange(profile.id);
                    setIsProfileMenuOpen(false);
                  }}
                  data-tihoka-id={`universal-panel-profile-option-${profile.id}`}
                />
              ))}
            </LanguageProfileCardList>
          </Menu>
        </>
      )}

      <TokenizeControls
        text={tokenizeState.enabled}
        media={tokenizeState.subtitleEnabled}
        hasMedia={hasMedia}
        onToggle={handleToggle}
        onHoverText={onHoverTokenizeText}
      />

      <Button shape="circle"
        size="md"
        variant="ghost"
        aria-label={t('panel.close')}
        className={styles.closeButton}
        onClick={onClose}
        data-tihoka-id="universal-panel-close"
      >
        <Icon name="x" />
      </Button>
    </header>
  );
}
