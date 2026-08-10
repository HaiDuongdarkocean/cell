import { useState, useImperativeHandle, forwardRef, useCallback, useRef, useEffect, Component } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { OverlayStyleConfig } from '@/entities/subtitle';
import type { NavClusterSettings, SubtitleBlockSettings, BilingualCue } from '@/entities/media';
import { SubtitleBlock } from './SubtitleBlock';
import { NavCluster } from './NavCluster';
import { SubtitleManagerPanel } from './SubtitleManagerPanel';
import { SubtitleOffsetPanel } from './SubtitleOffsetPanel';
import { SubtitleToast, type ToastItem, type ToastVariant } from './SubtitleToast';
import { SubtitleHint } from './SubtitleHint';
import { SubtitlePanelItem } from './subtitlePanelModel';
import { dragDeltaToYOffset } from '@/features/subtitle/logic/subtitleBlockDrag';
import { togglePlayerMode } from '@/features/subtitle/logic/playerModeGeometry';
import { isChildFrame } from '@/features/subtitle/logic/iframeContext';
import { PlayerModeOverlay } from './PlayerModeOverlay';
import { ICON_CATALOG } from '@/shared/icons';
import { Icon } from '@/shared/icons/Icon';
import { IconButton } from '@/shared/ui/IconButton';
import styles from './SubtitlePanels.module.css';

type IconCatalogKey = keyof typeof ICON_CATALOG;

export interface ManagerState {
  targetItems: SubtitlePanelItem[];
  nativeItems: SubtitlePanelItem[];
  targetActiveIndex: number;
  nativeActiveIndex: number;
  onSelect: (role: 'target' | 'native', index: number) => void;
  onImport?: (role: 'target' | 'native') => void;
  onGenerateNative?: () => void;
  onOffsetChange?: (role: 'target' | 'native', ms: number) => void;
}

export interface OffsetState {
  targetMs: number;
  nativeMs: number;
  onTargetChange: (ms: number) => void;
  onNativeChange: (ms: number) => void;
}

export interface SubtitlePanelsRef {
  /** Update target + native overlay styles. */
  setStyles: (targetStyle: OverlayStyleConfig, nativeStyle: OverlayStyleConfig) => void;
  /** Update nav cluster settings (buttonSize, textOpacity, bgOpacity, enabled). */
  setClusterSettings: (settings: NavClusterSettings) => void;
  /** Update subtitle block settings (bgOpacity, globalScale, yOffsetPercent). */
  setBlockSettings: (settings: SubtitleBlockSettings) => void;
  /** Replace the manager items and callbacks. */
  setManager: (manager: ManagerState) => void;
  /** Replace the offset state and callbacks. */
  setOffset: (offset: OffsetState) => void;
  /** Show or hide the subtitle manager panel. */
  setManagerOpen: (open: boolean) => void;
  /** Show or hide the offset panel. */
  setOffsetOpen: (open: boolean) => void;
  /** Show or hide the drag/drop hint. */
  setHintOpen: (open: boolean) => void;
  /** Add a toast notification. */
  addToast: (message: string, variant?: ToastVariant) => void;
  /** Clear all toasts. */
  clearToasts: () => void;
  /** Update whether a subtitle is currently loaded. */
  setHasSubtitle: (has: boolean) => void;
  /** Update whether the video is playing. */
  setIsPlaying: (playing: boolean) => void;
  /** Update the repeat AB-loop active state. */
  setRepeatActive: (active: boolean) => void;
  /** Update the repeat button icon and label. */
  setRepeatIcon: (icon: IconCatalogKey, label?: string) => void;
  /** Enable or disable the manager-panel generate-native button. */
  setGenerateNativeEnabled: (enabled: boolean) => void;
  /** Collapse or expand the nav cluster. */
  setCollapsed: (collapsed: boolean) => void;
  /** Update the block vertical position (percent 0-95). */
  setYOffsetPercent: (yOffsetPercent: number) => void;
  /** Update bilingual cues for CueList in Player Mode. */
  setCues: (cues: BilingualCue[]) => void;
  /** Update current video time (ms) for CueList highlight. */
  setCurrentTimeMs: (timeMs: number) => void;
}

