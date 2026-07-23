import tokensCss from '@/shared/styles/tokens.css?raw';
import componentsCss from '@/shared/styles/components.css?raw';
import { ICON_CATALOG } from '@/shared/icons';
import { buildTokenBadgeCss } from './tokenBadgeCss';
import { onStorageChanged, removeOnStorageChangedListener, getStorage, setStorage } from '@/shared/lib/chrome-apis';
import { STORAGE_KEYS } from '@/shared/config/config';
import type { ThemeMode } from '@/entities/theme';
import {
  type CollapsedEdge,
  getEdgeCenter,
} from '@/features/dictionaryPopup/badgePointer/badgeCollapse';

const HOST_CLASS = 'js-cell-token-badge-host';
const BADGE_Z_INDEX = '2147483646';
const FAB_SIZE = 36;

export interface TokenBadgeState {
  enabled: boolean;
  showStatus: boolean;
  showFrequency: boolean;
}

export interface TokenBadgeHandlers {
  onToggleEnabled: () => void;
  onToggleStatus: () => void;
  onToggleFrequency: () => void;
  onOpenDictionary: () => void;
}

export interface TokenBadge {
  setState(state: Partial<TokenBadgeState>): void;
  destroy(): void;
}

export interface CreateTokenBadgeOptions extends TokenBadgeHandlers {
  initialState: TokenBadgeState;
}

/**
 * Create a floating tokenize badge (FAB) with a Shadow DOM mini panel.
 *
 * ponytail: drag-to-reposition is intentionally omitted in this slice to keep
 * the first version testable in jsdom; the panel opens/closes via FAB click.
 *
 * Theme: data-theme is set on the panel element inside the shadow tree so
 * [data-theme="dark"] selectors in tokens.css match and cascade. Listens to
 * chrome.storage.onChanged + matchMedia for real-time theme switching.
 */
