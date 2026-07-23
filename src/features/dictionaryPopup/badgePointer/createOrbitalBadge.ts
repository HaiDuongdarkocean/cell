import tokensCss from '@/shared/styles/tokens.css?raw';
import { onStorageChanged, removeOnStorageChangedListener, getStorage } from '@/shared/lib/chrome-apis';
import { STORAGE_KEYS } from '@/shared/config/config';
import type { ThemeMode } from '@/entities/theme';
import { buildOrbitalBadgeCss } from './orbitalBadgeCss';
import { createGestureDetector } from './gestureDetector';
import {
  type PointerPreset,
  type Point,
  getPointerTip,
  computePointerOffset,
  POINTER_EDGE_GAP_PX,
} from './pointerPosition';
import {
  type CollapsedEdge,
  type Point as CollapsePoint,
  getNearestEdge as sharedGetNearestEdge,
  getEdgeCenter as sharedGetEdgeCenter,
  getCollapsedCenter as sharedGetCollapsedCenter,
} from './badgeCollapse';

const HOST_CLASS = 'js-cell-orbital-badge-host';
const BADGE_Z_INDEX = '2147483647';
const DRAG_THRESHOLD_PX = 4;
const DEFAULT_BADGE_SIZE_PX = 36;
const DEFAULT_POINTER_SCALE = 0.25;
/** Debounce before firing a hover lookup while the pointer is moving. */
const HOVER_DEBOUNCE_MS = 150;
/** Extra margin (px) beyond the badge radius for snapping to a viewport edge. */
const EDGE_SNAP_MARGIN_PX = 12;
/** Distance (px) the user must drag perpendicularly inward from an edge to expand the badge. */
const EXPAND_THRESHOLD_PX = 12;

export interface OrbitalBadgeState {
  readonly expanded: boolean;
  readonly preset: PointerPreset;
}

export interface OrbitalBadgeOptions {
  /** Initial pointer preset. Defaults to 'center'. */
  readonly initialPreset?: PointerPreset;
  /** Badge diameter in px. Defaults to 36. */
  readonly badgeSize?: number;
  /** Pointer diameter as a ratio of the badge. Defaults to 0.25. */
  readonly pointerScale?: number;
  /** Called when the user changes the pointer preset (drag, double/triple tap). */
  readonly onPresetChange?: (preset: PointerPreset) => void;
  /** Called when the pointer tip settles after a drag/expand so the caller can lookup. */
  readonly onTipReady?: (tip: Point, preset: PointerPreset, badgeCenter: Point) => void;
  /** Called while the pointer is hovering over the page (debounced) so the caller can do a hover lookup. */
  readonly onTipHover?: (tip: Point, preset: PointerPreset, badgeCenter: Point) => void;
  /** Called on every pointer move while expanded so the caller can temporarily hide/reposition the popup if it covers the pointer. */
  readonly onTipMoving?: (tip: Point, preset: PointerPreset, badgeCenter: Point) => void;
  /** Called when the badge is double-tapped while expanded. */
  readonly onDoubleTap?: () => void;
  /** Called when the badge is triple-tapped while expanded. */
  readonly onTripleTap?: () => void;
}

export interface OrbitalBadge {
  readonly setPreset: (preset: PointerPreset) => void;
  readonly getState: () => OrbitalBadgeState;
  readonly show: () => void;
  readonly hide: () => void;
  readonly destroy: () => void;
}

function resolveTheme(mode: ThemeMode | undefined): 'light' | 'dark' {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return mode ?? 'dark';
}

/** Return the content-area width, excluding scrollbars, falling back to window.innerWidth. */
function getClientWidth(): number {
  return document.documentElement?.clientWidth || window.innerWidth;
}

/** Return the content-area height, excluding scrollbars, falling back to window.innerHeight. */
function getClientHeight(): number {
  return document.documentElement?.clientHeight || window.innerHeight;
}

/** Viewport rect for the shared collapse helpers (pure functions, no DOM reads). */
function viewportRect(): { width: number; height: number } {
  return { width: getClientWidth(), height: getClientHeight() };
}

