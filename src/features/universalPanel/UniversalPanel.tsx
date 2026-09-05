import { useRef, useState, useEffect, useCallback, type ReactElement, type ReactNode, type KeyboardEvent } from 'react';
import { Surface } from '@/shared/ui/Surface';
import { Dialog } from '@/shared/ui/Dialog';
import { RadioGroup } from '@/shared/ui/RadioGroup';
import { useFocusTrap } from '@/shared/ui/useFocusTrap';
import { CollapsibleSidebar } from '@/shared/ui';
import { sendMessage } from '@/shared/lib/chrome-apis/runtime';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { UniversalPanelHeader } from './UniversalPanelHeader';
import { UniversalPanelBottomNav } from './UniversalPanelBottomNav';
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
  /** Whether the current page has a video (disables the Media half). */
  readonly hasMedia?: boolean;
  /** Language profiles for quick switch. */
  readonly languageProfiles?: { readonly id: string; readonly name: string; readonly target?: string }[];
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

const TOOLS: { id: string; icon: 'library' | 'layers' | 'playRoundedRect'; title: string; description: string; onClick: () => void; 'data-cell-id'?: string }[] = [
  {
    id: 'reader',
    icon: 'library',
    title: 'Open Reader',
    description: 'Read saved articles and subtitles',
    onClick: () => { void sendMessage({ type: MESSAGE_TYPES.OPEN_READER, payload: {} }); },
    'data-cell-id': 'universal-panel-reader',
  },
  {
    id: 'srs',
    icon: 'layers',
    title: 'Open SRS',
    description: 'Review your queued cards',
    onClick: () => { void sendMessage({ type: MESSAGE_TYPES.SRS_OPEN_STUDY_PAGE, payload: {} }); },
    'data-cell-id': 'universal-panel-srs-study',
  },
  {
    id: 'player',
    icon: 'playRoundedRect',
    title: 'Open local player',
    description: 'Watch local video with subtitles',
    onClick: () => { window.open(getLocalPlayerUrl(), '_blank'); },
    'data-cell-id': 'universal-panel-tab-local-player',
  },
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
  hasMedia = true,
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
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const profileOptions = languageProfiles.map((p) => ({ value: p.id, label: p.name }));
  const activeProfile = languageProfiles.find((p) => p.id === activeProfileId);

  const handleProfileSelect = useCallback((id: string): void => {
    onProfileChange(id);
    setIsProfileDialogOpen(false);
  }, [onProfileChange]);

  const handleProfileClick = useCallback((): void => {
    setIsProfileDialogOpen(true);
  }, []);

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
      className={`${overlayClass} js-cell-universal-panel`}
      onClick={handleBackdropClick}
      role="presentation"
      data-cell-id="universal-panel-backdrop"
    >
      <Surface
        ref={panelRef}
        as="div"
        variant="panel"
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
        className={panelClass}
        data-cell-id="universal-panel"
      >
        <UniversalPanelBottomNav
          activeTab={activeTab}
          onTabChange={onTabChange}
          tools={TOOLS}
        />
        <CollapsibleSidebar
          as="aside"
          collapsed={isCollapsed}
          onCollapsedChange={setIsCollapsed}
          aria-label="Panel tabs"
          data-cell-id="universal-panel-tab-bar"
          className={styles.desktopSidebar}
          sections={[
            {
              id: 'tabs',
              items: TABS.map((tab) => ({
                id: tab.key,
                icon: tab.icon,
                label: tab.label,
                active: activeTab === tab.key,
                onClick: () => onTabChange(tab.key),
                'data-cell-id': `universal-panel-tab-${tab.key}`,
              })),
            },
            {
              id: 'tools',
              items: TOOLS.map((tool) => ({
                id: tool.id,
                icon: tool.icon,
                label: tool.title,
                onClick: tool.onClick,
                'data-cell-id': tool['data-cell-id'],
              })),
            },
          ]}
        />

        {languageProfiles.length > 0 && (
          <Dialog
            open={isProfileDialogOpen}
            onOpenChange={setIsProfileDialogOpen}
            title="Select language profile"
            description="Choose the profile for translation and dictionary."
            showCloseButton
            data-cell-id="universal-panel-profile-dialog"
          >
            <RadioGroup
              name="profile"
              value={activeProfileId ?? ''}
              options={profileOptions}
              onChange={handleProfileSelect}
            />
          </Dialog>
        )}

        <div className={styles.body}>
          <UniversalPanelHeader
            tokenizeState={tokenizeState}
            onToggleTokenize={onToggleTokenize}
            onClose={onClose}
            hasMedia={hasMedia}
            activeProfile={activeProfile}
            onProfileClick={handleProfileClick}
          />

          <div className={styles.content} data-cell-id={`universal-panel-content-${activeTab}`}>
            {activeTab === 'dictionary' && dictionaryPanel}
            {activeTab === 'studyModes' && studyModesPanel}
            {activeTab === 'settings' && settingsPanel}
          </div>
        </div>
      </Surface>
    </div>
  );
}
