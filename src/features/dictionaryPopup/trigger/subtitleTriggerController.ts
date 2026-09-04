// subtitleTriggerController — spec §4.6.3 A2, §9.4: wire subtitle overlay
// tokens to the lookup pipeline with debounce + cancellation.
//
// Responsibilities:
// 1. Token-wrap subtitle text span into per-word (EN) or per-segment (ZH)
//    token spans with data attributes (offset, term).
// 2. Attach click/hover event listeners based on TriggerMode setting.
// 3. Hover debounce: 80ms (internal, no user setting — spec D9). Click is instant.
// 4. On trigger: build LookupRequest, assign requestId, send LOOKUP to worker.
// 5. On new trigger while in-flight: send LOOKUP_CANCEL for previous requestId.
// 6. Route LOOKUP_RESULT by requestId — only the latest requestId's result
//    reaches the popup.
//
// This controller is framework-agnostic (no React) — it operates on the
// subtitle overlay's text span DOM directly, same as subtitleUI.ts.

import type { LookupRequest, TriggerMode } from '../types';
import type { Token } from '../plugins/languagePlugin';
import { tokenizeSentence } from '@/features/dictionary/logic/phraseMatcher';
import { segmentFMM } from '../plugins/chinesePlugin';
import { scriptRunSegmenter } from '@/features/ocr/language/scriptRunSegmenter';

/** Hover debounce: only lookup after the cursor has stayed on the token for this long. */
export const HOVER_DEBOUNCE_MS = 80;

/** Data attributes on token spans. */
const DATA_TERM = 'data-cell-term';
const DATA_START = 'data-cell-start';
const DATA_END = 'data-cell-end';

/** Check if a modifier key matches the trigger mode.
 *  - click: no modifier (any click triggers).
 *  - hover: no modifier (any hover triggers).
 *  - hover-ctrl/shift/alt: matching modifier must be held.
 */
function modifierMatches(mode: TriggerMode, e: MouseEvent): boolean {
  switch (mode) {
    case 'hover-ctrl': return e.ctrlKey;
    case 'hover-shift': return e.shiftKey;
    case 'hover-alt': return e.altKey;
    case 'hover':
    case 'click':
    default:
      return true;
  }
}

/** Detect language from text: CJK (zh+ja) majority → 'zh', else 'en'.
 *  Delegates to scriptRunSegmenter (SSOT) — ja kanji counts as CJK. */
export function detectLangCode(text: string): string {
  const runs = scriptRunSegmenter(text);
  let cjkCount = 0;
  let enCount = 0;
  for (const run of runs) {
    const nonWs = run.text.replace(/\s/g, '').length;
    if (run.script === 'zh' || run.script === 'ja' || run.script === 'ko') cjkCount += nonWs;
    else if (run.script === 'en') enCount += nonWs;
  }
  const total = cjkCount + enCount;
  if (total > 0 && cjkCount / total > 0.5) return 'zh';
  return 'en';
}

/** Tokenize subtitle text into tokens (EN per-word, ZH per-segment). */
export function tokenizeSubtitleText(text: string, langCode: string): readonly Token[] {
  if (langCode === 'zh') {
    // ZH: FMM with empty probe → single chars (real segmentation needs dict).
    // The worker/orchestrator does real FMM with the dictionary probe.
    // Here we just need token spans for click/hover targeting.
    return segmentFMM(text, { hasTerm: () => false });
  }
  // EN: whitespace tokenize (same as phraseMatcher).
  return tokenizeSentence(text);
}

/**
 * Wrap a subtitle text span's content into per-token child spans.
 * Each token span has data-cell-term, data-cell-start, data-cell-end attributes.
 * Non-token characters (whitespace, punctuation) are kept as text nodes.
 *
 * Returns the list of created token span elements.
 */
