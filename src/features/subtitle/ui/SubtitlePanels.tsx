import { useState, useImperativeHandle, forwardRef, useCallback, useRef, useEffect, Component } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { OverlayStyleConfig } from '@/entities/subtitle';
import type { NavClusterSettings, SubtitleBlockSettings, BilingualCue } from '@/entities/media';
import { SubtitleBlock } from './SubtitleBlock';
import { NavCluster } from './NavCluster';
import { SubtitleManagerPanel, type AppearanceState } from './SubtitleManagerPanel';
import { SubtitleOffsetPanel } from './SubtitleOffsetPanel';
import { SubtitleToast, type ToastItem, type ToastVariant } from './SubtitleToast';
import { SubtitleHint } from './SubtitleHint';
import { SubtitlePanelItem } from './subtitlePanelModel';
import type { SubtitleSearchResult } from '@/features/subtitle/logic/subtitleSearchTypes';
import type { SubtitleApiKey } from '@/entities/settings';
import { dragDeltaToYOffset } from '@/features/subtitle/logic/subtitleBlockDrag';
import { resolveSplitViewWrapperHeight, togglePlayerMode } from '@/features/subtitle/logic/playerModeGeometry';
import { isChildFrame, requestIframePlayerModeEnter, requestIframePlayerModeExit } from '@/features/subtitle/logic/iframePlayerModeBridge';
import { PlayerModeOverlay } from './PlayerModeOverlay';
import { SubtitlePanel } from './SubtitlePanel';
import { findPlayerContainer } from '@/features/subtitle/logic/findPlayerContainer';
import { waitForPlayerSettle } from '@/features/subtitle/logic/waitForPlayerSettle';
import { saveScrollPosition, restoreScrollPosition } from '@/features/subtitle/logic/scrollPositionPreserve';
import {
  closeYoutubeSplitView,
  isYoutubePage,
} from '@/features/subtitle/logic/youtubeSplitView';
import { injectShadowCss } from '@/shared/lib/shadowRoot/injectShadowCss';
import { attachFullscreenReparenting } from '@/shared/lib/shadowRoot/mountReactShadow';
import { ShadowThemeProvider } from '@/shared/lib/shadowRoot/ShadowThemeProvider';
import { Sheet } from '@/shared/ui/Sheet';
import { useIsMobile } from '@/shared/ui/useIsMobile';
import { BREAKPOINTS } from '@/shared/lib/tokens';
import { getStorage, setStorage } from '@/shared/lib/chrome-apis';
import { sendMessage } from '@/shared/lib/chrome-apis/runtime';
import { STORAGE_KEYS } from '@/shared/config/config';
import { buildClusterCssVars } from './subtitleUI';
import subtitlePanelCss from './SubtitlePanel.module.css?inline';
import cueListCss from '@/entrypoints/sidepanel/components/CueList.module.css?inline';
import iconCss from '@/shared/icons/Icon.module.css?inline';
import iconButtonCss from '@/shared/ui/IconButton.module.css?inline';
import { ICON_CATALOG } from '@/shared/icons';
import { Icon } from '@/shared/icons/Icon';
import { IconButton } from '@/shared/ui/IconButton';
import styles from './SubtitlePanels.module.css';
import { serializeManagerState } from '@/features/subtitle/logic/managerStateSerializer';
import {
  requestManagerOpenOnHost,
  sendManagerStateUpdate,
  confirmManagerClosed,
  onManagerAction,
  onManagerCloseFromHost,
} from '@/features/subtitle/logic/iframeManagerBridgeChild';

type IconCatalogKey = keyof typeof ICON_CATALOG;

// --- Split View diagnostic logging (temporary — remove after fix) ---
// Structured log with [Cell:SplitView] prefix so it's easy to filter in console.
// Also relays to the background service worker (chrome://extensions → service
// worker) because sites with anti-debug reload the page when DevTools opens.
// The SW console is stable and not affected by the host page's anti-debug.
function svLog(event: string, data?: Record<string, unknown>): void {
  const ts = new Date().toISOString().slice(11, 23);
  const line = `[Cell:SplitView ${ts}] ${event}`;
  // eslint-disable-next-line no-console
  console.log(line, data ?? '');
  const payload = {
    type: '__CELL_SPLIT_VIEW_LOG',
    line,
    data: data ?? null,
    url: typeof location !== 'undefined' ? location.href : null,
    isChildFrame: (() => { try { return window.self !== window.top; } catch { return true; } })(),
  };
  // Relay 1: background SW console (chrome://extensions → service worker).
  void sendMessage(payload).catch(() => undefined);
  // Relay 2: postMessage to parent (top frame) so the top-frame content
  // script can store it in documentElement.dataset — readable via MCP
  // execute_script on the top frame (cross-origin iframes can't be inspected
  // directly). Anti-debug sites reload on F12, but stealth MCP bypasses that.
  try {
    if (window.self !== window.top) window.parent.postMessage(payload, '*');
  } catch { /* cross-origin — best effort */ }
}
function rectLog(el: Element | null | undefined): Record<string, number> | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y) };
}

export interface ManagerState {
  targetItems: SubtitlePanelItem[];
  nativeItems: SubtitlePanelItem[];
  targetActiveIndex: number;
  nativeActiveIndex: number;
  onSelect: (role: 'target' | 'native', index: number) => void;
  onImport?: (role: 'target' | 'native') => void;
  onGenerateNative?: () => void;
  onOffsetChange?: (role: 'target' | 'native', ms: number) => void;
  /** Appearance view props — when provided, "Customize appearance" button shows in footer. */
  appearance?: AppearanceState;
  /** Whether subtitle search API keys are configured (controls search UI availability). */
  hasSearchKeys: boolean;
  /** API keys for subtitle search (for inline ApiKeyManager in search view). */
  apiKeys: readonly SubtitleApiKey[];
  /** Persist API key changes to settings storage. */
  onApiKeysChange: (keys: SubtitleApiKey[]) => void;
  /** User selected a search result to download + load (delegated to contentScriptController). */
  onSearchResultSelect: (result: SubtitleSearchResult, role: 'target' | 'native') => void;
  /** Download a specific subtitle item to the user's machine. */
  onDownload?: (role: 'target' | 'native', index: number) => void;
  /** Toggle hide/show for a section's subtitle in the overlay. */
  onHideSection?: (role: 'target' | 'native') => void;
  /** Toggle hide/show for both target + native subtitles in the overlay. */
  onHideBoth?: () => void;
  /** Whether target subtitle is currently hidden in the overlay. */
  targetHidden?: boolean;
  /** Whether native subtitle is currently hidden in the overlay. */
  nativeHidden?: boolean;
  /** Whether both subtitles are currently hidden in the overlay. */
  bothHidden?: boolean;
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
  /** Toggle Player Mode (same as clicking the Player Mode button). */
  togglePlayerMode: () => void;
  /** Toggle Split View — CueList panel beside video container (page thường only). */
  toggleSplitView: () => void;
}