export interface SubtitlePanelsProps {
  targetStyle: OverlayStyleConfig;
  nativeStyle: OverlayStyleConfig;
  collapsed: boolean;
  hasSubtitle: boolean;
  isPlaying: boolean;
  repeatActive: boolean;
  repeatIcon?: IconCatalogKey;
  repeatLabel?: string;
  /** Nav cluster settings from extension popup. */
  clusterSettings?: NavClusterSettings;
  /** Subtitle block settings from extension popup. */
  blockSettings?: SubtitleBlockSettings;
  /** Block vertical position as percent of video height (0-95, center of block). ADR-025. */
  yOffsetPercent: number;
  /** Called when user drags the block to a new Y position (percent 0-95, snapped). */
  onDragReposition?: (yOffsetPercent: number) => void;
  onPrev: () => void;
  onNext: () => void;
  onRepeat: () => void;
  onRewind: () => void;
  onForward: () => void;
  onPlayPause: () => void;
  onToggleCollapsed: () => void;
  /** Quick-add all unknown/tracking words in the current subtitle line. */
  onQuickAdd?: () => void;
  /** Open the Card Creator dialog pre-filled for the current line. */
  onEditCard?: () => void;
  /** Update the card matching the current subtitle line. */
  onUpdateCurrentCard?: () => void;
  /** Generate a native subtitle from the current target cues. */
  onGenerateNative?: () => void;
  /** Open/close the Chrome side panel. */
  onToggleSidePanel?: () => void;
  /** Open the subtitle manager panel. */
  onToggleManager?: () => void;
  manager?: ManagerState;
  offset?: OffsetState;
  generateNativeEnabled?: boolean;
  /** Intrinsic video width/height ratio used by Player Mode layout. */
  videoAspectRatio?: number;
  /** Called when user toggles Player Mode. */
  onTogglePlayerMode?: (active: boolean) => void;
  /** Bilingual cues for CueList in Player Mode. */
  cues?: BilingualCue[];
  /** Current video time in ms (for CueList highlight). */
  currentTimeMs?: number;
  /** Subtitle offset in ms (ADR-019 sync). */
  offsetMs?: number;
  /** Seek video to timeMs when user clicks a cue. */
  onSeek?: (timeMs: number) => void;
}

