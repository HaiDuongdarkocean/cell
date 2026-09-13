import { useState, useImperativeHandle, forwardRef, useCallback, useRef, useEffect, Component } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { NavClusterSettings, SubtitleBlockSettings, BilingualCue } from '@/entities/media';
import { SubtitleBlock } from './SubtitleBlock';
import { NavCluster } from './NavCluster';
import { ClusterRightToolbar } from './ClusterRightToolbar';
import { ManagerLayer } from './ManagerLayer';
import { OffsetLayer } from './OffsetLayer';
import { SubtitleToast } from './SubtitleToast';
import { useToasts } from './subtitleToasts';
import { SubtitleHint } from './SubtitleHint';
import { dragDeltaToYOffset } from '@/features/subtitle/logic/subtitleBlockDrag';
import { togglePlayerMode } from '@/features/subtitle/logic/playerModeGeometry';
import { isChildFrame, requestIframePlayerModeEnter, requestIframePlayerModeExit } from '@/features/subtitle/logic/iframePlayerModeBridge';
import { PlayerModeOverlay } from './PlayerModeOverlay';
import { SubtitlePanel } from './SubtitlePanel';
import { useOverlayPortals } from './subtitlePortals';
import { useSplitView } from './subtitleSplitView';
import { ShadowThemeProvider } from '@/shared/lib/shadowRoot/ShadowThemeProvider';
import { useIsMobile } from '@/shared/ui/useIsMobile';
import { BREAKPOINTS } from '@/shared/lib/tokens';
import { buildClusterCssVars } from './subtitleUI';
import styles from './SubtitlePanels.module.css';
import { useManagerHostDelegation } from './subtitleManagerHost';
import type {
  ManagerState,
  OffsetState,
  SubtitlePanelsRef,
  SubtitlePanelsProps,
  IconCatalogKey,
} from './subtitlePanelsTypes';

// Re-export for backward compatibility — SSOT lives in subtitlePanelsTypes.ts
export type {
  ManagerState,
  OffsetState,
  SubtitlePanelsRef,
  SubtitlePanelsProps,
  AppearanceState,
} from './subtitlePanelsTypes';

