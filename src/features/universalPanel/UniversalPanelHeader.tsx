import { useCallback, type ReactElement } from 'react';
import { IconButton } from '@/shared/ui/IconButton';
import { Icon } from '@/shared/icons/Icon';
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
}

/**
 * UniversalPanelHeader — minimal horizontal header above the panel content.
 *
 * Layout (left → right): language profile select (optional) … gap …
 * tokenize split capsule (Text / Media) … gap … close button (right edge).
 */
export function UniversalPanelHeader({
  tokenizeState,
  onToggleTokenize,
  onClose,
  hasMedia = true,
}: UniversalPanelHeaderProps): ReactElement {
  const handleToggle = useCallback((mode: 'text' | 'media'): void => {
    onToggleTokenize(mode === 'text' ? 'enabled' : 'subtitleEnabled');
  }, [onToggleTokenize]);

  return (
    <header className={styles.header} data-cell-id="universal-panel-header">
      <TokenizeControls
        text={tokenizeState.enabled}
        media={tokenizeState.subtitleEnabled}
        hasMedia={hasMedia}
        onToggle={handleToggle}
      />

      <IconButton
        material="solid"
        size="md"
        variant="ghost"
        aria-label="Close panel"
        className={styles.closeButton}
        onClick={onClose}
        data-cell-id="universal-panel-close"
      >
        <Icon name="x" />
      </IconButton>
    </header>
  );
}