export const SubtitlePanels = forwardRef<SubtitlePanelsRef, SubtitlePanelsProps>(
  function SubtitlePanels(
    {
      targetStyle: initialTargetStyle,
      nativeStyle: initialNativeStyle,
      collapsed: initialCollapsed,
      hasSubtitle: initialHasSubtitle,
      isPlaying: initialIsPlaying,
      repeatActive: initialRepeatActive,
      repeatIcon: initialRepeatIcon = 'repeat',
      repeatLabel: initialRepeatLabel = 'Repeat current sentence',
      clusterSettings: initialClusterSettings,
      blockSettings: initialBlockSettings,
      yOffsetPercent: initialYOffsetPercent = 75,
      onDragReposition,
      onPrev,
      onNext,
      onRepeat,
      onRewind,
      onForward,
      onPlayPause,
      onToggleCollapsed,
      onQuickAdd,
      onEditCard,
      onUpdateCurrentCard,
      onGenerateNative,
      onToggleSidePanel,
      onToggleManager,
      manager: initialManager,
      offset: initialOffset,
      generateNativeEnabled: initialGenerateNativeEnabled = true,
      videoAspectRatio = 16 / 9,
      onTogglePlayerMode,
      cues: initialCues,
      currentTimeMs: initialCurrentTimeMs,
      offsetMs,
      onSeek,
    },
    ref,
  ): React.JSX.Element {
    const [targetStyle, setTargetStyle] = useState(initialTargetStyle);
    const [nativeStyle, setNativeStyle] = useState(initialNativeStyle);
    const [collapsed, setCollapsed] = useState(initialCollapsed);
    const [hasSubtitle, setHasSubtitle] = useState(initialHasSubtitle);
    const [isPlaying, setIsPlaying] = useState(initialIsPlaying);
    const [repeatActive, setRepeatActive] = useState(initialRepeatActive);
    const [repeatIcon, setRepeatIcon] = useState<IconCatalogKey>(initialRepeatIcon);
    const [repeatLabel, setRepeatLabel] = useState(initialRepeatLabel);
    const [yOffsetPercent, setYOffsetPercent] = useState(initialYOffsetPercent);
    const [clusterSettings, setClusterSettingsState] = useState<NavClusterSettings | undefined>(initialClusterSettings);
    const [blockSettings, setBlockSettingsState] = useState<SubtitleBlockSettings | undefined>(initialBlockSettings);
    const [dragging, setDragging] = useState(false);
    const [manager, setManager] = useState<ManagerState | undefined>(initialManager);
    const [offset, setOffset] = useState<OffsetState | undefined>(initialOffset);
    const [managerOpen, setManagerOpen] = useState(false);
    const [offsetOpen, setOffsetOpen] = useState(false);
    const [hintOpen, setHintOpen] = useState(false);
    const [toasts, setToasts] = useState<ToastItem[]>([]);
    const [generateNativeEnabled, setGenerateNativeEnabled] = useState(initialGenerateNativeEnabled);
    const [toolsExpanded, setToolsExpanded] = useState(false);
    const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
    const [playerMode, setPlayerMode] = useState(false);
    const [cues, setCues] = useState<readonly BilingualCue[]>(initialCues ?? []);
    const [currentTimeMs, setCurrentTimeMs] = useState(initialCurrentTimeMs ?? 0);

    useEffect(() => {
      const root = rootRef.current;
      if (!root) return;
      const rootNode = root.getRootNode();
      if (!(rootNode instanceof ShadowRoot)) return;
      const el = document.createElement('div');
      el.style.display = 'contents';
      rootNode.appendChild(el);
      setPortalTarget(el);
      return () => {
        setPortalTarget(null);
        el.remove();
      };
    }, []);

    const addToast = useCallback((message: string, variant?: ToastVariant): void => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setToasts((prev) => [...prev, { id, message, variant }]);
    }, []);

    const clearToasts = useCallback((): void => setToasts([]), []);

    const removeToast = useCallback((id: string): void => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        setStyles: (t, n) => { setTargetStyle(t); setNativeStyle(n); },
        setClusterSettings: (s) => setClusterSettingsState(s),
        setBlockSettings: (s) => setBlockSettingsState(s),
        setManager: (m) => setManager(m),
        setOffset: (o) => setOffset(o),
        setManagerOpen,
        setOffsetOpen,
        setHintOpen,
        addToast,
        clearToasts,
        setHasSubtitle,
        setIsPlaying,
        setRepeatActive,
        setRepeatIcon,
        setRepeatLabel,
        setGenerateNativeEnabled,
        setCollapsed,
        setYOffsetPercent,
        setCues,
        setCurrentTimeMs,
      }),
      [addToast, clearToasts],
    );

    const handleToggleCollapsed = useCallback((): void => {
      setCollapsed((prev) => !prev);
      onToggleCollapsed();
    }, [onToggleCollapsed]);

    const handlePlayPause = useCallback((): void => {
      onPlayPause();
    }, [onPlayPause]);

    const handleTogglePlayerMode = useCallback(async (): Promise<void> => {
      // Cross-origin iframe (AnimeKai/megaplay, moviepire/vidnest): use the
      // native Fullscreen API on the child document. Browser scales the iframe
      // to fill the viewport natively, no top-frame bridge or CSS reparenting.
      // attachFullscreenReparenting already moves #cell-subtitle-root into
      // document.fullscreenElement on fullscreenchange, so the overlay lives in
      // the fullscreen top-layer. PlayerModeOverlay is transparent in child frame
      // so the video shows through; Cell controls stay interactive.
      if (isChildFrame()) {
        if (document.fullscreenElement) {
          try {
            await document.exitFullscreen();
          } catch {
            /* ignore — browser may already be exiting */
          }
        } else {
          try {
            await document.documentElement.requestFullscreen();
          } catch {
            addToast('Player mode requires fullscreen permission', 'error');
          }
        }
        return;
      }

      // Top frame (YouTube/themoviebox): exit any host fullscreen before
      // reparenting the video into the Player Mode shadow stage. The fullscreen
      // element is top-layer and cannot be reparented without Chrome exiting it.
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
      setPlayerMode((prev) => togglePlayerMode(prev));
    }, [playerMode, addToast]);

    useEffect(() => {
      onTogglePlayerMode?.(playerMode);
    }, [onTogglePlayerMode, playerMode]);

    // Cross-origin iframe: keep playerMode in sync with the child document's
    // native fullscreen state. When requestFullscreen() succeeds, the overlay
    // mounts; pressing Esc or calling exitFullscreen() tears it down. We only
    // treat "document.documentElement is the fullscreen element" as Player Mode
    // so that site-initiated <video> fullscreen doesn't force the overlay on.
    useEffect(() => {
      if (!isChildFrame()) return;
      const onFullscreenChange = (): void => {
        setPlayerMode(document.fullscreenElement === document.documentElement);
      };
      document.addEventListener('fullscreenchange', onFullscreenChange);
      return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
    }, [setPlayerMode]);

    // ADR-025: drag-to-reposition theo trục Y. Pointer Events + rAF throttle +
    // transform (atom ux-drag-transform-willchange-raf). touch-action:none trên .root
    // (atom ux-touch-action-none-for-pointer-drag). Drag chỉ trên background —
    // cluster/button/text có pointer-events:auto nên không trigger drag.
    const rootRef = useRef<HTMLDivElement>(null);

    // Player Mode: live inside document.fullscreenElement when host is
    // fullscreen (top layer renders above everything — no z-index hack needed).
    // attachFullscreenReparenting (mountReactShadow) already moves #cell-subtitle-root
    // into document.fullscreenElement on fullscreenchange. Player Mode just needs
    // to NOT override that by moving cell root to document.body.
    //
    // When NOT fullscreen: fall back to body reparenting (escape video container
    // stacking context). PlayerModeOverlay moves host <video> into the video stage.
    //
    // When fullscreen: keep cell root inside fullscreen element. Host <video>
    // moves into the video stage (shadow DOM child). Seamless UX: exiting
    // Player Mode does NOT exit host fullscreen.
    const playerModeOriginalParent = useRef<HTMLElement | null>(null);
    const playerModeSavedStyles = useRef<{ zIndex: string; position: string; inset: string } | null>(null);

    useEffect(() => {
      const host = document.querySelector('#cell-subtitle-root');
      if (!(host instanceof HTMLElement)) return;
      if (playerMode) {
        playerModeSavedStyles.current = {
          zIndex: host.style.zIndex,
          position: host.style.position,
          inset: host.style.inset,
        };
        host.style.zIndex = '2147483647';
        host.style.position = 'fixed';
        host.style.inset = '0';
        host.setAttribute('data-cell-player-mode', 'true');
        if (isChildFrame()) {
          // Native fullscreen: attachFullscreenReparenting already moves the host
          // into document.fullscreenElement. Don't override by reparenting to body.
          return;
        }
        if (host.parentElement && host.parentElement !== document.body) {
          playerModeOriginalParent.current = host.parentElement;
          // Also save on the host element itself — PlayerModeOverlay (child)
          // effect may run before or after this effect depending on React's
          // effect ordering. Storing on the host ensures the exit branch can
          // always recover the original parent regardless of who moved it.
          const hostWithProp = host as HTMLElement & { __cellOriginalParent?: HTMLElement };
          if (!hostWithProp.__cellOriginalParent) {
            hostWithProp.__cellOriginalParent = host.parentElement;
          }
          document.body.appendChild(host);
        }
      } else {
        host.removeAttribute('data-cell-player-mode');
        const saved = playerModeSavedStyles.current;
        if (saved) {
          host.style.zIndex = saved.zIndex;
          host.style.position = saved.position;
          host.style.inset = saved.inset;
          playerModeSavedStyles.current = null;
        }
        if (isChildFrame()) {
          // attachFullscreenReparenting will restore the host to its mount parent
          // on fullscreen exit. Don't reparent it here.
          playerModeOriginalParent.current = null;
          (host as HTMLElement & { __cellOriginalParent?: HTMLElement }).__cellOriginalParent = undefined;
          return;
        }
        const originalParent = playerModeOriginalParent.current
          ?? (host as HTMLElement & { __cellOriginalParent?: HTMLElement }).__cellOriginalParent
          ?? null;
        if (originalParent && host.parentElement !== originalParent) {
          originalParent.appendChild(host);
        }
        playerModeOriginalParent.current = null;
        (host as HTMLElement & { __cellOriginalParent?: HTMLElement }).__cellOriginalParent = undefined;
      }
    }, [playerMode]);

    const dragState = useRef<{
      startY: number;
      startOffset: number;
      containerHeight: number;
      rafId: number | null;
      pendingDelta: number;
    } | null>(null);

    const handlePointerDown = useCallback(
      (e: React.PointerEvent<HTMLDivElement>): void => {
        // Chỉ drag khi nhấn trực tiếp lên root background (không qua child interactive).
        // Children interactive có pointer-events:auto + e.target !== currentTarget.
        if (e.target !== e.currentTarget) return;
        const root = rootRef.current;
        if (!root) return;
        const rootNode = root.getRootNode();
        const host = rootNode instanceof ShadowRoot ? (rootNode.host as HTMLElement) : root.parentElement;
        const containerHeight = host ? host.getBoundingClientRect().height : 0;
        if (containerHeight <= 0) return;
        dragState.current = {
          startY: e.clientY,
          startOffset: yOffsetPercent,
          containerHeight,
          rafId: null,
          pendingDelta: 0,
        };
        setDragging(true);
        root.setPointerCapture(e.pointerId);
      },
      [yOffsetPercent],
    );

    const handlePointerMove = useCallback(
      (e: React.PointerEvent<HTMLDivElement>): void => {
        const st = dragState.current;
        if (!st) return;
        st.pendingDelta = e.clientY - st.startY;
        if (st.rafId !== null) return;
        st.rafId = requestAnimationFrame(() => {
          st.rafId = null;
          const next = dragDeltaToYOffset(st.startOffset, st.pendingDelta, st.containerHeight);
          setYOffsetPercent(next);
        });
      },
      [],
    );

    const handlePointerUp = useCallback(
      (e: React.PointerEvent<HTMLDivElement>): void => {
        const st = dragState.current;
        if (!st) return;
        if (st.rafId !== null) {
          cancelAnimationFrame(st.rafId);
          st.rafId = null;
        }
        const finalDelta = e.clientY - st.startY;
        // Release ở đâu giữ nguyên đó — chỉ clamp 0-95%, không snap (theo yêu cầu).
        const next = dragDeltaToYOffset(st.startOffset, finalDelta, st.containerHeight);
        setYOffsetPercent(next);
        onDragReposition?.(next);
        dragState.current = null;
        setDragging(false);
        rootRef.current?.releasePointerCapture(e.pointerId);
      },
      [onDragReposition],
    );

    // Cluster settings CSS variables — áp dụng cho cả clusterLeft (NavCluster) + clusterRight
    // buttonSize uses clamp for auto-responsive scaling (65%→100% based on container width)
    const clusterBtnSize = clusterSettings?.buttonSize ?? 34;
    const clusterTextOpacity = clusterSettings?.textOpacity ?? 1;
    const clusterBgOpacity = clusterSettings?.bgOpacity ?? 0.2;
    const clusterRightStyle: React.CSSProperties = {
      '--cluster-btn-size': `clamp(${Math.round(clusterBtnSize * 0.65)}px, ${Math.round(clusterBtnSize * 0.15)}cqw, ${clusterBtnSize}px)`,
      '--cluster-icon-size': `clamp(${Math.round(clusterBtnSize * 0.35)}px, ${Math.round(clusterBtnSize * 0.082)}cqw, 20px)`,
      '--cluster-text-opacity': String(clusterTextOpacity),
      '--cluster-bg-opacity': String(clusterBgOpacity),
    } as React.CSSProperties;

    if (playerMode) {
      return (
        <PlayerModeErrorBoundary>
          <PlayerModeOverlay
            targetStyle={targetStyle}
            nativeStyle={nativeStyle}
            hasSubtitle={hasSubtitle}
            isPlaying={isPlaying}
            repeatActive={repeatActive}
            repeatIcon={repeatIcon}
            repeatLabel={repeatLabel}
            clusterSettings={clusterSettings}
            blockSettings={blockSettings}
            videoAspectRatio={videoAspectRatio}
            onQuickAdd={onQuickAdd}
            onEditCard={onEditCard}
            onUpdateCurrentCard={onUpdateCurrentCard}
            onGenerateNative={onGenerateNative}
            onToggleSidePanel={onToggleSidePanel}
            onToggleManager={onToggleManager}
            generateNativeEnabled={generateNativeEnabled}
            toolsExpanded={toolsExpanded}
            onToggleTools={() => setToolsExpanded((value) => !value)}
            onPrev={onPrev}
            onNext={onNext}
            onRepeat={onRepeat}
            onRewind={onRewind}
            onForward={onForward}
            onPlayPause={onPlayPause}
            onToggleCollapsed={handleToggleCollapsed}
            onExit={handleTogglePlayerMode}
            cues={cues as BilingualCue[]}
            currentTimeMs={currentTimeMs}
            offsetMs={offsetMs}
            onSeek={onSeek}
          />
        </PlayerModeErrorBoundary>
      );
    }

    return (
      <div
        ref={rootRef}
        className={`${styles.root}${dragging ? ` ${styles.dragging}` : ''}`}
        style={{ '--sb-y': yOffsetPercent } as React.CSSProperties}
        data-cell-id="subtitle-panels-root"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div className={styles.navLayer}>
          <NavCluster
            collapsed={collapsed}
            hasSubtitle={hasSubtitle}
            isPlaying={isPlaying}
            repeatActive={repeatActive}
            repeatIcon={repeatIcon}
            repeatLabel={repeatLabel}
            clusterSettings={clusterSettings}
            onToggleCollapsed={handleToggleCollapsed}
            onPrev={onPrev}
            onNext={onNext}
            onRepeat={onRepeat}
            onRewind={onRewind}
            onForward={onForward}
            onPlayPause={handlePlayPause}
          />
        </div>

        <div className={styles.blockLayer}>
          <SubtitleBlock targetStyle={targetStyle} nativeStyle={nativeStyle} blockSettings={blockSettings} />
        </div>

        {!collapsed && (
          <div className={styles.clusterRight} style={clusterRightStyle} data-cell-id="nav-cluster-right">
            <div className={styles.primaryCol}>
              {onQuickAdd && (
                <IconButton
                  aria-label="Quick add card"
                  title="Quick add (Q)"
                  data-cell-id="quick-add-btn"
                  size="sm"
                  onClick={onQuickAdd}
                >
                  <Icon name="zap" size={18} />
                </IconButton>
              )}
              {onEditCard && (
                <IconButton
                  aria-label="Edit card"
                  title="Edit card (E)"
                  data-cell-id="edit-card-btn"
                  size="sm"
                  onClick={onEditCard}
                >
                  <Icon name="pencil" size={18} />
                </IconButton>
              )}
              <div className={styles.toggleWrap}>
                <div
                  className={`${styles.extraCol} ${toolsExpanded ? styles.expanded : ''}`}
                  data-cell-id="subtitle-tools-extra"
                >
                  {onToggleSidePanel && (
                    <IconButton
                      aria-label="Toggle subtitle side panel"
                      title="Toggle side panel (T)"
                      data-cell-id="panel-toggle-btn"
                      size="sm"
                      onClick={onToggleSidePanel}
                    >
                      <Icon name="sidePanel" size={18} />
                    </IconButton>
                  )}
                  {onGenerateNative && (
                    <IconButton
                      aria-label="Generate native subtitle"
                      title="Generate native (G)"
                      data-cell-id="generate-native-btn"
                      size="sm"
                      onClick={onGenerateNative}
                      disabled={!generateNativeEnabled}
                    >
                      <Icon name="languages" size={18} />
                    </IconButton>
                  )}
                </div>
                <IconButton
                  aria-label={toolsExpanded ? 'Collapse tools' : 'Expand tools'}
                  title={toolsExpanded ? 'Collapse tools' : 'Expand tools'}
                  data-cell-id="tools-toggle-btn"
                  size="sm"
                  onClick={() => setToolsExpanded((v) => !v)}
                >
                  <Icon name="chevronLeft" size={18} />
                </IconButton>
              </div>
            </div>
            <div className={styles.secondaryCol}>
              {onUpdateCurrentCard && (
                <IconButton
                  aria-label="Update current card"
                  title="Update current card (U)"
                  data-cell-id="update-current-card-btn"
                  size="sm"
                  onClick={onUpdateCurrentCard}
                >
                  <Icon name="rotateCcw" size={18} />
                </IconButton>
              )}
              {onToggleManager && (
                <IconButton
                  aria-label="Open subtitle manager"
                  title="Open subtitle manager"
                  data-cell-id="manager-toggle-btn"
                  size="sm"
                  onClick={onToggleManager}
                >
                  <Icon name="subtitleManager" size={18} />
                </IconButton>
              )}
              <IconButton
                aria-label={playerMode ? 'Exit player mode' : 'Enter player mode'}
                title={playerMode ? 'Exit player mode' : 'Enter player mode'}
                data-cell-id="player-mode-btn"
                size="sm"
                onClick={handleTogglePlayerMode}
                active={playerMode}
              >
                <Icon name={playerMode ? 'minimize' : 'maximize'} size={18} />
              </IconButton>
            </div>
          </div>
        )}

        {managerOpen && manager && portalTarget && createPortal(
          <div className={styles.panelLayer} data-cell-id="subtitle-manager-layer">
            <SubtitleManagerPanel
              targetItems={manager.targetItems}
              nativeItems={manager.nativeItems}
              targetActiveIndex={manager.targetActiveIndex}
              nativeActiveIndex={manager.nativeActiveIndex}
              onSelect={manager.onSelect}
              onClose={() => setManagerOpen(false)}
              onImport={manager.onImport}
              onGenerateNative={manager.onGenerateNative}
              onOffsetChange={manager.onOffsetChange}
              generateNativeDisabled={!generateNativeEnabled}
            />
          </div>,
          portalTarget,
        )}

        {offsetOpen && offset && (
          <div className={styles.panelLayer} data-cell-id="subtitle-offset-layer">
            <div className={styles.offsetRow}>
              <SubtitleOffsetPanel
                offsetMs={offset.targetMs}
                onOffsetChange={offset.onTargetChange}
              />
              <SubtitleOffsetPanel
                offsetMs={offset.nativeMs}
                onOffsetChange={offset.onNativeChange}
              />
            </div>
          </div>
        )}

        <div className={styles.toastLayer}>
          <SubtitleToast toasts={toasts} onRemove={removeToast} />
        </div>

        {hintOpen && (
          <div className={styles.hintLayer} data-cell-id="subtitle-hint-layer">
            <SubtitleHint onClick={() => setHintOpen(false)} />
          </div>
        )}
      </div>
    );
  },
);

class PlayerModeErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error };
  }

  componentDidCatch(error: Error): void {
    // eslint-disable-next-line no-console
    console.error('[PlayerModeErrorBoundary]', error.message, error.stack);
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div style={{ position: 'fixed', inset: 0, background: '#1a1a1a', color: '#ff4444', padding: 20, fontSize: 14, fontFamily: 'monospace', zIndex: 2147483647, overflow: 'auto' }}>
          <div style={{ marginBottom: 8, color: '#fff', fontSize: 16 }}>Player Mode crashed:</div>
          <div>{this.state.error.message}</div>
          <pre style={{ marginTop: 8, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{this.state.error.stack}</pre>
          <div style={{ marginTop: 12, color: '#aaa' }}>Check console for details.</div>
        </div>
      );
    }
    return this.props.children;
  }
}