export function wrapTokenSpans(
  textSpan: HTMLSpanElement,
  text: string,
  langCode: string,
): HTMLSpanElement[] {
  const tokens = tokenizeSubtitleText(text, langCode);
  textSpan.textContent = '';

  const tokenSpans: HTMLSpanElement[] = [];
  let lastEnd = 0;

  for (const token of tokens) {
    // Insert any gap text (whitespace/punctuation between tokens) as text node.
    if (token.start > lastEnd) {
      textSpan.appendChild(document.createTextNode(text.slice(lastEnd, token.start)));
    }

    const span = document.createElement('span');
    span.className = 'js-cell-token';
    span.textContent = text.slice(token.start, token.end);
    span.setAttribute(DATA_TERM, token.text);
    span.setAttribute(DATA_START, String(token.start));
    span.setAttribute(DATA_END, String(token.end));
    span.style.cursor = 'pointer';
    span.style.borderRadius = 'var(--radius-xs)';
    textSpan.appendChild(span);
    tokenSpans.push(span);

    lastEnd = token.end;
  }

  // Trailing text.
  if (lastEnd < text.length) {
    textSpan.appendChild(document.createTextNode(text.slice(lastEnd)));
  }

  return tokenSpans;
}

/** Build a LookupRequest from a token span + the full subtitle sentence. */
export function buildLookupRequest(
  tokenSpan: HTMLSpanElement,
  sentence: string,
  langCode: string,
  fallback: boolean = false,
): LookupRequest {
  const term = tokenSpan.getAttribute(DATA_TERM) ?? tokenSpan.textContent ?? '';
  const start = parseInt(tokenSpan.getAttribute(DATA_START) ?? '0', 10);
  return {
    term,
    langCode,
    contextSentence: sentence,
    cursorOffset: start,
    fallback,
  };
}

/** Generate a unique requestId for a lookup. */
let requestCounter = 0;
export function nextRequestId(): string {
  requestCounter++;
  return `dp-${Date.now()}-${requestCounter}`;
}

/** Tolerance (px) for hit-testing a Range against a pointer. */
const POINTER_HIT_TOLERANCE = 1;

/** Return true if (x,y) lies inside any non-empty client rect of `range`.
 *  If the range has no layout rects (e.g. jsdom or hidden text), we allow
 *  the lookup because we cannot verify geometry. */
export function isPointOverRange(x: number, y: number, range: Range, tolerance = POINTER_HIT_TOLERANCE): boolean {
  // jsdom (and some test environments) do not implement getClientRects —
  // allow the lookup because we cannot verify geometry in those contexts.
  if (typeof range.getClientRects !== 'function') return true;
  const rects = range.getClientRects();
  const len = rects.length;
  if (len === 0) return true;
  let hasLayoutRect = false;
  for (let i = 0; i < len; i++) {
    const r = rects[i]!;
    if (r.width <= 0 || r.height <= 0) continue;
    hasLayoutRect = true;
    if (
      x >= r.left - tolerance &&
      x <= r.right + tolerance &&
      y >= r.top - tolerance &&
      y <= r.bottom + tolerance
    ) {
      return true;
    }
  }
  return !hasLayoutRect;
}

/** Return true if (x,y) lies inside the visible text rects of `span`.
 *  Falls back to true when the range cannot be measured. */
function isPointOverSpan(x: number, y: number, span: HTMLSpanElement, tolerance = POINTER_HIT_TOLERANCE): boolean {
  const range = document.createRange();
  try {
    range.selectNodeContents(span);
  } catch {
    return true;
  }
  return isPointOverRange(x, y, range, tolerance);
}

/**
 * Subtitle trigger controller — manages debounce, cancellation, and
 * dispatches LOOKUP requests to a callback (the caller wires this to the
 * worker postMessage).
 *
 * Usage:
 *   const ctrl = new SubtitleTriggerController({
 *     triggerMode: 'click',
 *     onLookup: (req, requestId) => worker.postMessage({ type: 'LOOKUP', requestId, payload: req }),
 *     onCancel: (requestId) => worker.postMessage({ type: 'LOOKUP_CANCEL', requestId }),
 *   });
 *   ctrl.attach(tokenSpans, sentence, langCode);
 *   ctrl.detach(); // remove all listeners
 */
