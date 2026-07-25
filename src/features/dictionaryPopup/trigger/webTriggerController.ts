// webTriggerController — spec §4.6 P1.1: generic web-text selection/hover lookup.
//
// Works on any text node in the page (not just subtitle overlay).
// Two trigger modes:
// 1. Selection: user selects text → lookup the selection (verbatim, fallback=true).
// 2. Hover: user hovers a word → extract sentence from parent element + lookup.
//
// Same debounce + cancellation as subtitleTriggerController.
// Same LookupRequest contract — just different source (page DOM vs subtitle span).

import type { LookupRequest, TriggerMode } from '../types';
import { detectLangCode, nextRequestId, isPointOverRange } from './subtitleTriggerController';
import {
  extractSentenceContext,
  extractWordAtOffset,
  createWordRange,
  WORD_CHAR_RE,
  type SentenceContext,
} from '../sentence/sentenceModule';

/** Hover debounce for web text — only fire after the cursor has been still for this long. */
const WEB_HOVER_DEBOUNCE_MS = 80;
/** Cursor must stay within this radius (px) for the debounce duration to count as a stop. */
const WEB_HOVER_STABILITY_PX = 6;

/** Quick word-character check used before deferring the expensive hover path. */
/** Minimum selection length to trigger lookup. */
const MIN_SELECTION_LENGTH = 1;
/** Maximum selection length (avoid looking up whole paragraphs). */
const MAX_SELECTION_LENGTH = 100;

/** UI hosts that float above page text and can block `caretRangeFromPoint`.
 *  Text inside these hosts is extension UI — must not trigger dictionary lookup.
 *  Kept in sync with EXTENSION_UI_HOST_SELECTORS in tokenizeBlock.ts. */
const UI_HOST_SELECTORS =
  '.js-cell-popup-host, .js-cell-orbital-badge-host, .js-cell-token-badge-host, ' +
  '#cell-settings-dialog-host, #cell-card-creator-host';

/** Temporarily disable pointer-events on our own floating UI (host + its shadow children)
 *  so caretRangeFromPoint can resolve the page text underneath instead of the popup/pointer. */
function withUiHostsPointerEventsDisabled<T>(fn: () => T): T {
  const hosts = Array.from(document.querySelectorAll(UI_HOST_SELECTORS)) as HTMLElement[];
  interface NodePointerStyle { element: HTMLElement; original: string; }
  const nodes: NodePointerStyle[] = [];

  function collect(element: HTMLElement): void {
    nodes.push({ element, original: element.style.getPropertyValue('pointer-events') });
    if (element.shadowRoot) {
      element.shadowRoot.querySelectorAll('*').forEach((child) => {
        if (child instanceof HTMLElement) collect(child);
      });
    }
  }
  hosts.forEach((host) => collect(host));

  nodes.forEach(({ element }) => element.style.setProperty('pointer-events', 'none', 'important'));
  try {
    return fn();
  } finally {
    nodes.forEach(({ element, original }) => {
      if (original) element.style.setProperty('pointer-events', original, 'important');
      else element.style.removeProperty('pointer-events');
    });
  }
}

/** Check whether a range is inside our own popup/orbital badge host. */
function rangeInUiHost(range: Range): boolean {
  const node = range.commonAncestorContainer;
  const el = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
  return el ? el.closest(UI_HOST_SELECTORS) !== null : false;
}

/**
 * Extract the sentence containing a text node + offset.
 * Walks up to the nearest block element, gets its text content,
 * and computes the cursor offset within that text.
 */
// Re-export from SSOT sentence module for backward compatibility.
export { extractSentenceContext, extractWordAtOffset, createWordRange, type SentenceContext };

