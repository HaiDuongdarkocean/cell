// popupShell — spec §4.6.3 A4, §9: Popup Dictionary container with Shadow DOM,
// auto-position, resize, and dismiss (Esc + click outside).
//
// Content-script isolated world — vanilla DOM, no React (same as subtitleUI.ts).
// Shadow DOM isolates popup CSS from page CSS.
//
// Single-source tokens + button classes: imported from shared/styles via ?raw,
// same files React uses. No --dp-* duplicates — uses --color-* directly.

import tokensCss from '@/shared/styles/tokens.css?raw';
import componentsCss from '@/shared/styles/components.css?raw';
import popupDictCss from './popupDictionary.css?raw';
import { getStorage, onStorageChanged, removeOnStorageChangedListener } from '@/shared/lib/chrome-apis';
import { ICON_CATALOG } from '@/shared/icons';
import { STORAGE_KEYS } from '@/shared/config/config';
//
// Layout:
// ┌─────────────────────────────────┐
// │ Header (term + reading + freq)  │  ← Task 4.3
// │ ─────────────────────────────── │
// │ Definitions (always visible)    │  ← Task 4.3
// │ ─────────────────────────────── │
// │ [Tab content — lazy]            │  ← Task 4.4/4.5
// │ ─────────────────────────────── │
// │ Footer (status cycle + QuickAdd)│  ← Task 4.3
// └─────────────────────────────────┘
//                          [resize] ↘

const POPUP_Z_INDEX = '2147483647'; // max int — above everything
const VIEWPORT_MARGIN = 8;



/** Popup position strategy (spec: auto-position tránh overflow). */
export interface PopupPosition {
  readonly left: number;
  readonly top: number;
}

/** Anchor rectangle for popup positioning (token's bounding box). */
export interface PopupAnchor {
  readonly top: number;
  readonly left: number;
  readonly right: number;
  readonly bottom: number;
}

/** Optional pointer hint so the popup can avoid covering the pointer/badge. */
export interface PopupPointerHint {
  readonly tip: { readonly x: number; readonly y: number };
  readonly badgeCenter?: { readonly x: number; readonly y: number };
  readonly badgeRadius?: number;
  readonly pointerRadius?: number;
}

/** Bounding box of the line containing the looked-up token.
 *  The popup must NEVER overlap this rect (hard constraint — "không che chữ
 *  cùng hàng"). If absent, falls back to the anchor rect itself. */
export interface PopupLineRect {
  readonly top: number;
  readonly left: number;
  readonly right: number;
  readonly bottom: number;
}

/** Popup size (sticky — persisted to chrome.storage.local). */
export interface PopupSize {
  readonly width: number;
  readonly maxHeight: number;
}

/**
 * Get the appropriate mount parent for the popup host.
 * In fullscreen mode, only the fullscreen element and its descendants render.
 * If fullscreen element is a <video> (replaced element — no DOM children rendered),
 * use its parent instead.
 * ponytail ceiling: if <video> has no wrapper parent, popup won't show in fullscreen.
 */
function getMountParent(): HTMLElement {
  const fsElement = document.fullscreenElement as HTMLElement | null;
  if (!fsElement) return document.body;
  if (fsElement.tagName === 'VIDEO') {
    return fsElement.parentElement ?? document.body;
  }
  return fsElement;
}

/** Clamp popup size to viewport. */
export function clampPopupSize(size: PopupSize, viewportWidth: number, viewportHeight: number): PopupSize {
  const width = Math.min(size.width, viewportWidth - VIEWPORT_MARGIN * 2);
  const maxHeight = Math.min(size.maxHeight, Math.round(viewportHeight * 0.7));
  return { width: Math.max(320, width), maxHeight: Math.max(200, maxHeight) };
}

/** Final clamp to keep the popup inside the viewport. */
function finalizePosition(
  left: number,
  top: number,
  popupWidth: number,
  popupHeight: number,
  viewportWidth: number,
  viewportHeight: number,
): PopupPosition {
  const maxFitWidth = viewportWidth - VIEWPORT_MARGIN * 2;
  const maxFitHeight = viewportHeight - VIEWPORT_MARGIN * 2;
  if (popupWidth <= maxFitWidth) {
    if (left < VIEWPORT_MARGIN) left = VIEWPORT_MARGIN;
    if (left + popupWidth > viewportWidth - VIEWPORT_MARGIN) {
      left = viewportWidth - popupWidth - VIEWPORT_MARGIN;
    }
  } else {
    left = VIEWPORT_MARGIN;
  }
  if (popupHeight <= maxFitHeight) {
    if (top + popupHeight > viewportHeight - VIEWPORT_MARGIN) {
      top = viewportHeight - popupHeight - VIEWPORT_MARGIN;
    }
    if (top < VIEWPORT_MARGIN) top = VIEWPORT_MARGIN;
  } else {
    top = VIEWPORT_MARGIN;
  }
  return { left: Math.round(left), top: Math.round(top) };
}

type PreferredPlacement = 'top' | 'bottom' | 'left' | 'right';

function derivePreferredPlacement(
  pointer: PopupPointerHint,
  anchor: PopupAnchor,
): PreferredPlacement | null {
  const originX = pointer.badgeCenter?.x ?? (anchor.left + anchor.right) / 2;
  const originY = pointer.badgeCenter?.y ?? (anchor.top + anchor.bottom) / 2;
  const dx = pointer.tip.x - originX;
  const dy = pointer.tip.y - originY;
  if (Math.hypot(dx, dy) < 4) return null;
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? 'right' : 'left';
  }
  return dy > 0 ? 'bottom' : 'top';
}