/** Find the nearest viewport edge and the perpendicular distance to it. */
function getNearestEdge(point: Point): { edge: CollapsedEdge; distance: number } {
  return sharedGetNearestEdge(point, viewportRect());
}

/** Snap a point to a viewport edge while keeping the tangential coordinate visible. */
function getEdgeCenter(edge: CollapsedEdge, point: Point, badgeSize: number): Point {
  return sharedGetEdgeCenter(edge, point, badgeSize, viewportRect());
}

/** Center of the visible half-moon when the badge is collapsed on an edge. */
function getCollapsedPointerCenter(badgeCenter: Point, edge: CollapsedEdge, badgeSize: number): CollapsePoint {
  return sharedGetCollapsedCenter(badgeCenter, edge, badgeSize);
}

/** Return the preset that points inward from a collapsed edge. */
function getInwardPreset(edge: CollapsedEdge): PointerPreset {
  switch (edge) {
    case 'left': return 'right';
    case 'right': return 'left';
    case 'top': return 'bottom';
    case 'bottom': return 'top';
  }
}

/** Decompose drag delta into inward and tangential components relative to a collapsed edge. */
function getEdgeMovement(edge: CollapsedEdge, dx: number, dy: number): { inward: number; tangential: number } {
  switch (edge) {
    case 'left': return { inward: dx, tangential: dy };
    case 'right': return { inward: -dx, tangential: dy };
    case 'top': return { inward: dy, tangential: dx };
    case 'bottom': return { inward: -dy, tangential: dx };
  }
}

/** Compute the badge center while sliding along a collapsed edge. */
function getSlideCenter(edge: CollapsedEdge, start: Point, dx: number, dy: number, badgeSize: number): Point {
  return getEdgeCenter(edge, { x: start.x + dx, y: start.y + dy }, badgeSize);
}

