import { collectSentenceRun, type SentenceRunEntry } from '@/features/tokenize/logic/sentenceRun';
import { SENTENCE_ATTR, SEPARATOR_CLASS, CONTAINER_SELECTOR, readSegments, type RenderedSentenceSegment } from './tokenSpanRenderer';

/** Marks the spans of the washed sentence. The wash itself is painted by band
 *  overlays (see paintSentenceBands) — --sentence stays a pure marker so the
 *  band edges stay geometrically straight instead of summing per-token boxes. */
export const SENTENCE_CLASS = 'js-cell-token--sentence';

const WORD_LANE_CLASS = 'js-cell-token-word';
const OVERLAY_ID = 'cell-sentence-overlay';
/** Horizontal run split: a gap wider than this many em ends the band segment. */
const BAND_GAP_EM = 2;

export interface BandBox {
  readonly top: number;
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
}

/** Merge fragment rects into one flat band per contiguous run on a visual
 *  line. All fragments on a line snap to the line's modal top/bottom, so the
 *  painted edges are straight regardless of per-token box differences; runs
 *  split only on gaps wider than maxGap. */
export function computeSentenceBands(rects: readonly BandBox[], maxGap: number): BandBox[] {
  const lines: { top: number; bottom: number; items: BandBox[] }[] = [];
  for (const rect of [...rects].sort((a, b) => a.top - b.top || a.left - b.left)) {
    const height = rect.bottom - rect.top;
    let line = lines.find(
      (l) =>
        Math.min(l.bottom, rect.bottom) - Math.max(l.top, rect.top) > 0.5 * Math.min(height, l.bottom - l.top),
    );
    if (!line) {
      line = { top: rect.top, bottom: rect.bottom, items: [] };
      lines.push(line);
    }
    line.items.push(rect);
    line.top = Math.min(line.top, rect.top);
    line.bottom = Math.max(line.bottom, rect.bottom);
  }

  const modal = (values: readonly number[]): number => {
    const counts = new Map<number, number>();
    for (const v of values) {
      const key = Math.round(v * 2) / 2;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]![0];
  };

  const bands: BandBox[] = [];
  for (const line of lines) {
    const top = modal(line.items.map((i) => i.top));
    const bottom = modal(line.items.map((i) => i.bottom));
    let left = Number.NaN;
    let right = Number.NaN;
    for (const item of [...line.items].sort((a, b) => a.left - b.left)) {
      if (Number.isNaN(left) || item.left - right > maxGap) {
        if (!Number.isNaN(left)) bands.push({ top, bottom, left, right });
        left = item.left;
        right = item.right;
      } else {
        right = Math.max(right, item.right);
      }
    }
    bands.push({ top, bottom, left, right });
  }
  return bands;
}

function collectWashRects(spans: readonly HTMLElement[]): BandBox[] {
  const rects: BandBox[] = [];
  const push = (r: DOMRect) => {
    if (r.width >= 0.5 && r.height >= 0.5) rects.push({ top: r.top, bottom: r.bottom, left: r.left, right: r.right });
  };
  for (const span of spans) {
    if (span.classList.contains(SEPARATOR_CLASS)) {
      // A gap can hold the sentence's punctuation — range over its
      // non-whitespace text so the band covers it; pure spaces are covered by
      // the merged band anyway.
      const node = [...span.childNodes].find((n): n is Text => n.nodeType === Node.TEXT_NODE);
      const text = node?.nodeValue ?? '';
      let first = -1;
      let last = -1;
      for (let i = 0; i < text.length; i++) {
        if (/\S/.test(text[i]!)) {
          if (first < 0) first = i;
          last = i;
        }
      }
      if (node && first >= 0) {
        const range = span.ownerDocument.createRange();
        range.setStart(node, first);
        range.setEnd(node, last + 1);
        for (const r of range.getClientRects?.() ?? []) push(r);
      }
      continue;
    }
    const lane = span.querySelector<HTMLElement>(`.${WORD_LANE_CLASS}`);
    if (!lane) continue;
    for (const r of lane.getClientRects()) push(r);
  }
  return rects;
}

let overlay: HTMLElement | null = null;
let overlaySpans: readonly HTMLElement[] = [];

function removeSentenceBands(): void {
  overlay?.remove();
  overlay = null;
  overlaySpans = [];
}

function repaintSentenceBands(): void {
  const host = overlay;
  if (!host) return;
  if (!overlaySpans.some((span) => span.isConnected)) {
    removeSentenceBands();
    return;
  }
  host.replaceChildren();
  paintSentenceBandsInto(host, overlaySpans);
}