/** Build a LookupRequest from a text selection. */
export function buildSelectionLookupRequest(selection: Selection): LookupRequest | null {
  const text = selection.toString().trim();
  if (text.length < MIN_SELECTION_LENGTH || text.length > MAX_SELECTION_LENGTH) return null;

  const range = selection.getRangeAt(0);
  const textNode = range.startContainer as Text;
  if (textNode.nodeType !== Node.TEXT_NODE) return null;

  const langCode = detectLangCode(text);
  const block = textNode.parentElement?.closest('p, div, li, h1, h2, h3, h4, h5, h6, span');
  const sentence = block?.textContent ?? text;

  return {
    term: text,
    langCode,
    contextSentence: sentence,
    cursorOffset: 0,
    fallback: true,
  };
}

/** Build a LookupRequest from an already-extracted sentence context. */
function buildHoverLookupRequestFromContext(
  ctx: NonNullable<ReturnType<typeof extractSentenceContext>>,
): LookupRequest {
  const langCode = detectLangCode(ctx.sentence);
  return {
    term: ctx.term,
    langCode,
    contextSentence: ctx.sentence,
    cursorOffset: ctx.cursorOffset,
    fallback: false,
  };
}

/** Check if a modifier key matches the trigger mode. */
function modifierMatches(mode: TriggerMode, e: MouseEvent): boolean {
  switch (mode) {
    case 'hover-ctrl': return e.ctrlKey;
    case 'hover-shift': return e.shiftKey;
    case 'hover-alt': return e.altKey;
    default: return true;
  }
}

export interface WebTriggerPointer {
  readonly x: number;
  readonly y: number;
  readonly badgeCenter?: { readonly x: number; readonly y: number };
  readonly badgeRadius?: number;
  readonly pointerRadius?: number;
}

export interface WebTriggerDeps {
  triggerMode: TriggerMode;
  /** onLookup receives the cloned Range so the consumer can highlight the target word. */
  readonly onLookup: (request: LookupRequest, requestId: string, anchorRect: DOMRect, range: Range, pointer?: WebTriggerPointer) => void;
  readonly onCancel: (requestId: string) => void;
  /** onClear is called when the cursor leaves a valid word/selection target so the consumer can hide the popup. */
  readonly onClear?: () => void;
}

/**
 * Web trigger controller — listens to selectionchange + mousemove on
 * document.body. Triggers lookup on:
 * - click mode: text selection (mouseup with non-empty selection).
 * - hover mode: hover over text (mouseenter on text node via mousemove).
 *
 * Same debounce + cancellation as SubtitleTriggerController.
 */
export class WebTriggerController {
  private deps: WebTriggerDeps;
  private hoverTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingMouseMove: MouseEvent | null = null;
  private scheduledMouseMove: MouseEvent | null = null;
  private inFlightRequestId: string | null = null;
  private readonly boundMouseUp: (e: MouseEvent) => void;
  private readonly boundMouseMove: (e: MouseEvent) => void;
  private readonly boundSelectionChange: () => void;
  private lastHoveredTerm: string | null = null;
  private lastHoveredStartContainer: Node | null = null;
  private lastHoveredStartOffset = -1;
  private lastHoveredPointerX = NaN;
  private lastHoveredPointerY = NaN;

  constructor(deps: WebTriggerDeps) {
    this.deps = deps;
    this.boundMouseUp = this.onMouseUp.bind(this);
    this.boundMouseMove = this.onMouseMove.bind(this);
    this.boundSelectionChange = this.onSelectionChange.bind(this);
  }

  /** Attach listeners to document. */
  attach(): void {
    if (this.deps.triggerMode === 'click') {
      document.addEventListener('mouseup', this.boundMouseUp);
      document.addEventListener('selectionchange', this.boundSelectionChange);
    } else {
      document.addEventListener('mousemove', this.boundMouseMove);
      // Also allow selection in hover modes.
      document.addEventListener('mouseup', this.boundMouseUp);
    }
  }

  /** Remove all listeners + clear timers. */
  detach(): void {
    this.cancelPendingHover();
    document.removeEventListener('mouseup', this.boundMouseUp);
    document.removeEventListener('mousemove', this.boundMouseMove);
    document.removeEventListener('selectionchange', this.boundSelectionChange);
    this.lastHoveredTerm = null;
    this.lastHoveredStartContainer = null;
    this.lastHoveredStartOffset = -1;
    this.lastHoveredPointerX = NaN;
    this.lastHoveredPointerY = NaN;
    this.cancelInFlight();
  }