function rectContainsPoint(rx: number, ry: number, rw: number, rh: number, px: number, py: number): boolean {
  return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
}

function rectIntersectsCircle(rx: number, ry: number, rw: number, rh: number, cx: number, cy: number, r: number): boolean {
  const closestX = Math.max(rx, Math.min(cx, rx + rw));
  const closestY = Math.max(ry, Math.min(cy, ry + rh));
  return Math.hypot(closestX - cx, closestY - cy) < r;
}

function rectanglesOverlap(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number,
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

interface ScoredPlacement {
  readonly name: PreferredPlacement;
  readonly left: number;
  readonly top: number;
  readonly rawLeft: number;
  readonly rawTop: number;
  readonly score: number;
}

/** Cross-axis alignment variants for shift (Floating UI "shift" inspired).
 *  For bottom/top: shifts horizontally (left↔right).
 *  For left/right: shifts vertically (up↔down). */
type ShiftVariant = 'start' | 'center' | 'end';

function rawPlacementFits(
  name: PreferredPlacement,
  rawLeft: number,
  rawTop: number,
  popupWidth: number,
  popupHeight: number,
  viewportWidth: number,
  viewportHeight: number,
): boolean {
  if (name === 'bottom' || name === 'top') {
    const verticalFits = name === 'bottom'
      ? rawTop + popupHeight <= viewportHeight - VIEWPORT_MARGIN
      : rawTop >= VIEWPORT_MARGIN;
    return verticalFits;
  }
  // Side placements must fit horizontally; vertical clamping is allowed.
  return rawLeft >= VIEWPORT_MARGIN && rawLeft + popupWidth <= viewportWidth - VIEWPORT_MARGIN;
}

function scorePlacement(
  name: PreferredPlacement,
  pos: { left: number; top: number },
  rawLeft: number,
  rawTop: number,
  popupWidth: number,
  popupHeight: number,
  preferred: PreferredPlacement | null,
  pointer: PopupPointerHint | undefined,
  anchor: PopupAnchor,
  lineRect: PopupLineRect | null,
): number {
  const GAP = 4;
  let score = 0;

  if (name === preferred) score -= 50;
  // Prefer below the token/cue when no pointer preference (image-2: hang under the line).
  if (!preferred && name === 'bottom') score -= 20;
  score += (Math.abs(pos.left - rawLeft) + Math.abs(pos.top - rawTop)) * 0.5;

  // Avoid covering the pointer (treat the tip as a circle with a small gap).
  if (pointer) {
    const pr = Number.isFinite(pointer.pointerRadius) ? pointer.pointerRadius! : 6;
    const pointerMargin = pr + GAP;
    if (rectContainsPoint(pos.left - pointerMargin, pos.top - pointerMargin, popupWidth + pointerMargin * 2, popupHeight + pointerMargin * 2, pointer.tip.x, pointer.tip.y)) {
      score += 1000;
    }
  }

  // Avoid covering the orbital badge (treated as a circle with a small gap).
  if (pointer?.badgeCenter && pointer.badgeRadius != null && pointer.badgeRadius > 0) {
    const r = pointer.badgeRadius + GAP;
    if (rectIntersectsCircle(pos.left - GAP, pos.top - GAP, popupWidth + GAP * 2, popupHeight + GAP * 2, pointer.badgeCenter.x, pointer.badgeCenter.y, r)) {
      score += 500;
    }
  }

  // HARD: Never overlap the looked-up token itself (LUÔN LUÔN không che chữ đang lookup).
  const anchorW = anchor.right - anchor.left;
  const anchorH = anchor.bottom - anchor.top;
  if (rectanglesOverlap(pos.left, pos.top, popupWidth, popupHeight, anchor.left, anchor.top, anchorW, anchorH)) {
    score += 2000;
  }

  // HARD: Never overlap the line/cue band (không che chữ cùng hàng / neighbors).
  // Band is full viewport width so left/right placements cannot cover same-row text.
  if (lineRect) {
    const bandTop = lineRect.top;
    const bandBottom = lineRect.bottom;
    if (pos.top < bandBottom && pos.top + popupHeight > bandTop) {
      score += 1500;
    }
  }

  return score;
}

/** Compute the raw left for a horizontal shift variant (bottom/top sides).
 *  start: align popup left with anchor left
 *  center: center popup over anchor
 *  end: align popup right with anchor right */
function shiftHorizontal(shift: ShiftVariant, anchor: PopupAnchor, popupWidth: number): number {
  const anchorCenter = (anchor.left + anchor.right) / 2;
  if (shift === 'start') return anchor.left;
  if (shift === 'end') return anchor.right - popupWidth;
  return anchorCenter - popupWidth / 2;
}

/** Compute the raw top for a vertical shift variant (left/right sides).
 *  start: align popup top with anchor top
 *  center: center popup over anchor
 *  end: align popup bottom with anchor bottom */
function shiftVertical(shift: ShiftVariant, anchor: PopupAnchor, popupHeight: number): number {
  const anchorCenter = (anchor.top + anchor.bottom) / 2;
  if (shift === 'start') return anchor.top;
  if (shift === 'end') return anchor.bottom - popupHeight;
  return anchorCenter - popupHeight / 2;
}

/**
 * Compute popup position anchored to a token's bounding box.
 *
 * Strategy (flip + shift + score-based, inspired by Floating UI):
 * 1. If a pointer hint is provided, derive the side the pointer is coming from
 *    (away from the badge) so the popup does not cover the pointer or badge.
 * 2. For each of 4 sides × 3 shift variants (start/center/end) = 12 candidates:
 *    - Compute raw position (anchored to token edge + shift offset)
 *    - Clamp to viewport
 *    - Score by: HARD (overlap anchor +2000, overlap lineRect +1500),
 *      SOFT (overlap pointer +1000, overlap badge +500, distance from raw)
 *    - Strongly prefer placements that fit without clamping (+500 penalty)
 * 3. The lowest score wins. This naturally:
 *    - Avoids covering the looked-up token (HARD)
 *    - Avoids covering the line containing the token (HARD, "không che chữ cùng hàng")
 *    - Avoids covering the pointer and orbital badge (SOFT)
 *    - Stays close to the token ("bám sát")
 * 4. Fallback: if all candidates violate HARD constraints, the least-bad one
 *    is still chosen (clamped to viewport).
 *
 * @param anchorTop    - Pixel Y of the token's top edge.
 * @param anchorLeft   - Pixel X of the token's left edge.
 * @param anchorRight  - Pixel X of the token's right edge.
 * @param anchorBottom - Pixel Y of the token's bottom edge.
 * @param popupWidth   - Popup width in px.
 * @param viewportWidth  - Window inner width.
 * @param viewportHeight - Window inner height.
 * @param popupHeight    - Estimated popup height (for flip logic). Defaults to 300.
 * @param pointer        - Optional pointer tip + badge center + badge radius + pointer radius to avoid covering them.
 * @param lineRect       - Optional bounding box of the line containing the token. The popup avoids overlapping it.
 */
export function computePopupPosition(
  anchorTop: number,
  anchorLeft: number,
  anchorRight: number,
  anchorBottom: number,
  popupWidth: number,
  viewportWidth: number,
  viewportHeight: number,
  popupHeight: number = 300,
  pointer?: PopupPointerHint,
  lineRect?: PopupLineRect | null,
): PopupPosition {
  const GAP = 4;
  const anchor: PopupAnchor = { top: anchorTop, left: anchorLeft, right: anchorRight, bottom: anchorBottom };
  const line = lineRect ?? null;

  const preferred = pointer ? derivePreferredPlacement(pointer, anchor) : null;
  const order: PreferredPlacement[] = ['bottom', 'top', 'right', 'left'];
  if (preferred) {
    const idx = order.indexOf(preferred);
    if (idx >= 0) {
      order.splice(idx, 1);
      order.unshift(preferred);
    }
  }

  let best: ScoredPlacement | null = null;
  const shifts: ShiftVariant[] = ['start', 'center', 'end'];

  for (const name of order) {
    for (const shift of shifts) {
      let rawLeft = 0;
      let rawTop = 0;

      if (name === 'bottom') {
        rawLeft = shiftHorizontal(shift, anchor, popupWidth);
        // Clear the whole line/cue band (not just the word).
        rawTop = line ? Math.max(anchor.bottom + GAP, line.bottom + GAP) : anchor.bottom + GAP;
      } else if (name === 'top') {
        rawLeft = shiftHorizontal(shift, anchor, popupWidth);
        const bandTop = line ? Math.min(anchor.top, line.top) : anchor.top;
        rawTop = bandTop - popupHeight - GAP;
      } else if (name === 'right') {
        // Keep horizontal beside the word, but park vertically off the line band
        // so same-row neighbors stay clickable.
        rawLeft = anchor.right + GAP;
        if (line) {
          rawTop = shift === 'end'
            ? line.top - popupHeight - GAP
            : line.bottom + GAP;
        } else {
          rawTop = shiftVertical(shift, anchor, popupHeight);
        }
      } else if (name === 'left') {
        rawLeft = anchor.left - popupWidth - GAP;
        if (line) {
          rawTop = shift === 'end'
            ? line.top - popupHeight - GAP
            : line.bottom + GAP;
        } else {
          rawTop = shiftVertical(shift, anchor, popupHeight);
        }
      }

      const fits = rawPlacementFits(name, rawLeft, rawTop, popupWidth, popupHeight, viewportWidth, viewportHeight);
      const clamped = finalizePosition(rawLeft, rawTop, popupWidth, popupHeight, viewportWidth, viewportHeight);
      const pos = fits ? { left: clamped.left, top: clamped.top } : clamped;
      const score = scorePlacement(name, pos, rawLeft, rawTop, popupWidth, popupHeight, preferred, pointer, anchor, line);
      // Strongly prefer a placement that fits without clamping.
      const finalScore = fits ? score : score + 500;

      if (!best || finalScore < best.score) {
        best = { name, left: pos.left, top: pos.top, rawLeft, rawTop, score: finalScore };
      }
    }
  }

  return { left: best!.left, top: best!.top };
}

/** Popup shell — manages Shadow DOM root, positioning, resize, dismiss. */
export class PopupShell {
  private host: HTMLDivElement | null = null;
  private shadow: ShadowRoot | null = null;
  private container: HTMLDivElement | null = null;
  private contentEl: HTMLDivElement | null = null;
  private resizeHandle: HTMLDivElement | null = null;
  private size: PopupSize;
  private isResizing = false;
  private resizeStartX = 0;
  private resizeStartY = 0;
  private resizeStartWidth = 0;
  private resizeStartHeight = 0;
  private lastAnchor: { top: number; left: number; right: number; bottom: number } | null = null;
  private lastLineRect: PopupLineRect | null = null;
  private lastPointer: PopupPointerHint | null = null;
  private dragOffset: { x: number; y: number } = { x: 0, y: 0 };
  private dragStart: { x: number; y: number } | null = null;
  private dragOffsetStart: { x: number; y: number } = { x: 0, y: 0 };
  // Cached at drag start so applyPosition (called each pointermove) never reads
  // offsetWidth/offsetHeight (forced reflow). The popup size is stable during a
  // drag — only its position changes.
  private dragCachedWidth = 0;
  private dragCachedHeight = 0;
  private dragCachedVw = 0;
  private dragCachedVh = 0;
  // rAF throttle for drag + resize: stash the latest pointer delta and apply
  // once per animation frame, aligning to the display refresh. pointermove can
  // fire >100Hz; this cuts style recalcs from N-per-frame to 1.
  private dragPending: { dx: number; dy: number } | null = null;
  private dragRaf = 0;
  private resizePending: { dx: number; dy: number } | null = null;
  private resizeRaf = 0;
  private previouslyFocused: Element | null = null;
  private themeCleanup: (() => void) | null = null;
  private readonly onDismiss: () => void;
  private readonly onResizeComplete: (size: PopupSize) => void;
  private readonly boundKeyDown: (e: KeyboardEvent) => void;
  private readonly boundClickOutside: (e: MouseEvent) => void;
  private readonly boundResizeStart: (e: PointerEvent) => void;
  private readonly boundResizeMove: (e: PointerEvent) => void;
  private readonly boundResizeEnd: (e: PointerEvent) => void;
  private readonly boundFullscreenChange: () => void;
  private readonly boundPointerDown: (e: PointerEvent) => void;
  private readonly boundPointerMove: (e: PointerEvent) => void;
  private readonly boundPointerUp: (e: PointerEvent) => void;

  constructor(
    initialSize: PopupSize,
    onDismiss: () => void,
    onResizeEnd: (size: PopupSize) => void,
  ) {
    this.size = initialSize;
    this.onDismiss = onDismiss;
    this.onResizeComplete = onResizeEnd;
    this.boundKeyDown = this.onKeyDown.bind(this);
    this.boundClickOutside = this.onClickOutside.bind(this);
    this.boundResizeStart = this.onResizeStart.bind(this);
    this.boundResizeMove = this.onResizeMove.bind(this);
    this.boundResizeEnd = this.onResizeEnd.bind(this);
    this.boundFullscreenChange = this.onFullscreenChange.bind(this);
    this.boundPointerDown = this.onPointerDown.bind(this);
    this.boundPointerMove = this.onPointerMove.bind(this);
    this.boundPointerUp = this.onPointerUp.bind(this);
  }

  /** Mount the popup shell into the document body (or fullscreen element) with Shadow DOM. */
  mount(): ShadowRoot {
    if (this.shadow) return this.shadow;

    // Host element — lives in the light DOM but is visually invisible
    // (the Shadow DOM content is what's visible).
    this.host = document.createElement('div');
    this.host.className = 'js-cell-popup-host';
    this.host.style.position = 'fixed';
    this.host.style.left = '0';
    this.host.style.top = '0';
    this.host.style.width = '0';
    this.host.style.height = '0';
    this.host.style.zIndex = POPUP_Z_INDEX;
    this.host.style.pointerEvents = 'none'; // host itself doesn't capture

    // Fullscreen-safe mount: append host to fullscreen element (or its parent
    // if it's a <video> — replaced elements don't render DOM children).
    // ponytail ceiling: if <video> has no wrapper, popup won't show in fullscreen.
    getMountParent().appendChild(this.host);

    // Shadow DOM — isolates CSS from page.
    this.shadow = this.host.attachShadow({ mode: 'open' });

    // Inject shared design-system tokens + button classes (single source with
    // React surfaces) + popup-specific CSS. Shadow DOM doesn't inherit from
    // host page, so we inject tokens.css + components.css via ?raw import.
    // tokens.css defines :root + [data-theme="dark"] — inside Shadow DOM we
    // remap :root to :host so tokens apply within the shadow boundary.
    const styleEl = document.createElement('style');
    styleEl.textContent = tokensCss
      .replace(/:root/g, ':host')
      + componentsCss
      + popupDictCss;
    this.shadow.appendChild(styleEl);

    // Container — the visible popup shell. Does NOT scroll itself; an inner
    // contentEl handles scrolling so the resize handle (a sibling of contentEl)
    // stays pinned at the bottom-right corner instead of scrolling with content.
    this.container = document.createElement('div');
    this.container.className = 'cell-popup js-cell-popup';
    this.container.setAttribute('role', 'dialog');
    this.container.setAttribute('aria-modal', 'true');
    this.container.setAttribute('tabindex', '-1');
    this.container.setAttribute('aria-label', 'Dictionary popup');
    this.container.style.position = 'fixed';
    this.container.style.pointerEvents = 'auto';
    this.container.style.width = `${this.size.width}px`;
    this.container.style.height = `${this.size.maxHeight}px`;
    this.container.style.display = 'flex';
    // user-select is inherited — fullscreen video containers often set
    // user-select:none, which Shadow DOM inherits. Force text so definitions
    // are selectable.
    this.container.style.userSelect = 'text';
    this.container.style.webkitUserSelect = 'text';
    this.shadow.appendChild(this.container);
    this.container.addEventListener('pointerdown', this.boundPointerDown);

    // Theme: set data-theme on container so [data-theme="dark"] selectors in
    // tokens.css apply inside Shadow DOM. Sync initial from prefers-color-scheme
    // to avoid FOUC; async-correct from chrome.storage.local.themeMode.
    // Listens to storage.onChanged + prefers-color-scheme for real-time switching.
    this.initTheme();
    // Inner scroll wrapper — content renders here, this is what scrolls.
    this.contentEl = document.createElement('div');
    this.contentEl.className = 'cell-popup__content js-cell-content';
    this.container.appendChild(this.contentEl);

    // Resize handle (bottom-right corner) — sibling of contentEl, NOT inside
    // the scroll wrapper, so it stays pinned at the shell's bottom-right.
    this.resizeHandle = document.createElement('div');
    this.resizeHandle.className = 'cell-popup__resize js-cell-resize';
    this.resizeHandle.innerHTML = ICON_CATALOG.resize.svg;
    this.container.appendChild(this.resizeHandle);
    // Pointer events handle both mouse + touch (touch-action:none prevents
    // the browser from scrolling/zooming during resize drag on touch screens).
    this.resizeHandle.style.touchAction = 'none';
    this.resizeHandle.addEventListener('pointerdown', this.boundResizeStart);

    // Dismiss listeners.
    // keydown uses capture:true so we intercept Esc before the browser's
    // fullscreen-exit handler (which also listens on capture). Without this,
    // Esc exits fullscreen first and the popup only closes on the second Esc.
    document.addEventListener('keydown', this.boundKeyDown, true);
    document.addEventListener('mousedown', this.boundClickOutside, true); // capture — check before target
    // Re-parent host when fullscreen changes (host must live inside fullscreen element).
    document.addEventListener('fullscreenchange', this.boundFullscreenChange);

    return this.shadow;
  }

  /** Position the popup anchored to a token's bounding box.
   *  lineRect: bounding box of the line containing the token — the popup avoids
   *  overlapping it ("không che chữ cùng hàng"). If omitted, falls back to anchor. */
  setPosition(anchor: PopupAnchor, pointer?: PopupPointerHint, lineRect?: PopupLineRect | null): void {
    if (!this.container) return;
    this.lastAnchor = { top: anchor.top, left: anchor.left, right: anchor.right, bottom: anchor.bottom };
    this.lastLineRect = lineRect ?? null;
    this.lastPointer = pointer ?? null;
    // New lookup → start from the anchored position, not the previous drag offset.
    this.dragOffset = { x: 0, y: 0 };
    this.applyPosition();
  }

  /** Re-position using the last anchor (after content height changes). */
  rePosition(): void {
    if (!this.container || !this.lastAnchor) return;
    this.applyPosition();
  }

  private applyPosition(): void {
    if (!this.container || !this.lastAnchor) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // If container is hidden (display:none), offsetHeight=0 → use maxHeight fallback.
    // setPosition is now called before show() so the initial position is set
    // without animating; visibility:hidden still contributes to layout.
    const estHeight = this.container.offsetHeight > 0
      ? Math.min(this.container.offsetHeight, this.size.maxHeight)
      : Math.min(this.size.maxHeight, 300);
    const pos = computePopupPosition(
      this.lastAnchor.top, this.lastAnchor.left, this.lastAnchor.right, this.lastAnchor.bottom,
      this.size.width, vw, vh, estHeight,
      this.lastPointer ?? undefined,
      this.lastLineRect,
    );
    // Apply any user drag offset and keep the popup inside the viewport.
    const width = this.container.offsetWidth || this.size.width;
    const height = this.container.offsetHeight || estHeight;
    const left = Math.max(VIEWPORT_MARGIN, Math.min(vw - width - VIEWPORT_MARGIN, pos.left + this.dragOffset.x));
    const top = Math.max(VIEWPORT_MARGIN, Math.min(vh - height - VIEWPORT_MARGIN, pos.top + this.dragOffset.y));
    this.container.style.left = `${left}px`;
    this.container.style.top = `${top}px`;
    // Shrink popup height to fit the viewport so it never overflows.
    // The user wants the popup to "thu nhỏ lại" when there isn't enough space.
    const availableHeight = vh - top - VIEWPORT_MARGIN;
    const clampedHeight = Math.max(200, Math.min(this.size.maxHeight, availableHeight));
    this.container.style.height = `${clampedHeight}px`;
  }

  /** Fast-path position update during drag — uses cached dims (vw/vh/width/height)
   *  captured at pointerdown so no layout reads happen on the pointermove hot
   *  path. Only the drag offset changes between calls; the anchor-based base
   *  position is computed once at drag start and reused. */
  private applyDragPosition(): void {
    if (!this.container || !this.lastAnchor) return;
    // Recompute the base position with cached dims + cached anchor — the anchor
    // does not change mid-drag, and using cached vw/vh avoids reading
    // window.innerWidth each move.
    const pos = computePopupPosition(
      this.lastAnchor.top, this.lastAnchor.left, this.lastAnchor.right, this.lastAnchor.bottom,
      this.size.width, this.dragCachedVw, this.dragCachedVh, this.dragCachedHeight,
      this.lastPointer ?? undefined,
      this.lastLineRect,
    );
    const left = Math.max(VIEWPORT_MARGIN, Math.min(this.dragCachedVw - this.dragCachedWidth - VIEWPORT_MARGIN, pos.left + this.dragOffset.x));
    const top = Math.max(VIEWPORT_MARGIN, Math.min(this.dragCachedVh - this.dragCachedHeight - VIEWPORT_MARGIN, pos.top + this.dragOffset.y));
    this.container.style.left = `${left}px`;
    this.container.style.top = `${top}px`;
    const availableHeight = this.dragCachedVh - top - VIEWPORT_MARGIN;
    const clampedHeight = Math.max(200, Math.min(this.size.maxHeight, availableHeight));
    this.container.style.height = `${clampedHeight}px`;
  }

  /** Get the Shadow DOM root (for content rendering). */
  getShadowRoot(): ShadowRoot | null {
    return this.shadow;
  }

  /** Get the content element (for rendering). This is the inner
   *  scroll wrapper, NOT the outer shell — the resize handle lives on the
   *  shell as a sibling, so clearing this element leaves the handle intact. */
  getContainer(): HTMLDivElement | null {
    return this.contentEl;
  }

  /** Get the outer popup's bounding rect, useful for hit-testing against
   *  the orbital pointer while the popup is visible. */
  getPopupRect(): DOMRect | null {
    return this.container?.getBoundingClientRect() ?? null;
  }

  /** Update popup size. */
  setSize(size: PopupSize): void {
    this.size = size;
    if (this.container) {
      this.container.style.width = `${size.width}px`;
      this.container.style.maxHeight = `${size.maxHeight}px`;
    }
  }

  /** Update the dismiss callback (used when showPopup is called multiple
   *  times and the caller's onDismiss closure changes). */
  setOnDismiss(onDismiss: () => void): void {
    (this as unknown as { onDismiss: () => void }).onDismiss = onDismiss;
  }

  /** Update the resize-complete callback. */
  setOnResizeEnd(onResizeEnd: (size: PopupSize) => void): void {
    (this as unknown as { onResizeComplete: (size: PopupSize) => void }).onResizeComplete = onResizeEnd;
  }

  /** Show the popup. Adds the visible class so CSS transitions opacity + transform
   *  and enables left/top/width/height transitions for subsequent moves.
   *  Locks Escape key via Keyboard Lock API when in fullscreen. */
  show(): void {
    if (this.container) {
      this.container.classList.add('cell-popup--visible');
      // Point aria-labelledby at the winner term when rendered.
      const term = this.shadow?.getElementById('cell-popup-term');
      if (term) {
        this.container.setAttribute('aria-labelledby', 'cell-popup-term');
        this.container.removeAttribute('aria-label');
      }
      // Trap focus inside the popup and restore on close (WCAG AA).
      this.previouslyFocused = document.activeElement;
      this.container.focus({ preventScroll: true });
    }
    // ponytail: Keyboard Lock API requires fullscreen + user gesture.
    // show() is called from a click handler (user gesture active).
    // If lock fails (unsupported/non-fullscreen), Esc still works —
    // it just exits fullscreen first, then closes popup on 2nd Esc.
    const kb = (navigator as { keyboard?: { lock: (keys: string[]) => Promise<void>; unlock: () => void } }).keyboard;
    if (document.fullscreenElement && kb) {
      void kb.lock(['Escape']).catch(() => {});
    }
  }

  /** Hide the popup. Removing the visible class triggers the CSS fade-out
   *  (opacity + transform) and hides the popup from the a11y tree via visibility.
   *  Unlocks Escape key so browser default Esc (exit fullscreen) works again. */
  hide(): void {
    if (this.container) {
      this.container.classList.remove('cell-popup--visible');
    }
    this.restoreFocus();
    const kb = (navigator as { keyboard?: { lock: (keys: string[]) => Promise<void>; unlock: () => void } }).keyboard;
    if (kb) {
      try { kb.unlock(); } catch { /* not locked */ }
    }
  }

  /** Whether the popup is currently visible to the user. */
  isVisible(): boolean {
    return this.container?.classList.contains('cell-popup--visible') ?? false;
  }

  /** Initialize theme detection + listeners. Called once in mount(). */
  private initTheme(): void {
    if (!this.container) return;

    // Sync initial — prefers-color-scheme avoids FOUC for 'system' mode users.
    const syncDefault = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    this.container.setAttribute('data-theme', syncDefault);

    // Async-correct from storage.
    this.refreshTheme();

    // Re-resolve when themeMode changes in storage (user toggled in settings).
    const onThemeChange = (changes: Record<string, chrome.storage.StorageChange>, area: string): void => {
      if (area !== 'local') return;
      if (STORAGE_KEYS.THEME_MODE in changes) this.refreshTheme();
    };
    onStorageChanged(onThemeChange);

    // Re-resolve when OS theme changes (matters when mode='system').
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onSystemChange = (): void => { void this.refreshTheme(); };
    mql.addEventListener('change', onSystemChange);

    this.themeCleanup = (): void => {
      removeOnStorageChangedListener(onThemeChange);
      mql.removeEventListener('change', onSystemChange);
    };
  }

  /** Read themeMode from storage, resolve system mode, set data-theme on container. */
  private async refreshTheme(): Promise<void> {
    if (!this.container) return;
    const data = await getStorage<Record<string, unknown>>(STORAGE_KEYS.THEME_MODE);
    if (!this.container) return; // re-check after await — destroy() may have nulled it
    const mode = data[STORAGE_KEYS.THEME_MODE] as 'light' | 'dark' | 'system' | undefined;
    const resolved = mode === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : (mode ?? 'dark'); // DEFAULT_THEME_MODE = 'dark'
    this.container.setAttribute('data-theme', resolved);
  }

  /** Unmount the popup + remove all listeners. */
  destroy(): void {
    if (this.dragRaf) { cancelAnimationFrame(this.dragRaf); this.dragRaf = 0; }
    if (this.resizeRaf) { cancelAnimationFrame(this.resizeRaf); this.resizeRaf = 0; }
    document.removeEventListener('keydown', this.boundKeyDown, true);
    document.removeEventListener('mousedown', this.boundClickOutside, true);
    document.removeEventListener('fullscreenchange', this.boundFullscreenChange);
    if (this.resizeHandle) {
      this.resizeHandle.removeEventListener('pointerdown', this.boundResizeStart);
    }
    document.removeEventListener('pointermove', this.boundResizeMove);
    document.removeEventListener('pointerup', this.boundResizeEnd);
    this.container?.removeEventListener('pointerdown', this.boundPointerDown);
    this.container?.removeEventListener('pointermove', this.boundPointerMove);
    this.container?.removeEventListener('pointerup', this.boundPointerUp);
    this.themeCleanup?.();
    this.themeCleanup = null;
    this.restoreFocus();
    if (this.host && this.host.parentNode) {
      this.host.parentNode.removeChild(this.host);
    }
    this.host = null;
    this.shadow = null;
    this.container = null;
    this.contentEl = null;
    this.resizeHandle = null;
  }

  /** Re-parent host into fullscreen element (or back to body) on fullscreen change. */
  private onFullscreenChange(): void {
    if (!this.host) return;
    const mountParent = getMountParent();
    if (this.host.parentNode !== mountParent) {
      mountParent.appendChild(this.host);
    }
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (!this.container?.classList.contains('cell-popup--visible')) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.onDismiss();
      return;
    }
    if (e.key === 'Tab') {
      // Focus trap: Tab/Shift+Tab cycles inside the popup (WCAG AA).
      const active = this.shadow?.activeElement as HTMLElement | null;
      if (!active || !this.container?.contains(active)) return;
      const focusable = this.getFocusableElements();
      if (focusable.length === 0) return;
      const currentIndex = focusable.indexOf(active);
      let nextIndex: number;
      if (e.shiftKey) {
        nextIndex = currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1;
      } else {
        nextIndex = currentIndex < 0 || currentIndex >= focusable.length - 1 ? 0 : currentIndex + 1;
      }
      e.preventDefault();
      e.stopPropagation();
      focusable[nextIndex]?.focus();
    }
  }

  private onClickOutside(e: MouseEvent): void {
    if (!this.container?.classList.contains('cell-popup--visible')) return;
    if (!this.host) return;
    const composedPath = e.composedPath();
    if (!composedPath.includes(this.host)) {
      // Don't dismiss if clicking on a subtitle token span (.js-cell-token) —
      // that triggers a new lookup, not a dismiss.
      const target = e.target as HTMLElement | null;
      if (target?.closest?.('.js-cell-token')) return;
      // Dismiss on any other outside click. Web text lookups that fire on
      // mouseup will re-show the popup (minimal 1-frame flicker, acceptable
      // trade-off vs. the previous isPointOnText guard which blocked dismiss
      // on any text node — including YouTube UI, comments, titles — making
      // the popup impossible to close by clicking "empty" space that still
      // had text behind it).
      this.onDismiss();
    }
  }

  private onResizeStart(e: PointerEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.isResizing = true;
    this.resizeStartX = e.clientX;
    this.resizeStartY = e.clientY;
    this.resizeStartWidth = this.size.width;
    // Capture actual rendered height — container may be shorter than maxHeight.
    this.resizeStartHeight = this.container?.offsetHeight ?? this.size.maxHeight;
    this.resizePending = null;
    document.addEventListener('pointermove', this.boundResizeMove);
    document.addEventListener('pointerup', this.boundResizeEnd);
  }

  private onResizeMove(e: PointerEvent): void {
    if (!this.isResizing || !this.container) return;
    // Stash the latest delta and schedule a single rAF to apply it — never
    // touch style on the pointermove hot path itself.
    this.resizePending = { dx: e.clientX - this.resizeStartX, dy: e.clientY - this.resizeStartY };
    if (!this.resizeRaf) {
      this.resizeRaf = requestAnimationFrame(() => {
        this.resizeRaf = 0;
        if (this.resizePending && this.container) {
          const p = this.resizePending;
          this.resizePending = null;
          this.applyResize(p.dx, p.dy);
        }
      });
    }
  }

  /** Apply the cached resize delta using live window dims (resize changes the
   *  popup size, so the viewport clamp must use current innerWidth/Height — but
   *  only once per frame, not per pointermove). */
  private applyResize(dx: number, dy: number): void {
    if (!this.container) return;
    const newWidth = Math.max(320, this.resizeStartWidth + dx);
    const newHeight = Math.max(200, this.resizeStartHeight + dy);
    const clamped = clampPopupSize(
      { width: newWidth, maxHeight: newHeight },
      window.innerWidth,
      window.innerHeight,
    );
    this.size = clamped;
    this.container.style.width = `${clamped.width}px`;
    // Set height directly so popup visually grows/shrinks, not just maxHeight.
    this.container.style.height = `${clamped.maxHeight}px`;
    this.container.style.maxHeight = `${clamped.maxHeight}px`;
  }

  private onResizeEnd(_e: PointerEvent): void {
    if (!this.isResizing) return;
    // Apply any pending resize synchronously so the final size is current.
    if (this.resizeRaf) { cancelAnimationFrame(this.resizeRaf); this.resizeRaf = 0; }
    if (this.resizePending) {
      const p = this.resizePending;
      this.resizePending = null;
      this.applyResize(p.dx, p.dy);
    }
    this.isResizing = false;
    this.resizePending = null;
    document.removeEventListener('pointermove', this.boundResizeMove);
    document.removeEventListener('pointerup', this.boundResizeEnd);
    this.onResizeComplete(this.size);
  }

  /** Show a transient toast inside the popup shell. */
  showToast(message: string): void {
    if (!this.container) return;
    const toast = document.createElement('div');
    toast.className = 'cell-toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.textContent = message;
    this.container.appendChild(toast);
    // Trigger reflow so the CSS transition has a start state.
    void toast.offsetHeight;
    toast.classList.add('cell-toast--visible');
    setTimeout(() => {
      toast.classList.remove('cell-toast--visible');
      toast.addEventListener('transitionend', () => { toast.remove(); }, { once: true });
      // ponytail: if transitionend doesn't fire (e.g. popup removed), force cleanup.
      setTimeout(() => { toast.remove(); }, 400);
    }, 3000);
  }

  /** Restore focus to the element that was focused before the popup opened. */
  private restoreFocus(): void {
    if (this.previouslyFocused && 'focus' in this.previouslyFocused) {
      (this.previouslyFocused as HTMLElement).focus({ preventScroll: true });
    }
    this.previouslyFocused = null;
  }

  /** Get focusable elements inside the popup for Tab cycling. */
  private getFocusableElements(): HTMLElement[] {
    if (!this.container) return [];
    const selector = 'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])';
    return Array.from(this.container.querySelectorAll(selector));
  }

  /** Pointer down on the header starts a drag move. */
  private onPointerDown(e: PointerEvent): void {
    if (!this.container) return;
    const target = e.target as HTMLElement | null;
    // Only drag from the header, and never from interactive controls.
    if (!target?.closest('.cell-header')) return;
    if (target.closest('button, a, input, [role="button"], .cell-header__status, .cell-header__frequency, .cell-popup__resize')) return;
    e.preventDefault();
    this.dragStart = { x: e.clientX, y: e.clientY };
    this.dragOffsetStart = { ...this.dragOffset };
    // Cache dims so the pointermove hot path never reads layout (offsetWidth/
    // offsetHeight force reflow). The popup size + viewport are stable mid-drag.
    this.dragCachedWidth = this.container.offsetWidth || this.size.width;
    this.dragCachedHeight = this.container.offsetHeight || this.size.maxHeight;
    this.dragCachedVw = window.innerWidth;
    this.dragCachedVh = window.innerHeight;
    this.dragPending = null;
    this.container.classList.add('cell-popup--dragging');
    this.container.setPointerCapture(e.pointerId);
    this.container.addEventListener('pointermove', this.boundPointerMove);
    this.container.addEventListener('pointerup', this.boundPointerUp);
  }

  private onPointerMove(e: PointerEvent): void {
    if (!this.container || !this.dragStart) return;
    // Stash the latest delta and schedule a single rAF to apply it — never
    // touch style on the pointermove hot path itself.
    this.dragPending = { dx: e.clientX - this.dragStart.x, dy: e.clientY - this.dragStart.y };
    if (!this.dragRaf) {
      this.dragRaf = requestAnimationFrame(() => {
        this.dragRaf = 0;
        if (this.dragPending) {
          const p = this.dragPending;
          this.dragPending = null;
          this.dragOffset = { x: this.dragOffsetStart.x + p.dx, y: this.dragOffsetStart.y + p.dy };
          this.applyDragPosition();
        }
      });
    }
  }

  private onPointerUp(e: PointerEvent): void {
    if (!this.container) return;
    // Apply any pending move synchronously so the final position is current.
    if (this.dragRaf) { cancelAnimationFrame(this.dragRaf); this.dragRaf = 0; }
    if (this.dragPending) {
      const p = this.dragPending;
      this.dragPending = null;
      this.dragOffset = { x: this.dragOffsetStart.x + p.dx, y: this.dragOffsetStart.y + p.dy };
      this.applyDragPosition();
    }
    this.dragStart = null;
    this.dragPending = null;
    this.container.classList.remove('cell-popup--dragging');
    this.container.releasePointerCapture(e.pointerId);
    this.container.removeEventListener('pointermove', this.boundPointerMove);
    this.container.removeEventListener('pointerup', this.boundPointerUp);
  }
}
