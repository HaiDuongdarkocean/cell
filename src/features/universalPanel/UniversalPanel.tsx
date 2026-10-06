import { useRef, useState, useEffect, useLayoutEffect, useCallback, type ReactElement, type ReactNode } from 'react';
import { Surface } from '@/shared/ui/Surface';
import { Dialog } from '@/shared/ui/Dialog';
import { RadioGroup } from '@/shared/ui/RadioGroup';
import { useFocusTrap } from '@/shared/ui/useFocusTrap';
import { pushEscapeLayer } from '@/shared/ui/escapeLayerStack';
import { CollapsibleSidebar } from '@/shared/ui';
import { sendMessage } from '@/shared/lib/chrome-apis/runtime';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { UniversalPanelHeader } from './UniversalPanelHeader';
import { UniversalPanelBottomNav } from './UniversalPanelBottomNav';
import { getLocalPlayerUrl } from './localPlayerLink';
import { PANEL_TABS } from './panelTabs';
import { t, type MessageKey } from '@/shared/i18n';
import type { TokenizePanelState } from '@/features/tokenize';
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
  /** Content for the Vocabulary tab. */
  readonly vocabularyPanel?: ReactNode;
  /** Content for the Study Modes tab. */
  readonly studyModesPanel: ReactNode;
  /** Content for the Settings tab. */
  readonly settingsPanel: ReactNode;
  /** Content for the Playlist tab (condensed audio). */
  readonly playlistPanel?: ReactNode;
  /** Content for the Recap tab (session recap). */
  readonly recapPanel?: ReactNode;
}

const TOOLS: { id: string; icon: 'library' | 'layers' | 'playRoundedRect'; title: MessageKey; description: MessageKey; onClick: () => void; 'data-cell-id'?: string }[] = [
  {
    id: 'reader',
    icon: 'library',
    title: 'panel.tools.reader.title',
    description: 'panel.tools.reader.desc',
    onClick: () => { void sendMessage({ type: MESSAGE_TYPES.OPEN_READER, payload: {} }); },
    'data-cell-id': 'universal-panel-reader',
  },
  {
    id: 'srs',
    icon: 'layers',
    title: 'panel.tools.srs.title',
    description: 'panel.tools.srs.desc',
    onClick: () => { void sendMessage({ type: MESSAGE_TYPES.SRS_OPEN_STUDY_PAGE, payload: {} }); },
    'data-cell-id': 'universal-panel-srs-study',
  },
  {
    id: 'player',
    icon: 'playRoundedRect',
    title: 'panel.tools.player.title',
    description: 'panel.tools.player.desc',
    onClick: () => { window.open(getLocalPlayerUrl(), '_blank'); },
    'data-cell-id': 'universal-panel-tab-local-player',
  },
];

/**
 * UniversalPanel — centered 94% modal inside a full-surface overlay.
 *
 * Desktop: vertical tab rail on the left via CollapsibleSidebar.
 * <= 839px: bottom nav bar; <= 599px: full-screen.
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
  vocabularyPanel,
  studyModesPanel,
  settingsPanel,
  playlistPanel,
  recapPanel,
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
    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = isOpen;
    if (isOpen) {
      setIsClosing(false);
      return;
    }
    if (!wasOpen) return;
    setIsClosing(true);
    const panel = panelRef.current;
    const durationMs = panel
      ? (parseFloat(getComputedStyle(panel).animationDuration) || 0) * 1000
      : 0;
    const fallback = window.setTimeout(() => setIsClosing(false), durationMs + 50);
    return () => window.clearTimeout(fallback);
  }, [isOpen]);

  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });
  // Layout effect so the layer registers in the commit phase — before any
  // passive-effect push from a descendant overlay that mounts open in the
  // same commit (React runs children's passive effects before the parent's,
  // which would otherwise park the panel's layer above the inner surface's).
  useLayoutEffect(() => isOpen ? pushEscapeLayer(() => onCloseRef.current()) : undefined, [isOpen]);

  const handleBackdropClick = (): void => {
    onClose();
  };

  const handlePanelClick = (e: React.MouseEvent<HTMLDivElement>): void => {
    e.stopPropagation();
  };

  const [visitedTabs, setVisitedTabs] = useState<ReadonlySet<UniversalPanelTab>>(() => new Set([activeTab]));
  useEffect(() => {
    setVisitedTabs((prev) => (prev.has(activeTab) ? prev : new Set(prev).add(activeTab)));
  }, [activeTab]);

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
      data-cell-id="universal-panel-backdrop"
    >
      <Surface
        ref={panelRef}
        as="div"
        variant="panel"
        role="dialog"
        aria-modal="true"
        aria-label={t('panel.aria')}
        onClick={handlePanelClick}
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
          tools={TOOLS.map((tool) => ({ ...tool, title: t(tool.title), description: t(tool.description) }))}
        />
        <CollapsibleSidebar
          as="aside"
          collapsed={isCollapsed}
          onCollapsedChange={setIsCollapsed}
          aria-label={t('panel.tabs.aria')}
          data-cell-id="universal-panel-tab-bar"
          className={styles.desktopSidebar}
          sections={[
            {
              id: 'tabs',
              label: t('panel.tabs.aria'),
              items: PANEL_TABS.map((tab) => ({
                id: tab.key,
                icon: tab.icon,
                label: t(tab.label),
                active: activeTab === tab.key,
                onClick: () => onTabChange(tab.key),
                'data-cell-id': `universal-panel-tab-${tab.key}`,
              })),
            },
            {
              id: 'tools',
              label: t('panel.tools.title'),
              items: TOOLS.map((tool) => ({
                id: tool.id,
                icon: tool.icon,
                label: t(tool.title),
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
            title={t('panel.profileDialog.title')}
            description={t('panel.profileDialog.desc')}
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
            {(visitedTabs.has('dictionary') || activeTab === 'dictionary') && (
              <div className={styles.tabPane} hidden={activeTab !== 'dictionary'}>{dictionaryPanel}</div>
            )}
            {(visitedTabs.has('vocabulary') || activeTab === 'vocabulary') && vocabularyPanel && (
              <div className={styles.tabPane} hidden={activeTab !== 'vocabulary'}>{vocabularyPanel}</div>
            )}
            {(visitedTabs.has('studyModes') || activeTab === 'studyModes') && (
              <div className={styles.tabPane} hidden={activeTab !== 'studyModes'}>{studyModesPanel}</div>
            )}
            {(visitedTabs.has('playlist') || activeTab === 'playlist') && playlistPanel && (
              <div className={styles.tabPane} hidden={activeTab !== 'playlist'}>{playlistPanel}</div>
            )}
            {activeTab === 'recap' && recapPanel}
            {(visitedTabs.has('settings') || activeTab === 'settings') && (
              <div className={styles.tabPane} hidden={activeTab !== 'settings'}>{settingsPanel}</div>
            )}
          </div>
        </div>
      </Surface>
    </div>
  );
}