export function createOrbitalBadge(options: OrbitalBadgeOptions): OrbitalBadge {
  const badgeSize = Math.max(24, Math.min(96, options.badgeSize ?? DEFAULT_BADGE_SIZE_PX));
  const pointerSize = Math.max(6, Math.min(24, badgeSize * (options.pointerScale ?? DEFAULT_POINTER_SCALE)));
  const pointerOffset = computePointerOffset(badgeSize, pointerSize, POINTER_EDGE_GAP_PX);

  // `userPreset` is the preset the user (or settings) selected. `preset` is the
  // active preset and may temporarily be set to an inward-pointing preset when
  // the badge is collapsed against an edge. We restore `userPreset` on expand
  // so dragging the badge out always shows the user's chosen pointer direction.
  let userPreset: PointerPreset = options.initialPreset ?? 'center';
  let preset: PointerPreset = userPreset;
  let expanded = false;
  let collapsedEdge: CollapsedEdge = 'right';
  // Center the badge on the right content edge. The viewport clips the right
  // half, so the visible part is a clean half-moon/crescent. Using clientWidth
  // (not innerWidth) keeps the badge on the content side of the scrollbar so
  // it is not hidden when collapsed.
  const rightEdge = getClientWidth();
  const bottomEdge = getClientHeight();
  let badgeCenter: Point = { x: rightEdge, y: bottomEdge / 2 };
  let pointerTip: Point = { ...badgeCenter };

  let dragStart: { x: number; y: number; center: Point; vw: number; vh: number } | null = null;
  let dragging = false;
  let suppressClick = false;
  let visible = true;
  let hoverTimer: ReturnType<typeof setTimeout> | null = null;
  let themeCleanup: (() => void) | null = null;
  // rAF throttle: stash the latest pointer delta and apply once per animation
  // frame, aligning movement to the display refresh. pointermove can fire
  // >100Hz on high-rate devices; this cuts setBadgeCenter calls from N-per-frame
  // to 1. vw/vh are cached at pointerdown so pointermove never reads layout.
  let pendingMove: { dx: number; dy: number } | null = null;
  let moveRaf = 0;

  const host = document.createElement('div');
  host.className = HOST_CLASS;
  host.setAttribute('data-cell-orbital-badge', 'true');
  host.style.position = 'fixed';
  host.style.left = '0';
  host.style.top = '0';
  host.style.width = '0';
  host.style.height = '0';
  host.style.zIndex = BADGE_Z_INDEX;
  host.style.pointerEvents = 'none';

  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = `${tokensCss.replace(/:root/g, ':host')}\n${buildOrbitalBadgeCss()}`;
  shadow.appendChild(style);

  const root = document.createElement('div');
  root.className = 'cell-orbital-badge-root';
  root.setAttribute('data-cell-orbital-badge', 'true');
  root.style.setProperty('--badge-size', `${badgeSize}px`);
  root.style.setProperty('--pointer-size', `${pointerSize}px`);
  shadow.appendChild(root);

  const badge = document.createElement('button');
  badge.className = 'cell-orbital-badge js-cell-orbital-badge';
  badge.setAttribute('data-cell-orbital-badge', 'true');
  badge.setAttribute('aria-label', 'Orbital dictionary pointer');
  badge.setAttribute('aria-pressed', 'false');
  root.appendChild(badge);

  const pointer = document.createElement('span');
  pointer.className = 'cell-orbital-pointer js-cell-orbital-pointer';
  pointer.setAttribute('data-cell-orbital-badge', 'true');
  pointer.setAttribute('aria-hidden', 'true');
  root.appendChild(pointer);

  function setBadgeCenter(center: Point): void {
    badgeCenter = center;
    badge.style.left = `${center.x}px`;
    badge.style.top = `${center.y}px`;
    updatePointerVisual(false);
    if (expanded) {
      options.onTipMoving?.(pointerTip, preset, badgeCenter);
      scheduleHoverNotify();
    }
  }

  function updatePointerVisual(animate: boolean): void {
    let pointerCenter: Point;
    if (!expanded) {
      // When collapsed, center the pointer inside the visible half-moon so it
      // is not clipped by the viewport edge.
      pointerCenter = getCollapsedPointerCenter(badgeCenter, collapsedEdge, badgeSize);
      pointerTip = pointerCenter;
    } else {
      pointerCenter = getPointerTip(badgeCenter, preset, pointerOffset);
      // The lookup point is the outer edge of the pointer, not its center.
      if (preset === 'center') {
        pointerTip = pointerCenter;
      } else {
        const dx = pointerCenter.x - badgeCenter.x;
        const dy = pointerCenter.y - badgeCenter.y;
        const distance = Math.hypot(dx, dy);
        const tipExtension = pointerSize / 2;
        pointerTip = {
          x: pointerCenter.x + (dx / distance) * tipExtension,
          y: pointerCenter.y + (dy / distance) * tipExtension,
        };
      }
    }
    pointer.style.left = `${pointerCenter.x}px`;
    pointer.style.top = `${pointerCenter.y}px`;
    pointer.style.transition = animate
      ? 'opacity 200ms ease, transform 200ms ease, left 200ms ease, top 200ms ease'
      : 'none';
  }

  /** Apply a preset. When `persist` is true, also update `userPreset` so the
   *  user's chosen direction is restored the next time the badge expands. */
  function applyPreset(next: PointerPreset, animate = true, persist = false): void {
    preset = next;
    if (persist) userPreset = next;
    updatePointerVisual(animate);
    badge.setAttribute('aria-pressed', String(expanded));
  }

  function setExpanded(next: boolean, animate = true, edge?: CollapsedEdge): void {
    expanded = next;
    if (expanded) {
      // Restore the user's chosen preset when expanding; do not auto-rotate.
      preset = userPreset;
    } else if (edge) {
      collapsedEdge = edge;
    }
    badge.classList.toggle('cell-orbital-badge--expanded', expanded);
    badge.setAttribute('aria-pressed', String(expanded));
    updatePointerVisual(animate);
    if (!expanded) {
      if (hoverTimer) {
        clearTimeout(hoverTimer);
        hoverTimer = null;
      }
    }
    // Keep the pointer visible: when collapsed it is centered inside the
    // half-moon, when expanded it follows the selected preset.
    pointer.classList.remove('cell-orbital-pointer--hidden');
  }

  function notifyTip(): void {
    if (options.onTipReady) {
      options.onTipReady(pointerTip, preset, badgeCenter);
    }
  }

  function scheduleHoverNotify(): void {
    if (hoverTimer) clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => {
      hoverTimer = null;
      if (expanded && options.onTipHover) {
        options.onTipHover(pointerTip, preset, badgeCenter);
      }
    }, HOVER_DEBOUNCE_MS);
  }

  function toggleVerticalPreset(): void {
    const next: PointerPreset = userPreset === 'top' ? 'bottom' : (userPreset === 'bottom' ? 'center' : 'top');
    applyPreset(next, true, true);
    options.onPresetChange?.(next);
    notifyTip();
    if (options.onDoubleTap) options.onDoubleTap();
  }

  function toggleHorizontalPreset(): void {
    const next: PointerPreset = userPreset === 'left' ? 'right' : (userPreset === 'right' ? 'center' : 'left');
    applyPreset(next, true, true);
    options.onPresetChange?.(next);
    notifyTip();
    if (options.onTripleTap) options.onTripleTap();
  }

  const gestureDetector = createGestureDetector({
    onDoubleTap: () => {
      if (!expanded) return;
      toggleVerticalPreset();
    },
    onTripleTap: () => {
      if (!expanded) return;
      toggleHorizontalPreset();
    },
  });

  /** Apply the cached drag delta. Called from the rAF flush or synchronously on
   *  pointerup. Uses cached vw/vh so no layout reads happen on the hot path. */
  function applyDragMove(dx: number, dy: number): void {
    if (!dragStart) return;
    if (!dragging && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;

    if (!expanded) {
      const movement = getEdgeMovement(collapsedEdge, dx, dy);
      if (movement.inward > EXPAND_THRESHOLD_PX) {
        // User dragged inward far enough — expand the badge.
        dragging = true;
        setExpanded(true, false);
      } else {
        // Otherwise slide along the collapsed edge.
        dragging = true;
        setBadgeCenter(getSlideCenter(collapsedEdge, dragStart.center, dx, dy, badgeSize));
        return;
      }
    }

    if (!dragging) {
      dragging = true;
      setExpanded(true, false);
    }

    // Clamp to the content viewport using cached dims — no layout reads here.
    const maxX = dragStart.vw - badgeSize / 2;
    const maxY = dragStart.vh - badgeSize / 2;
    const nx = Math.max(badgeSize / 2, Math.min(maxX, dragStart.center.x + dx));
    const ny = Math.max(badgeSize / 2, Math.min(maxY, dragStart.center.y + dy));
    setBadgeCenter({ x: nx, y: ny });
  }

  function flushDragMove(): void {
    if (moveRaf) { cancelAnimationFrame(moveRaf); moveRaf = 0; }
    if (pendingMove) {
      const m = pendingMove;
      pendingMove = null;
      applyDragMove(m.dx, m.dy);
    }
  }

  function onBadgePointerDown(e: PointerEvent): void {
    if (e.button !== 0) return;
    dragStart = { x: e.clientX, y: e.clientY, center: { ...badgeCenter }, vw: getClientWidth(), vh: getClientHeight() };
    dragging = false;
    pendingMove = null;
    try { badge.setPointerCapture(e.pointerId); } catch { /* capture may throw on some platforms */ }
  }

  function onBadgePointerMove(e: PointerEvent): void {
    if (!dragStart) return;
    // Stash the latest delta and schedule a single rAF to apply it — never
    // call setBadgeCenter on the pointermove hot path itself.
    pendingMove = { dx: e.clientX - dragStart.x, dy: e.clientY - dragStart.y };
    if (!moveRaf) {
      moveRaf = requestAnimationFrame(() => {
        moveRaf = 0;
        if (pendingMove) {
          const m = pendingMove;
          pendingMove = null;
          applyDragMove(m.dx, m.dy);
        }
      });
    }
  }

  function onBadgePointerUp(e: PointerEvent): void {
    // Apply any pending move synchronously so the final position is current.
    flushDragMove();
    if (dragging) {
      suppressClick = true;
      if (hoverTimer) {
        clearTimeout(hoverTimer);
        hoverTimer = null;
      }

      if (expanded) {
        // Re-use the currently selected preset instead of snapping to the angle
        // toward the viewport center. Animate the pointer to its new position
        // relative to the dragged badge and then lookup the word under the tip.
        updatePointerVisual(true);
        notifyTip();

        // Edge-snap: if the badge is close to a viewport edge, collapse it there.
        const nearest = getNearestEdge(badgeCenter);
        const snapThreshold = badgeSize / 2 + EDGE_SNAP_MARGIN_PX;
        if (nearest.distance <= snapThreshold) {
          const snapped = getEdgeCenter(nearest.edge, badgeCenter, badgeSize);
          applyPreset(getInwardPreset(nearest.edge), false, false);
          setBadgeCenter(snapped);
          setExpanded(false, true, nearest.edge);
        }
      }
      // Collapsed-edge slides do not trigger a lookup; the badge stays on the edge.
    }
    dragging = false;
    dragStart = null;
    pendingMove = null;
    try { badge.releasePointerCapture(e.pointerId); } catch { /* noop */ }
  }

  function onBadgePointerCancel(): void {
    if (moveRaf) { cancelAnimationFrame(moveRaf); moveRaf = 0; }
    dragging = false;
    dragStart = null;
    pendingMove = null;
  }

  function onBadgeClick(): void {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    gestureDetector.onPointerUp(performance.now());
  }

  badge.addEventListener('pointerdown', onBadgePointerDown);
  badge.addEventListener('pointermove', onBadgePointerMove);
  badge.addEventListener('pointerup', onBadgePointerUp);
  badge.addEventListener('pointercancel', onBadgePointerCancel);
  badge.addEventListener('click', onBadgeClick);

  function getFullscreenContainer(): Element {
    return document.fullscreenElement ?? (document.body ?? document.documentElement);
  }

  function attachHost(): void {
    getFullscreenContainer().appendChild(host);
    initTheme();
  }

  function onFullscreenChange(): void {
    const container = getFullscreenContainer();
    if (host.parentElement !== container) {
      container.appendChild(host);
    }
  }

  async function refreshTheme(): Promise<void> {
    const data = await getStorage<Record<string, unknown>>(STORAGE_KEYS.THEME_MODE);
    const mode = data[STORAGE_KEYS.THEME_MODE] as ThemeMode | undefined;
    root.setAttribute('data-theme', resolveTheme(mode));
  }

  function initTheme(): void {
    const syncDefault = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    root.setAttribute('data-theme', syncDefault);
    void refreshTheme();

    const onThemeChange = (changes: Record<string, chrome.storage.StorageChange>, area: string): void => {
      if (area !== 'local') return;
      if (STORAGE_KEYS.THEME_MODE in changes) void refreshTheme();
    };
    onStorageChanged(onThemeChange);

    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onSystemChange = (): void => { void refreshTheme(); };
    mql.addEventListener('change', onSystemChange);

    themeCleanup = (): void => {
      removeOnStorageChangedListener(onThemeChange);
      mql.removeEventListener('change', onSystemChange);
    };
  }

  if (document.readyState === 'complete') {
    attachHost();
  } else {
    window.addEventListener('load', () => attachHost(), { once: true });
  }
  document.addEventListener('fullscreenchange', onFullscreenChange);

  // Initial render.
  setBadgeCenter(badgeCenter);
  setExpanded(false, false, 'right');

  return {
    setPreset(next: PointerPreset) {
      applyPreset(next, true, true);
    },
    getState() {
      return { expanded, preset: userPreset };
    },
    show() {
      if (visible) return;
      visible = true;
      host.style.display = '';
    },
    hide() {
      visible = false;
      host.style.display = 'none';
    },
    destroy() {
      if (moveRaf) { cancelAnimationFrame(moveRaf); moveRaf = 0; }
      themeCleanup?.();
      themeCleanup = null;
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      gestureDetector.destroy();
      host.remove();
    },
  };
}
