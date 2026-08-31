import { useRef, useState, useEffect, type ReactElement, type ReactNode, type KeyboardEvent } from 'react';
import { IconButton } from '@/shared/ui/IconButton';
import { useFocusTrap } from '@/shared/ui/useFocusTrap';
import { Icon } from '@/shared/icons/Icon';
import { sendMessage } from '@/shared/lib/chrome-apis/runtime';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { UniversalPanelHeader } from './UniversalPanelHeader';
import { getLocalPlayerUrl } from './localPlayerLink';
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
  /** Language profiles for quick switch. */
  readonly languageProfiles?: { readonly id: string; readonly name: string }[];
  /** Active profile id. */
  readonly activeProfileId?: string | null;
  /** Called when user switches active profile. */
  readonly onProfileChange?: (profileId: string) => void;
  /** Content for the Dictionary tab. */
  readonly dictionaryPanel: ReactNode;
  /** Content for the Study Modes tab. */
  readonly studyModesPanel: ReactNode;
  /** Content for the Settings tab. */
  readonly settingsPanel: ReactNode;
}

const TABS: { key: UniversalPanelTab; icon: 'bookOpen' | 'settings' | 'slidersHorizontal'; label: string }[] = [
  { key: 'dictionary', icon: 'bookOpen', label: 'Dictionary' },
  { key: 'studyModes', icon: 'slidersHorizontal', label: 'Study Modes' },
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
  languageProfiles = [],
  activeProfileId = null,
  onProfileChange = () => {},
  dictionaryPanel,
  studyModesPanel,
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

  // Keep mounted through the close animation. Without the wasOpenRef term,
  // the render where isOpen flips false (isClosing not set yet) returns null,
  // unmounting the node; the effect then remounts it with .close, flashing
  // the full panel before it fades.
  const shouldRender = isOpen || isClosing || wasOpenRef.current;

  if (!shouldRender) return null;

  const panelClass = `${styles.panel} ${isOpen ? styles.open : styles.close}`.trim();
  const overlayClass = isOpen ? styles.overlay : `${styles.overlay} ${styles.overlayClosing}`.trim();

  return (
    <div
      className={overlayClass}
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
              <IconButton material="solid"
                key={tab.key}
                size="md"
                variant="ghost"
                active={activeTab === tab.key}
                aria-label={tab.label}
                aria-pressed={activeTab === tab.key}
                onClick={() => onTabChange(tab.key)}
                data-cell-id={`universal-panel-tab-${tab.key}`}
              >
                <Icon name={tab.icon}  />
              </IconButton>
            ))}
            <IconButton material="solid"
              size="md"
              variant="ghost"
              aria-label="Open Reader"
              title="Open Reader"
              onClick={() =>
                void sendMessage({
                  type: MESSAGE_TYPES.OPEN_READER,
                  payload: {},
                })
              }
              data-cell-id="universal-panel-reader"
            >
              <Icon name="library"  />
            </IconButton>
            <IconButton material="solid"
              size="md"
              variant="ghost"
              aria-label="Open local player"
              title="Open local player"
              onClick={() => { window.open(getLocalPlayerUrl(), '_blank'); }}
              data-cell-id="universal-panel-tab-local-player"
            >
              <Icon name="playRoundedRect"  />
            </IconButton>
          </div>
        </nav>

        <div className={styles.body}>
          <UniversalPanelHeader
            tokenizeState={tokenizeState}
            onToggleTokenize={onToggleTokenize}
            onClose={onClose}
            languageProfiles={languageProfiles}
            activeProfileId={activeProfileId}
            onProfileChange={onProfileChange}
          />

          <div className={styles.content} data-cell-id={`universal-panel-content-${activeTab}`}>
            {activeTab === 'dictionary' && dictionaryPanel}
            {activeTab === 'studyModes' && studyModesPanel}
            {activeTab === 'settings' && settingsPanel}
          </div>
        </div>
      </div>
    </div>
  );
}
