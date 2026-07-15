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
const RESIZE_HANDLE_SIZE = 12;
const VIEWPORT_MARGIN = 8;

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

/** Clamp popup size to viewport. */
export function clampPopupSize(size: PopupSize, viewportWidth: number, viewportHeight: number): PopupSize {
  const width = Math.min(size.width, viewportWidth - VIEWPORT_MARGIN * 2);
  const maxHeight = Math.min(size.maxHeight, Math.round(viewportHeight * 0.7));
  return { width: Math.max(320, width), maxHeight: Math.max(200, maxHeight) };
}

/**
 * Compute popup position near an anchor point, clamped to viewport.
 * The popup appears below-right of the anchor by default, flipping
 * left/up if it would overflow.
 */
export function computePopupPosition(
  anchorX: number,
  anchorY: number,
  popupWidth: number,
  viewportWidth: number,
  viewportHeight: number,
): PopupPosition {
  // Default: below-right of anchor.
  let left = anchorX;
  let top = anchorY + 20; // 20px below anchor

  // Flip left if would overflow right edge.
  if (left + popupWidth + VIEWPORT_MARGIN > viewportWidth) {
    left = viewportWidth - popupWidth - VIEWPORT_MARGIN;
  }

  // Clamp left to viewport.
  if (left < VIEWPORT_MARGIN) {
    left = VIEWPORT_MARGIN;
  }

  // Clamp top to viewport.
  if (top < VIEWPORT_MARGIN) {
    top = VIEWPORT_MARGIN;
  }

  // If popup would overflow bottom, place above anchor.
  // (We don't know exact height at position time — use maxHeight as estimate.)
  if (top + 200 > viewportHeight - VIEWPORT_MARGIN) {
    top = Math.max(VIEWPORT_MARGIN, anchorY - 220);
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
  private resizeStartWidth = 0;
  private readonly onDismiss: () => void;
  private readonly onResizeComplete: (size: PopupSize) => void;
  private readonly boundKeyDown: (e: KeyboardEvent) => void;
  private readonly boundClickOutside: (e: MouseEvent) => void;
  private readonly boundResizeStart: (e: MouseEvent) => void;
  private readonly boundResizeMove: (e: MouseEvent) => void;
  private readonly boundResizeEnd: () => void;

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
  }

  /** Mount the popup shell into the document body with Shadow DOM. */
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
    document.body.appendChild(this.host);

    // Shadow DOM — isolates CSS from page.
    this.shadow = this.host.attachShadow({ mode: 'open' });

    // Container — the visible popup.
    this.container = document.createElement('div');
    this.container.setAttribute('data-dp-popup', '');
    this.container.style.position = 'fixed';
    this.container.style.pointerEvents = 'auto';
    this.container.style.width = `${this.size.width}px`;
    this.container.style.maxHeight = `${this.size.maxHeight}px`;
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
    this.shadow.appendChild(this.container);

    // Resize handle (bottom-right corner).
    this.resizeHandle = document.createElement('div');
    this.resizeHandle.setAttribute('data-dp-resize', '');
    this.resizeHandle.style.position = 'absolute';
    this.resizeHandle.style.bottom = '0';
    this.resizeHandle.style.right = '0';
    this.resizeHandle.style.width = `${RESIZE_HANDLE_SIZE}px`;
    this.resizeHandle.style.height = `${RESIZE_HANDLE_SIZE}px`;
    this.resizeHandle.style.cursor = 'nwse-resize';
    this.resizeHandle.style.pointerEvents = 'auto';
    this.resizeHandle.style.background = 'linear-gradient(135deg, transparent 50%, var(--dp-border, #cbd5e1) 50%)';
    this.container.style.position = 'fixed';
    this.container.appendChild(this.resizeHandle);
    this.resizeHandle.addEventListener('mousedown', this.boundResizeStart);

    // Dismiss listeners.
    document.addEventListener('keydown', this.boundKeyDown);
    document.addEventListener('mousedown', this.boundClickOutside, true); // capture — check before target

    return this.shadow;
  }

  /** Position the popup near an anchor point. */
  setPosition(anchorX: number, anchorY: number): void {
    if (!this.container) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pos = computePopupPosition(anchorX, anchorY, this.size.width, vw, vh);
    this.container.style.left = `${pos.left}px`;
    this.container.style.top = `${pos.top}px`;
  }

  /** Get the Shadow DOM root (for content rendering). */
  getShadowRoot(): ShadowRoot | null {
    return this.shadow;
  }

  /** Get the container element (for content rendering). */
  getContainer(): HTMLDivElement | null {
    return this.container;
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
      // Click outside — dismiss.
      this.onDismiss();
    }
  }

  private onResizeStart(e: MouseEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.isResizing = true;
    this.resizeStartX = e.clientX;
    this.resizeStartWidth = this.size.width;
    document.addEventListener('mousemove', this.boundResizeMove);
    document.addEventListener('mouseup', this.boundResizeEnd);
  }

  private onResizeMove(e: MouseEvent): void {
    if (!this.isResizing || !this.container) return;
    const dx = e.clientX - this.resizeStartX;
    const newWidth = Math.max(320, this.resizeStartWidth + dx);
    const clamped = clampPopupSize(
      { width: newWidth, maxHeight: this.size.maxHeight },
      window.innerWidth,
      window.innerHeight,
    );
    this.size = clamped;
    this.container.style.width = `${clamped.width}px`;
  }

  private onResizeEnd(): void {
    if (!this.isResizing) return;
    this.isResizing = false;
    document.removeEventListener('mousemove', this.boundResizeMove);
    document.removeEventListener('mouseup', this.boundResizeEnd);
    this.onResizeComplete(this.size);
  }
}
