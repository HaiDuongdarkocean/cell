import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import {
  resolveSplitViewWrapperHeight,
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
  closeYoutubeSplitView,
  isYoutubePage,
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
// Structured log with [Cell:SplitView] prefix so it's easy to filter in console.
// Gated to CELL_E2E=1 builds via logger — no-ops in production.
function svLog(event: string, data?: Record<string, unknown>): void {
  const ts = new Date().toISOString().slice(11, 23);
  logger.debug(`[Cell:SplitView ${ts}] ${event}`, data ?? '');
}
function rectLog(el: Element | null | undefined): Record<string, number> | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y) };
}

function measureShellContentHeight(shell: HTMLElement): number {
  // Also lift our aspect-ratio:auto override while measuring so a stylesheet
  // aspect-ratio (e.g. StreamFlix .playerContainer 16/9) contributes natural
  // height — shells whose children are all position:absolute would otherwise
  // report only their overflow (~70px) and collapse the wrapper.
  shell.style.removeProperty('aspect-ratio');
  shell.style.setProperty('height', 'auto', 'important');
  const height = shell.scrollHeight;
  shell.style.setProperty('aspect-ratio', 'auto', 'important');
  shell.style.setProperty('height', '100%', 'important');
  return height;
}

const SPLIT_VIEW_MIN_STAGE_WIDTH = 200;
const SPLIT_VIEW_MIN_HEIGHT = 160;
const SPLIT_VIEW_VIEWPORT_MARGIN = 8;
// Below this width the row layout cannot keep both the video and the panel
// usable. A narrow viewport (mobile) mounts the panel as a bottom sheet
// overlay — the Cell Sheet pattern (edge-to-edge, top radius-element,
// surface-popover) — so the video keeps its slot and the cue list gets a
// proper height instead of an inline panel squeezing both. A narrow slot
// inside a wide viewport still stacks column-in-place.
const SPLIT_VIEW_COLUMN_BELOW = 600;
const SPLIT_VIEW_SHEET_HANDLE_HEIGHT = 24;
const PANEL_INNER_BASE_BG = 'color-mix(in srgb, var(--color-surface) 85%, transparent)';

