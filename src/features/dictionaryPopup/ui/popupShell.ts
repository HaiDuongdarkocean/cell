// popupShell — spec §4.6.3 A4, §9: Popup Dictionary container with Shadow DOM,
// auto-position, resize, and dismiss (Esc + click outside).
//
// Content-script isolated world — vanilla DOM, no React (same as subtitleUI.ts).
// Shadow DOM isolates popup CSS from page CSS.
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
const RESIZE_HANDLE_SIZE = 24;
const VIEWPORT_MARGIN = 8;

// Resize handle icon — diagonal lines (jQuery UI / PrimeNG style).
// Lucide style: stroke 2.0, 24×24, currentColor, round caps.
const RESIZE_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;display:block"><path d="M22 2 L2 22" opacity="0.3"/><path d="M22 8 L8 22"/><path d="M22 14 L14 22"/></svg>`;

/** Popup position strategy (spec: auto-position tránh overflow). */
export interface PopupPosition {
  readonly left: number;
  readonly top: number;
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

/**
 * Compute popup position anchored to a token's bounding box.
 *
 * Strategy (spec: anchor theo cạnh token, không center; không che sentence):
 * 1. Horizontal: align popup's **left edge** with token's left edge by default.
 *    If popup would overflow right, align popup's **right edge** with token's
 *    right edge instead. If token is wider than popup or both alignments
 *    overflow, clamp to viewport margin.
 * 2. Vertical: prefer **below** the token. If not enough space, flip **above**
 *    the token (using anchorTop so the popup never overlaps the token).
 * 3. If neither vertical direction fits, try **right** then **left** side of the
 *    token while keeping the popup aligned to the edge with more vertical space.
 * 4. Final fallback: clamp to viewport, still trying to keep the popup edge near
 *    the token.
 *
 * @param anchorTop    - Pixel Y of the token's top edge.
 * @param anchorLeft   - Pixel X of the token's left edge.
 * @param anchorRight  - Pixel X of the token's right edge.
 * @param anchorBottom - Pixel Y of the token's bottom edge.
 * @param popupWidth   - Popup width in px.
 * @param viewportWidth  - Window inner width.
 * @param viewportHeight - Window inner height.
 * @param popupHeight    - Estimated popup height (for flip logic). Defaults to 300.
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
): PopupPosition {
  const GAP = 4;

  // ── Horizontal base alignment: align to token left edge, flip if overflow ──
  const maxFitWidth = viewportWidth - VIEWPORT_MARGIN * 2;
  let left = anchorLeft;
  if (left + popupWidth > viewportWidth - VIEWPORT_MARGIN) {
    left = anchorRight - popupWidth;
  }
  if (left < VIEWPORT_MARGIN) {
    left = VIEWPORT_MARGIN;
  }
  // Only clamp right if popup can fit within viewport; otherwise left-align at margin.
  if (popupWidth <= maxFitWidth && left + popupWidth > viewportWidth - VIEWPORT_MARGIN) {
    left = viewportWidth - popupWidth - VIEWPORT_MARGIN;
  }

  // ── Vertical: prefer below, then above, never overlap token ──
  const spaceBelow = viewportHeight - anchorBottom - VIEWPORT_MARGIN;
  const spaceAbove = anchorTop - VIEWPORT_MARGIN;

  let top: number;

  if (spaceBelow >= popupHeight) {
    // Enough space below.
    top = anchorBottom + GAP;
  } else if (spaceAbove >= popupHeight) {
    // Flip above: popup bottom sits GAP px above token's top edge.
    top = anchorTop - popupHeight - GAP;
  } else {
    // Neither vertical direction fits fully. Try side positioning (right, then left)
    // while keeping the popup vertically aligned to the direction with more space.
    const preferBelow = spaceBelow >= spaceAbove;
    const verticalBaseTop = preferBelow
      ? anchorBottom + GAP
      : anchorTop - popupHeight - GAP;

    if (anchorRight + GAP + popupWidth <= viewportWidth - VIEWPORT_MARGIN) {
      // Right side of token fits.
      left = anchorRight + GAP;
      top = verticalBaseTop;
    } else if (anchorLeft - GAP - popupWidth >= VIEWPORT_MARGIN) {
      // Left side of token fits.
      left = anchorLeft - popupWidth - GAP;
      top = verticalBaseTop;
    } else {
      // No side space either — clamp vertically, preferring the direction with more room.
      if (preferBelow) {
        top = anchorBottom + GAP;
        if (top + popupHeight > viewportHeight - VIEWPORT_MARGIN) {
          top = viewportHeight - popupHeight - VIEWPORT_MARGIN;
        }
      } else {
        top = anchorTop - popupHeight - GAP;
        if (top < VIEWPORT_MARGIN) {
          top = VIEWPORT_MARGIN;
        }
      }
    }
  }

  // Final clamp to ensure popup stays inside viewport.
  // When popup is larger than viewport (minus margins), left/top-align at margin
  // and accept the overflow — the two clamps would otherwise conflict.
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

/** Popup shell — manages Shadow DOM root, positioning, resize, dismiss. */
export class PopupShell {
  private host: HTMLDivElement | null = null;
  private shadow: ShadowRoot | null = null;
  private container: HTMLDivElement | null = null;
  private resizeHandle: HTMLDivElement | null = null;
  private size: PopupSize;
  private isResizing = false;
  private resizeStartX = 0;
  private resizeStartY = 0;
  private resizeStartWidth = 0;
  private resizeStartHeight = 0;
  private lastAnchor: { top: number; left: number; right: number; bottom: number } | null = null;
  private readonly onDismiss: () => void;
  private readonly onResizeComplete: (size: PopupSize) => void;
  private readonly boundKeyDown: (e: KeyboardEvent) => void;
  private readonly boundClickOutside: (e: MouseEvent) => void;
  private readonly boundResizeStart: (e: MouseEvent) => void;
  private readonly boundResizeMove: (e: MouseEvent) => void;
  private readonly boundResizeEnd: () => void;
  private readonly boundFullscreenChange: () => void;

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
  }