function paintSentenceBandsInto(host: HTMLElement, spans: readonly HTMLElement[]): void {
  const first = spans[0];
  if (!first) return;
  const doc = first.ownerDocument;
  const view = doc.defaultView;
  const fontSize = parseFloat(view?.getComputedStyle(first).fontSize ?? '') || 16;
  const bands = computeSentenceBands(collectWashRects(spans), BAND_GAP_EM * fontSize);
  const scrollX = view?.scrollX ?? 0;
  const scrollY = view?.scrollY ?? 0;
  for (const band of bands) {
    const el = doc.createElement('div');
    el.className = 'js-cell-sentence-band';
    el.setAttribute('aria-hidden', 'true');
    el.style.left = `${band.left + scrollX}px`;
    el.style.top = `${band.top + scrollY}px`;
    el.style.width = `${band.right - band.left}px`;
    el.style.height = `${band.bottom - band.top}px`;
    host.appendChild(el);
  }
}

function paintSentenceBands(spans: readonly HTMLElement[]): void {
  removeSentenceBands();
  const first = spans[0];
  const mount = first?.ownerDocument.body;
  if (!first || !mount) return;
  const host = first.ownerDocument.createElement('div');
  host.id = OVERLAY_ID;
  host.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;pointer-events:none;';
  mount.appendChild(host);
  overlay = host;
  overlaySpans = spans;
  paintSentenceBandsInto(host, spans);
  if (host.childNodes.length === 0) removeSentenceBands();
}

/** Remove the wash from every span of the previous run. */
export function clearSentenceHighlight(spans: readonly HTMLElement[]): void {
  for (const span of spans) span.classList.remove(SENTENCE_CLASS);
  removeSentenceBands();
}

interface SentenceRun {
  readonly segments: RenderedSentenceSegment[];
  readonly entries: SentenceRunEntry[];
}

/** Resolve the sentence run `span` belongs to — the same segments the wash
 *  paints, in container DOM order. */
function collectRunForSpan(span: HTMLElement): SentenceRun | null {
  const container = span.closest(CONTAINER_SELECTOR) ?? span.parentElement;
  if (!container) return null;

  const segments = readSegments(container);
  const hoveredSegment = segments.findIndex((segment) => segment.spans.includes(span));
  if (hoveredSegment < 0) return null;

  const sentenceIndex = Number(span.getAttribute(SENTENCE_ATTR) ?? '0');
  return { segments, entries: collectSentenceRun(segments, hoveredSegment, sentenceIndex) };
}

function* runSpans({ segments, entries }: SentenceRun): Generator<HTMLElement> {
  for (const entry of [...entries].sort((a, b) => a.segment - b.segment)) {
    const segment = segments[entry.segment];
    if (!segment) continue;
    for (const candidate of segment.spans) {
      if (candidate.getAttribute(SENTENCE_ATTR) !== String(entry.sentenceIndex)) continue;
      yield candidate;
    }
  }
}

/** Text of the sentence `span` belongs to plus `span`'s offset inside it —
 *  the same run the wash paints, so lookup context, TTS and card sentences
 *  match the highlight exactly and cursorOffset lands on the clicked token. */
export function sentenceContextForSpan(span: HTMLElement): { sentence: string; cursorOffset: number } | null {
  const run = collectRunForSpan(span);
  if (!run) return null;
  let text = '';
  let cursorOffset = -1;
  for (const candidate of runSpans(run)) {
    if (candidate === span) cursorOffset = text.length;
    text += candidate.textContent ?? '';
  }
  const leadingWs = text.length - text.trimStart().length;
  const sentence = text.trim();
  if (!sentence || cursorOffset < 0) return null;
  return { sentence, cursorOffset: Math.max(0, cursorOffset - leadingWs) };
}

/** Text of the sentence `span` belongs to — the same run the wash paints. */
export function sentenceTextForSpan(span: HTMLElement): string {
  return sentenceContextForSpan(span)?.sentence ?? '';
}

/** Wash every rendered token of the sentence `span` belongs to, and return the
 *  washed spans so the caller can clear them later. */
export function highlightSentence(span: HTMLElement): HTMLElement[] {
  const run = collectRunForSpan(span);
  if (!run) return [];
  const washed = [...runSpans(run)];
  for (const candidate of washed) candidate.classList.add(SENTENCE_CLASS);
  paintSentenceBands(washed);
  return washed;
}

/** Reflows while a wash is pinned (resize, lazy images) move the text but not
 *  the painted bands — recompute them from the still-washed spans. */
if (typeof window !== 'undefined') {
  window.addEventListener('resize', repaintSentenceBands);
}