export interface SubtitlePanelsProps {
  targetStyle: OverlayStyleConfig;
  nativeStyle: OverlayStyleConfig;
  collapsed: boolean;
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
  /** CSS strings to inject into the body-level shadow root for the manager panel.
   *  Needed because the manager panel portals to document.body to escape the
   *  video container's stacking context (e.g. YouTube #movie_player z-index:0). */
  managerShadowCss?: string[];
}

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
      managerShadowCss,
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
    const [offset, setOffset] = useState<OffsetState | undefined>(initialOffset);
    const [managerOpen, setManagerOpen] = useState(false);
    const [managerExiting, setManagerExiting] = useState(false);
    const [managerOpenOnHost, setManagerOpenOnHost] = useState(false);
    const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isMobile = useIsMobile(BREAKPOINTS.tablet);
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
    const [toasts, setToasts] = useState<ToastItem[]>([]);
    const [generateNativeEnabled, setGenerateNativeEnabled] = useState(initialGenerateNativeEnabled);
    const [toolsExpanded, setToolsExpanded] = useState(false);
    const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
    // Body-level shadow host for the manager panel — escapes video container
    // stacking context (e.g. YouTube #movie_player z-index:0 + position:relative)
    const [managerPortalTarget, setManagerPortalTarget] = useState<HTMLElement | null>(null);
    const managerPortalRef = useRef<{ host: HTMLElement; cleanup: () => void } | null>(null);
    const [playerMode, setPlayerMode] = useState(false);
    const [cues, setCues] = useState<readonly BilingualCue[]>(initialCues ?? []);
    const [currentTimeMs, setCurrentTimeMs] = useState(initialCurrentTimeMs ?? 0);
    const [splitViewOpen, setSplitViewOpen] = useState(false);
    const [splitViewPct, setSplitViewPct] = useState(30);
    // Persisted mobile sheet height (% of viewport, 20-95). null = not yet loaded.
    const [managerSheetHeightVh, setManagerSheetHeightVh] = useState<number | null>(null);
    const cleanupRef = useRef<(() => void) | null>(null);
    const savedScrollRef = useRef<number | null>(null);
    const [splitViewPortalTarget, setSplitViewPortalTarget] = useState<HTMLElement | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement));
    // Track the normal-branch wrapper so we can clean it up when transitioning
    // to fullscreen (the wrapper can't be removed while playerShell — now the
    // fullscreen element — is inside it; we remove it on the next normal run).
    const splitViewWrapperRef = useRef<HTMLDivElement | null>(null);

    // Toggle split view off on fullscreenchange, wait for player dims to
    // stabilize via rAF polling, then re-enable. Generic — no per-host adapter.
    useEffect(() => {
      const onChange = (): void => {
        const nowFullscreen = Boolean(document.fullscreenElement);
        setIsFullscreen(nowFullscreen);
        setSplitViewOpen((open) => {
          if (!open) return false;
          savedScrollRef.current = saveScrollPosition();
          svLog('fullscreenchange — toggling off→on', { nowFullscreen });
          cleanupRef.current = waitForPlayerSettle(() => {
            svLog('player settled, re-enabling split view', { nowFullscreen });
            setSplitViewOpen(true);
          });
          return false;
        });
      };
      document.addEventListener('fullscreenchange', onChange);
      return () => {
        document.removeEventListener('fullscreenchange', onChange);
        cleanupRef.current?.();
        cleanupRef.current = null;
      };
    }, []);

    useEffect(() => {
      if (!splitViewPortalTarget || savedScrollRef.current == null) return;
      const saved = savedScrollRef.current;
      savedScrollRef.current = null;
      requestAnimationFrame(() => {
        restoreScrollPosition(splitViewPortalTarget, saved);
      });
    }, [splitViewPortalTarget]);

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

    // Manager panel shadow host — mounted in the video player container
    // (same parent as #cell-subtitle-root) so it shares the overlay's
    // positioning strategy: absolute within the container, no body-level
    // portal, no videoRect tracking. Fullscreen reparenting reuses the
    // same attachFullscreenReparenting helper as the overlay shadow host.
    useEffect(() => {
      if (!managerShadowCss || managerShadowCss.length === 0) return;
      const overlayHost = document.getElementById('cell-subtitle-root');
      const container = overlayHost?.parentElement ?? document.body;
      const host = document.createElement('div');
      host.id = 'cell-manager-portal';
      host.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:2147483647;';
      container.appendChild(host);
      const shadow = host.attachShadow({ mode: 'open' });
      const cleanupCss = injectShadowCss(shadow, { css: managerShadowCss });
      const inner = document.createElement('div');
      inner.style.display = 'contents';
      shadow.appendChild(inner);
      setManagerPortalTarget(inner);
      const cleanupFullscreen = attachFullscreenReparenting(host, container);
      managerPortalRef.current = { host, cleanup: () => { cleanupFullscreen(); cleanupCss(); host.remove(); } };
      return () => {
        setManagerPortalTarget(null);
        managerPortalRef.current?.cleanup();
        managerPortalRef.current = null;
      };
    }, [managerShadowCss]);

    // Child-iframe mobile: delegate manager panel rendering to the host frame.
    // Serialize state + ask host to mount the panel; on success skip the
    // in-iframe portal so we don't render two copies. On failure, fall back to
    // rendering in-iframe as normal (managerOpenOnHost stays false).
    // Re-runs when isMobile changes → viewport-responsive reparenting:
    //   desktop→mobile: delegate to host (sheet escapes iframe bounds).
    //   mobile→desktop: handled by the host-close effect below.
    useEffect(() => {
      if (!managerOpen || !isChildFrame() || !isMobile) return;
      if (!manager) return;

      let cancelled = false;
      const serialized = serializeManagerState(manager, offset, !generateNativeEnabled);
      requestManagerOpenOnHost(serialized).then((ok) => {
        if (cancelled) return;
        if (ok) setManagerOpenOnHost(true);
        // If !ok, fallback: don't set managerOpenOnHost, render in-iframe as normal
      });

      return () => { cancelled = true; };
    }, [managerOpen, manager, offset, generateNativeEnabled, isMobile]);

    // Viewport-responsive reparenting: when viewport grows to desktop while
    // the sheet is on the host page, close the host sheet so the in-iframe
    // portal (inside the video container) can resume rendering.
    useEffect(() => {
      if (!managerOpenOnHost || isMobile) return;
      confirmManagerClosed();
      setManagerOpenOnHost(false);
    }, [managerOpenOnHost, isMobile]);

    // Map host-forwarded manager actions to the local manager callbacks.
    // Guard: ignore actions after close (managerOpen false).
    useEffect(() => {
      if (!managerOpenOnHost || !manager) return;
      const cleanup = onManagerAction((action, args) => {
        if (!managerOpen) return;
        const role = args.role as 'target' | 'native';
        const index = args.index as number;
        const ms = args.ms as number;
        switch (action) {
          case 'select': manager.onSelect(role, index); break;
          case 'import': manager.onImport?.(role); break;
          case 'generateNative': manager.onGenerateNative?.(); break;
          case 'offsetChange': manager.onOffsetChange?.(role, ms); break;
          case 'download': manager.onDownload?.(role, index); break;
          case 'hideSection': manager.onHideSection?.(role); break;
          case 'hideBoth': manager.onHideBoth?.(); break;
          case 'apiKeysChange': manager.onApiKeysChange(args.keys as SubtitleApiKey[]); break;
          case 'searchResultSelect': manager.onSearchResultSelect(args.result as SubtitleSearchResult, role); break;
          case 'styleChange': manager.appearance?.onStyleChange(role, args.partial as Partial<OverlayStyleConfig>); break;
          case 'blockSettingsChange': manager.appearance?.onBlockSettingsChange(args.partial as Partial<SubtitleBlockSettings>); break;
          case 'clusterSettingsChange': manager.appearance?.onClusterSettingsChange(args.partial as Partial<NavClusterSettings>); break;
          case 'resetStyle': manager.appearance?.onResetStyle(role); break;
          case 'previewTextChange': manager.appearance?.onPreviewTextChange(role, args.text as string); break;
        }
      });
      return cleanup;
    }, [managerOpenOnHost, manager, managerOpen]);

    // Host requested close (user pressed close button on the host-rendered panel).
    useEffect(() => {
      if (!managerOpenOnHost) return;
      const cleanup = onManagerCloseFromHost(() => {
        closeManager();
      });
      return cleanup;
    }, [managerOpenOnHost]);

    // State sync: push serialized state to host on change (throttled 100ms).
    const stateSyncRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
      if (!managerOpenOnHost || !manager) return;
      if (stateSyncRef.current) clearTimeout(stateSyncRef.current);
      stateSyncRef.current = setTimeout(() => {
        sendManagerStateUpdate(serializeManagerState(manager, offset, !generateNativeEnabled));
      }, 100);
      return () => { if (stateSyncRef.current) clearTimeout(stateSyncRef.current); };
    }, [managerOpenOnHost, manager.targetItems, manager.nativeItems, manager.targetActiveIndex, manager.nativeActiveIndex, manager.targetHidden, manager.nativeHidden, manager.bothHidden, manager.appearance, offset?.targetMs, offset?.nativeMs]);

    // Cleanup on close: notify host the child closed the manager + reset flag.
    useEffect(() => {
      if (!managerOpen && managerOpenOnHost) {
        confirmManagerClosed();
        setManagerOpenOnHost(false);
      }
    }, [managerOpen, managerOpenOnHost]);

    const addToast = useCallback((message: string, variant?: ToastVariant): void => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setToasts((prev) => [...prev, { id, message, variant }]);
    }, []);

    const clearToasts = useCallback((): void => setToasts([]), []);

    const removeToast = useCallback((id: string): void => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

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
      setPlayerMode((prev) => togglePlayerMode(prev));
    }, [addToast, playerMode]);

    const handleToggleSplitView = useCallback((): void => {
      if (playerMode) { svLog('toggle BLOCKED by playerMode'); return; }
      const childFrame = isChildFrame();
      svLog('toggle', { from: splitViewOpen, to: !splitViewOpen, playerMode, isFullscreen, childFrame, url: location.href });
      setSplitViewOpen((v) => !v);
    }, [playerMode, splitViewOpen, isFullscreen]);

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
        togglePlayerMode: () => { void handleTogglePlayerMode(); },
        toggleSplitView: () => { handleToggleSplitView(); },
      }),
      [addToast, clearToasts, handleTogglePlayerMode, handleToggleSplitView],
    );

    useEffect(() => {
      onTogglePlayerMode?.(playerMode);
    }, [onTogglePlayerMode, playerMode]);

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

    // Split View — page thường + fullscreen. Finds the video container and
    // arranges it in a flex row: video stage (flex:1) + CueList panel (fixed %)
    // with a resize handle. The video container stays in light DOM (CSS/controls
    // keep working). CueList renders via portal into the panel div.
    //
    // Fullscreen: when playerShell IS document.fullscreenElement, moving it
    // exits fullscreen (Chrome reparenting behavior). Instead, transform
    // playerShell into a flex container and move its children into stageCell.
    // playerShell stays as the top-layer fullscreen element — no exit.
    useEffect(() => {
      if (!splitViewOpen || playerMode) {
        svLog('effect SKIP', { splitViewOpen, playerMode });
        return;
      }
      const childFrame = isChildFrame();
      svLog('effect ENTER', { splitViewOpen, playerMode, isFullscreen, childFrame, splitViewPct, url: location.href });
      let playerShell = findPlayerContainer();
      if (!playerShell) { svLog('effect EXIT — no playerShell'); return; }
      svLog('playerShell found', {
        tag: playerShell.tagName,
        id: playerShell.id || null,
        cls: playerShell.className?.toString().slice(0, 80) || null,
        rect: rectLog(playerShell),
        parentTag: playerShell.parentElement?.tagName ?? null,
        parentRect: rectLog(playerShell.parentElement),
      });

      // playerShell or any descendant (e.g. <video> itself) may be the
      // fullscreen element. On some browsers YouTube requests fullscreen on
      // document.documentElement (an ANCESTOR of #movie_player) — detect that
      // too so the fullscreen branch runs instead of the normal wrapper branch.
      let fsEl = document.fullscreenElement;
      let isPlayerFullscreen = !!fsEl
        && (fsEl === playerShell
          || playerShell.contains(fsEl)
          || (fsEl instanceof HTMLElement && fsEl.contains(playerShell)));
      svLog('fullscreen detect', {
        fsEl: fsEl ? { tag: fsEl.tagName, id: fsEl.id || null, rect: rectLog(fsEl) } : null,
        isPlayerFullscreen,
        playerShellTag: playerShell.tagName,
        playerShellContainsFs: fsEl ? playerShell.contains(fsEl) : null,
        fsContainsPlayerShell: fsEl instanceof HTMLElement ? fsEl.contains(playerShell) : null,
      });

      // If playerShell is an ANCESTOR of the fullscreen element (not the
      // fullscreen element itself), the fullscreen branch would move the
      // fullscreen element among playerShell's children → exits fullscreen.
      // Use the fullscreen element as playerShell instead — it's the
      // top-layer element and can be transformed in place.
      // Only do this when fsEl is a DESCENDANT of playerShell — NOT when fsEl
      // is an ancestor (e.g. document.documentElement). In the ancestor case,
      // keep playerShell = #movie_player (YouTube's CSS already sizes it to
      // fill the viewport via .ytp-fullscreen).
      if (isPlayerFullscreen && fsEl !== playerShell && playerShell.contains(fsEl) && fsEl instanceof HTMLElement) {
        const video = playerShell.querySelector('video');
        if (video && fsEl.contains(video)) {
          svLog('fullscreen branch: playerShell = fsEl (descendant)', { fsTag: fsEl.tagName, fsId: fsEl.id });
          playerShell = fsEl;
        } else {
          svLog('fullscreen branch: isPlayerFullscreen → false (video not in fsEl)');
          isPlayerFullscreen = false;
        }
      }

      // <video> is a replaced element — display:flex has no effect, children
      // are not rendered. When the video itself is the fullscreen element,
      // re-request fullscreen on its parent container so we can transform THAT
      // into a flex row. The effect re-runs on fullscreenchange (isFullscreen
      // dep), at which point findPlayerContainer returns the parent container.
      if (isPlayerFullscreen && playerShell.tagName === 'VIDEO') {
        const parent = playerShell.parentElement;
        svLog('fullscreen branch: playerShell is <video>, re-requesting on parent', { parentTag: parent?.tagName, parentRect: rectLog(parent) });
        if (parent && parent !== document.body) {
          void document.exitFullscreen().then(() => {
            void parent.requestFullscreen().catch(() => undefined);
          });
          return;
        }
      }

      const originalParent = playerShell.parentElement;
      if (!originalParent) return;
      const originalNextSibling = playerShell.nextSibling;

      // Save #cell-subtitle-root's current parent BEFORE Split View moves it
      // into stageCell. On cleanup, cellRoot must return to THIS parent (e.g.
      // .art-video-player with position:relative), NOT to playerShell —
      // playerShell can be position:static (e.g. themoviebox .w-full h-[203px]),
      // which lets cellRoot's position:absolute+inset:0 escape to the viewport.
      const cellRootOriginalParent = document.getElementById('cell-subtitle-root')?.parentElement ?? null;

      const playerRect = playerShell.getBoundingClientRect();
      const playerComputedStyle = getComputedStyle(playerShell);
      const viewportBound = playerComputedStyle.position === 'fixed'
        && Math.abs(playerRect.width - window.innerWidth) <= 1
        && Math.abs(playerRect.height - window.innerHeight) <= 1;
      const wrapperHeight = resolveSplitViewWrapperHeight(
        playerRect.height,
        window.innerHeight,
        viewportBound,
      );
      svLog('geometry', {
        playerRect: rectLog(playerShell),
        viewport: { w: window.innerWidth, h: window.innerHeight },
        playerPosition: playerComputedStyle.position,
        viewportBound,
        wrapperHeight,
        isPlayerFullscreen,
        branch: isPlayerFullscreen ? 'FULLSCREEN' : 'NORMAL',
      });
      const playerShellStyleProperties = [
        'position', 'inset', 'top', 'right', 'bottom', 'left', 'width', 'height',
        'max-width', 'max-height', 'min-width', 'min-height', 'aspect-ratio',
        'flex', 'margin', 'box-sizing', 'display', 'flex-direction', 'overflow',
      ];
      const savedPlayerShellStyles: Record<string, string> = {};
      for (const property of playerShellStyleProperties) {
        savedPlayerShellStyles[property] = playerShell.style.getPropertyValue(property);
      }
      const stageCell = document.createElement('div');
      stageCell.setAttribute('data-cell-split-view', 'stage');
      stageCell.style.cssText = 'flex:1 1 0;min-width:0;min-height:0;height:100%;position:relative;overflow:hidden;';

      const panel = document.createElement('div');
      panel.setAttribute('data-cell-split-view', 'panel');
      panel.style.cssText = `flex:0 0 ${splitViewPct}%;min-width:200px;max-width:60%;height:100%;overflow:hidden;position:relative;`;

      // Attach a shadow root to the panel so the design-system tokens
      // (--color-surface, --color-border-subtle, etc.) + CueList/SubtitlePanel
      // CSS resolve identically to Player Mode (which renders inside the main
      // shadow root). Without this, the panel is in light DOM and tokens are
      // undefined → colors fall back to browser defaults.
      const panelShadow = panel.attachShadow({ mode: 'open' });
      injectShadowCss(panelShadow, {
        css: [subtitlePanelCss, cueListCss, iconCss, iconButtonCss],
      });
      const panelInner = document.createElement('div');
      panelInner.setAttribute('data-theme', 'dark');
      panelInner.style.cssText = 'width:100%;height:100%;display:flex;flex-direction:column;';
      panelShadow.appendChild(panelInner);

      const handle = document.createElement('div');
      handle.setAttribute('data-cell-split-view', 'handle');
      handle.style.cssText = 'flex:0 0 6px;height:100%;background:var(--color-border,#333);cursor:col-resize;touch-action:none;position:relative;z-index:1;';

      // Wrapper only needed in the normal (non-fullscreen) branch.
      let wrapper: HTMLDivElement | null = null;

      if (isPlayerFullscreen) {
        // FULLSCREEN: playerShell is the top-layer fullscreen element. Moving
        // it exits fullscreen. Instead, move playerShell's children (including
        // #cell-subtitle-root) into stageCell and transform playerShell into a
        // flex row. The overlay fills stageCell via position:absolute+inset:0.
        // When fsEl is an ANCESTOR of playerShell (e.g. document.documentElement),
        // playerShell is NOT the top-layer element. The old wrapper from a
        // previous normal run constrains its height (overflow:hidden + fixed
        // height). Unwrap playerShell so YouTube's .ytp-fullscreen CSS can
        // size it to fill the viewport.
        // When playerShell WAS REASSIGNED to fsEl (a descendant of the original
        // playerShell, e.g. kisskh .videoplayer inside .col-12), playerShell IS
        // the fullscreen element — moving it exits fullscreen. Skip the unwrap;
        // the old wrapper is an invisible ancestor (the fullscreen element is in
        // the top layer). The old wrapper is cleaned up on the next NORMAL
        // branch run (via splitViewWrapperRef).
        svLog('FULLSCREEN branch enter', { playerShellRect: rectLog(playerShell), oldWrapper: !!splitViewWrapperRef.current, playerIsFs: playerShell === document.fullscreenElement });
        const oldWrapper = splitViewWrapperRef.current;
        if (oldWrapper && oldWrapper.contains(playerShell) && playerShell !== document.fullscreenElement) {
          const wrapperParent = oldWrapper.parentElement;
          if (wrapperParent) {
            wrapperParent.insertBefore(playerShell, oldWrapper);
            oldWrapper.remove();
            splitViewWrapperRef.current = null;
            svLog('FULLSCREEN: unwrapped old wrapper');
          }
        }
        // Move ALL children (including #cell-subtitle-root) into stageCell.
        // stageCell is position:relative, so #cell-subtitle-root's existing
        // position:absolute + inset:0 fills exactly the video stage — no
        // inline left/right/width overrides needed.
        const childrenToMove = Array.from(playerShell.children);
        for (const child of childrenToMove) {
          stageCell.appendChild(child);
        }
        playerShell.style.setProperty('display', 'flex', 'important');
        playerShell.style.setProperty('flex-direction', 'row', 'important');
        playerShell.appendChild(stageCell);
        playerShell.appendChild(handle);
        playerShell.appendChild(panel);
        svLog('FULLSCREEN branch done', {
          playerShellRect: rectLog(playerShell),
          stageCellRect: rectLog(stageCell),
          panelRect: rectLog(panel),
          childrenMoved: childrenToMove.length,
        });
        // YouTube CSS (object-fit, .ytp-chrome-bottom width, progress bar
        // widths) is injected by the MAIN-world adapter. Dispatch the event
        // directly — MAIN world listener only registers on YouTube (manifest
        // matches), so off-YouTube this is a no-op (event into void).
        document.dispatchEvent(new CustomEvent('__YT_SPLIT_VIEW_APPLY_CSS'));
      } else {
        // NORMAL: wrap playerShell in a flex row wrapper.
        wrapper = document.createElement('div');
        wrapper.setAttribute('data-cell-split-view', 'wrapper');
        // Wrapper height: the goal is to match the video's display height
        // so the subtitle panel doesn't tower above/below the video.
        //
        // Two cases:
        // 1. Tight shell (playerShell ≈ video width, e.g. kisskh.co):
        //    The shell is just the video + controls. Fill the parent's
        //    height — the video stretches via height:100% and the panel
        //    matches. This avoids empty space below the Split View area
        //    when the parent is taller than the video (hidden siblings).
        //
        // 2. Broad shell (playerShell >> video width, e.g. themoviebox):
        //    The shell includes side-by-side content (resources panel,
        //    episode list). Moving it into a narrower stage causes content
        //    to reflow vertically → shell height explodes (690→2053px).
        //    Use the video's height instead so the panel matches the video.
        //
        // height:100% alone doesn't work in flex-wrap:wrap containers
        // because flex items are sized by the flex algorithm, not %.
        const parentPixelHeight = originalParent.getBoundingClientRect().height;
        const videoEl = playerShell.querySelector('video');
        const videoRect = videoEl?.getBoundingClientRect();
        const isBroadShell = videoRect
          && playerRect.width > videoRect.width * 1.2;

        // When transitioning from fullscreen back to normal, playerShell
        // is still inside the old wrapper's stageCell. originalParent is
        // that stageCell — which is inside the old wrapper. Removing the
        // old wrapper before inserting the new one would detach the new
        // wrapper too. Resolve the real insertion point: if originalParent
        // is inside the old wrapper, use the old wrapper's parent instead.
        const oldWrapper = splitViewWrapperRef.current;
        const originalParentInOldWrapper = oldWrapper
          && oldWrapper !== wrapper
          && oldWrapper.contains(originalParent);
        const insertParent = originalParentInOldWrapper
          ? oldWrapper!.parentElement!
          : originalParent;
        const insertBefore = originalParentInOldWrapper
          ? oldWrapper!.nextSibling
          : originalNextSibling;

        // Wrapper flex: preserve playerShell's original footprint when the
        // INSERTION parent is a flex row with siblings (e.g. kisskh .row
        // contains video col + drama info col). Using flex:1 1 100% would
        // take the entire row, collapsing siblings to 0 width — the episode
        // selector disappears. Instead, use the playerShell's original pixel
        // width as flex-basis so the wrapper takes only the video column's
        // space. Must check insertParent (the actual flex row), NOT
        // originalParent (which may be an old stageCell inside the old
        // wrapper — not a flex row, causing hasFlexSiblings=false after
        // fullscreen exit).
        // Ponytail ceiling: fixed px width won't resize on browser resize;
        // upgrade path = parse computed flex-basis percentage (e.g. 58.3333%)
        // for responsive sizing. On re-open the width recalculates.
        const insertParentCs = getComputedStyle(insertParent);
        const insertParentIsFlexRow = insertParentCs.display === 'flex'
          && (insertParentCs.flexDirection === 'row'
            || insertParentCs.flexDirection === 'row-reverse');
        const hasFlexSiblings = insertParentIsFlexRow
          && Array.from(insertParent.children)
            .filter((c) => c !== playerShell
              && c !== oldWrapper
              && !(c as HTMLElement).hasAttribute?.('data-cell-split-view')
              && c.getBoundingClientRect().width > 0)
            .length > 0;
        const wrapperFlex = hasFlexSiblings
          ? `0 0 ${Math.round(originalParentInOldWrapper ? oldWrapper!.getBoundingClientRect().width : playerRect.width)}px`
          : '1 1 100%';
        // YouTube: use height:100% so the wrapper follows #container's
        // computed height automatically on window resize — no hardcoded px,
        // no resize listener needed. #container's height is set by YouTube's
        // CSS based on video aspect ratio + available width, and updates on
        // resize. The old approach (parentPixelHeight px) froze the wrapper
        // at the initial size → empty space below after browser resize.
        const wrapperHeightStyle = viewportBound
          ? wrapperHeight
          : isYoutubePage()
            ? '100%'
          : isBroadShell
            ? `${Math.round(videoRect!.height)}px`
            : `${Math.round(parentPixelHeight)}px`;
        svLog('NORMAL wrapper height', {
          viewportBound,
          isYoutube: isYoutubePage(),
          isBroadShell,
          hasFlexSiblings,
          wrapperFlex,
          parentPixelHeight: Math.round(parentPixelHeight),
          videoRect: rectLog(videoEl),
          playerRect: { w: Math.round(playerRect.width), h: Math.round(playerRect.height) },
          wrapperHeightStyle,
        });
        // YouTube: height must be !important to override flex stretch
        // (align-self:stretch in a flex parent would otherwise expand the
        // wrapper to the parent's full height, making the panel tower above
        // the video). Non-YouTube: keep flex stretch so tight shells fill.
        const isYoutube = isYoutubePage();
        wrapper.style.cssText = isYoutube
          ? `display:flex;flex-direction:row;width:100%;height:${wrapperHeightStyle}!important;flex:0 0 auto;overflow:hidden;position:relative;`
          : hasFlexSiblings
            ? `display:flex;flex-direction:row;flex:${wrapperFlex};height:${wrapperHeightStyle};align-self:stretch;overflow:hidden;position:relative;`
            : `display:flex;flex-direction:row;width:100%;height:${wrapperHeightStyle};flex:${wrapperFlex};align-self:stretch;overflow:hidden;position:relative;`;

        if (playerComputedStyle.position === 'fixed') {
          playerShell.style.setProperty('position', 'absolute', 'important');
          playerShell.style.setProperty('inset', '0', 'important');
        }
        playerShell.style.setProperty('width', '100%', 'important');
        playerShell.style.setProperty('height', '100%', 'important');
        playerShell.style.setProperty('max-width', 'none', 'important');
        playerShell.style.setProperty('max-height', 'none', 'important');
        playerShell.style.setProperty('min-width', '0', 'important');
        playerShell.style.setProperty('min-height', '0', 'important');
        playerShell.style.setProperty('aspect-ratio', 'auto', 'important');
        playerShell.style.setProperty('margin', '0', 'important');
        playerShell.style.setProperty('box-sizing', 'border-box', 'important');
        // jwplayer/megaplay sets overflow:hidden on #megaplay-player, which
        // clips the control bar (especially right-side controls like the
        // fullscreen button) at the player bounds. Override to visible so
        // controls render outside the player's content box. stageCell still
        // has overflow:hidden, so the video itself is clipped to the stage.
        playerShell.style.setProperty('overflow', 'visible', 'important');

        // Move playerShell into new stageCell FIRST (detaches from old
        // wrapper's stageCell if transitioning from a previous normal run).
        stageCell.appendChild(playerShell);
        // Move #cell-subtitle-root into stageCell so its position:absolute +
        // inset:0 fills the video stage (stageCell is position:relative),
        // not the subtitle panel. No inline overrides needed.
        const cellRootNormal = document.getElementById('cell-subtitle-root');
        if (cellRootNormal) stageCell.appendChild(cellRootNormal);
        wrapper.appendChild(stageCell);
        wrapper.appendChild(handle);
        wrapper.appendChild(panel);

        // Insert new wrapper at the resolved position BEFORE removing the
        // old wrapper — otherwise originalParent (inside old wrapper) gets
        // detached and the new wrapper goes into a detached subtree.
        if (insertBefore && insertBefore.parentElement === insertParent) {
          insertParent.insertBefore(wrapper, insertBefore);
        } else {
          insertParent.appendChild(wrapper);
        }

        // Now safe to remove old wrapper — new wrapper already in DOM.
        if (oldWrapper && oldWrapper !== wrapper) {
          oldWrapper.remove();
        }
        splitViewWrapperRef.current = wrapper;
        svLog('NORMAL wrapper inserted', {
          wrapperRect: rectLog(wrapper),
          stageCellRect: rectLog(stageCell),
          panelRect: rectLog(panel),
          playerShellRect: rectLog(playerShell),
          oldWrapperPresent: !!oldWrapper,
          originalParentInOldWrapper,
          insertParentTag: insertParent?.tagName,
        });
        // YouTube: inject CSS overrides so video + controls fill the stage
        // via CSS (height:100%!important, object-fit:contain). The MAIN-world
        // listener handles injection/removal. This replaces the old setSize
        // approach which set hardcoded pixel sizes that froze on resize.
        if (isYoutube) {
          document.dispatchEvent(new CustomEvent('__YT_SPLIT_VIEW_APPLY_CSS'));
        }
      }

      setSplitViewPortalTarget(panelInner);
      // CSS handles all YouTube player sizing now (height:100%!important,
      // object-fit:contain). No setSize bridge needed — it set hardcoded
      // pixel sizes that froze on resize.
      const restoreYoutubeSplitView = (): void => undefined;
      window.dispatchEvent(new Event('resize'));

      // Drag resize: measure the flex container (wrapper or playerShell).
      const flexContainer = wrapper ?? playerShell;
      let dragStart: { x: number; startPct: number; wrapperW: number } | null = null;
      const onPointerDown = (e: PointerEvent): void => {
        e.preventDefault();
        dragStart = { x: e.clientX, startPct: splitViewPct, wrapperW: flexContainer.getBoundingClientRect().width };
        handle.setPointerCapture(e.pointerId);
      };
      const onPointerMove = (e: PointerEvent): void => {
        if (!dragStart || dragStart.wrapperW <= 0) return;
        const deltaPct = -((e.clientX - dragStart.x) / dragStart.wrapperW) * 100;
        const next = Math.min(Math.max(dragStart.startPct + deltaPct, 20), 60);
        panel.style.flexBasis = `${next}%`;
        setSplitViewPct(next);
        // CSS handles video sizing (height:100%!important, object-fit:contain).
        // No setSize needed — the video fills the stage via CSS automatically.
      };
      const onPointerUp = (e: PointerEvent): void => {
        dragStart = null;
        try { handle.releasePointerCapture(e.pointerId); } catch { /* noop */ }
        setSplitViewPct((pct) => {
          setStorage({ [STORAGE_KEYS.SPLIT_VIEW_PCT]: pct }).catch(() => undefined);
          return pct;
        });
      };
      handle.addEventListener('pointerdown', onPointerDown);
      handle.addEventListener('pointermove', onPointerMove);
      handle.addEventListener('pointerup', onPointerUp);
      handle.addEventListener('pointercancel', onPointerUp);

      return () => {
        svLog('cleanup START', { splitViewOpen, isPlayerFullscreen, playerShellTag: playerShell.tagName, playerShellInDom: document.body.contains(playerShell) });
        handle.removeEventListener('pointerdown', onPointerDown);
        setSplitViewPortalTarget(null);
        handle.removeEventListener('pointermove', onPointerMove);
        handle.removeEventListener('pointerup', onPointerUp);
        handle.removeEventListener('pointercancel', onPointerUp);
        if (isPlayerFullscreen) {
          // Move children back from stageCell to playerShell (preserving order).
          const childrenToRestore = Array.from(stageCell.children);
          // If playerShell was detached by the site's React re-render (common
          // when exiting fullscreen — the site recreates the player shell),
          // skip moving children back. They're in a detached subtree anyway;
          // the site's React will render a fresh video + controls. The normal
          // branch effect re-run will find the new playerShell + video.
          const playerShellInDom = document.body.contains(playerShell);
          if (playerShellInDom) {
            for (const child of childrenToRestore) {
              playerShell.appendChild(child);
            }
          }
          stageCell.remove();
          handle.remove();
          panel.remove();
          svLog('cleanup FULLSCREEN done', { playerShellRect: rectLog(playerShell), playerShellInDom: document.body.contains(playerShell) });
        } else {
          // Mode transition (normal→fullscreen): moving playerShell out of
          // the wrapper would exit fullscreen (browser exits fullscreen when
          // the fullscreen element's ancestor is re-parented). Check if
          // playerShell now contains the fullscreen element — if so, leave
          // it in place (inside the wrapper/stageCell) and only remove
          // handle/panel. The FULLSCREEN branch (after defer+settle) will
          // transform playerShell in place. On close (no fullscreen), do
          // full restore: move playerShell back to originalParent + remove
          // wrapper.
          const currentFs = document.fullscreenElement;
          const playerNowFullscreen = !!currentFs
            && (currentFs === playerShell || playerShell.contains(currentFs));
          if (playerNowFullscreen) {
            // Don't move playerShell (would exit fullscreen). Remove
            // handle/panel but keep wrapper+stageCell — FULLSCREEN branch
            // will unwrap playerShell from old wrapper and rebuild.
            handle.remove();
            panel.remove();
            svLog('cleanup NORMAL (fullscreen guard) — playerShell left in place', {
              playerShellRect: rectLog(playerShell),
              fsEl: { tag: currentFs.tagName, id: currentFs.id || null },
            });
          } else {
            if (originalParent && playerShell.parentElement === stageCell) {
              if (originalNextSibling && originalNextSibling.parentElement === originalParent) {
                originalParent.insertBefore(playerShell, originalNextSibling);
              } else {
                originalParent.appendChild(playerShell);
              }
            }
            wrapper?.remove();
            splitViewWrapperRef.current = null;
            svLog('cleanup NORMAL done', { playerShellRect: rectLog(playerShell), originalParentTag: originalParent?.tagName });
          }
        }
        // Restore all saved styles (display+flex-direction in fullscreen, all in normal).
        for (const property of playerShellStyleProperties) {
          playerShell.style.removeProperty(property);
          const value = savedPlayerShellStyles[property];
          if (value) playerShell.style.setProperty(property, value);
        }
        // Move #cell-subtitle-root back to its pre-Split-View parent (e.g.
        // .art-video-player with position:relative), NOT to playerShell.
        // playerShell can be position:static (themoviebox .w-full h-[203px]),
        // which lets cellRoot's position:absolute+inset:0 escape to the
        // viewport → subtitle overlay covers the whole page instead of the
        // video. Fall back to playerShell only when the original parent is
        // unavailable (cellRoot didn't exist when Split View opened).
        // attachFullscreenReparenting will reposition it on the next
        // fullscreenchange if needed.
        const cellRootCleanup = document.getElementById('cell-subtitle-root');
        const cellRootTarget = cellRootOriginalParent ?? playerShell;
        if (cellRootCleanup && cellRootCleanup.parentElement !== cellRootTarget) {
          cellRootTarget.appendChild(cellRootCleanup);
        }
        // Remove YouTube CSS overrides in both branches (normal + fullscreen).
        // The MAIN-world listener removes the <style> tag.
        document.dispatchEvent(new CustomEvent('__YT_SPLIT_VIEW_REMOVE_CSS'));
        // setSize bridge is no longer used — CSS handles all player sizing.
        // restoreYoutubeSplitView is a no-op; closeYoutubeSplitView cleared
        // the storedSize which is never set now. Keep it for safety in case
        // a stale MAIN-world listener still has a storedSize from a previous
        // session.
        if (!splitViewOpen) {
          closeYoutubeSplitView();
        }
        // YouTube JS sets inline px on <video> based on #movie_player size.
        // During split view, playerShell was narrower → YouTube set smaller
        // px. After restoring playerShell to its original parent + removing
        // inline overrides, YouTube doesn't know the player size changed.
        // Dispatch resize so YouTube re-measures and updates <video> px.
        window.dispatchEvent(new Event('resize'));
        svLog('cleanup END', { splitViewOpen, playerShellRect: rectLog(playerShell) });
      };
    }, [splitViewOpen, playerMode, isFullscreen]);

    // Load persisted splitViewPct on mount.
    useEffect(() => {
      let cancelled = false;
      getStorage<Record<string, number>>(STORAGE_KEYS.SPLIT_VIEW_PCT)
        .then((data) => {
          const stored = data[STORAGE_KEYS.SPLIT_VIEW_PCT];
          if (cancelled || typeof stored !== 'number' || !Number.isFinite(stored)) return;
          setSplitViewPct(Math.min(Math.max(stored, 20), 60));
        })
        .catch(() => undefined);
      return () => { cancelled = true; };
    }, []);

    // Load persisted manager sheet height on mount.
    useEffect(() => {
      let cancelled = false;
      getStorage<Record<string, number>>(STORAGE_KEYS.SUBTITLE_MANAGER_SHEET_HEIGHT_VH)
        .then((data) => {
          const stored = data[STORAGE_KEYS.SUBTITLE_MANAGER_SHEET_HEIGHT_VH];
          if (cancelled || typeof stored !== 'number' || !Number.isFinite(stored)) return;
          setManagerSheetHeightVh(Math.min(Math.max(stored, 20), 95));
        })
        .catch(() => undefined);
      return () => { cancelled = true; };
    }, []);

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
                <IconButton variant="transparent"
                  aria-label="Quick add card"
                  title="Quick add (Q)"
                  data-cell-id="quick-add-btn"
                  size="sm"
                  onClick={onQuickAdd}
                >
                  <Icon name="zap"  />
                </IconButton>
              )}
              {onEditCard && (
                <IconButton variant="transparent"
                  aria-label="Edit card"
                  title="Edit card (E)"
                  data-cell-id="edit-card-btn"
                  size="sm"
                  onClick={onEditCard}
                >
                  <Icon name="pencil"  />
                </IconButton>
              )}
              <div className={styles.toggleWrap}>
                <div
                  className={`${styles.extraCol} ${toolsExpanded ? styles.expanded : ''}`}
                  data-cell-id="subtitle-tools-extra"
                >
                  {onToggleSidePanel && (
                    <IconButton variant="transparent"
                      aria-label={splitViewOpen ? 'Close subtitle list' : 'Open subtitle list'}
                      title="Toggle subtitle list (T)"
                      data-cell-id="panel-toggle-btn"
                      size="sm"
                      onClick={handleToggleSplitView}
                    >
                      <Icon name="sidePanel"  />
                    </IconButton>
                  )}
                  {onGenerateNative && (
                    <IconButton variant="transparent"
                      aria-label="Generate native subtitle"
                      title="Generate native (H)"
                      data-cell-id="generate-native-btn"
                      size="sm"
                      onClick={onGenerateNative}
                      disabled={!generateNativeEnabled}
                    >
                      <Icon name="languages"  />
                    </IconButton>
                  )}
                </div>
                <IconButton variant="transparent"
                  aria-label={toolsExpanded ? 'Collapse tools' : 'Expand tools'}
                  title={toolsExpanded ? 'Collapse tools' : 'Expand tools'}
                  data-cell-id="tools-toggle-btn"
                  size="sm"
                  onClick={() => setToolsExpanded((v) => !v)}
                >
                  <Icon name="chevronLeft"  />
                </IconButton>
              </div>
            </div>
            <div className={styles.secondaryCol}>
              {onUpdateCurrentCard && (
                <IconButton variant="transparent"
                  aria-label="Update current card"
                  title="Update current card (U)"
                  data-cell-id="update-current-card-btn"
                  size="sm"
                  onClick={onUpdateCurrentCard}
                >
                  <Icon name="rotateCcw"  />
                </IconButton>
              )}
              {onToggleManager && (
                <IconButton variant="transparent"
                  aria-label="Open subtitle manager"
                  title="Open subtitle manager"
                  data-cell-id="manager-toggle-btn"
                  size="sm"
                  onClick={() => {
                    onToggleManager();
                  }}
                >
                  <Icon name="subtitleManager"  />
                </IconButton>
              )}
              <IconButton variant="transparent"
                aria-label={playerMode ? 'Exit player mode' : 'Enter player mode'}
                title={playerMode ? 'Exit player mode (Esc)' : 'Enter player mode (G)'}
                data-cell-id="player-mode-btn"
                size="sm"
                onClick={handleTogglePlayerMode}
                active={playerMode}
              >
                <Icon name={playerMode ? 'minimize' : 'maximize'}  />
              </IconButton>
            </div>
          </div>
        )}

        {managerOpen && manager && managerPortalTarget && !managerOpenOnHost && createPortal(
          <ShadowThemeProvider container={managerPortalTarget}>
            {isMobile ? (
              <Sheet
                open
                onClose={() => closeManager()}
                initialHeight={managerSheetHeightVh != null
                  ? Math.round(window.innerHeight * (managerSheetHeightVh / 100))
                  : undefined}
                onHeightChange={(h) => {
                  const vh = Math.round((h / window.innerHeight) * 100);
                  const clamped = Math.max(20, Math.min(95, vh));
                  setManagerSheetHeightVh(clamped);
                  setStorage({ [STORAGE_KEYS.SUBTITLE_MANAGER_SHEET_HEIGHT_VH]: clamped }).catch(() => undefined);
                }}
                data-cell-id="subtitle-manager-layer"
              >
                <SubtitleManagerPanel
                  targetItems={manager.targetItems}
                  nativeItems={manager.nativeItems}
                  targetActiveIndex={manager.targetActiveIndex}
                  nativeActiveIndex={manager.nativeActiveIndex}
                  onSelect={manager.onSelect}
                  onClose={() => closeManager()}
                  onImport={manager.onImport}
                  onGenerateNative={manager.onGenerateNative}
                  onOffsetChange={manager.onOffsetChange}
                  generateNativeDisabled={!generateNativeEnabled}
                  appearance={manager.appearance}
                  hasSearchKeys={manager.hasSearchKeys}
                  apiKeys={manager.apiKeys}
                  onApiKeysChange={manager.onApiKeysChange}
                  onSearchResultSelect={manager.onSearchResultSelect}
                  onDownload={manager.onDownload}
                  onHideSection={manager.onHideSection}
                  onHideBoth={manager.onHideBoth}
                  targetHidden={manager.targetHidden}
                  nativeHidden={manager.nativeHidden}
                  bothHidden={manager.bothHidden}
                  inSheet
                />
              </Sheet>
            ) : (
              <div
                className={styles.panelLayer}
                data-cell-id="subtitle-manager-layer"
                onClick={(e) => {
                  if (e.target === e.currentTarget) closeManager();
                }}
              >
                <SubtitleManagerPanel
                  targetItems={manager.targetItems}
                  nativeItems={manager.nativeItems}
                  targetActiveIndex={manager.targetActiveIndex}
                  nativeActiveIndex={manager.nativeActiveIndex}
                  onSelect={manager.onSelect}
                  onClose={() => closeManager()}
                  onImport={manager.onImport}
                  onGenerateNative={manager.onGenerateNative}
                  onOffsetChange={manager.onOffsetChange}
                  generateNativeDisabled={!generateNativeEnabled}
                  appearance={manager.appearance}
                  hasSearchKeys={manager.hasSearchKeys}
                  apiKeys={manager.apiKeys}
                  onApiKeysChange={manager.onApiKeysChange}
                  onSearchResultSelect={manager.onSearchResultSelect}
                  onDownload={manager.onDownload}
                  onHideSection={manager.onHideSection}
                  onHideBoth={manager.onHideBoth}
                  targetHidden={manager.targetHidden}
                  nativeHidden={manager.nativeHidden}
                  bothHidden={manager.bothHidden}
                  exiting={managerExiting}
                />
              </div>
            )}
          </ShadowThemeProvider>,
          managerPortalTarget,
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

        {splitViewOpen && splitViewPortalTarget && cues.length > 0 && onSeek && createPortal(
          <SubtitlePanel
            cues={[...cues]}
            currentTimeMs={currentTimeMs}
            offsetMs={offsetMs}
            onSeek={onSeek}
            onClose={handleToggleSplitView}
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