  /** Mount the popup shell into the document body (or fullscreen element) with Shadow DOM. */
  mount(): ShadowRoot {
    if (this.shadow) return this.shadow;

    // Host element — lives in the light DOM but is visually invisible
    // (the Shadow DOM content is what's visible).
    this.host = document.createElement('div');
    this.host.setAttribute('data-dp-popup-host', '');
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

    // Inject CSS variables for dark/light mode (Shadow DOM doesn't inherit
    // from host page). Uses prefers-color-scheme media query.
    const styleEl = document.createElement('style');
    styleEl.textContent = `
      :host {
        --dp-bg: #ffffff;
        --dp-text: #1e293b;
        --dp-border: #cbd5e1;
        --dp-muted: #64748b;
        --dp-primary: #3b82f6;
        --dp-primary-subtle: rgba(59,130,246,0.1);
        --dp-badge-bg: #f1f5f9;
        --dp-surface-hover: rgba(0,0,0,0.04);
      }
      @media (prefers-color-scheme: dark) {
        :host {
          --dp-bg: #1e293b;
          --dp-text: #e2e8f0;
          --dp-border: #334155;
          --dp-muted: #94a3b8;
          --dp-primary: #60a5fa;
          --dp-primary-subtle: rgba(96,165,250,0.15);
          --dp-badge-bg: #334155;
          --dp-surface-hover: rgba(255,255,255,0.06);
        }
      }
      /* Hide scrollbar but keep scrollable. */
      ::-webkit-scrollbar { display: none; }
      * { scrollbar-width: none; }
    `;
    this.shadow.appendChild(styleEl);

    // Container — the visible popup.
    this.container = document.createElement('div');
    this.container.setAttribute('data-dp-popup', '');
    this.container.style.position = 'fixed';
    this.container.style.pointerEvents = 'auto';
    this.container.style.width = `${this.size.width}px`;
    this.container.style.height = `${this.size.maxHeight}px`;
    this.container.style.overflow = 'hidden';
    this.container.style.display = 'flex';
    this.container.style.flexDirection = 'column';
    this.container.style.borderRadius = '10px';
    this.container.style.border = '1px solid var(--dp-border, #cbd5e1)';
    this.container.style.background = 'var(--dp-bg, #ffffff)';
    this.container.style.boxShadow = '0 4px 24px rgba(0,0,0,0.15)';
    this.container.style.fontFamily = 'system-ui, -apple-system, sans-serif';
    this.container.style.fontSize = '14px';
    this.container.style.color = 'var(--dp-text, #1e293b)';
    // user-select is inherited — fullscreen video containers often set
    // user-select:none, which Shadow DOM inherits. Force text so definitions
    // are selectable.
    this.container.style.userSelect = 'text';
    this.container.style.webkitUserSelect = 'text';
    this.shadow.appendChild(this.container);

    // Resize handle (bottom-right corner) — diagonal-lines icon, resize both width & height.
    this.resizeHandle = document.createElement('div');
    this.resizeHandle.setAttribute('data-dp-resize', '');
    this.resizeHandle.style.position = 'absolute';
    this.resizeHandle.style.bottom = '0';
    this.resizeHandle.style.right = '0';
    this.resizeHandle.style.width = `${RESIZE_HANDLE_SIZE}px`;
    this.resizeHandle.style.height = `${RESIZE_HANDLE_SIZE}px`;
    this.resizeHandle.style.cursor = 'nwse-resize';
    this.resizeHandle.style.pointerEvents = 'auto';
    this.resizeHandle.style.zIndex = '9999';
    this.resizeHandle.style.display = 'flex';
    this.resizeHandle.style.alignItems = 'center';
    this.resizeHandle.style.justifyContent = 'center';
    this.resizeHandle.style.color = 'var(--dp-muted, #94a3b8)';
    this.resizeHandle.style.borderBottomRightRadius = '10px';
    this.resizeHandle.innerHTML = RESIZE_ICON_SVG;
    this.container.style.position = 'fixed';
    this.container.appendChild(this.resizeHandle);
    this.resizeHandle.addEventListener('mousedown', this.boundResizeStart);

    // Dismiss listeners.
    document.addEventListener('keydown', this.boundKeyDown);
    document.addEventListener('mousedown', this.boundClickOutside, true); // capture — check before target
    // Re-parent host when fullscreen changes (host must live inside fullscreen element).
    document.addEventListener('fullscreenchange', this.boundFullscreenChange);

    return this.shadow;
  }

