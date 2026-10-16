import { useRef, useState, useEffect, useLayoutEffect, type ReactElement, type ReactNode } from 'react';
import { Surface } from '@/shared/ui/Surface';
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
  /** Pointer entering the text-tokenize half — prewarms the SW before the click. */
  readonly onHoverTokenizeText?: () => void;
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
  /** Content for the Queue tab (mining queue). */
  readonly queuePanel?: ReactNode;
}

const TOOLS: { id: string; icon: 'library' | 'layers' | 'playRoundedRect'; title: MessageKey; onClick: () => void; 'data-tihoka-id'?: string }[] = [
  {
    id: 'reader',
    icon: 'library',
    title: 'panel.tools.reader.title',
    onClick: () => { void sendMessage({ type: MESSAGE_TYPES.OPEN_READER, payload: {} }); },
    'data-tihoka-id': 'universal-panel-reader',
  },
  {
    id: 'srs',
    icon: 'layers',
    title: 'panel.tools.srs.title',
    onClick: () => { void sendMessage({ type: MESSAGE_TYPES.SRS_OPEN_STUDY_PAGE, payload: {} }); },
    'data-tihoka-id': 'universal-panel-srs-study',
  },
  {
    id: 'player',
    icon: 'playRoundedRect',
    title: 'panel.tools.player.title',
    onClick: () => { window.open(getLocalPlayerUrl(), '_blank'); },
    'data-tihoka-id': 'universal-panel-tab-local-player',
  },
];

/**
 * UniversalPanel — centered 94% modal inside a full-surface overlay.
 *
 * Desktop: vertical tab rail on the left via CollapsibleSidebar.
 * <= 839px: full-screen (100% x dynamic viewport) with bottom nav bar.
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
  onHoverTokenizeText,
  dictionaryPanel,
  vocabularyPanel,
  studyModesPanel,
  settingsPanel,
  playlistPanel,
  recapPanel,
  queuePanel,
}: UniversalPanelProps): ReactElement | null {
  const panelRef = useRef<HTMLDivElement>(null);
  const wasOpenRef = useRef(isOpen);
  const [isClosing, setIsClosing] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useFocusTrap(panelRef, isOpen);

  // On tab switch the previously focused element can end up outside the
  // dialog (unmounted) or inside a pane that just got `hidden`. Move focus to
  // the visible nav item for the new tab so focus stays inside aria-modal.
  useEffect(() => {
    const panel = panelRef.current;
    if (!isOpen || !panel) return;
    const root = panel.getRootNode() as Document | ShadowRoot;
    const ae = root.activeElement as HTMLElement | null;
    if (ae && panel.contains(ae) && ae.offsetParent !== null) return;
    const item = Array.from(
      panel.querySelectorAll<HTMLElement>(
        `[data-tihoka-id="universal-panel-tab-${activeTab}"],[data-tihoka-id="universal-panel-mobile-tab-${activeTab}"]`,
      ),
    ).find((el) => el.offsetParent !== null);
    item?.focus();
  }, [activeTab, isOpen]);

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
      className={`${overlayClass} js-Tihoka-universal-panel`}
      onClick={handleBackdropClick}
      data-tihoka-id="universal-panel-backdrop"
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
        data-tihoka-id="universal-panel"
      >
        <CollapsibleSidebar
          as="nav"
          collapsed={isCollapsed}
          onCollapsedChange={setIsCollapsed}
          aria-label={t('panel.tabs.aria')}
          data-tihoka-id="universal-panel-tab-bar"
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
                'data-tihoka-id': `universal-panel-tab-${tab.key}`,
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
                'data-tihoka-id': tool['data-tihoka-id'],
              })),
            },
          ]}
        />

        <div className={styles.body}>
          <UniversalPanelHeader
            tokenizeState={tokenizeState}
            onToggleTokenize={onToggleTokenize}
            onClose={onClose}
            hasMedia={hasMedia}
            languageProfiles={languageProfiles}
            activeProfileId={activeProfileId}
            onProfileChange={onProfileChange}
            onHoverTokenizeText={onHoverTokenizeText}
          />

          <div className={styles.content} data-tihoka-id={`universal-panel-content-${activeTab}`}>
            {(visitedTabs.has('dictionary') || activeTab === 'dictionary') && (
              <div className={styles.tabPane} role="region" aria-label={t('panel.tab.dictionary')} hidden={activeTab !== 'dictionary'}>{dictionaryPanel}</div>
            )}
            {(visitedTabs.has('vocabulary') || activeTab === 'vocabulary') && vocabularyPanel && (
              <div className={styles.tabPane} role="region" aria-label={t('panel.tab.vocabulary')} hidden={activeTab !== 'vocabulary'}>{vocabularyPanel}</div>
            )}
            {(visitedTabs.has('studyModes') || activeTab === 'studyModes') && (
              <div className={styles.tabPane} role="region" aria-label={t('panel.tab.studyModes')} hidden={activeTab !== 'studyModes'}>{studyModesPanel}</div>
            )}
            {(visitedTabs.has('playlist') || activeTab === 'playlist') && playlistPanel && (
              <div className={styles.tabPane} role="region" aria-label={t('panel.tab.playlist')} hidden={activeTab !== 'playlist'}>{playlistPanel}</div>
            )}
            {(visitedTabs.has('queue') || activeTab === 'queue') && queuePanel && (
              <div className={styles.tabPane} role="region" aria-label={t('panel.tab.queue')} hidden={activeTab !== 'queue'}>{queuePanel}</div>
            )}
            {(visitedTabs.has('recap') || activeTab === 'recap') && recapPanel && (
              <div className={styles.tabPane} role="region" aria-label={t('panel.tab.recap')} hidden={activeTab !== 'recap'}>{recapPanel}</div>
            )}
            {(visitedTabs.has('settings') || activeTab === 'settings') && (
              <div className={styles.tabPane} role="region" aria-label={t('panel.tab.settings')} hidden={activeTab !== 'settings'}>{settingsPanel}</div>
            )}
          </div>
        </div>

        <UniversalPanelBottomNav
          activeTab={activeTab}
          onTabChange={onTabChange}
          tools={TOOLS.map((tool) => ({ ...tool, title: t(tool.title) }))}
        />
      </Surface>
    </div>
  );
}
