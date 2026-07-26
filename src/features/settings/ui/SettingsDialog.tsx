import { useEffect, useRef } from 'react';
import type { Settings } from '@/entities/media';
import { Icon } from '@/shared/icons/Icon';
import { IconButton } from '@/shared/ui/IconButton';
import type { TokenizePanelState } from './TokenizeSettingsPanel';
import { SettingsDialogContent } from './SettingsDialogContent';

import styles from './SettingsDialog.module.css';

interface SettingsDialogProps {
  isOpen: boolean;
  settings: Settings;
  onChange: (settings: Settings) => void;
  onClose: () => void;
  /** ADR-061: Tokenize section — only provided when mounted in the orbital
   *  badge panel (content-script). Popup/sidepanel/options don't have
   *  tokenize runtime state, so these stay undefined there. */
  readonly tokenizeState?: TokenizePanelState;
  readonly onToggleTokenize?: (key: 'enabled' | 'showStatus' | 'showFrequency') => void;
  readonly onOpenDictionary?: () => void;
}


export function SettingsDialog({ isOpen, settings, onChange, onClose, tokenizeState, onToggleTokenize, onOpenDictionary }: SettingsDialogProps): React.JSX.Element {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      closeButtonRef.current?.focus();
      const handleEscape = (e: KeyboardEvent): void => {
        if (e.key === 'Escape') onClose();
      };
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return <div />;

  return (
    <>
      <div className={`${styles.overlay} ${styles.open}`} onClick={onClose} />

      <div
        className={`${styles.popover} ${styles.open}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        <div className={styles.popoverHeader}>
          <h3 id="settings-title" className={styles.popoverTitle}>Settings</h3>
          <IconButton
            ref={closeButtonRef}
            size="sm"
            onClick={onClose}
            aria-label="Close settings"
          >
            <Icon name="x" className={styles.icon} />
          </IconButton>
        </div>
        <SettingsDialogContent
          settings={settings}
          onChange={onChange}
          tokenizeState={tokenizeState}
          onToggleTokenize={onToggleTokenize}
          onOpenDictionary={onOpenDictionary}
        />
      </div>
    </>
  );
}
