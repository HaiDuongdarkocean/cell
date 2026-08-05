import { useState, useImperativeHandle, forwardRef, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { OverlayStyleConfig } from '@/entities/subtitle';
import type { NavClusterSettings, SubtitleBlockSettings } from '@/entities/media';
import { SubtitleBlock } from './SubtitleBlock';
import { NavCluster } from './NavCluster';
import { SubtitleManagerPanel } from './SubtitleManagerPanel';
import { SubtitleOffsetPanel } from './SubtitleOffsetPanel';
import { SubtitleToast, type ToastItem, type ToastVariant } from './SubtitleToast';
import { SubtitleHint } from './SubtitleHint';
import { SubtitlePanelItem } from './subtitlePanelModel';
import { dragDeltaToYOffset, dragEndSnapYOffset } from '@/features/subtitle/logic/subtitleBlockDrag';
import { togglePlayerMode } from '@/features/subtitle/logic/playerModeGeometry';
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

    const handleTogglePlayerMode = useCallback((): void => {
      setPlayerMode((prev) => togglePlayerMode(prev));
    }, []);

    useEffect(() => {
      onTogglePlayerMode?.(playerMode);
    }, [onTogglePlayerMode, playerMode]);

    // ADR-025: drag-to-reposition theo trục Y. Pointer Events + rAF throttle +
    // transform (atom ux-drag-transform-willchange-raf). touch-action:none trên .root
    // (atom ux-touch-action-none-for-pointer-drag). Drag chỉ trên background —
    // cluster/button/text có pointer-events:auto nên không trigger drag.
    const rootRef = useRef<HTMLDivElement>(null);

    // Player Mode: reparent #cell-subtitle-root to document.body (escape video
    // container's stacking context), full-screen, z-index max. A light DOM
    // backdrop (bg black, z-index max-1) attached to document.body covers ALL
    // host UI regardless of stacking context or iframe structure — cross-browser,
    // cross-site, no host class/id queries. Canvas in overlay (z-index max) draws
    // video frames on top of the backdrop.
    // When exiting, restore original styles set by mountReactShadow/mountSubtitle
    // (position:absolute, zIndex:200, inset:0) — clearing them breaks the
    // stacking context and lets the <video> element cover NavCluster/subtitle.
    const playerModeOriginalParent = useRef<HTMLElement | null>(null);
    const playerModeSavedStyles = useRef<{ zIndex: string; position: string; inset: string } | null>(null);
    const playerModeBackdrop = useRef<HTMLDivElement | null>(null);
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
        host.style.pointerEvents = 'none';
        if (host.parentElement && host.parentElement !== document.body) {
          playerModeOriginalParent.current = host.parentElement;
          document.body.appendChild(host);
        }
        // Light DOM backdrop: fixed full-screen black, z-index just below
        // cell-subtitle-root. Covers all host UI (controls, captions, gestures)
        // regardless of where they live in the DOM — no host queries needed.
        if (!playerModeBackdrop.current) {
          const backdrop = document.createElement('div');
          backdrop.style.cssText =
            'position:fixed;inset:0;width:100vw;height:100vh;background:#000;z-index:2147483646;pointer-events:none;';
          document.body.appendChild(backdrop);
          playerModeBackdrop.current = backdrop;
        }
      } else {
        // Only restore if we previously saved (i.e. exiting Player Mode).
        // On first mount (playerMode=false, saved=null) don't touch styles —
        // mountReactShadow/mountSubtitle already set them correctly.
        const saved = playerModeSavedStyles.current;
        if (saved) {
          host.style.zIndex = saved.zIndex;
          host.style.position = saved.position;
          host.style.inset = saved.inset;
          playerModeSavedStyles.current = null;
        }
        const originalParent = playerModeOriginalParent.current;
        if (originalParent && host.parentElement !== originalParent) {
          originalParent.appendChild(host);
        }
        playerModeOriginalParent.current = null;
        if (playerModeBackdrop.current) {
          playerModeBackdrop.current.remove();
          playerModeBackdrop.current = null;
        }
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
        const rawY = dragDeltaToYOffset(st.startOffset, finalDelta, st.containerHeight);
        // Snap chỉ khi release → CSS transition tạo animation mượt tới snap point
        const next = dragEndSnapYOffset(rawY);
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
        />
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
              <IconButton
                aria-label={playerMode ? 'Exit player mode' : 'Enter player mode'}
                title={playerMode ? 'Exit player mode' : 'Enter player mode'}
                data-cell-id="player-mode-btn"
                size="sm"
                onClick={handleTogglePlayerMode}
                active={playerMode}
              >
                <Icon name="pip" size={18} />
              </IconButton>
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