export interface SubtitleTriggerDeps {
  triggerMode: TriggerMode;
  /** onLookup receives the token span so the consumer can highlight it. */
  readonly onLookup: (request: LookupRequest, requestId: string, anchorRect: DOMRect, highlightTarget: HTMLSpanElement) => void;
  readonly onCancel: (requestId: string) => void;
  /** onClear is called when the cursor leaves a valid token target so the consumer can hide the popup. */
  readonly onClear?: () => void;
}

interface AttachedSpan {
  readonly span: HTMLSpanElement;
  readonly sentence: string;
  readonly langCode: string;
}

export class SubtitleTriggerController {
  private deps: SubtitleTriggerDeps;
  private hoverTimer: ReturnType<typeof setTimeout> | null = null;
  private leaveClearTimer: ReturnType<typeof setTimeout> | null = null;
  private inFlightRequestId: string | null = null;
  private readonly attached: AttachedSpan[] = [];
  private readonly boundHoverEnter: (e: MouseEvent) => void;
  private readonly boundHoverLeave: (e: MouseEvent) => void;
  private readonly boundClick: (e: MouseEvent) => void;

  constructor(deps: SubtitleTriggerDeps) {
    this.deps = deps;
    this.boundHoverEnter = this.onHoverEnter.bind(this);
    this.boundHoverLeave = this.onHoverLeave.bind(this);
    this.boundClick = this.onClick.bind(this);
  }

  /** Attach trigger listeners to a set of token spans.
   *  Modes:
   *    - click: click only.
   *    - hover / hover-ctrl/shift/alt: hover (with optional modifier) + click fallback.
   *    - orbital: hover only (no click — spec forbids click popup in orbital).
   */
  attach(tokenSpans: readonly HTMLSpanElement[], sentence: string, langCode: string): void {
    for (const span of tokenSpans) {
      const entry: AttachedSpan = { span, sentence, langCode };
      this.attached.push(entry);
      this.bindSpanForMode(span, this.deps.triggerMode);
    }
  }

  private bindSpanForMode(span: HTMLSpanElement, mode: TriggerMode): void {
    if (mode === 'click') {
      span.addEventListener('click', this.boundClick);
      return;
    }
    span.addEventListener('mouseenter', this.boundHoverEnter);
    span.addEventListener('mouseleave', this.boundHoverLeave);
    // Click fallback for hover modifier modes (touch/accessibility).
    span.addEventListener('click', this.boundClick);
  }

  /** Remove all listeners and clear timers (does NOT cancel in-flight lookup or hide popup). */
  detach(): void {
    if (this.hoverTimer) { clearTimeout(this.hoverTimer); this.hoverTimer = null; }
    if (this.leaveClearTimer) { clearTimeout(this.leaveClearTimer); this.leaveClearTimer = null; }
    for (const { span } of this.attached) {
      span.removeEventListener('mouseenter', this.boundHoverEnter);
      span.removeEventListener('mouseleave', this.boundHoverLeave);
      span.removeEventListener('click', this.boundClick);
    }
    this.attached.length = 0;
    // NOTE: do NOT call cancelInFlight() here — detach is called on every cue
    // change (render → wrapTargetLineTokens → detach). Cancelling would hide
    // the popup every time the subtitle line changes. cancelInFlight is only
    // called from dispatchLookup (before sending a new request) and destroy().
  }

  /** Cancel any in-flight request. */
  cancelInFlight(): void {
    if (this.inFlightRequestId) {
      this.deps.onCancel(this.inFlightRequestId);
      this.inFlightRequestId = null;
    }
  }

