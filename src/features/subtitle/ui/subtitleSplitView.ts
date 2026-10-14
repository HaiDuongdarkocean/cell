import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import {
  splitViewSheetHeightPx,
  splitViewSheetClampHeightPx,
  splitViewSheetMaxHeightPx,
  SPLIT_VIEW_SHEET_MIN_HEIGHT,
} from '@/features/subtitle/logic/playerModeGeometry';
import { isChildFrame } from '@/features/subtitle/logic/iframePlayerModeBridge';
import { findPlayerContainer } from '@/shared/lib/dom/findPlayerContainer';
import { waitForPlayerSettle } from '@/features/subtitle/logic/waitForPlayerSettle';
import { saveScrollPosition, restoreScrollPosition } from '@/features/subtitle/logic/scrollPositionPreserve';
import {
  applyYoutubeSplitViewCss,
  removeYoutubeSplitViewCss,
} from '@/features/subtitle/logic/youtubeSplitView';
import { injectShadowCss } from '@/shared/lib/shadowRoot/injectShadowCss';
import { allModuleCss } from '@/shared/lib/shadowRoot/allModuleCss';
import { buildTokenSpanCssForShadow } from '@/features/tokenize';
import { syncElementTheme, findThemeCarrier } from '@/features/theme';
import { getStorage, setStorage } from '@/shared/lib/chrome-apis';
import { STORAGE_KEYS } from '@/shared/config/config';
import { t } from '@/shared/i18n';
import { logger } from '@/shared/lib/logger';

// --- Split View diagnostic logging ---
// Structured log with [Tihoka:SplitView] prefix so it's easy to filter in console.
// Gated to Tihoka_E2E=1 builds via logger — no-ops in production.
function svLog(event: string, data?: Record<string, unknown>): void {
  const ts = new Date().toISOString().slice(11, 23);
  logger.debug(`[Tihoka:SplitView ${ts}] ${event}`, data ?? '');
}
function rectLog(el: Element | null | undefined): Record<string, number> | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y) };
}

// Below this width the side-by-side layout cannot keep both the video and
// the panel usable — the panel floats as a bottom sheet instead.
const SPLIT_VIEW_COLUMN_BELOW = 600;
const SPLIT_VIEW_SHEET_HANDLE_HEIGHT = 24;
const SPLIT_VIEW_HANDLE_HIT_PX = 14;
const PANEL_INNER_BASE_BG = 'color-mix(in srgb, var(--color-surface) 85%, transparent)';

export interface SplitViewParams {
  playerMode: boolean;
  onSplitViewChange?: (open: boolean) => void;
  fallbackPlayerContainerRef?: RefObject<HTMLElement | null>;
}

export interface SplitView {
  splitViewOpen: boolean;
  splitViewPortalTarget: HTMLElement | null;
  handleToggleSplitView: () => void;
  setSplitViewOpen: (open: boolean) => void;
  drainPendingRestore: () => void;
}

