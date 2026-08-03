import { useRef, useState, useEffect, type ReactElement, type ReactNode, type KeyboardEvent } from 'react';
import { IconButton } from '@/shared/ui/IconButton';
import { useFocusTrap } from '@/shared/ui/useFocusTrap';
import { Icon } from '@/shared/icons/Icon';
import { UniversalPanelHeader } from './UniversalPanelHeader';
import type { TokenizePanelState } from '@/features/tokenize/types';
import type { UniversalPanelTab } from './types';
import styles from './UniversalPanel.module.css';

export interface UniversalPanelProps {
  /** Whether the panel is open. */
  readonly isOpen: boolean;
  /** Currently active tab. */
  readonly activeTab: UniversalPanelTab;
  /** Called when the user switches tabs. */
  readonly onTabChange: (tab: UniversalPanelTab) => void;
  /** Called when the panel should close (backdrop click, X, Escape). */
  readonly onClose: () => void;
  /** Tokenize state for the universal header (ADR-061). */
  readonly tokenizeState: TokenizePanelState;
  /** Toggle one of the tokenize keys from the universal header. */
  readonly onToggleTokenize: (key: 'enabled' | 'showStatus' | 'showFrequency' | 'subtitleEnabled') => void;
  /** Content for the Dictionary tab. */
  readonly dictionaryPanel: ReactNode;
  /** Content for the Settings tab. */
  readonly settingsPanel: ReactNode;
}

const TABS: { key: UniversalPanelTab; icon: 'bookOpen' | 'settings'; label: string }[] = [
  { key: 'dictionary', icon: 'bookOpen', label: 'Dictionary' },
  { key: 'settings', icon: 'settings', label: 'Settings' },
];

/**
 * UniversalPanel — slide-in side panel shell with Dictionary / Settings tabs.
 *
 * Desktop: vertical tab bar on the left, right-edge panel, max-width 1280px.
 * Mobile (<= 768px): full-screen with bottom tab bar.
 */
export function UniversalPanel({
  isOpen,
  activeTab,
  onTabChange,
  onClose,
  tokenizeState,
  onToggleTokenize,
  dictionaryPanel,
  settingsPanel,
}: UniversalPanelProps): ReactElement | null {
  const panelRef = useRef<HTMLDivElement>(null);
  const wasOpenRef = useRef(isOpen);
  const [isClosing, setIsClosing] = useState(false);

  useFocusTrap(panelRef, isOpen);

  useEffect(() => {
    if (isOpen) {
      setIsClosing(false);
    } else if (wasOpenRef.current) {
      setIsClosing(true);
    }
    wasOpenRef.current = isOpen;
  }, [isOpen]);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  const handleBackdropClick = (): void => {
    onClose();
  };

  const handlePanelClick = (e: React.MouseEvent<HTMLDivElement>): void => {
    e.stopPropagation();
  };

  if (!isOpen && !isClosing) return null;

  const panelClass = `${styles.panel} ${isOpen ? styles.open : styles.close}`.trim();

  return (
    <div
      className={styles.overlay}
      onClick={handleBackdropClick}
      role="presentation"
      data-cell-id="universal-panel-backdrop"
    >
      <div
        ref={panelRef}
        className={panelClass}
        role="dialog"
        aria-modal="true"
        aria-label="Universal panel"
        onClick={handlePanelClick}
        onKeyDown={handleKeyDown}
        onAnimationEnd={() => {
          if (isClosing) {
            setIsClosing(false);
          }
        }}
        data-cell-id="universal-panel"
      >
        <nav
          className={styles.tabBar}
          aria-label="Panel tabs"
          data-cell-id="universal-panel-tab-bar"
        >
          <div className={styles.tabGroup}>
            {TABS.map((tab) => (
              <IconButton
                key={tab.key}
                size="md"
                variant="ghost"
                active={activeTab === tab.key}
                aria-label={tab.label}
                aria-pressed={activeTab === tab.key}
                onClick={() => onTabChange(tab.key)}
                data-cell-id={`universal-panel-tab-${tab.key}`}
              >
                <Icon name={tab.icon} size={20} />
              </IconButton>
            ))}
          </div>
        </nav>

        <div className={styles.body}>
          <UniversalPanelHeader
            tokenizeState={tokenizeState}
            onToggleTokenize={onToggleTokenize}
            onClose={onClose}
          />

          <div className={styles.content} data-cell-id={`universal-panel-content-${activeTab}`}>
            {activeTab === 'dictionary' ? dictionaryPanel : settingsPanel}
          </div>
        </div>
      </div>
    </div>
  );
}