  /** Update trigger mode (re-attaches listeners). */
  setTriggerMode(mode: TriggerMode): void {
    // Persist the new mode so modifier checks inside the event handlers
    // reflect the current setting, not the original one.
    this.deps.triggerMode = mode;
    // Detach + re-attach with new mode.
    const entries = [...this.attached];
    this.detach();
    // Re-attach without re-adding to `attached` — rebuild from entries.
    for (const { span, sentence, langCode } of entries) {
      const entry: AttachedSpan = { span, sentence, langCode };
      this.attached.push(entry);
      this.bindSpanForMode(span, mode);
    }
  }

  private onHoverEnter(e: MouseEvent): void {
    // Cancel any pending clear when the cursor re-enters a token (even if it
    // isn't directly over the text geometry).
    if (this.leaveClearTimer) { clearTimeout(this.leaveClearTimer); this.leaveClearTimer = null; }
    if (!modifierMatches(this.deps.triggerMode, e)) return;
    if (this.hoverTimer) { clearTimeout(this.hoverTimer); this.hoverTimer = null; }
    const span = e.currentTarget as HTMLSpanElement;
    const entry = this.attached.find((a) => a.span === span);
    if (!entry) return;
    // Only trigger when the pointer is actually over the token text,
    // not just within the line/padding/shadow around it.
    if (!isPointOverSpan(e.clientX, e.clientY, span)) return;
    this.hoverTimer = setTimeout(() => {
      this.hoverTimer = null;
      this.dispatchLookup(span, entry.sentence, entry.langCode);
    }, HOVER_DEBOUNCE_MS);
  }

  private onHoverLeave(e: MouseEvent): void {
    if (this.hoverTimer) { clearTimeout(this.hoverTimer); this.hoverTimer = null; }

    // If the cursor is moving to another token, the popup host, or the orbital
    // badge, do NOT clear. Otherwise schedule a clear so empty space dismisses
    // the popup immediately (next tick) while still allowing token-to-token.
    const rt = e.relatedTarget instanceof Element ? e.relatedTarget : null;
    const movingToValidTarget = rt !== null && rt.closest('.js-cell-token, .js-cell-popup-host, [data-cell-orbital-badge]') !== null;
    if (movingToValidTarget) return;

    if (this.leaveClearTimer) clearTimeout(this.leaveClearTimer);
    this.leaveClearTimer = setTimeout(() => {
      this.leaveClearTimer = null;
      this.deps.onClear?.();
    }, 0);
  }

  private onClick(e: MouseEvent): void {
    // In hover modes, click is a fallback (touch). In click mode, it's primary.
    // Click is intentionally instant (no debounce) for an immediate lookup feel.
    if (this.deps.triggerMode !== 'click' && !modifierMatches(this.deps.triggerMode, e)) return;
    const span = e.currentTarget as HTMLSpanElement;
    const entry = this.attached.find((a) => a.span === span);
    if (!entry) return;
    // Only trigger when the pointer is actually over the token text.
    if (!isPointOverSpan(e.clientX, e.clientY, span)) return;
    this.dispatchLookup(span, entry.sentence, entry.langCode);
  }

  private dispatchLookup(span: HTMLSpanElement, sentence: string, langCode: string): void {
    // Cancel any in-flight request before sending a new one.
    this.cancelInFlight();
    const request = buildLookupRequest(span, sentence, langCode);
    const requestId = nextRequestId();
    this.inFlightRequestId = requestId;
    // Anchor = token only. Line/cue avoidance is applied later as PopupLineRect
    // from the highlight target's parent (computeLineRect) so the popup stays
    // near the word without covering same-line neighbors.
    const tokenRect = span.getBoundingClientRect();
    this.deps.onLookup(request, requestId, tokenRect, span);
  }

  /** Check if a LOOKUP_RESULT's requestId matches the in-flight request. */
  isCurrentRequestId(requestId: string): boolean {
    return this.inFlightRequestId === requestId;
  }

  /** Clear the in-flight requestId after receiving a result. */
  clearRequestId(requestId: string): void {
    if (this.inFlightRequestId === requestId) {
      this.inFlightRequestId = null;
    }
  }
}