export function useSplitView({
  playerMode,
  onSplitViewChange,
  fallbackPlayerContainerRef,
}: SplitViewParams): SplitView {
  const [splitViewOpen, setSplitViewOpenState] = useState(false);
  // Ref not state: pct is only consumed inside the split-view effect. State
  // would re-run the effect on every pointermove tick → full DOM rebuild,
  // lost pointer capture, and a stack of deferred restore timers.
  const splitViewPctRef = useRef(30);
  // Mobile sheet height as viewport % — null falls back to the default
  // ratio. Persisted to storage; a vh value (not px) so a viewport resize
  // keeps the sheet proportional instead of clamped against a stale pixel.
  const splitViewSheetVhRef = useRef<number | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const savedScrollRef = useRef<number | null>(null);
  const [splitViewPortalTarget, setSplitViewPortalTarget] = useState<HTMLElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement));
  // Deferred cleanup restore (slide-out animation window). A new effect run
  // drains it synchronously so the restore can't fire mid-session and strip
  // the fresh overrides.
  const splitViewPendingRestoreRef = useRef<(() => void) | null>(null);

  // Toggle split view off on fullscreenchange, wait for player dims to
  // stabilize via rAF polling, then re-enable. Generic — no per-host adapter.
  useEffect(() => {
    const onChange = (): void => {
      const nowFullscreen = Boolean(document.fullscreenElement);
      setIsFullscreen(nowFullscreen);
      if (playerMode) return;
      setSplitViewOpenState((open) => {
        if (!open) return false;
        savedScrollRef.current = saveScrollPosition();
        svLog('fullscreenchange — toggling off→on', { nowFullscreen });
        cleanupRef.current = waitForPlayerSettle(() => {
          svLog('player settled, re-enabling split view', { nowFullscreen });
          setSplitViewOpenState(true);
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
  }, [playerMode]);

  useEffect(() => {
    if (!splitViewPortalTarget || savedScrollRef.current == null) return;
    const saved = savedScrollRef.current;
    savedScrollRef.current = null;
    requestAnimationFrame(() => {
      restoreScrollPosition(splitViewPortalTarget, saved);
    });
  }, [splitViewPortalTarget]);

  const handleToggleSplitView = useCallback((): void => {
    if (playerMode) { svLog('toggle BLOCKED by playerMode'); return; }
    const childFrame = isChildFrame();
    svLog('toggle', { from: splitViewOpen, to: !splitViewOpen, playerMode, isFullscreen, childFrame, url: location.href });
    // A pending fullscreen-settle re-enable must not resurrect the panel
    // after the user explicitly toggled.
    cleanupRef.current?.();
    cleanupRef.current = null;
    const next = !splitViewOpen;
    setSplitViewOpenState(next);
    onSplitViewChange?.(next);
  }, [playerMode, splitViewOpen, isFullscreen, onSplitViewChange]);

  const setSplitViewOpen = useCallback((open: boolean): void => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    setSplitViewOpenState(open);
  }, []);

  const drainPendingRestore = useCallback((): void => {
    const pendingRestore = splitViewPendingRestoreRef.current;
    if (pendingRestore) {
      splitViewPendingRestoreRef.current = null;
      pendingRestore();
    }
  }, []);

  // Split View — page thường + fullscreen.
  //
  // Design rule: never move the host's DOM. The player shell stays exactly
  // where the host put it — the host's own layout (reserved slot, sticky
  // pinning, engagement-panel states, re-renders) keeps working untouched.
  // Side-by-side mode only narrows the shell via width + mounts the panel
  // as position:fixed on <body>, glued to the freed strip. Nothing is
  // reparented, so there is no slot keeper, no originalParent restore, and
  // no open/close race — mount/unmount is atomic.
  //
  // Fullscreen is the exception: the panel must live inside the top-layer
  // element or it won't paint, so its children go into a stage div.
  useEffect(() => {
    if (!splitViewOpen || playerMode) {
      svLog('effect SKIP', { splitViewOpen, playerMode });
      return;
    }
    const pendingRestore = splitViewPendingRestoreRef.current;
    if (pendingRestore) {
      splitViewPendingRestoreRef.current = null;
      pendingRestore();
    }
    const childFrame = isChildFrame();
    svLog('effect ENTER', { splitViewOpen, playerMode, isFullscreen, childFrame, splitViewPct: splitViewPctRef.current, url: location.href });
    let playerShell = findPlayerContainer();
    if (!playerShell && fallbackPlayerContainerRef?.current) {
      playerShell = fallbackPlayerContainerRef.current;
      svLog('using fallbackPlayerContainer', { tag: playerShell.tagName, id: playerShell.id || null });
    }
    if (!playerShell) { svLog('effect EXIT — no playerShell'); return; }
    svLog('playerShell found', {
      tag: playerShell.tagName,
      id: playerShell.id || null,
      cls: playerShell.className?.toString().slice(0, 80) || null,
      rect: rectLog(playerShell),
      parentTag: playerShell.parentElement?.tagName ?? null,
      parentRect: rectLog(playerShell.parentElement),
    });

    const fsEl = document.fullscreenElement;
    let isPlayerFullscreen = !!fsEl
      && (fsEl === playerShell
        || playerShell.contains(fsEl)
        || (fsEl instanceof HTMLElement && fsEl.contains(playerShell)));
    svLog('fullscreen detect', {
      fsEl: fsEl ? { tag: fsEl.tagName, id: fsEl.id || null, rect: rectLog(fsEl) } : null,
      isPlayerFullscreen,
      playerShellTag: playerShell.tagName,
    });

    // If playerShell is an ANCESTOR of the fullscreen element, transform the
    // fullscreen element itself — it is the top-layer element.
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

    // <video> is a replaced element — display:flex has no effect. Re-request
    // fullscreen on its parent container so we can transform THAT.
    if (isPlayerFullscreen && playerShell.tagName === 'VIDEO') {
      const parent = playerShell.parentElement;
      svLog('fullscreen branch: playerShell is <video>, re-requesting on parent', { parentTag: parent?.tagName });
      if (parent && parent !== document.body) {
        void document.exitFullscreen().then(() => {
          void parent.requestFullscreen().catch(() => undefined);
        });
        return;
      }
    }

    const savedShellStyles: Record<string, string> = {};
    const shellStyleProps = isPlayerFullscreen
      ? ['display', 'flex-direction', 'padding']
      : ['width', 'height'];
    for (const property of shellStyleProps) {
      savedShellStyles[property] = playerShell.style.getPropertyValue(property);
    }

    let stageTihoka: HTMLElement | null = null;

    const panel = document.createElement('div');
    panel.setAttribute('data-tihoka-split-view', 'panel');
    // Apple §7: enter from right, exit to right — symmetric path.
    // §4: critically damped spring feel (no overshoot).
    panel.style.cssText = 'overflow:hidden;position:fixed;z-index:var(--z-overlay-video,10000);transition:transform var(--duration-normal) var(--ease-standard),opacity var(--duration-normal) var(--ease-standard);transform:translateX(100%);opacity:var(--opacity-30);';

    // A shadow root on the panel so design-system tokens + CueList CSS
    // resolve identically to Player Mode.
    const panelShadow = panel.attachShadow({ mode: 'open' });
    injectShadowCss(panelShadow, {
      css: [...allModuleCss, buildTokenSpanCssForShadow()],
    });
    const panelInner = document.createElement('div');
    const themeSyncCleanup = syncElementTheme(panelInner, findThemeCarrier());
    panelInner.style.cssText = `width:100%;height:100%;display:flex;flex-direction:column;background:${PANEL_INNER_BASE_BG};backdrop-filter:blur(var(--blur-lg));-webkit-backdrop-filter:blur(var(--blur-lg));border-left:1px solid var(--color-border-subtle);`;
    panelShadow.appendChild(panelInner);

    // The resize handle is the panel's own left edge — an invisible hit
    // strip inside the panel shadow. touch-action:pan-y keeps vertical
    // swipe scrolling the cue list while horizontal drags resize.
    const handle = document.createElement('div');
    handle.setAttribute('data-tihoka-split-view', 'handle');
    handle.style.cssText = `position:absolute;top:0;bottom:0;left:0;width:${SPLIT_VIEW_HANDLE_HIT_PX}px;cursor:col-resize;touch-action:pan-y;z-index:2;`;
    panelShadow.appendChild(handle);

    // Sheet-mode resize grip — in-flow first child of panelInner.
    const sheetHandle = document.createElement('div');
    sheetHandle.setAttribute('data-tihoka-split-view', 'sheet-handle');
    sheetHandle.setAttribute('role', 'separator');
    sheetHandle.setAttribute('aria-orientation', 'horizontal');
    sheetHandle.setAttribute('aria-label', t('subtitle.playerMode.resizeList'));
    sheetHandle.tabIndex = 0;
    sheetHandle.style.cssText = `display:none;flex:0 0 ${SPLIT_VIEW_SHEET_HANDLE_HEIGHT}px;position:relative;cursor:grab;touch-action:none;`;
    const sheetHandlePill = document.createElement('div');
    sheetHandlePill.style.cssText = 'position:absolute;top:var(--space-1);left:50%;transform:translateX(-50%);width:var(--space-10);height:var(--space-1);border-radius:var(--radius-full);background:var(--color-text-secondary);opacity:var(--opacity-50);';
    sheetHandle.appendChild(sheetHandlePill);
    panelInner.appendChild(sheetHandle);

    let layoutObserver: ResizeObserver | null = null;
    let layoutRaf = 0;
    let scheduleLayoutSync: (remeasure?: boolean) => void = () => {};
    const onViewportResize = (): void => scheduleLayoutSync(true);
    const onScroll = (): void => scheduleLayoutSync();
    let isSheetMode = false;
    // The strip is measured inside the shell's containing block — the same
    // box its width % resolves against, so shell + panel tile it exactly.
    // A fixed shell's CB is the viewport (offsetParent is null then), not
    // its in-flow parent which may have scrolled away.
    const shellBlock = (): HTMLElement => {
      if (getComputedStyle(playerShell).position === 'fixed') {
        return document.documentElement;
      }
      return (playerShell.offsetParent as HTMLElement | null)
        ?? playerShell.parentElement
        ?? document.documentElement;
    };

    const sheetMaxHeight = (): number => splitViewSheetMaxHeightPx(window.innerHeight);
    const resolveSheetHeight = (): number =>
      splitViewSheetHeightPx(splitViewSheetVhRef.current, window.innerHeight);

    if (isPlayerFullscreen) {
      // FULLSCREEN: playerShell is the top-layer element — reparenting it
      // exits fullscreen. Move its children (including #Tihoka-subtitle-root)
      // into stageTihoka inside the shell and turn the shell into a flex row.
      svLog('FULLSCREEN branch enter', { playerShellRect: rectLog(playerShell), playerIsFs: playerShell === document.fullscreenElement });
      playerShell.setAttribute('data-tihoka-split-shell', '');
      stageTihoka = document.createElement('div');
      stageTihoka.setAttribute('data-tihoka-split-view', 'stage');
      stageTihoka.style.cssText = 'flex:1 1 0;min-width:0;min-height:0;height:100%;position:relative;overflow:hidden;';
      const childrenToMove = Array.from(playerShell.children);
      for (const child of childrenToMove) {
        stageTihoka.appendChild(child);
      }
      playerShell.style.setProperty('display', 'flex', 'important');
      playerShell.style.setProperty('flex-direction', 'row', 'important');
      playerShell.style.setProperty('padding', '0', 'important');
      playerShell.appendChild(stageTihoka);
      playerShell.appendChild(panel);
      panel.style.position = 'relative';
      panel.style.flex = `0 0 ${splitViewPctRef.current}%`;
      panel.style.minWidth = 'min(200px,45%)';
      panel.style.maxWidth = 'min(60%,100%)';
      panel.style.height = '100%';
      svLog('FULLSCREEN branch done', {
        playerShellRect: rectLog(playerShell),
        stageTihokaRect: rectLog(stageTihoka),
        panelRect: rectLog(panel),
        childrenMoved: childrenToMove.length,
      });
      applyYoutubeSplitViewCss();
    } else {
      // NORMAL: shell keeps its DOM position — narrow it with width:% and
      // glue the fixed panel onto the strip it frees. Height is anchored to
      // the shell's natural full-width height: hosts that derive height
      // from width (m.youtube's .player-size %-padding) would otherwise
      // shrink the video vertically and leave dead space — with a definite
      // px height the CSS fill chain letterboxes the video instead.
      const shell = playerShell;
      let shellH = 0;
      // Measure with the marker off — the injected fill chain zeroes
      // .player-size's %-padding, and with the shell back at height:auto
      // that resolves to 0 (the same circular collapse the anchor exists
      // to prevent). Marker off + inline props cleared in one sync task =
      // a true natural-height read with no paint in between.
      const measureNaturalHeight = (): void => {
        shell.removeAttribute('data-tihoka-split-shell');
        shell.style.removeProperty('width');
        shell.style.removeProperty('height');
        shellH = shell.getBoundingClientRect().height;
        shell.setAttribute('data-tihoka-split-shell', '');
      };
      measureNaturalHeight();
      playerShell.setAttribute('data-tihoka-split-shell', '');

      // A fixed shell over a scrolled page is host takeover (YouTube's pin/
      // miniplayer) — release our geometry and hide the panel until it
      // returns to flow. At scrollY≈0 a pinned shell is still visually
      // in-flow, so the split dock keeps working.
      let hostPinned = false;

      const syncLayout = (remeasure = false): void => {
        if (!panel.isConnected) return;
        const shellPos = getComputedStyle(shell).position;
        if (shellPos === 'fixed' && window.scrollY > 8) {
          shell.style.removeProperty('width');
          shell.style.removeProperty('height');
          for (const [prop, val] of Object.entries(savedShellStyles)) {
            if (val) shell.style.setProperty(prop, val);
          }
          shell.removeAttribute('data-tihoka-split-shell');
          panel.style.visibility = 'hidden';
          hostPinned = true;
          return;
        }
        if (hostPinned) {
          hostPinned = false;
          shell.setAttribute('data-tihoka-split-shell', '');
          panel.style.visibility = 'visible';
          remeasure = true;
        }
        const cbRect = shellBlock().getBoundingClientRect();
        const sheet = window.innerWidth < SPLIT_VIEW_COLUMN_BELOW;
        isSheetMode = sheet;
        if (remeasure) measureNaturalHeight();
        const shellRect = shell.getBoundingClientRect();
        if (sheet) {
          // Keep the height anchor even here — while the marker is set the
          // fill chain gives .player-size height:100%, which needs a
          // definite base or it collapses to 0 (width-%-padding disabled).
          shell.style.removeProperty('width');
          if (savedShellStyles.width) {
            shell.style.setProperty('width', savedShellStyles.width);
          }
          if (shellH > 1) {
            shell.style.setProperty('height', `${Math.round(shellH)}px`, 'important');
          } else if (savedShellStyles.height) {
            shell.style.setProperty('height', savedShellStyles.height);
          }
          panel.style.position = 'fixed';
          panel.style.zIndex = 'var(--z-overlay-video, 10000)';
          panel.style.left = '0';
          panel.style.right = '0';
          panel.style.top = 'auto';
          panel.style.bottom = '0';
          panel.style.width = 'auto';
          panel.style.height = `${resolveSheetHeight()}px`;
          handle.style.display = 'none';
          sheetHandle.style.display = 'block';
          sheetHandle.setAttribute('aria-valuemin', String(SPLIT_VIEW_SHEET_MIN_HEIGHT));
          sheetHandle.setAttribute('aria-valuemax', String(sheetMaxHeight()));
          sheetHandle.setAttribute('aria-valuenow', String(Math.round(resolveSheetHeight())));
          panelInner.style.borderRadius = 'var(--radius-element) var(--radius-element) 0 0';
          panelInner.style.background = 'var(--color-surface-popover)';
        } else {
          // Effective pct keeps a ≥200px strip while the stored pct still
          // records user intent — a narrow containing block widens the panel
          // up to half the block rather than crushing it to 30px.
          const minPct = Math.min((200 / Math.max(cbRect.width, 1)) * 100, 50);
          const effectivePct = Math.min(Math.max(splitViewPctRef.current, minPct), 60);
          shell.style.setProperty('width', `${100 - effectivePct}%`, 'important');
          if (shellH > 1) {
            shell.style.setProperty('height', `${Math.round(shellH)}px`, 'important');
          }
          const r = shell.getBoundingClientRect();
          // Dock in document space while the shell is in flow — scrolling
          // then carries the panel in the same paint pass as the video,
          // where a fixed panel lags a frame behind and looks detached.
          // Pinned shells (fixed/sticky) keep viewport coordinates.
          const docSpace = shellPos !== 'fixed' && shellPos !== 'sticky';
          const offX = docSpace ? window.scrollX : 0;
          const offY = docSpace ? window.scrollY : 0;
          panel.style.position = docSpace ? 'absolute' : 'fixed';
          // Doc-space z sits above in-flow page content (kisskh
          // .mat-drawer-content z1 — DOM order wins the tie) yet below
          // host chrome (kisskh toolbar z2, youtube topbar z4) so the
          // panel slides under it while scrolling instead of covering it.
          panel.style.zIndex = docSpace
            ? 'var(--z-overlay-content, 1)'
            : 'var(--z-overlay-video, 10000)';
          panel.style.left = `${Math.round(r.right + offX)}px`;
          panel.style.right = 'auto';
          panel.style.top = `${Math.round(r.top + offY)}px`;
          panel.style.bottom = 'auto';
          panel.style.width = `${Math.max(Math.round(cbRect.right - r.right), 0)}px`;
          panel.style.height = `${Math.round(r.height)}px`;
          handle.style.display = '';
          sheetHandle.style.display = 'none';
          panelInner.style.borderRadius = '';
          panelInner.style.background = PANEL_INNER_BASE_BG;
        }
        // The host hid its own subtree (engagement panel, re-render, tab
        // state) — collapse with it instead of floating over the takeover.
        const liveRect = sheet ? shellRect : shell.getBoundingClientRect();
        panel.style.visibility = liveRect.width < 2 || liveRect.height < 2 ? 'hidden' : 'visible';
        document.documentElement.style.setProperty(
          '--Tihoka-split-panel-w',
          sheet ? '0px' : `${Math.round(panel.getBoundingClientRect().width)}px`,
        );
      };

      document.body.appendChild(panel);
      syncLayout();
      // Entry slide direction follows the mounted layout (up for sheet).
      panel.style.transform = isSheetMode ? 'translateY(100%)' : 'translateX(100%)';
      scheduleLayoutSync = (remeasure = false): void => {
        cancelAnimationFrame(layoutRaf);
        layoutRaf = requestAnimationFrame(() => syncLayout(remeasure));
      };
      layoutObserver = new ResizeObserver(() => scheduleLayoutSync());
      layoutObserver.observe(shell);
      const observedVideo = shell.querySelector('video');
      if (observedVideo) layoutObserver.observe(observedVideo);
      window.addEventListener('scroll', onScroll, { passive: true, capture: true });
      window.addEventListener('resize', onViewportResize);
      svLog('NORMAL mounted', { shellRect: rectLog(shell), panelRect: rectLog(panel), sheet: isSheetMode });
      applyYoutubeSplitViewCss();
    }

    setSplitViewPortalTarget(panelInner);
    requestAnimationFrame(() => {
      panel.style.transform = isSheetMode ? 'translateY(0)' : 'translateX(0)';
      panel.style.opacity = '1';
    });
    window.dispatchEvent(new Event('resize'));

    // Drag resize: pct is % of the shell's containing block — the same unit
    // the shell width uses, so the strip the drag frees is what the panel gets.
    let dragStart: { x: number; startPct: number } | null = null;
    let panelWidthRaf = 0;
    const onPointerDown = (e: PointerEvent): void => {
      if (isSheetMode) return;
      e.preventDefault();
      dragStart = { x: e.clientX, startPct: splitViewPctRef.current };
      handle.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent): void => {
      if (!dragStart) return;
      const cbW = (isPlayerFullscreen ? playerShell : shellBlock()).getBoundingClientRect().width;
      if (cbW <= 0) return;
      const deltaPct = -((e.clientX - dragStart.x) / cbW) * 100;
      const next = Math.min(Math.max(dragStart.startPct + deltaPct, 20), 60);
      splitViewPctRef.current = next;
      if (isPlayerFullscreen) {
        panel.style.flexBasis = `${next}%`;
      } else {
        scheduleLayoutSync();
      }
      if (panelWidthRaf === 0) {
        panelWidthRaf = requestAnimationFrame(() => {
          panelWidthRaf = 0;
          document.documentElement.style.setProperty(
            '--Tihoka-split-panel-w',
            `${Math.round(panel.getBoundingClientRect().width)}px`,
          );
        });
      }
    };
    const onPointerUp = (e: PointerEvent): void => {
      dragStart = null;
      try { handle.releasePointerCapture(e.pointerId); } catch { /* noop */ }
      setStorage({ [STORAGE_KEYS.SPLIT_VIEW_PCT]: splitViewPctRef.current }).catch(() => undefined);
    };
    handle.addEventListener('pointerdown', onPointerDown);
    handle.addEventListener('pointermove', onPointerMove);
    handle.addEventListener('pointerup', onPointerUp);
    handle.addEventListener('pointercancel', onPointerUp);

    // Sheet-mode vertical resize — height tracked as viewport % so it
    // survives recalcs and persists across sessions.
    const persistSheetHeight = (): void => {
      if (splitViewSheetVhRef.current === null) return;
      setStorage({ [STORAGE_KEYS.SPLIT_VIEW_SHEET_HEIGHT_VH]: splitViewSheetVhRef.current })
        .catch(() => undefined);
    };
    const applySheetHeight = (px: number): void => {
      const clamped = splitViewSheetClampHeightPx(px, window.innerHeight);
      splitViewSheetVhRef.current = (clamped / window.innerHeight) * 100;
      panel.style.height = `${clamped}px`;
      sheetHandle.setAttribute('aria-valuenow', String(clamped));
    };
    let sheetDrag: { y: number; startH: number } | null = null;
    const onSheetPointerDown = (e: PointerEvent): void => {
      if (!isSheetMode) return;
      e.preventDefault();
      sheetDrag = { y: e.clientY, startH: panel.getBoundingClientRect().height };
      sheetHandle.setPointerCapture(e.pointerId);
    };
    const onSheetPointerMove = (e: PointerEvent): void => {
      if (!sheetDrag) return;
      applySheetHeight(sheetDrag.startH - (e.clientY - sheetDrag.y));
    };
    const onSheetPointerUp = (e: PointerEvent): void => {
      if (!sheetDrag) return;
      sheetDrag = null;
      try { sheetHandle.releasePointerCapture(e.pointerId); } catch { /* noop */ }
      persistSheetHeight();
    };
    const onSheetKeyDown = (e: KeyboardEvent): void => {
      if (!isSheetMode) return;
      const step = window.innerHeight * 0.05;
      let next: number | null = null;
      if (e.key === 'ArrowUp') next = panel.getBoundingClientRect().height + step;
      else if (e.key === 'ArrowDown') next = panel.getBoundingClientRect().height - step;
      else if (e.key === 'Home') next = SPLIT_VIEW_SHEET_MIN_HEIGHT;
      else if (e.key === 'End') next = sheetMaxHeight();
      if (next === null) return;
      e.preventDefault();
      applySheetHeight(next);
      persistSheetHeight();
    };
    sheetHandle.addEventListener('pointerdown', onSheetPointerDown);
    sheetHandle.addEventListener('pointermove', onSheetPointerMove);
    sheetHandle.addEventListener('pointerup', onSheetPointerUp);
    sheetHandle.addEventListener('pointercancel', onSheetPointerUp);
    sheetHandle.addEventListener('keydown', onSheetKeyDown);

    // Host teardown guard: if the site removes/replaces the player subtree
    // while Split View owns it, self-close instead of leaving a ghost panel.
    const detachObserver = new MutationObserver(() => {
      if (!playerShell.isConnected) {
        svLog('playerShell detached — closing split view');
        setSplitViewOpenState(false);
      }
    });
    detachObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      detachObserver.disconnect();
      layoutObserver?.disconnect();
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onViewportResize);
      cancelAnimationFrame(layoutRaf);
      cancelAnimationFrame(panelWidthRaf);
      themeSyncCleanup();
      svLog('cleanup START', { splitViewOpen, isPlayerFullscreen, playerShellTag: playerShell.tagName });
      handle.removeEventListener('pointerdown', onPointerDown);
      handle.removeEventListener('pointermove', onPointerMove);
      handle.removeEventListener('pointerup', onPointerUp);
      handle.removeEventListener('pointercancel', onPointerUp);
      sheetHandle.removeEventListener('pointerdown', onSheetPointerDown);
      sheetHandle.removeEventListener('pointermove', onSheetPointerMove);
      sheetHandle.removeEventListener('pointerup', onSheetPointerUp);
      sheetHandle.removeEventListener('pointercancel', onSheetPointerUp);
      sheetHandle.removeEventListener('keydown', onSheetKeyDown);
      const subtitlePanelEl = panelInner.querySelector('[data-tihoka-id="subtitle-panel"]') as HTMLElement | null;
      if (subtitlePanelEl) subtitlePanelEl.setAttribute('data-closing', 'true');
      panel.style.transform = isSheetMode ? 'translateY(100%)' : 'translateX(100%)';
      panel.style.opacity = '0.3';
      // Host-side restore is atomic — the shell returns to its own box while
      // the panel slides out; only the DOM removal waits for the animation.
      document.documentElement.style.removeProperty('--Tihoka-split-panel-w');
      playerShell.removeAttribute('data-tihoka-split-shell');
      if (isPlayerFullscreen && stageTihoka) {
        const childrenToRestore = Array.from(stageTihoka.children);
        if (document.body.contains(playerShell)) {
          for (const child of childrenToRestore) {
            playerShell.appendChild(child);
          }
        }
        stageTihoka.remove();
      }
      for (const property of shellStyleProps) {
        playerShell.style.removeProperty(property);
        const value = savedShellStyles[property];
        if (value) playerShell.style.setProperty(property, value);
      }
      removeYoutubeSplitViewCss();
      window.dispatchEvent(new Event('resize'));
      const ANIM_MS = 410;
      let restoreDone = false;
      const restoreNow = (): void => {
        if (restoreDone) return;
        restoreDone = true;
        panel.remove();
        svLog('cleanup END', { playerShellRect: rectLog(playerShell) });
        setSplitViewPortalTarget(null);
      };
      splitViewPendingRestoreRef.current = restoreNow;
      setTimeout(() => {
        if (splitViewPendingRestoreRef.current === restoreNow) {
          splitViewPendingRestoreRef.current = null;
        }
        restoreNow();
      }, ANIM_MS);
    };
  }, [splitViewOpen, playerMode, isFullscreen, fallbackPlayerContainerRef]);

  useEffect(() => {
    let cancelled = false;
    getStorage<Record<string, number>>([
      STORAGE_KEYS.SPLIT_VIEW_PCT,
      STORAGE_KEYS.SPLIT_VIEW_SHEET_HEIGHT_VH,
    ])
      .then((data) => {
        if (cancelled) return;
        const pct = data[STORAGE_KEYS.SPLIT_VIEW_PCT];
        if (typeof pct === 'number' && Number.isFinite(pct)) {
          splitViewPctRef.current = Math.min(Math.max(pct, 20), 60);
        }
        const vh = data[STORAGE_KEYS.SPLIT_VIEW_SHEET_HEIGHT_VH];
        if (typeof vh === 'number' && Number.isFinite(vh)) {
          splitViewSheetVhRef.current = Math.min(Math.max(vh, 20), 95);
        }
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  return { splitViewOpen, splitViewPortalTarget, handleToggleSplitView, setSplitViewOpen, drainPendingRestore };
}