  /** Update trigger mode. */
  setTriggerMode(mode: TriggerMode): void {
    this.deps.triggerMode = mode;
    this.detach();
    this.attach();
  }

  cancelInFlight(): void {
    if (this.inFlightRequestId) {
      this.deps.onCancel(this.inFlightRequestId);
      this.inFlightRequestId = null;
    }
  }

  isCurrentRequestId(requestId: string): boolean {
    return this.inFlightRequestId === requestId;
  }

  clearRequestId(requestId: string): void {
    if (this.inFlightRequestId === requestId) {
      this.inFlightRequestId = null;
    }
  }

  private cancelPendingHover(): void {
    if (this.hoverTimer) { clearTimeout(this.hoverTimer); this.hoverTimer = null; }
    this.pendingMouseMove = null;
    this.scheduledMouseMove = null;
  }

  private resetHover(): void {
    this.cancelPendingHover();
    this.lastHoveredTerm = null;
    this.lastHoveredStartContainer = null;
    this.lastHoveredStartOffset = -1;
    this.lastHoveredPointerX = NaN;
    this.lastHoveredPointerY = NaN;
    this.deps.onClear?.();
  }

  private onMouseUp(e: MouseEvent): void {
    // In hover modes (hover-ctrl/shift/alt), a click/fallback must hold the
    // matching modifier key. 'click' and plain 'hover' modes allow any click.
    if (!modifierMatches(this.deps.triggerMode, e)) {
      this.resetHover();
      return;
    }

    const target = e.target as HTMLElement | null;
    if (target?.closest(UI_HOST_SELECTORS)) {
      // Non-popup UI hosts (badge, settings, card creator) — never lookup.
      if (!target.closest('.js-cell-popup-host')) return;
      // Click inside the popup. e.target is retargeted to the host element
      // (Shadow DOM retargeting), so use composedPath()[0] to check the
      // actual clicked element. Interactive elements (buttons, links, drag
      // handle, resize handle) handle their own clicks — don't fall through.
      // Non-interactive areas fall through to caretRangeFromPoint (which uses
      // withUiHostsPointerEventsDisabled to see through the popup) so the
      // user can look up page text behind the popup — this was the root cause
      // of "chập chờn" recognition where clicks on text covered by the popup
      // were silently swallowed.
      const actual = e.composedPath()[0] as HTMLElement | null;
      if (actual?.closest?.(
        'button, a, input, select, textarea, [role="button"], [role="tab"], ' +
        '[contenteditable="true"], .cell-header, .cell-popup__resize, .cell-sheet-handle',
      )) return;
      // Non-interactive popup area: fall through to caretRangeFromPoint below.
    }
    // Skip subtitle/tokenize tokens — handled by SubtitleTriggerController or
    // tokenize controller via shared controller. Without this, mouseup on a
    // token with no selection falls through to caretRangeFromPoint → resetHover
    // → dismissLookup, which kills the popup the token handler just opened
    // (inverted dp.enabled behavior: checked=no popup, unchecked=popup).
    if (target?.closest('.js-cell-token')) {
      return;
    }

    // Selection-based lookup (click mode or fallback in hover mode).
    const selection = window.getSelection();
    const text = selection?.toString().trim() ?? '';

    if (text) {
      const request = buildSelectionLookupRequest(selection!);
      if (!request) return;
      const range = selection!.getRangeAt(0);
      const rect = getLineAwareAnchorRect(range);
      this.dispatchLookup(request, rect, range);
      return;
    }

    // No selection: fallback to caret range (helps on user-select:none sites).
    // If the click is on empty space, dismiss any open popup.
    if (!document.caretRangeFromPoint) {
      this.resetHover();
      return;
    }
    const caretRange = withUiHostsPointerEventsDisabled(() => document.caretRangeFromPoint(e.clientX, e.clientY));
    if (!caretRange) {
      this.resetHover();
      return;
    }
    const textNode = caretRange.startContainer as Text;
    if (textNode.nodeType !== Node.TEXT_NODE || rangeInUiHost(caretRange)) {
      this.resetHover();
      return;
    }
    const ctx = extractSentenceContext(textNode, caretRange.startOffset);
    if (!ctx) {
      this.resetHover();
      return;
    }
    const wordRange = createWordRange(textNode, caretRange.startOffset, ctx);
    if (!wordRange) {
      this.resetHover();
      return;
    }
    if (!isPointOverRange(e.clientX, e.clientY, wordRange)) {
      this.resetHover();
      return;
    }
    const request = buildHoverLookupRequestFromContext(ctx);
    if (!request) {
      this.resetHover();
      return;
    }
    const rect = getLineAwareAnchorRect(wordRange);
    this.dispatchLookup(request, rect, wordRange, { x: e.clientX, y: e.clientY });
  }