  /** Position the popup anchored to a token's bounding box. */
  setPosition(anchorTop: number, anchorLeft: number, anchorRight: number, anchorBottom: number): void {
    if (!this.container) return;
    this.lastAnchor = { top: anchorTop, left: anchorLeft, right: anchorRight, bottom: anchorBottom };
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
    // The caller should call show() before setPosition to get accurate height.
    const estHeight = this.container.offsetHeight > 0
      ? Math.min(this.container.offsetHeight, this.size.maxHeight)
      : Math.min(this.size.maxHeight, 300);
    const pos = computePopupPosition(
      this.lastAnchor.top, this.lastAnchor.left, this.lastAnchor.right, this.lastAnchor.bottom,
      this.size.width, vw, vh, estHeight,
    );
    this.container.style.left = `${pos.left}px`;
    this.container.style.top = `${pos.top}px`;
    // Shrink popup height to fit the viewport so it never overflows.
    // The user wants the popup to "thu nhỏ lại" when there isn't enough space.
    const availableHeight = vh - pos.top - VIEWPORT_MARGIN;
    const clampedHeight = Math.max(200, Math.min(this.size.maxHeight, availableHeight));
    this.container.style.height = `${clampedHeight}px`;
  }

  /** Get the Shadow DOM root (for content rendering). */
  getShadowRoot(): ShadowRoot | null {
    return this.shadow;
  }

  /** Get the container element (for content rendering). */
  getContainer(): HTMLDivElement | null {
    return this.container;
  }

  /** Re-append resize handle after clearContainer wiped it. */
  reAppendResizeHandle(): void {
    if (this.container && this.resizeHandle) {
      this.container.appendChild(this.resizeHandle);
    }
  }

  /** Update popup size. */
  setSize(size: PopupSize): void {
    this.size = size;
    if (this.container) {
      this.container.style.width = `${size.width}px`;
      this.container.style.maxHeight = `${size.maxHeight}px`;
    }
  }

  /** Show the popup. */
  show(): void {
    if (this.container) {
      this.container.style.display = 'flex';
    }
  }

  /** Hide the popup (without unmounting). */
  hide(): void {
    if (this.container) {
      this.container.style.display = 'none';
    }
  }

  /** Unmount the popup + remove all listeners. */
  destroy(): void {
    document.removeEventListener('keydown', this.boundKeyDown);
    document.removeEventListener('mousedown', this.boundClickOutside, true);
    document.removeEventListener('fullscreenchange', this.boundFullscreenChange);
    if (this.resizeHandle) {
      this.resizeHandle.removeEventListener('mousedown', this.boundResizeStart);
    }
    document.removeEventListener('mousemove', this.boundResizeMove);
    document.removeEventListener('mouseup', this.boundResizeEnd);
    if (this.host && this.host.parentNode) {
      this.host.parentNode.removeChild(this.host);
    }
    this.host = null;
    this.shadow = null;
    this.container = null;
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
    if (e.key === 'Escape') {
      e.stopPropagation();
      this.onDismiss();
    }
  }

  private onClickOutside(e: MouseEvent): void {
    // Check if the click target is inside the popup's Shadow DOM.
    // In Shadow DOM, event.target is the host element for outside listeners.
    // We check if the composed path includes our host.
    if (!this.host) return;
    const composedPath = e.composedPath();
    if (!composedPath.includes(this.host)) {
      // Don't dismiss if clicking on a subtitle token span (data-dp-term) —
      // that triggers a new lookup, not a dismiss.
      const target = e.target as HTMLElement | null;
      if (target?.closest?.('[data-dp-term]')) return;
      // Click outside — dismiss.
      this.onDismiss();
    }
  }

  private onResizeStart(e: MouseEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.isResizing = true;
    this.resizeStartX = e.clientX;
    this.resizeStartY = e.clientY;
    this.resizeStartWidth = this.size.width;
    // Capture actual rendered height — container may be shorter than maxHeight.
    this.resizeStartHeight = this.container?.offsetHeight ?? this.size.maxHeight;
    document.addEventListener('mousemove', this.boundResizeMove);
    document.addEventListener('mouseup', this.boundResizeEnd);
  }

  private onResizeMove(e: MouseEvent): void {
    if (!this.isResizing || !this.container) return;
    const dx = e.clientX - this.resizeStartX;
    const dy = e.clientY - this.resizeStartY;
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

  private onResizeEnd(): void {
    if (!this.isResizing) return;
    this.isResizing = false;
    document.removeEventListener('mousemove', this.boundResizeMove);
    document.removeEventListener('mouseup', this.boundResizeEnd);
    this.onResizeComplete(this.size);
  }
}
