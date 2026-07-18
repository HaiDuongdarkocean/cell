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
const RESIZE_HANDLE_SIZE = 24;
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
  private contentEl: HTMLDivElement | null = null;
  private resizeHandle: HTMLDivElement | null = null;
  private size: PopupSize;
  private isResizing = false;
  private resizeStartX = 0;
  private resizeStartY = 0;
  private resizeStartWidth = 0;
  private resizeStartHeight = 0;
  private lastAnchor: { top: number; left: number; right: number; bottom: number } | null = null;
  private dragOffset: { x: number; y: number } = { x: 0, y: 0 };
  private dragStart: { x: number; y: number } | null = null;
  private dragOffsetStart: { x: number; y: number } = { x: 0, y: 0 };
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
    this.resizeHandle.style.width = `${RESIZE_HANDLE_SIZE}px`;
    this.resizeHandle.style.height = `${RESIZE_HANDLE_SIZE}px`;
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

  /** Position the popup anchored to a token's bounding box. */
  setPosition(anchorTop: number, anchorLeft: number, anchorRight: number, anchorBottom: number): void {
    if (!this.container) return;
    this.lastAnchor = { top: anchorTop, left: anchorLeft, right: anchorRight, bottom: anchorBottom };
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
    // The caller should call show() before setPosition to get accurate height.
    const estHeight = this.container.offsetHeight > 0
      ? Math.min(this.container.offsetHeight, this.size.maxHeight)
      : Math.min(this.size.maxHeight, 300);
    const pos = computePopupPosition(
      this.lastAnchor.top, this.lastAnchor.left, this.lastAnchor.right, this.lastAnchor.bottom,
      this.size.width, vw, vh, estHeight,
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

  /** Get the Shadow DOM root (for content rendering). */
  getShadowRoot(): ShadowRoot | null {
    return this.shadow;
  }

  /** Get the content element (for content rendering). This is the inner
   *  scroll wrapper, NOT the outer shell — the resize handle lives on the
   *  shell as a sibling, so clearing this element leaves the handle intact. */
  getContainer(): HTMLDivElement | null {
    return this.contentEl;
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

  /** Show the popup. Locks Escape key via Keyboard Lock API when in
   *  fullscreen so Chromium's browser process doesn't intercept Esc
   *  (which exits fullscreen before our keydown handler can close the popup). */
  show(): void {
    if (this.container) {
      this.container.style.display = 'flex';
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

  /** Hide the popup. Unlocks Escape key so browser default Esc
   *  (exit fullscreen) works again after popup closes. */
  hide(): void {
    if (this.container) {
      this.container.style.display = 'none';
    }
    this.restoreFocus();
    const kb = (navigator as { keyboard?: { lock: (keys: string[]) => Promise<void>; unlock: () => void } }).keyboard;
    if (kb) {
      try { kb.unlock(); } catch { /* not locked */ }
    }
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
    if (this.container?.style.display === 'none') return;
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
    if (this.container?.style.display === 'none') return;
    // Check if the click target is inside the popup's Shadow DOM.
    // In Shadow DOM, event.target is the host element for outside listeners.
    // We check if the composed path includes our host.
    if (!this.host) return;
    const composedPath = e.composedPath();
    if (!composedPath.includes(this.host)) {
      // Don't dismiss if clicking on a subtitle token span (.js-cell-token) —
      // that triggers a new lookup, not a dismiss.
      const target = e.target as HTMLElement | null;
      if (target?.closest?.('.js-cell-token')) return;
      // Click outside — dismiss.
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
    document.addEventListener('pointermove', this.boundResizeMove);
    document.addEventListener('pointerup', this.boundResizeEnd);
  }

  private onResizeMove(e: PointerEvent): void {
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

  private onResizeEnd(_e: PointerEvent): void {
    if (!this.isResizing) return;
    this.isResizing = false;
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
    this.container.classList.add('cell-popup--dragging');
    this.container.setPointerCapture(e.pointerId);
    this.container.addEventListener('pointermove', this.boundPointerMove);
    this.container.addEventListener('pointerup', this.boundPointerUp);
  }

  private onPointerMove(e: PointerEvent): void {
    if (!this.container || !this.dragStart) return;
    const dx = e.clientX - this.dragStart.x;
    const dy = e.clientY - this.dragStart.y;
    this.dragOffset = { x: this.dragOffsetStart.x + dx, y: this.dragOffsetStart.y + dy };
    this.applyPosition();
  }

  private onPointerUp(e: PointerEvent): void {
    if (!this.container) return;
    this.dragStart = null;
    this.container.classList.remove('cell-popup--dragging');
    this.container.releasePointerCapture(e.pointerId);
    this.container.removeEventListener('pointermove', this.boundPointerMove);
    this.container.removeEventListener('pointerup', this.boundPointerUp);
  }
}