  private onSelectionChange(): void {
    // Cancel any pending hover when selection changes (user is selecting text).
    // Do NOT call resetHover/onClear — selectionchange fires AFTER mouseup in
    // click mode, so onClear would dismissLookup the popup just opened by the
    // subtitle/web trigger (symptom: "click, flash, then popup disappears").
    this.cancelPendingHover();
    this.lastHoveredTerm = null;
    this.lastHoveredStartContainer = null;
    this.lastHoveredStartOffset = -1;
  }

  private onMouseMove(e: MouseEvent): void {
    if (!modifierMatches(this.deps.triggerMode, e)) {
      this.resetHover();
      return;
    }
    const target = e.target as HTMLElement | null;
    if (!target) return;
    // Skip our own UI — don't dismiss while the user is interacting with it.
    if (target.closest(UI_HOST_SELECTORS)) {
      this.cancelPendingHover();
      return;
    }
    // Skip subtitle tokens (handled by SubtitleTriggerController via shared controller).
    if (target.closest('.js-cell-token')) {
      this.cancelPendingHover();
      return;
    }

    if (!document.caretRangeFromPoint) return;
    const caretRange = document.caretRangeFromPoint(e.clientX, e.clientY);
    if (!caretRange) {
      this.resetHover();
      return;
    }
    const textNode = caretRange.startContainer as Text;
    if (textNode.nodeType !== Node.TEXT_NODE) {
      this.resetHover();
      return;
    }
    const ch = textNode.data[caretRange.startOffset];
    if (!ch || !WORD_CHAR_RE.test(ch)) {
      this.resetHover();
      return;
    }

    // Defer the expensive sentence/word-geometry work to the timer callback
    // so we only pay for it once per hover burst, not on every mousemove.
    this.pendingMouseMove = e;
    this.scheduleHoverProcess();
  }

  private scheduleHoverProcess(): void {
    if (this.hoverTimer) clearTimeout(this.hoverTimer);
    // Remember the exact event this timer is waiting on. When the timer fires
    // we compare against the latest mouse position: if the cursor moved more
    // than WEB_HOVER_STABILITY_PX, the user hasn't stopped yet, so we reset.
    this.scheduledMouseMove = this.pendingMouseMove;
    this.hoverTimer = setTimeout(() => this.onHoverTimer(), WEB_HOVER_DEBOUNCE_MS);
  }

  private onHoverTimer(): void {
    this.hoverTimer = null;
    const e = this.pendingMouseMove;
    const scheduled = this.scheduledMouseMove;
    this.scheduledMouseMove = null;
    if (!e) return;

    // Guard: fast movement → do not lookup yet. Wait until the cursor is still.
    if (scheduled && this.mouseDistancePx(e, scheduled) > WEB_HOVER_STABILITY_PX) {
      this.scheduledMouseMove = e;
      this.hoverTimer = setTimeout(() => this.onHoverTimer(), WEB_HOVER_DEBOUNCE_MS);
      return;
    }

    this.pendingMouseMove = null;
    this.processHoverMove(e.clientX, e.clientY);
  }

