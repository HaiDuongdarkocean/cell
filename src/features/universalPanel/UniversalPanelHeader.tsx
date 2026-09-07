import { useCallback, type ReactElement } from 'react';
import { Button } from '@/shared/ui/Button';

import { Icon } from '@/shared/ui/Icon';
import { FlagIcon } from '@/shared/ui/FlagIcon';
import { TokenizeControls } from './TokenizeControls';
import type { TokenizePanelState } from '@/features/tokenize/types';
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
}

/**
 * UniversalPanelHeader — minimal horizontal header above the panel content.
 *
 * Layout (left → right): language profile select (optional) … tokenize split capsule (Text / Media) … close button (right edge).
 */
export function UniversalPanelHeader({
  tokenizeState,
  onToggleTokenize,
  onClose,
  hasMedia = true,
  activeProfile,
  onProfileClick,
}: UniversalPanelHeaderProps): ReactElement {
  const handleToggle = useCallback((mode: 'text' | 'media'): void => {
    onToggleTokenize(mode === 'text' ? 'enabled' : 'subtitleEnabled');
  }, [onToggleTokenize]);

  const profileName = activeProfile?.name ?? 'Select profile';

  return (
    <header className={styles.header} data-cell-id="universal-panel-header">
      {activeProfile && onProfileClick && (
        <Button
          size="md"
          variant="ghost"
          shape="circle"
          className={styles.profileButton}
          onClick={onProfileClick}
          aria-label={`Switch language profile: ${profileName}`}
          title={profileName}
          data-cell-id="universal-panel-profile-button"
        >
          <FlagIcon lang={activeProfile.target ?? ''} title={profileName} />
        </Button>
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
        aria-label="Close panel"
        className={styles.closeButton}
        onClick={onClose}
        data-cell-id="universal-panel-close"
      >
        <Icon name="x" />
      </Button>
    </header>
  );
}