export const SubtitlePanels = forwardRef<SubtitlePanelsRef, SubtitlePanelsProps>(
  function SubtitlePanels(
    {
      targetStyle: initialTargetStyle,
      nativeStyle: initialNativeStyle,
      collapsed: initialCollapsed,
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
      onToggleOcr,
      ocrEnabled,
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
      onSplitViewChange,
      managerShadowCss,
      playlistContent,
      filename,
      fallbackPlayerContainerRef,
      removeBracketed: initialRemoveBracketed = false,
    },
    ref,
  ): React.JSX.Element {
    const [targetStyle, setTargetStyle] = useState(initialTargetStyle);
    const [nativeStyle, setNativeStyle] = useState(initialNativeStyle);
    const [collapsed, setCollapsed] = useState(initialCollapsed);
    const [isPlaying, setIsPlaying] = useState(initialIsPlaying);
    const [repeatActive, setRepeatActive] = useState(initialRepeatActive);
    const [repeatIcon, setRepeatIcon] = useState<IconCatalogKey>(initialRepeatIcon);
    const [repeatLabel, setRepeatLabel] = useState(initialRepeatLabel);
    const [yOffsetPercent, setYOffsetPercent] = useState(initialYOffsetPercent);
    const [clusterSettings, setClusterSettingsState] = useState<NavClusterSettings | undefined>(initialClusterSettings);
    const [blockSettings, setBlockSettingsState] = useState<SubtitleBlockSettings | undefined>(initialBlockSettings);
    const [dragging, setDragging] = useState(false);
    const [manager, setManager] = useState<ManagerState | undefined>(initialManager);
    // Sync manager prop → state when parent passes a *new* manager object
    // (e.g. local-player rebuilds ManagerState when subtitles change). Guard
    // against the first render where the prop is undefined but the controller
    // will immediately set the real state via the imperative ref.
    const lastInitialManagerRef = useRef(initialManager);
    useEffect(() => {
      if (initialManager !== lastInitialManagerRef.current) {
        lastInitialManagerRef.current = initialManager;
        setManager(initialManager);
      }
    }, [initialManager]);
    const [offset, setOffset] = useState<OffsetState | undefined>(initialOffset);
    const lastInitialOffsetRef = useRef(initialOffset);
    useEffect(() => {
      if (initialOffset !== lastInitialOffsetRef.current) {
        lastInitialOffsetRef.current = initialOffset;
        setOffset(initialOffset);
      }
    }, [initialOffset]);
    const [removeBracketed, setRemoveBracketed] = useState(initialRemoveBracketed);
    const [managerOpen, setManagerOpen] = useState(false);
    const [managerExiting, setManagerExiting] = useState(false);
    const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isMobile = useIsMobile(BREAKPOINTS.medium);
    // Desktop: trigger slide-out animation, then unmount after 280ms.
    // Mobile: unmount immediately (Sheet handles its own exit animation).
    const closeManager = useCallback(() => {
      if (!isMobile) {
        setManagerExiting(true);
        if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
        exitTimerRef.current = setTimeout(() => {
          setManagerOpen(false);
          setManagerExiting(false);
          exitTimerRef.current = null;
        }, 280);
      } else {
        setManagerOpen(false);
      }
    }, [isMobile]);
    const [offsetOpen, setOffsetOpen] = useState(false);
    const [hintOpen, setHintOpen] = useState(false);
    const { toasts, addToast, clearToasts, removeToast } = useToasts();
    const [generateNativeEnabled, setGenerateNativeEnabled] = useState(initialGenerateNativeEnabled);
    const [ocrEnabledState, setOcrEnabledState] = useState(ocrEnabled ?? false);
    const [toolsExpanded, setToolsExpanded] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const { managerPortalTarget } = useOverlayPortals({ rootRef, managerShadowCss, isMobile });
    const [playerMode, setPlayerMode] = useState(false);
    const [cues, setCues] = useState<readonly BilingualCue[]>(initialCues ?? []);
    const [currentTimeMs, setCurrentTimeMs] = useState(initialCurrentTimeMs ?? 0);
    // Sync prop → state when cues change after mount (e.g. subtitle loaded later).
    useEffect(() => { setCues(initialCues ?? []); }, [initialCues]);
    useEffect(() => { setCurrentTimeMs(initialCurrentTimeMs ?? 0); }, [initialCurrentTimeMs]);
    const {
      splitViewOpen,
      splitViewPortalTarget,
      handleToggleSplitView,
      setSplitViewOpen,
      drainPendingRestore,
    } = useSplitView({ playerMode, onSplitViewChange, fallbackPlayerContainerRef });

    // Listen for ENTERED/EXITED from the top-frame bridge so the child overlay
    // mounts/unmounts when the user presses `g` on the top document (not inside
    // the iframe). When the child triggers PM itself, requestIframePlayerModeEnter
    // resolves on ENTERED and handleTogglePlayerMode sets playerMode — this
    // listener is redundant but harmless (setPlayerMode is idempotent).
    useEffect(() => {
      if (!isChildFrame()) return;
      const onMessage = (e: MessageEvent): void => {
        if (e.data?.type === '__CELL_PLAYER_MODE_ENTERED') {
          setPlayerMode(true);
        } else if (e.data?.type === '__CELL_PLAYER_MODE_EXITED') {
          setPlayerMode(false);
        }
      };
      window.addEventListener('message', onMessage);
      return () => window.removeEventListener('message', onMessage);
    }, []);

    const { managerOpenOnHost } = useManagerHostDelegation({
      managerOpen,
      isMobile,
      manager,
      offset,
      generateNativeEnabled,
      closeManager,
    });

    const handleToggleCollapsed = useCallback((): void => {
      setCollapsed((prev) => !prev);
      onToggleCollapsed();
    }, [onToggleCollapsed]);

    const handlePlayPause = useCallback((): void => {
      onPlayPause();
    }, [onPlayPause]);

    const handleTogglePlayerMode = useCallback(async (): Promise<void> => {
      if (isChildFrame()) {
        // Guard: if the iframe (or video inside) is currently in fullscreen,
        // exit it first so the top frame can enter Cell Player Mode fullscreen
        // on the host container. Fullscreen is from the child browsing context,
        // so we must exit it from the child, then ask the top frame.
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        }
        if (playerMode) {
          requestIframePlayerModeExit();
          setPlayerMode(false);
          return;
        }
        // Ask the top-frame bridge to request fullscreen on the host container.
        if (await requestIframePlayerModeEnter()) {
          setPlayerMode(true);
        } else {
          addToast('Player mode could not reach the host player', 'error');
        }
        return;
      }

      // Exit site fullscreen BEFORE toggling playerMode. The fullscreen element
      // is top-layer and cannot be reparented into shadow DOM without Chrome
      // exiting fullscreen. await ensures the document is no longer fullscreen
      // when PlayerModeOverlay mounts, so the player-move effect runs the normal
      // flow (reparent into video stage). After mount, the native-fullscreen
      // effect requests fullscreen on #cell-subtitle-root — SSOT with Flow 2.
      // If the site was already in fullscreen, the exit consumed the user
      // gesture, so requestFullscreen() may fail → CSS fallback covers this.
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
      // Drain a pending split-view restore BEFORE PM mounts: otherwise PM's
      // findPlayerContainer runs while the shell is still inside the doomed
      // stageCell — PM snapshots that as its originalParent, the deferred
      // restore then removes the wrapper (detaching the stageCell), and PM's
      // exit-restore strands the player in a detached subtree (video lost,
      // findPlayerContainer returns null forever).
      drainPendingRestore();
      setPlayerMode((prev) => togglePlayerMode(prev));
    }, [addToast, playerMode, drainPendingRestore]);

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
        setIsPlaying,
        setRepeatActive,
        setRepeatIcon,
        setRepeatLabel,
        setGenerateNativeEnabled,
        setCollapsed,
        setYOffsetPercent,
        setCues,
        setCurrentTimeMs,
        setRemoveBracketed,
        togglePlayerMode: () => { void handleTogglePlayerMode(); },
        toggleSplitView: () => { handleToggleSplitView(); },
        setSplitViewOpen,
        setOcrEnabled: (enabled: boolean) => { setOcrEnabledState(enabled); },
      }),
      [addToast, clearToasts, handleTogglePlayerMode, handleToggleSplitView, setSplitViewOpen],
    );

    useEffect(() => {
      onTogglePlayerMode?.(playerMode);
    }, [onTogglePlayerMode, playerMode]);

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
        // max-int: intentional top-most overlay
        host.style.zIndex = '2147483647';
        host.style.position = 'fixed';
        host.style.inset = '0';
        host.setAttribute('data-cell-player-mode', 'true');
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

    // Native fullscreen — SSOT with Flow 2 (iframe bridge). After Player Mode
    // mounts and the host reparenting effect above moves #cell-subtitle-root to
    // document.body with position:fixed;inset:0 (CSS fallback), request native
    // fullscreen on the host. Top-layer rendering guarantees nothing can
    // z-index over it — no z-index:2147483647 hack needed.
    //
    // Transient activation from the toggle gesture (keyboard `g` or button
    // click) is still valid when this effect runs (React render+effects <100ms,
    // activation window ~5s). If the site was already in fullscreen,
    // handleTogglePlayerMode exited it first (consuming the gesture), so
    // requestFullscreen() may fail here — the CSS fallback covers that case.
    //
    // On Esc: browser exits fullscreen → fullscreenchange → setPlayerMode(false).
    // PlayerModeOverlay's Esc handler skips preventDefault when in native
    // fullscreen so the browser can process the exit.
    useEffect(() => {
      if (!playerMode) return;
      const host = document.querySelector('#cell-subtitle-root');
      if (!(host instanceof HTMLElement)) return;

      let ourFullscreenActive = false;

      const onFullscreenChange = (): void => {
        if (document.fullscreenElement === host) {
          ourFullscreenActive = true;
        } else if (ourFullscreenActive) {
          // Our fullscreen exited (Esc, browser UI, or another element) → exit PM.
          ourFullscreenActive = false;
          setPlayerMode(false);
        }
      };
      document.addEventListener('fullscreenchange', onFullscreenChange);

      // Request native fullscreen. requestFullscreen() auto-exits any existing
      // fullscreen in one step — same user gesture, no Chrome block.
      if (document.fullscreenElement !== host) {
        host.requestFullscreen().catch(() => { /* CSS fallback active */ });
      } else {
        ourFullscreenActive = true;
      }

      return () => {
        document.removeEventListener('fullscreenchange', onFullscreenChange);
        if (ourFullscreenActive && document.fullscreenElement) {
          document.exitFullscreen().catch(() => undefined);
        }
      };
    }, [playerMode]);

    // ADR-025: drag-to-reposition theo trục Y. Pointer Events + rAF throttle +
    // transform (atom ux-drag-transform-willchange-raf). touch-action:none trên .root
    // (atom ux-touch-action-none-for-pointer-drag). Drag chỉ trên background —
    // cluster/button/text có pointer-events:auto nên không trigger drag.
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
    // Cluster CSS vars — SSOT: buildClusterCssVars (shared with NavCluster + PlayerModeOverlay + OverlayPreview)
    const clusterRightStyle = buildClusterCssVars(clusterSettings);

    if (playerMode) {
      return (
        <PlayerModeErrorBoundary>
          <PlayerModeOverlay
            targetStyle={targetStyle}
            nativeStyle={nativeStyle}
            isPlaying={isPlaying}
            repeatActive={repeatActive}
            repeatIcon={repeatIcon}
            repeatLabel={repeatLabel}
            clusterSettings={clusterSettings}
            blockSettings={blockSettings}
            videoAspectRatio={videoAspectRatio}
            onQuickAdd={onQuickAdd}
            onEditCard={onEditCard}
            onToggleOcr={onToggleOcr}
            ocrEnabled={ocrEnabledState}
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
            onExit={() => { void handleTogglePlayerMode(); }}
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
          <SubtitleBlock targetStyle={targetStyle} nativeStyle={nativeStyle} blockSettings={blockSettings} removeBracketed={removeBracketed} />
        </div>

        {!collapsed && (
          <ClusterRightToolbar
            mode="overlay"
            clusterRightStyle={clusterRightStyle}
            onQuickAdd={onQuickAdd}
            onEditCard={onEditCard}
            onToggleOcr={onToggleOcr}
            ocrEnabled={ocrEnabledState}
            onToggleManager={onToggleManager}
            onGenerateNative={onGenerateNative}
            generateNativeEnabled={generateNativeEnabled}
            onToggleSidePanel={onToggleSidePanel ? handleToggleSplitView : undefined}
            sidePanelLabel={splitViewOpen ? 'Close subtitle list' : 'Open subtitle list'}
            toolsExpanded={toolsExpanded}
            onToggleTools={() => setToolsExpanded((v) => !v)}
            onTogglePlayerMode={() => { void handleTogglePlayerMode(); }}
            playerMode={playerMode}
          />
        )}

        {managerOpen && manager && managerPortalTarget && !managerOpenOnHost && createPortal(
          <ShadowThemeProvider container={managerPortalTarget}>
            <ManagerLayer
              manager={manager}
              isMobile={isMobile}
              exiting={managerExiting}
              onClose={closeManager}
              generateNativeEnabled={generateNativeEnabled}
            />
          </ShadowThemeProvider>,
          managerPortalTarget,
        )}

        {offsetOpen && offset && (
          <OffsetLayer offset={offset} />
        )}

        <div className={styles.toastLayer}>
          <SubtitleToast toasts={toasts} onRemove={removeToast} />
        </div>

        {hintOpen && (
          <div className={styles.hintLayer} data-cell-id="subtitle-hint-layer">
            <SubtitleHint onClick={() => setHintOpen(false)} />
          </div>
        )}

        {splitViewOpen && splitViewPortalTarget && onSeek && createPortal(
          <SubtitlePanel
            cues={[...cues]}
            currentTimeMs={currentTimeMs}
            offsetMs={offsetMs}
            onSeek={onSeek}
            onClose={handleToggleSplitView}
            playlistContent={playlistContent}
            filename={filename}
          />,
          splitViewPortalTarget,
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
     
    console.error('[PlayerModeErrorBoundary]', error.message, error.stack);
  }

  render(): ReactNode {
    if (this.state.error) {
      // max-int: intentional top-most overlay
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