  private mouseDistancePx(a: MouseEvent, b: MouseEvent): number {
    const dx = a.clientX - b.clientX;
    const dy = a.clientY - b.clientY;
    return Math.hypot(dx, dy);
  }

  /** Process a hover at an explicit (x, y) point, e.g. from the orbital pointer. */
  processPoint(x: number, y: number, badgeCenter?: { x: number; y: number }, badgeRadius?: number, pointerRadius?: number): void {
    this.processHoverMove(x, y, badgeCenter, badgeRadius, pointerRadius);
  }

  private processHoverMove(x: number, y: number, badgeCenter?: { x: number; y: number }, badgeRadius?: number, pointerRadius?: number): void {
    const caretRange = withUiHostsPointerEventsDisabled(() => document.caretRangeFromPoint(x, y));
    if (!caretRange) {
      this.resetHover();
      return;
    }
    const textNode = caretRange.startContainer as Text;
    if (textNode.nodeType !== Node.TEXT_NODE || rangeInUiHost(caretRange)) {
      this.resetHover();
      return;
    }
    const offset = caretRange.startOffset;

    const ctx = extractSentenceContext(textNode, offset);
    if (!ctx) {
      this.resetHover();
      return;
    }
    const wordRange = createWordRange(textNode, offset, ctx);
    if (!wordRange) {
      this.resetHover();
      return;
    }
    // Only trigger when the pointer is actually over the word's geometry,
    // not just within the line/padding/shadow around it.
    if (!isPointOverRange(x, y, wordRange)) {
      this.resetHover();
      return;
    }
    const request = buildHoverLookupRequestFromContext(ctx);
    if (!request) {
      this.resetHover();
      return;
    }
    // Skip if we're still over the exact same word occurrence and the pointer
    // has barely moved (prevents re-triggering while hovering a single word).
    // Reposition when the same term appears elsewhere so the popup follows the pointer.
    const pointerDelta = Math.hypot(x - this.lastHoveredPointerX, y - this.lastHoveredPointerY);
    if (
      request.term === this.lastHoveredTerm &&
      wordRange.startContainer === this.lastHoveredStartContainer &&
      wordRange.startOffset === this.lastHoveredStartOffset &&
      pointerDelta < 6
    ) {
      return;
    }
    this.lastHoveredTerm = request.term;
    this.lastHoveredStartContainer = wordRange.startContainer;
    this.lastHoveredStartOffset = wordRange.startOffset;
    this.lastHoveredPointerX = x;
    this.lastHoveredPointerY = y;

    const rect = getLineAwareAnchorRect(wordRange);
    this.dispatchLookup(request, rect, wordRange, { x, y, badgeCenter, badgeRadius, pointerRadius });
  }

  private dispatchLookup(request: LookupRequest, anchorRect: DOMRect, range?: Range, pointer?: WebTriggerPointer): void {
    this.cancelInFlight();
    const requestId = nextRequestId();
    this.inFlightRequestId = requestId;
    // Clone range so the consumer gets a stable snapshot for highlight.
    this.deps.onLookup(request, requestId, anchorRect, range ? range.cloneRange() : new Range(), pointer);
  }
}

/**
 * Anchor rect for popup = looked-up word only.
 * Line/cue avoidance is applied separately as PopupLineRect so the popup stays
 * near the word and does not cover same-row neighbors via side placement.
 */
function getLineAwareAnchorRect(range: Range): DOMRect {
  return safeGetRangeRect(range);
}

/** Safely get a DOMRect from a Range (jsdom fallback). */
function safeGetRangeRect(range: Range): DOMRect {
  try {
    const rect = range.getBoundingClientRect();
    if (rect.width > 0) return rect;
  } catch { /* jsdom */ }
  const parent = range.startContainer.parentElement;
  return parent?.getBoundingClientRect() ?? new DOMRect(0, 0, 0, 0);
}
