// subtitleTriggerController — spec §4.6.3 A2, §9.4: wire subtitle overlay
// tokens to the lookup pipeline with debounce + cancellation.
//
// Responsibilities:
// 1. Token-wrap subtitle text span into per-word (EN) or per-segment (ZH)
//    token spans with data attributes (offset, term).
// 2. Attach click/hover event listeners based on TriggerMode setting.
// 3. Debounce: 150ms hover, 50ms click (internal, no user setting — spec D9).
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

/** Debounce delays (spec §9.4, D9 — internal, no user setting). */
export const HOVER_DEBOUNCE_MS = 150;
export const CLICK_DEBOUNCE_MS = 50;

/** Data attributes on token spans. */
const DATA_TERM = 'data-cell-term';
const DATA_START = 'data-cell-start';
const DATA_END = 'data-cell-end';

/** Check if a modifier key matches the trigger mode. */
function modifierMatches(mode: TriggerMode, e: MouseEvent): boolean {
  switch (mode) {
    case 'hover-ctrl': return e.ctrlKey;
    case 'hover-shift': return e.shiftKey;
    case 'hover-alt': return e.altKey;
    default: return true; // 'click' and 'hover' — no modifier needed
  }
}

/** Detect language from text: CJK-only → 'zh', else 'en'. */
export function detectLangCode(text: string): string {
  // Strip whitespace + punctuation, check if remaining is CJK.
  const cjkChars = [...text].filter((ch) => /[\u4e00-\u9fff\u3400-\u4dbf]/.test(ch));
  const allChars = [...text].filter((ch) => /\S/.test(ch));
  if (allChars.length > 0 && cjkChars.length / allChars.length > 0.5) return 'zh';
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
  // Clear existing content.
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
    span.style.borderRadius = 'var(--radius-xs, 2px)';
    // Hover highlight (subtle, theme-agnostic).
    span.style.transition = 'background-color var(--duration-100, 100ms)';
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
  readonly triggerMode: TriggerMode;
  readonly onLookup: (request: LookupRequest, requestId: string, anchorRect: DOMRect) => void;
  readonly onCancel: (requestId: string) => void;
}

interface AttachedSpan {
  readonly span: HTMLSpanElement;
  readonly sentence: string;
  readonly langCode: string;
}

export class SubtitleTriggerController {
  private readonly deps: SubtitleTriggerDeps;
  private hoverTimer: ReturnType<typeof setTimeout> | null = null;
  private clickTimer: ReturnType<typeof setTimeout> | null = null;
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

  /** Attach trigger listeners to a set of token spans. */
  attach(tokenSpans: readonly HTMLSpanElement[], sentence: string, langCode: string): void {
    for (const span of tokenSpans) {
      const entry: AttachedSpan = { span, sentence, langCode };
      this.attached.push(entry);
      if (this.deps.triggerMode === 'click') {
        span.addEventListener('click', this.boundClick);
      } else {
        // hover / hover-ctrl / hover-shift / hover-alt
        span.addEventListener('mouseenter', this.boundHoverEnter);
        span.addEventListener('mouseleave', this.boundHoverLeave);
        // Also allow click in hover modes (for touch fallback).
        span.addEventListener('click', this.boundClick);
      }
    }
  }

  /** Remove all listeners and clear timers (does NOT cancel in-flight lookup). */
  detach(): void {
    if (this.hoverTimer) { clearTimeout(this.hoverTimer); this.hoverTimer = null; }
    if (this.clickTimer) { clearTimeout(this.clickTimer); this.clickTimer = null; }
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
    // Detach + re-attach with new mode.
    const entries = [...this.attached];
    this.detach();
    // Re-attach without re-adding to `attached` — rebuild from entries.
    for (const { span, sentence, langCode } of entries) {
      const entry: AttachedSpan = { span, sentence, langCode };
      this.attached.push(entry);
      if (mode === 'click') {
        span.addEventListener('click', this.boundClick);
      } else {
        span.addEventListener('mouseenter', this.boundHoverEnter);
        span.addEventListener('mouseleave', this.boundHoverLeave);
        span.addEventListener('click', this.boundClick);
      }
    }
  }

  private onHoverEnter(e: MouseEvent): void {
    if (!modifierMatches(this.deps.triggerMode, e)) return;
    if (this.hoverTimer) clearTimeout(this.hoverTimer);
    const span = e.currentTarget as HTMLSpanElement;
    const entry = this.attached.find((a) => a.span === span);
    if (!entry) return;
    this.hoverTimer = setTimeout(() => {
      this.hoverTimer = null;
      this.dispatchLookup(span, entry.sentence, entry.langCode);
    }, HOVER_DEBOUNCE_MS);
  }

  private onHoverLeave(): void {
    if (this.hoverTimer) {
      clearTimeout(this.hoverTimer);
      this.hoverTimer = null;
    }
  }

  private onClick(e: MouseEvent): void {
    // In hover modes, click is a fallback (touch). In click mode, it's primary.
    if (this.deps.triggerMode !== 'click' && !modifierMatches(this.deps.triggerMode, e)) return;
    const span = e.currentTarget as HTMLSpanElement;
    const entry = this.attached.find((a) => a.span === span);
    if (!entry) return;
    if (this.clickTimer) clearTimeout(this.clickTimer);
    this.clickTimer = setTimeout(() => {
      this.clickTimer = null;
      this.dispatchLookup(span, entry.sentence, entry.langCode);
    }, CLICK_DEBOUNCE_MS);
  }

  private dispatchLookup(span: HTMLSpanElement, sentence: string, langCode: string): void {
    // Cancel any in-flight request before sending a new one.
    this.cancelInFlight();
    const request = buildLookupRequest(span, sentence, langCode);
    const requestId = nextRequestId();
    this.inFlightRequestId = requestId;
    // Anchor rect: vertical bounds from the subtitle line (parent element)
    // so the popup avoids the entire line, not just the clicked token.
    // Horizontal bounds from the token so the popup aligns to the word.
    const tokenRect = span.getBoundingClientRect();
    const lineRect = span.parentElement?.getBoundingClientRect() ?? tokenRect;
    const anchorRect = new DOMRect(
      tokenRect.left,
      lineRect.top,
      tokenRect.width,
      lineRect.height,
    );
    this.deps.onLookup(request, requestId, anchorRect);
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