export function createTokenBadge(options: CreateTokenBadgeOptions): TokenBadge {
  let state = { ...options.initialState };
  let isOpen = false;
  let themeCleanup: (() => void) | null = null;

  // Drag-to-reposition state. dragStart null = not dragging; dragging true once
  // movement exceeds DRAG_THRESHOLD (distinguishes click vs drag on the FAB).
  // suppressClick swallows the synthetic click that follows a drag pointerup.
  // Dims (fabW/H, vw/vh) are cached at pointerdown so pointermove never reads
  // layout (offsetWidth/Height forces reflow) — only writes transform, which is
  // compositor-only and stays smooth on low-RAM devices.
  let dragStart: { x: number; y: number; baseLeft: number; baseTop: number; fabW: number; fabH: number; vw: number; vh: number } | null = null;
  let dragging = false;
  let suppressClick = false;
  const DRAG_THRESHOLD = 4;
  // rAF-throttle the transform update: pointermove can fire >100Hz; coalescing
  // to one apply per animation frame aligns movement to the display refresh and
  // cuts main-thread style recalcs from N-per-frame to 1. pendingMove holds the
  // latest pointer delta until the next rAF flushes it.
  let pendingMove: { dx: number; dy: number } | null = null;
  let moveRaf = 0;

  // Collapse state — the FAB defaults to a half-moon on the right viewport edge
  // (like the orbital badge). Clicking expands it to a full circle + opens the
  // panel. Dragging repositions it; releasing near an edge snaps + collapses it.
  // `collapsed` true = half-moon on `collapsedEdge`; false = full circle.
  let collapsed = true;
  let collapsedEdge: CollapsedEdge = 'right';

  /** Viewport rect for the shared collapse helpers (pure functions, no DOM reads).
   *  Uses documentElement.clientWidth/Height which EXCLUDES the scrollbar —
   *  window.innerWidth/Height includes it, so a badge on the right edge would
   *  sit under the scrollbar and be hidden. */
  function viewportRect(): { width: number; height: number } {
    return {
      width: document.documentElement?.clientWidth || window.innerWidth,
      height: document.documentElement?.clientHeight || window.innerHeight,
    };
  }

  /** Position the FAB center exactly on an edge so the viewport clips half of it
   *  → visible half-moon. Switches from right/bottom CSS to left/top inline.
   *  Sets data-collapse-edge so CSS can shift the icon into the visible half. */
  function collapseToEdge(edge: CollapsedEdge): void {
    collapsed = true;
    collapsedEdge = edge;
    const vp = viewportRect();
    const center = getEdgeCenter(edge, { x: vp.width / 2, y: vp.height / 2 }, FAB_SIZE, vp);
    fab.style.setProperty('right', 'auto', 'important');
    fab.style.setProperty('bottom', 'auto', 'important');
    fab.style.setProperty('left', `${center.x - FAB_SIZE / 2}px`, 'important');
    fab.style.setProperty('top', `${center.y - FAB_SIZE / 2}px`, 'important');
    fab.style.removeProperty('transform');
    fab.classList.add('cell-token-fab--collapsed');
    fab.setAttribute('data-collapse-edge', edge);
  }

  /** Expand to a full circle at the current center position. */
  function expand(): void {
    collapsed = false;
    fab.classList.remove('cell-token-fab--collapsed');
    fab.removeAttribute('data-collapse-edge');
  }

  /** Apply the cached drag delta as a compositor-only translate3d. Called from
   *  the rAF flush or synchronously on pointerup (to bake the final position). */
  function applyDragTransform(dx: number, dy: number): void {
    if (!dragStart) return;
    if (!dragging && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    dragging = true;
    // Clamp using cached dims — no layout reads here, so no forced reflow.
    const maxX = dragStart.vw - dragStart.fabW;
    const maxY = dragStart.vh - dragStart.fabH;
    const tx = Math.max(0, Math.min(maxX, dragStart.baseLeft + dx)) - dragStart.baseLeft;
    const ty = Math.max(0, Math.min(maxY, dragStart.baseTop + dy)) - dragStart.baseTop;
    // !important guarantees this wins over .btn:active's transform: scale(0.98)
    // while the pointer is held down. translate3d is compositor-only.
    fab.style.setProperty('transform', `translate3d(${tx}px, ${ty}px, 0)`, 'important');
    if (isOpen) anchorPanelToFAB();
  }

  function flushDragTransform(): void {
    if (moveRaf) { cancelAnimationFrame(moveRaf); moveRaf = 0; }
    if (pendingMove) {
      const m = pendingMove;
      pendingMove = null;
      applyDragTransform(m.dx, m.dy);
    }
  }

  const host = document.createElement('div');
  host.className = HOST_CLASS;
  host.style.position = 'fixed';
  host.style.left = '0';
  host.style.top = '0';
  host.style.width = '0';
  host.style.height = '0';
  host.style.zIndex = BADGE_Z_INDEX;

  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = `${tokensCss.replace(/:root/g, ':host')}\n${componentsCss}\n${buildTokenBadgeCss()}`;
  shadow.appendChild(style);

  const fab = document.createElement('button');
  // .btn--primary provides bg/color/hover/active; .cell-token-fab adds floating layout.
  fab.className = 'btn btn--primary cell-token-fab js-cell-token-fab';
  fab.setAttribute('aria-label', 'Tokenize');
  fab.innerHTML = ICON_CATALOG.settings.svg;
  shadow.appendChild(fab);

  const panel = document.createElement('div');
  panel.className = 'cell-token-panel js-cell-token-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Tokenize settings');
  shadow.appendChild(panel);

  /** Resolve theme mode (system → matchMedia, else stored mode, default dark). */
  function resolveTheme(mode: ThemeMode | undefined): 'light' | 'dark' {
    if (mode === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return mode ?? 'dark';
  }

  /** Read themeMode from storage and set data-theme on the panel element. */
  async function refreshTheme(): Promise<void> {
    const data = await getStorage<Record<string, unknown>>(STORAGE_KEYS.THEME_MODE);
    const mode = data[STORAGE_KEYS.THEME_MODE] as ThemeMode | undefined;
    panel.setAttribute('data-theme', resolveTheme(mode));
  }

  /** Initialize theme detection + listeners. Called once after host append. */
  function initTheme(): void {
    // Sync initial — prefers-color-scheme avoids FOUC for 'system' mode users.
    const syncDefault = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    panel.setAttribute('data-theme', syncDefault);

    // Async-correct from storage.
    void refreshTheme();

    // Re-resolve when themeMode changes in storage (user toggled in settings).
    const onThemeChange = (changes: Record<string, chrome.storage.StorageChange>, area: string): void => {
      if (area !== 'local') return;
      if (STORAGE_KEYS.THEME_MODE in changes) void refreshTheme();
    };
    onStorageChanged(onThemeChange);

    // Re-resolve when OS theme changes (matters when mode='system').
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onSystemChange = (): void => { void refreshTheme(); };
    mql.addEventListener('change', onSystemChange);

    themeCleanup = (): void => {
      removeOnStorageChangedListener(onThemeChange);
      mql.removeEventListener('change', onSystemChange);
    };
  }

  function buildPanel(): void {
    panel.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'cell-token-panel__header';
    header.textContent = 'Tokenize';

    const closeBtn = document.createElement('button');
    // .icon-btn--xs provides size/hover/active; .cell-token-panel__close is a BEM hook.
    closeBtn.className = 'icon-btn icon-btn--xs cell-token-panel__close js-cell-token-panel-close';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.innerHTML = ICON_CATALOG.x.svg;
    closeBtn.addEventListener('click', () => setOpen(false));
    header.appendChild(closeBtn);
    panel.appendChild(header);

    panel.appendChild(createToggleRow('Tokenize page', state.enabled, () => options.onToggleEnabled()));
    panel.appendChild(createToggleRow('Status', state.showStatus, () => options.onToggleStatus()));
    panel.appendChild(createToggleRow('Frequency', state.showFrequency, () => options.onToggleFrequency()));

    const dictBtn = document.createElement('button');
    // .btn--primary provides bg/color/hover/active; .cell-token-action adds full-width.
    dictBtn.className = 'btn btn--primary cell-token-action js-cell-token-open-dict';
    dictBtn.textContent = 'Open Dictionary';
    dictBtn.addEventListener('click', () => options.onOpenDictionary());
    panel.appendChild(dictBtn);
  }

  function createToggleRow(label: string, pressed: boolean, onChange: () => void): HTMLDivElement {
    const row = document.createElement('div');
    row.className = 'cell-token-row';

    const labelEl = document.createElement('span');
    labelEl.className = 'cell-token-row__label';
    labelEl.textContent = label;
    row.appendChild(labelEl);

    // DS Toggle pattern: <button aria-pressed> + .cell-toggle__thumb span.
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'cell-toggle js-cell-token-toggle';
    toggle.setAttribute('aria-pressed', String(pressed));
    toggle.setAttribute('role', 'switch');
    toggle.setAttribute('aria-label', label);
    const thumb = document.createElement('span');
    thumb.className = 'cell-toggle__thumb';
    toggle.appendChild(thumb);
    toggle.addEventListener('click', () => {
      const next = toggle.getAttribute('aria-pressed') !== 'true';
      toggle.setAttribute('aria-pressed', String(next));
      onChange();
    });
    row.appendChild(toggle);

    return row;
  }

  function setOpen(open: boolean): void {
    isOpen = open;
    if (open) {
      buildPanel();
      panel.classList.add('cell-token-panel--open');
      anchorPanelToFAB();
    } else {
      panel.classList.remove('cell-token-panel--open');
    }
  }

  /**
   * Position the panel relative to the FAB's current viewport rect.
   * Horizontal: right-align panel to FAB when FAB is on the right half of the
   * viewport, else left-align. Vertical: prefer above FAB; fall back to below
   * when there isn't room. Overrides the CSS right/bottom defaults via inline
   * !important so the panel follows a dragged FAB.
   */
  function anchorPanelToFAB(): void {
    const fabRect = fab.getBoundingClientRect();
    const gap = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const panelW = panel.offsetWidth;
    const panelH = panel.offsetHeight;
    if (panelW === 0 || panelH === 0) return; // not laid out yet

    const fabCenter = fabRect.left + fabRect.width / 2;
    let left: number;
    if (fabCenter > vw / 2) {
      left = fabRect.right - panelW;
    } else {
      left = fabRect.left;
    }
    left = Math.max(gap, Math.min(vw - panelW - gap, left));

    const spaceAbove = fabRect.top - gap;
    let top: number;
    if (spaceAbove >= panelH + gap) {
      top = fabRect.top - gap - panelH;
    } else {
      top = fabRect.bottom + gap;
      if (top + panelH > vh - gap) top = Math.max(gap, vh - panelH - gap);
    }

    panel.style.setProperty('right', 'auto', 'important');
    panel.style.setProperty('bottom', 'auto', 'important');
    panel.style.setProperty('left', `${left}px`, 'important');
    panel.style.setProperty('top', `${top}px`, 'important');
  }

  /** Persist current FAB viewport position so it survives reload/navigation. */
  async function persistPosition(): Promise<void> {
    const rect = fab.getBoundingClientRect();
    if (rect.left === 0 && rect.top === 0) return; // uninit layout
    await setStorage({ [STORAGE_KEYS.TOKEN_BADGE_POSITION]: { left: rect.left, top: rect.top, collapsed, collapsedEdge } });
  }

  /** Restore FAB position from storage, clamped to current viewport. If the
   *  saved state was collapsed, re-collapse to the saved edge; otherwise expand
   *  at the saved position. Falls back to collapsed-right when no saved state. */
  async function restorePosition(): Promise<void> {
    const data = await getStorage<Record<string, unknown>>(STORAGE_KEYS.TOKEN_BADGE_POSITION);
    const pos = data[STORAGE_KEYS.TOKEN_BADGE_POSITION] as { left: number; top: number; collapsed?: boolean; collapsedEdge?: CollapsedEdge } | undefined;
    if (!pos || typeof pos.left !== 'number' || typeof pos.top !== 'number') {
      // No saved state → default collapsed half-moon on the right edge.
      collapseToEdge('right');
      return;
    }
    if (pos.collapsed && pos.collapsedEdge) {
      collapseToEdge(pos.collapsedEdge);
      return;
    }
    const vp = viewportRect();
    const w = fab.offsetWidth;
    const h = fab.offsetHeight;
    const left = Math.max(0, Math.min(vp.width - w, pos.left));
    const top = Math.max(0, Math.min(vp.height - h, pos.top));
    fab.style.setProperty('right', 'auto', 'important');
    fab.style.setProperty('bottom', 'auto', 'important');
    fab.style.setProperty('left', `${left}px`, 'important');
    fab.style.setProperty('top', `${top}px`, 'important');
    expand();
  }

  /** Click-outside: close the panel when a pointerdown lands outside the host. */
  function onDocPointerDown(e: PointerEvent): void {
    if (!isOpen) return;
    const t = e.target as Node | null;
    // Shadow DOM retargets inner clicks to `host`, so contains() covers both.
    if (t && host.contains(t)) return;
    setOpen(false);
  }

  fab.addEventListener('pointerdown', (e: PointerEvent) => {
    if (e.button !== 0) return;
    const rect = fab.getBoundingClientRect();
    // If the FAB is collapsed (half-moon on an edge), expand it first and bake
    // the position into the valid clamp range. When collapsed, baseLeft can be
    // outside 0..vw-fabW (e.g. vw-24 for the right edge), which would cause the
    // first drag delta to clamp and produce a 24px jump ("giật về phía cạnh").
    // Baking into the valid range before drag starts eliminates that jump.
    if (collapsed) {
      expand();
      const vp = viewportRect();
      const clampedLeft = Math.max(0, Math.min(vp.width - rect.width, rect.left));
      const clampedTop = Math.max(0, Math.min(vp.height - rect.height, rect.top));
      fab.style.setProperty('left', `${clampedLeft}px`, 'important');
      fab.style.setProperty('top', `${clampedTop}px`, 'important');
      dragStart = {
        x: e.clientX, y: e.clientY,
        baseLeft: clampedLeft, baseTop: clampedTop,
        fabW: rect.width, fabH: rect.height,
        vw: vp.width, vh: vp.height,
      };
    } else {
      // Bake the current visual position into left/top as the drag base, then
      // move via transform only. This also handles the case where restorePosition
      // (async) hasn't completed yet — without baking, clearing right/bottom
      // would jump the FAB to (0,0).
      fab.style.setProperty('left', `${rect.left}px`, 'important');
      fab.style.setProperty('top', `${rect.top}px`, 'important');
      const vp = viewportRect();
      dragStart = {
        x: e.clientX, y: e.clientY,
        baseLeft: rect.left, baseTop: rect.top,
        fabW: rect.width, fabH: rect.height,
        vw: vp.width, vh: vp.height,
      };
    }
    dragging = false;
    // Switch from CSS right/bottom to inline left/top positioning, then move
    // via transform only. Disable .btn's `transition: transform` so the FAB
    // tracks the cursor instantly instead of easing 150ms behind it.
    fab.style.setProperty('right', 'auto', 'important');
    fab.style.setProperty('bottom', 'auto', 'important');
    fab.style.setProperty('transition', 'none', 'important');
    try { fab.setPointerCapture(e.pointerId); } catch { /* ponytail: capture throws on some platforms */ }
  });

  fab.addEventListener('pointermove', (e: PointerEvent) => {
    if (!dragStart) return;
    // Stash the latest delta and schedule a single rAF to apply it — never
    // touch style on the pointermove hot path itself.
    pendingMove = { dx: e.clientX - dragStart.x, dy: e.clientY - dragStart.y };
    if (!moveRaf) {
      moveRaf = requestAnimationFrame(() => {
        moveRaf = 0;
        if (pendingMove) {
          const m = pendingMove;
          pendingMove = null;
          applyDragTransform(m.dx, m.dy);
        }
      });
    }
  });

  fab.addEventListener('pointerup', (e: PointerEvent) => {
    // Apply any pending move synchronously so the baked position is current.
    flushDragTransform();
    if (dragging) {
      // Commit: read the transformed rect once, bake it into left/top, then
      // clear transform so the final position is stable and transition-free.
      const rect = fab.getBoundingClientRect();
      fab.style.removeProperty('transform');
      fab.style.setProperty('left', `${rect.left}px`, 'important');
      fab.style.setProperty('top', `${rect.top}px`, 'important');
      fab.style.removeProperty('transition');
      suppressClick = true;
      // Edge-snap: only collapse when the user deliberately pushed the FAB
      // past a viewport edge — detected by the CURSOR going past the edge,
      // not the FAB rect. This lets the user position the FAB flush against
      // an edge without triggering collapse; they have to "dí" (push) the
      // cursor past the viewport boundary to collapse. The drag clamp keeps
      // the FAB fully on-screen, so the FAB can be at the edge while the
      // cursor continues past it — that's the "dí chạm cạnh" gesture.
      const vp = viewportRect();
      let snapEdge: CollapsedEdge | null = null;
      if (e.clientX <= 0) snapEdge = 'left';
      else if (e.clientX >= vp.width) snapEdge = 'right';
      else if (e.clientY <= 0) snapEdge = 'top';
      else if (e.clientY >= vp.height) snapEdge = 'bottom';
      if (snapEdge) {
        collapseToEdge(snapEdge);
      } else {
        expand();
      }
      void persistPosition();
    }
    dragging = false;
    dragStart = null;
    pendingMove = null;
    try { fab.releasePointerCapture(e.pointerId); } catch { /* noop */ }
  });

  fab.addEventListener('pointercancel', () => {
    if (moveRaf) { cancelAnimationFrame(moveRaf); moveRaf = 0; }
    if (dragging) {
      fab.style.removeProperty('transform');
      fab.style.removeProperty('transition');
    }
    dragging = false;
    dragStart = null;
    pendingMove = null;
  });

  fab.addEventListener('click', () => {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    // When collapsed (half-moon), the first click expands to a full circle and
    // opens the panel. When already expanded, click toggles the panel.
    if (collapsed) {
      expand();
      setOpen(true);
    } else {
      setOpen(!isOpen);
    }
  });

  // Append the badge host after the page (and Angular/Cloudflare hydration)
  // has finished loading. Appending during hydration can cause DOM
  // mismatches that break script injection and leave the page stuck.
  // Fullscreen-safe: attach to the fullscreen element (or body) so the FAB
  // shows inside fullscreen video — kế thừa orbital badge onFullscreenChange.
  function getMountParent(): Element {
    return document.fullscreenElement ?? (document.body ?? document.documentElement);
  }

  function appendHost(): void {
    getMountParent().appendChild(host);
    initTheme();
    void restorePosition();
    document.addEventListener('pointerdown', onDocPointerDown, true);
  }

  function onFullscreenChange(): void {
    const parent = getMountParent();
    if (host.parentElement !== parent) {
      parent.appendChild(host);
    }
  }

  if (document.readyState === 'complete') {
    appendHost();
  } else {
    window.addEventListener('load', () => appendHost(), { once: true });
  }
  document.addEventListener('fullscreenchange', onFullscreenChange);
  buildPanel();

  return {
    setState(next: Partial<TokenBadgeState>) {
      state = { ...state, ...next };
      buildPanel();
    },
    destroy() {
      if (moveRaf) { cancelAnimationFrame(moveRaf); moveRaf = 0; }
      themeCleanup?.();
      themeCleanup = null;
      document.removeEventListener('pointerdown', onDocPointerDown, true);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      host.remove();
    },
  };
}