function clampToVisibleViewport(contentHeight: number, topEdge: number): number {
  const available = window.innerHeight - topEdge - SPLIT_VIEW_VIEWPORT_MARGIN;
  return Math.min(contentHeight, Math.max(SPLIT_VIEW_MIN_HEIGHT, Math.round(available)));
}

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
  // Track the normal-branch wrapper so we can clean it up when transitioning
  // to fullscreen (the wrapper can't be removed while playerShell — now the
  // fullscreen element — is inside it; we remove it on the next normal run).
  const splitViewWrapperRef = useRef<HTMLDivElement | null>(null);
  // Deferred cleanup restore (slide-out animation window). A new effect run
  // drains it synchronously so the restore can't fire mid-session and strip
  // the fresh overrides / move cellRoot out of the live stageCell.
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
    // Drain a restore still pending from the previous session's slide-out
    // window: run its teardown NOW (synchronously, before we snapshot and
    // rewrap) instead of letting its timer fire mid-session. Otherwise the
    // stale timer would strip this run's fresh !important overrides, move
    // cellRoot out of the live stageCell, and null the live wrapper ref.
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

    // playerShell or any descendant (e.g. <video> itself) may be the
    // fullscreen element. On some browsers YouTube requests fullscreen on
    // document.documentElement (an ANCESTOR of #movie_player) — detect that
    // too so the fullscreen branch runs instead of the normal wrapper branch.
    const fsEl = document.fullscreenElement;
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
      'padding', 'justify-content',
    ];
    const savedPlayerShellStyles: Record<string, string> = {};
    for (const property of playerShellStyleProperties) {
      savedPlayerShellStyles[property] = playerShell.style.getPropertyValue(property);
    }
    const chainStyleProps = ['width', 'height', 'min-height'];
    const savedChainStyles: Array<{ el: HTMLElement; values: Record<string, string> }> = [];
    const stageCell = document.createElement('div');
    stageCell.setAttribute('data-cell-split-view', 'stage');
    stageCell.style.cssText = `flex:1 1 0;min-width:min(${SPLIT_VIEW_MIN_STAGE_WIDTH}px,55%);min-height:0;height:100%;position:relative;overflow:hidden;`;

    const panel = document.createElement('div');
    panel.setAttribute('data-cell-split-view', 'panel');
    // Apple §7: enter from right, exit to right — symmetric path.
    // §4: critically damped spring feel (no overshoot).
    // flex-basis animates so the video expands smoothly as the panel slides out.
    panel.style.cssText = `flex:0 0 ${splitViewPctRef.current}%;min-width:min(200px,45%);max-width:min(60%,calc(100% - ${SPLIT_VIEW_MIN_STAGE_WIDTH}px));height:100%;overflow:hidden;position:relative;transition:transform var(--duration-normal) var(--ease-standard),opacity var(--duration-normal) var(--ease-standard),flex-basis var(--duration-normal) var(--ease-standard);transform:translateX(100%);opacity:var(--opacity-30);`;

    // Attach a shadow root to the panel so the design-system tokens
    // (--color-surface, --color-border-subtle, etc.) + CueList/SubtitlePanel
    // CSS resolve identically to Player Mode (which renders inside the main
    // shadow root). Without this, the panel is in light DOM and tokens are
    // undefined → colors fall back to browser defaults.
    const panelShadow = panel.attachShadow({ mode: 'open' });
    injectShadowCss(panelShadow, {
      css: [...allModuleCss, buildTokenSpanCssForShadow()],
    });
    const panelInner = document.createElement('div');
    const themeSyncCleanup = syncElementTheme(panelInner, findThemeCarrier());
    // Translucent surface + blur (same spec as SubtitlePanel/.contentOther)
    // so the split-view column never looks empty even before/if the panel
    // content portals in.
    panelInner.style.cssText = `width:100%;height:100%;display:flex;flex-direction:column;background:${PANEL_INNER_BASE_BG};backdrop-filter:blur(var(--blur-lg));-webkit-backdrop-filter:blur(var(--blur-lg));`;
    panelShadow.appendChild(panelInner);

    const handle = document.createElement('div');
    handle.setAttribute('data-cell-split-view', 'handle');
    handle.style.cssText = 'flex:0 0 var(--space-1-5);height:100%;background:var(--color-border);cursor:col-resize;touch-action:none;position:relative;z-index:1;';

    // Sheet-mode resize grip — lives inside panelInner (shadow DOM: light
    // children of the host would not render) as an in-flow first child, so
    // it reserves its band instead of overlaying the cue chrome.
    const sheetHandle = document.createElement('div');
    sheetHandle.setAttribute('data-cell-split-view', 'sheet-handle');
    sheetHandle.setAttribute('role', 'separator');
    sheetHandle.setAttribute('aria-orientation', 'horizontal');
    sheetHandle.setAttribute('aria-label', t('subtitle.playerMode.resizeList'));
    sheetHandle.tabIndex = 0;
    sheetHandle.style.cssText = `display:none;flex:0 0 ${SPLIT_VIEW_SHEET_HANDLE_HEIGHT}px;position:relative;cursor:grab;touch-action:none;`;
    const sheetHandlePill = document.createElement('div');
    sheetHandlePill.style.cssText = 'position:absolute;top:var(--space-1);left:50%;transform:translateX(-50%);width:var(--space-10);height:var(--space-1);border-radius:var(--radius-full);background:var(--color-text-secondary);opacity:var(--opacity-50);';
    sheetHandle.appendChild(sheetHandlePill);
    panelInner.appendChild(sheetHandle);

    // Wrapper only needed in the normal (non-fullscreen) branch.
    let wrapper: HTMLDivElement | null = null;
    let layoutObserver: ResizeObserver | null = null;
    let layoutRaf = 0;
    let scheduleLayoutRecalc: () => void = () => {};
    let onPageScrollRef: ((() => void) | null) = null;
    let lastLayoutKey: { w: number; vh: number } | null = null;
    let cachedContentH = 0;
    let isNarrowLayout = false;
    let isSheetMode = false;

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
      playerShell.style.setProperty('padding', '0', 'important');
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
      // Wrapper height: preserve the slot the container occupied before
      // split — the page layout was built around exactly that box.
      //
      // Two cases:
      // 1. Tight shell (playerShell ≈ video width, e.g. kisskh.co):
      //    The shell is just the video + controls — keep its own rendered
      //    height. Never the flex-row parent's height: a wrap/stacked row
      //    is sized by the tallest SIBLING (kisskh's drama-info column),
      //    which towers over the player slot and can hit the viewport cap.
      //    A shell stretch-inflated by its row already reports the
      //    stretched rect, so the original footprint is still preserved.
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
      // The % basis only applies to flex-row parents: on a column parent
      // the basis lands on the HEIGHT axis and overrides height:px,
      // collapsing the wrapper — non-row parents get '0 0 auto' so the
      // height property governs (for non-flex parents flex is inert).
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
      const wrapperFlex = !insertParentIsFlexRow
        ? '0 0 auto'
        : hasFlexSiblings
          ? `0 0 ${Math.round(originalParentInOldWrapper ? oldWrapper!.getBoundingClientRect().width : playerRect.width)}px`
          : '1 1 100%';
      // YouTube: use height:100% so the wrapper follows #container's
      // computed height automatically on window resize — no hardcoded px,
      // no resize listener needed. #container's height is set by YouTube's
      // CSS based on video aspect ratio + available width, and updates on
      // resize. The old approach (parentPixelHeight px) froze the wrapper
      // at the initial size → empty space below after browser resize.
      //
      // height:100% is only meaningful when the insert parent hands the
      // shell a real slot: a definite content-box height (>1px — rules out
      // padding-driven aspect-ratio shells where 100% resolves against 0,
      // e.g. m.youtube .player-size) that is roughly the player's own
      // height (rules out body-level parents where 100% would tower over
      // the video). Anything else takes the measured px path.
      const insertParentComputedHeight = parseFloat(insertParentCs.height);
      const youtubeFollowsParent = isYoutubePage()
        && Number.isFinite(insertParentComputedHeight)
        && insertParentComputedHeight > 1
        && insertParent.getBoundingClientRect().height <= playerRect.height * 1.1;
      // position:fixed shells (e.g. m.youtube's sticky player sits directly
      // on <body>) have no meaningful DOM slot: an in-flow wrapper inserted
      // there lands at the parent's content top, covering fixed chrome
      // (masthead) and pushing the whole page flow down by the wrapper
      // height. Re-anchor the wrapper at the shell's visual rect so it
      // stays where the player was. Absolute shells keep the in-flow path —
      // their DOM position usually sits inside the intended slot anyway.
      const shellOutOfFlow = playerComputedStyle.position === 'fixed';
      const viewportCapH = Math.max(
        SPLIT_VIEW_MIN_HEIGHT,
        window.innerHeight - playerRect.top - SPLIT_VIEW_VIEWPORT_MARGIN,
      );
      // Tight shells keep the shell's own rendered height — that is the
      // slot the container occupied before split, and the page already
      // reserves it (m.youtube pads scroll content; kisskh's fixed .col-12
      // sits over a top-padded flow). Filling the flex-row parent's height
      // instead stretches the wrapper to the tallest SIBLING (kisskh's
      // drama-info col is ~1400px → capped to the viewport) — the stage
      // towers over the video with dead space above and below.
      const wrapperHeightStyle = viewportBound
        ? wrapperHeight
        : youtubeFollowsParent
          ? '100%'
        : isBroadShell
          ? `${Math.min(Math.round(videoRect!.height), viewportCapH)}px`
          : `${Math.min(Math.round(playerRect.height), viewportCapH)}px`;
      // Video aspect captured before the fill chain re-sizes the shell —
      // narrow (column) mode sizes the stage from it so the video never
      // distorts. The shell rect includes letterbox/controls space the
      // site adds around the video, so prefer the video's own rect.
      const stageAspect = videoRect && videoRect.height > 0
        ? videoRect.width / videoRect.height
        : playerRect.width / Math.max(playerRect.height, 1) || 16 / 9;
      svLog('NORMAL wrapper height', {
        viewportBound,
        isYoutube: isYoutubePage(),
        isBroadShell,
        hasFlexSiblings,
        wrapperFlex,
        shellOutOfFlow,
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
      const shellZIndexCss = shellOutOfFlow && playerComputedStyle.zIndex !== 'auto'
        ? `z-index:${playerComputedStyle.zIndex};`
        : '';
      const wrapperAnchorCss = shellOutOfFlow
        ? `position:fixed;top:${Math.round(playerRect.top)}px;left:${Math.round(playerRect.left)}px;width:${Math.round(playerRect.width)}px;${shellZIndexCss}`
        : 'position:relative;width:100%;';
      wrapper.style.cssText = isYoutube
        ? `display:flex;flex-direction:row;height:${wrapperHeightStyle}!important;flex:0 0 auto;overflow:hidden;${wrapperAnchorCss}`
        : `display:flex;flex-direction:row;flex:${wrapperFlex};height:${wrapperHeightStyle};align-self:stretch;overflow:hidden;${wrapperAnchorCss}`;

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
      // The shell keeps its native display — forcing display:flex would
      // blockify its direct children, re-parenting every descendant's
      // height:100% resolution onto a blockified intermediate that sizes
      // to content (kisskh's APP-WATCH/MAT-VIDEO are inline, so their
      // block-level descendants resolve %height straight against the
      // shell — leave them alone and the host's own fill chain works).
      // jwplayer/megaplay sets overflow:hidden on #megaplay-player, which
      // clips the control bar (especially right-side controls like the
      // fullscreen button) at the player bounds. Override to visible so
      // controls render outside the player's content box. stageCell still
      // has overflow:hidden, so the video itself is clipped to the stage.
      playerShell.style.setProperty('overflow', 'visible', 'important');

      // Move playerShell into new stageCell FIRST (detaches from old
      // wrapper's stageCell if transitioning from a previous normal run).
      stageCell.appendChild(playerShell);

      // Re-link the "video fills shell" percentage chain between video and
      // shell — WITHOUT changing display. An intermediate that is already
      // a block/flex/grid box keeps its layout mode (forcing display:block
      // on a flex container would collapse its children's arrangement —
      // that is how host control bars explode into a vertical stack);
      // inline intermediates are skipped by %height resolution anyway.
      // YouTube is skipped — its MAIN-world YT_SPLIT_CSS bridge owns the
      // same fill behavior plus .ytp-chrome specifics. Broad shells keep
      // video-driven height.
      if (!isYoutube && !isBroadShell && videoEl) {
        let node: HTMLElement | null = videoEl.parentElement;
        while (node && node !== playerShell && node !== document.body) {
          const values: Record<string, string> = {};
          for (const property of chainStyleProps) {
            values[property] = node.style.getPropertyValue(property);
          }
          savedChainStyles.push({ el: node, values });
          node.style.setProperty('width', '100%', 'important');
          node.style.setProperty('height', '100%', 'important');
          node.style.setProperty('min-height', '0', 'important');
          node = node.parentElement;
        }
        const videoValues: Record<string, string> = {};
        for (const property of chainStyleProps) {
          videoValues[property] = videoEl.style.getPropertyValue(property);
        }
        savedChainStyles.push({ el: videoEl, values: videoValues });
        videoEl.style.setProperty('width', '100%', 'important');
        videoEl.style.setProperty('height', '100%', 'important');
      }
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
      const recalcWrapperLayout = (): void => {
        if (!wrapper?.isConnected) return;
        const rect = wrapper.getBoundingClientRect();
        // Row layout needs stage (min 200) + panel (min 200) + handle —
        // below the column breakpoint that cannot fit, so stack the panel
        // under the video instead of pushing it off-screen. The slot width
        // comes from the parent, not the wrapper: the wrapper may still
        // carry a stale px flex-basis that overflows the viewport.
        const slotW = Math.max(insertParent.clientWidth, 1);
        // Mobile viewport → the panel leaves the page flow and floats as a
        // bottom sheet (video keeps its natural slot). A narrow slot on a
        // wide viewport stacks column-in-place instead.
        const sheetMode = window.innerWidth < SPLIT_VIEW_COLUMN_BELOW;
        const narrow = sheetMode || slotW < SPLIT_VIEW_COLUMN_BELOW;
        isNarrowLayout = narrow;
        isSheetMode = narrow && sheetMode;
        const stageH = Math.round(slotW / stageAspect);
        // Site responsive CSS can switch the shell to position:fixed at
        // narrow widths (kisskh .portrait covers the viewport), which rips
        // it out of the stage and buries the panel. Pin it back into the
        // stage whenever it is fixed — open-time or after a breakpoint
        // change. In-flow shells are untouched.
        if (getComputedStyle(playerShell).position === 'fixed') {
          playerShell.style.setProperty('position', 'absolute', 'important');
          playerShell.style.setProperty('inset', '0', 'important');
        }
        const restorePanelIntoWrapper = (): void => {
          if (panel.parentElement === document.body) {
            wrapper?.appendChild(panel);
          }
          panel.style.position = 'relative';
          panel.style.left = '';
          panel.style.right = '';
          panel.style.top = '';
          panel.style.bottom = '';
          panel.style.zIndex = '';
          panel.style.borderRadius = '';
          panelInner.style.borderRadius = '';
          panelInner.style.background = PANEL_INNER_BASE_BG;
          handle.style.display = '';
          sheetHandle.style.display = 'none';
        };
        if (narrow) {
          wrapper.style.flexDirection = 'column';
          stageCell.style.flex = '0 0 auto';
          stageCell.style.minWidth = '0';
          stageCell.style.width = '100%';
          stageCell.style.height = `${stageH}px`;
          if (sheetMode) {
            handle.style.display = 'none';
            sheetHandle.style.display = 'block';
            sheetHandle.setAttribute('aria-valuemin', String(SPLIT_VIEW_SHEET_MIN_HEIGHT));
            sheetHandle.setAttribute('aria-valuemax', String(sheetMaxHeight()));
            if (panel.parentElement !== document.body) {
              document.body.appendChild(panel);
              // The entry transform was translateX(100%) — retarget it to
              // slide up so the sheet enters like every other Cell sheet.
              if (panel.style.transform === 'translateX(100%)') {
                panel.style.transform = 'translateY(100%)';
              }
            }
            panel.style.position = 'fixed';
            panel.style.left = '0';
            panel.style.right = '0';
            panel.style.bottom = '0';
            panel.style.top = 'auto';
            panel.style.width = 'auto';
            panel.style.height = `${resolveSheetHeight()}px`;
            sheetHandle.setAttribute('aria-valuenow', String(Math.round(resolveSheetHeight())));
            panel.style.flex = 'none';
            panel.style.minWidth = '0';
            panel.style.maxWidth = 'none';
            panel.style.minHeight = '0';
            panel.style.zIndex = 'var(--z-overlay-video, 10000)';
            panel.style.borderRadius = 'var(--radius-element, 12px) var(--radius-element, 12px) 0 0';
            panelInner.style.borderRadius = 'var(--radius-element) var(--radius-element) 0 0';
            panelInner.style.background = 'var(--color-surface-popover)';
          } else {
            restorePanelIntoWrapper();
            handle.style.flex = '0 0 var(--space-1-5)';
            handle.style.width = '100%';
            handle.style.height = 'auto';
            handle.style.cursor = 'default';
            panel.style.flex = '1 1 0';
            panel.style.minWidth = '0';
            panel.style.maxWidth = 'none';
            panel.style.width = '100%';
            panel.style.height = 'auto';
            panel.style.minHeight = '0';
          }
        } else {
          restorePanelIntoWrapper();
          wrapper.style.flexDirection = 'row';
          stageCell.style.flex = '1 1 0';
          stageCell.style.minWidth = `min(${SPLIT_VIEW_MIN_STAGE_WIDTH}px,55%)`;
          stageCell.style.width = '';
          stageCell.style.height = '100%';
          handle.style.flex = '0 0 var(--space-1-5)';
          handle.style.width = '';
          handle.style.height = '100%';
          handle.style.cursor = 'col-resize';
          panel.style.flex = `0 0 ${splitViewPctRef.current}%`;
          panel.style.minWidth = 'min(200px,45%)';
          panel.style.maxWidth = `min(60%,calc(100% - ${SPLIT_VIEW_MIN_STAGE_WIDTH}px))`;
          panel.style.width = '';
          panel.style.height = '100%';
          panel.style.minHeight = '';
        }
        let liveHeight: string;
        if (narrow && sheetMode) {
          // The wrapper is just the video slot — the sheet lives outside
          // the flow, so don't reserve panel height under the stage.
          liveHeight = `${stageH}px`;
          playerShell.style.setProperty('width', '100%', 'important');
          playerShell.style.setProperty('margin', '0', 'important');
        } else if (narrow) {
          const panelH = Math.max(
            SPLIT_VIEW_MIN_HEIGHT,
            Math.round((stageH * splitViewPctRef.current) / Math.max(100 - splitViewPctRef.current, 1)),
          );
          liveHeight = `${clampToVisibleViewport(stageH + panelH, rect.top)}px`;
          playerShell.style.setProperty('width', '100%', 'important');
          playerShell.style.setProperty('margin', '0', 'important');
        } else if (viewportBound) {
          liveHeight = resolveSplitViewWrapperHeight(
            playerShell.getBoundingClientRect().height,
            window.innerHeight,
            true,
          );
        } else if (isYoutube) {
          // The wrapper keeps the shell's original height: the page reserves
          // that slot for the player (m.youtube pads its scroll content), so
          // shrinking leaves dead space below and growing covers neighbors.
          // The video fills the stage via the YT_SPLIT_CSS bridge
          // (object-fit:contain) — re-measuring the video would read back
          // the same value anyway.
          liveHeight = youtubeFollowsParent ? '100%' : wrapperHeightStyle;
        } else {
          const keyChanged = !lastLayoutKey
            || Math.abs(rect.width - lastLayoutKey.w) > 1
            || Math.abs(window.innerHeight - lastLayoutKey.vh) > 1;
          if (keyChanged) {
            lastLayoutKey = { w: rect.width, vh: window.innerHeight };
            playerShell.style.setProperty('width', '100%', 'important');
            playerShell.style.setProperty('margin', '0', 'important');
            panel.style.visibility = 'hidden';
            panel.style.position = 'absolute';
            let measuredH: number;
            if (isBroadShell) {
              measuredH = playerShell.querySelector('video')?.getBoundingClientRect().height ?? 0;
            } else {
              // Floor at the shell's open-time height: that slot is what the
              // page reserved for the player — shrinking below it leaves dead
              // space (fixed shells like kisskh .col-12 keep their reserved
              // spot regardless of flow). Natural content height still wins
              // when reflow legitimately makes the shell taller (resize).
              measuredH = Math.max(
                measureShellContentHeight(playerShell),
                Math.round(playerRect.height),
              );
            }
            panel.style.visibility = '';
            panel.style.position = '';
            cachedContentH = measuredH;
          }
          const cappedH = clampToVisibleViewport(cachedContentH, rect.top);
          const videoForRatio = playerShell.querySelector('video')?.getBoundingClientRect();
          const stageW = stageCell.getBoundingClientRect().width;
          const targetW = cappedH < cachedContentH && videoForRatio && videoForRatio.height > 0
            ? Math.floor(cappedH * (videoForRatio.width / videoForRatio.height))
            : 0;
          if (targetW > SPLIT_VIEW_MIN_STAGE_WIDTH && targetW < stageW) {
            playerShell.style.setProperty('width', `${targetW}px`, 'important');
            playerShell.style.setProperty('margin', '0 auto', 'important');
          } else {
            playerShell.style.setProperty('width', '100%', 'important');
            playerShell.style.setProperty('margin', '0', 'important');
          }
          liveHeight = `${cappedH}px`;
        }
        wrapper.style.height = liveHeight;
        if (narrow) {
          // Full width so the video column's siblings wrap below it. Only a
          // flex-row parent honors a % basis on the width axis — on a column
          // parent the basis lands on the HEIGHT axis and would override the
          // explicit height above (collapses the whole split view).
          wrapper.style.flex = insertParentIsFlexRow ? '0 0 100%' : '0 0 auto';
        } else if (hasFlexSiblings) {
          const cs = getComputedStyle(insertParent);
          const parentContentW = insertParent.clientWidth
            - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
          const siblingW = Array.from(insertParent.children)
            .filter((c) => c !== wrapper
              && !(c as HTMLElement).hasAttribute?.('data-cell-split-view'))
            .reduce((sum, c) => sum + c.getBoundingClientRect().width, 0);
          const basis = Math.round(parentContentW - siblingW);
          // Siblings may have wrapped to their own rows after a viewport
          // shrink — a stale px basis would then overflow the viewport,
          // so fall back to filling the row.
          wrapper.style.flex = basis > 0 ? `0 0 ${basis}px` : '1 1 100%';
        }
      };
      scheduleLayoutRecalc = (): void => {
        cancelAnimationFrame(layoutRaf);
        layoutRaf = requestAnimationFrame(recalcWrapperLayout);
      };
      layoutObserver = new ResizeObserver(scheduleLayoutRecalc);
      layoutObserver.observe(insertParent);
      const observedVideo = playerShell.querySelector('video');
      if (observedVideo) layoutObserver.observe(observedVideo);
      let lastScrollX = window.scrollX;
      let lastScrollY = window.scrollY;
      onPageScrollRef = (): void => {
        if (window.scrollX === lastScrollX && window.scrollY === lastScrollY) return;
        lastScrollX = window.scrollX;
        lastScrollY = window.scrollY;
        scheduleLayoutRecalc();
      };
      window.addEventListener('scroll', onPageScrollRef, { passive: true, capture: true });
      window.addEventListener('resize', scheduleLayoutRecalc);
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
    // Apple §1: respond instantly — slide panel in from right on next frame.
    // rAF ensures the initial translateX(100%) is painted before animating to 0.
    requestAnimationFrame(() => {
      // Sheet mode reparents the panel onto <body> — slide up, not in.
      panel.style.transform = panel.parentElement === document.body
        ? 'translateY(0)'
        : 'translateX(0)';
      panel.style.opacity = '1';
    });
    // CSS handles all YouTube player sizing now (height:100%!important,
    // object-fit:contain). No setSize bridge needed — it set hardcoded
    // pixel sizes that froze on resize.
    window.dispatchEvent(new Event('resize'));

    const sheetMaxHeight = (): number => splitViewSheetMaxHeightPx(window.innerHeight);
    const resolveSheetHeight = (): number =>
      splitViewSheetHeightPx(splitViewSheetVhRef.current, window.innerHeight);

    // Drag resize: measure the flex container (wrapper or playerShell).
    const flexContainer = wrapper ?? playerShell;
    let dragStart: { x: number; startPct: number; wrapperW: number } | null = null;
    const onPointerDown = (e: PointerEvent): void => {
      // Column (narrow) layout has no horizontal split to drag.
      if (isNarrowLayout) return;
      e.preventDefault();
      dragStart = { x: e.clientX, startPct: splitViewPctRef.current, wrapperW: flexContainer.getBoundingClientRect().width };
      handle.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent): void => {
      if (!dragStart || dragStart.wrapperW <= 0) return;
      const deltaPct = -((e.clientX - dragStart.x) / dragStart.wrapperW) * 100;
      const next = Math.min(Math.max(dragStart.startPct + deltaPct, 20), 60);
      panel.style.flexBasis = `${next}%`;
      splitViewPctRef.current = next;
      // CSS handles video sizing (height:100%!important, object-fit:contain).
      // No setSize needed — the video fills the stage via CSS automatically.
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

    // Sheet-mode vertical resize: drag the top-edge grip to grow/shrink the
    // fixed bottom sheet. Height is tracked as viewport % so it survives
    // recalcs and persists across sessions.
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
    // (React re-render, SPA nav, episode switch) while Split View owns it,
    // self-close instead of leaving a ghost wrapper around a detached shell.
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
      if (onPageScrollRef) window.removeEventListener('scroll', onPageScrollRef, true);
      window.removeEventListener('resize', scheduleLayoutRecalc);
      cancelAnimationFrame(layoutRaf);
      themeSyncCleanup();
      svLog('cleanup START', { splitViewOpen, isPlayerFullscreen, playerShellTag: playerShell.tagName, playerShellInDom: document.body.contains(playerShell) });
      handle.removeEventListener('pointerdown', onPointerDown);
      handle.removeEventListener('pointermove', onPointerMove);
      handle.removeEventListener('pointerup', onPointerUp);
      handle.removeEventListener('pointercancel', onPointerUp);
      sheetHandle.removeEventListener('pointerdown', onSheetPointerDown);
      sheetHandle.removeEventListener('pointermove', onSheetPointerMove);
      sheetHandle.removeEventListener('pointerup', onSheetPointerUp);
      sheetHandle.removeEventListener('pointercancel', onSheetPointerUp);
      sheetHandle.removeEventListener('keydown', onSheetKeyDown);
      // Apple §7: exit along the same path as entry — slide out to right.
      // §8: hint in the direction of the gesture — rotate chevron to point right.
      // §1: start the animation immediately, defer DOM removal until it settles.
      const subtitlePanelEl = panelInner.querySelector('[data-cell-id="subtitle-panel"]') as HTMLElement | null;
      if (subtitlePanelEl) subtitlePanelEl.setAttribute('data-closing', 'true');
      panel.style.transform = panel.parentElement === document.body
        ? 'translateY(100%)'
        : 'translateX(100%)';
      panel.style.opacity = '0.3';
      panel.style.flexBasis = '0%';
      panel.style.minWidth = '0';
      const ANIM_MS = 410;
      let restoreDone = false;
      const restoreNow = (): void => {
      if (restoreDone) return;
      restoreDone = true;
      // Capture #cell-subtitle-root BEFORE wrapper.remove() detaches it —
      // getElementById only searches connected nodes, so reading it after
      // the wrapper is gone returns null and the restore below never runs,
      // leaving the subtitle host permanently detached.
      const cellRootCleanup = document.getElementById('cell-subtitle-root');
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
          if (splitViewWrapperRef.current === wrapper) {
            splitViewWrapperRef.current = null;
          }
          svLog('cleanup NORMAL done', { playerShellRect: rectLog(playerShell), originalParentTag: originalParent?.tagName });
        }
      }
      // User closed Split View while the player is fullscreen: the
      // normal-branch wrapper still wraps the fullscreen element. Removing
      // it now would detach the fs element and force-exit fullscreen, so
      // the unwrap is deferred to the first fullscreenchange that reports
      // no fullscreen element. Without this, a zombie wrapper + stage cell
      // (flex row, hardcoded height) stays in the page forever.
      const leftoverWrapper = splitViewWrapperRef.current;
      if (leftoverWrapper && document.fullscreenElement && leftoverWrapper.contains(document.fullscreenElement)) {
        const unwrapWhenFsExits = (): void => {
          if (document.fullscreenElement) return;
          document.removeEventListener('fullscreenchange', unwrapWhenFsExits);
          const wrapperParent = leftoverWrapper.parentElement;
          if (wrapperParent && leftoverWrapper.contains(playerShell)) {
            wrapperParent.insertBefore(playerShell, leftoverWrapper);
          }
          leftoverWrapper.remove();
          if (splitViewWrapperRef.current === leftoverWrapper) {
            splitViewWrapperRef.current = null;
          }
        };
        document.addEventListener('fullscreenchange', unwrapWhenFsExits);
      }
      // Restore all saved styles (display+flex-direction in fullscreen, all in normal).
      for (const property of playerShellStyleProperties) {
        playerShell.style.removeProperty(property);
        const value = savedPlayerShellStyles[property];
        if (value) playerShell.style.setProperty(property, value);
      }
      for (const { el, values } of savedChainStyles) {
        for (const property of chainStyleProps) {
          el.style.removeProperty(property);
          const value = values[property];
          if (value) el.style.setProperty(property, value);
        }
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
      const cellRootTarget = cellRootOriginalParent?.isConnected
        ? cellRootOriginalParent
        : playerShell;
      if (cellRootCleanup && cellRootTarget.isConnected && cellRootCleanup.parentElement !== cellRootTarget) {
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
      setSplitViewPortalTarget(null);
      };
      // Expose the deferred restore so a NEW effect run can drain it
      // synchronously (rapid close→open, fullscreen settle). The timer then
      // becomes a no-op via restoreDone.
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
