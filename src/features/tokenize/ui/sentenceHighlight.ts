import { collectSentenceRun, type SentenceRunEntry } from '@/features/tokenize/logic/sentenceRun';
import { SENTENCE_ATTR, SEPARATOR_CLASS, CONTAINER_SELECTOR, readSegments, type RenderedSentenceSegment } from './tokenSpanRenderer';

/** Marks the spans of the washed sentence. The wash itself is painted by band
 *  overlays (see paintSentenceBands) — --sentence stays a pure marker so the
 *  band edges stay geometrically straight instead of summing per-token boxes. */
export const SENTENCE_CLASS = 'js-Tihoka-token--sentence';

const WORD_LANE_CLASS = 'js-Tihoka-token-word';
const OVERLAY_ID = 'Tihoka-sentence-overlay';
/** Horizontal run split: a gap wider than this many em ends the band segment. */
const BAND_GAP_EM = 2;
/** The dictionary popup host (mountPopupDictionary) — wash bands are clipped
 *  out of its surface rect so a translucent popup skin never shows the wash
 *  bleeding through as if it painted over the card. */
const POPUP_HOST_CLASS = 'js-Tihoka-popup-host';
const POPUP_SURFACE_SELECTOR = '[data-tihoka-id="popup-dictionary"]';

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

/** Subtract each hole rect from the band, returning the remaining pieces.
 *  A horizontal band cut by one hole yields at most 3 fragments (top strip,
 *  bottom strip, left/right pieces of the cut line). */
export function subtractRects(band: BandBox, holes: readonly BandBox[]): BandBox[] {
  let pieces: BandBox[] = [band];
  for (const hole of holes) {
    const next: BandBox[] = [];
    for (const piece of pieces) {
      const ix0 = Math.max(piece.left, hole.left);
      const ix1 = Math.min(piece.right, hole.right);
      const iy0 = Math.max(piece.top, hole.top);
      const iy1 = Math.min(piece.bottom, hole.bottom);
      if (ix1 <= ix0 || iy1 <= iy0) {
        next.push(piece);
        continue;
      }
      if (piece.top < iy0) next.push({ top: piece.top, bottom: iy0, left: piece.left, right: piece.right });
      if (piece.bottom > iy1) next.push({ top: iy1, bottom: piece.bottom, left: piece.left, right: piece.right });
      if (piece.left < ix0) next.push({ top: iy0, bottom: iy1, left: piece.left, right: ix0 });
      if (piece.right > ix1) next.push({ top: iy0, bottom: iy1, left: ix1, right: piece.right });
    }
    pieces = next;
  }
  return pieces;
}

/** Viewport rects of open dictionary popup surfaces. The shadow host itself is
 *  a 0x0 anchor, so the visible card is located inside its shadow root. */
function popupRects(doc: Document): BandBox[] {
  const rects: BandBox[] = [];
  const roots: ParentNode[] = [doc];
  const subtitleShadow = doc.getElementById('Tihoka-subtitle-root')?.shadowRoot;
  if (subtitleShadow) roots.push(subtitleShadow);
  for (const root of roots) {
    for (const host of root.querySelectorAll<HTMLElement>(`.${POPUP_HOST_CLASS}`)) {
      const surface = host.shadowRoot?.querySelector<HTMLElement>(POPUP_SURFACE_SELECTOR) ?? host;
      const r = surface.getBoundingClientRect();
      if (r.width >= 1 && r.height >= 1) {
        rects.push({ top: r.top, bottom: r.bottom, left: r.left, right: r.right });
      }
    }
  }
  return rects;
}

let overlay: HTMLElement | null = null;
let overlaySpans: readonly HTMLElement[] = [];
let popupObserver: { disconnect(): void } | null = null;
let geometryRaf = 0;
let lastHolesKey = '';

function holesKey(holes: readonly BandBox[]): string {
  return holes.map((h) => `${h.left},${h.top},${h.right},${h.bottom}`).join('|');
}

function removeSentenceBands(): void {
  overlay?.remove();
  overlay = null;
  overlaySpans = [];
  popupObserver?.disconnect();
  popupObserver = null;
  if (geometryRaf) {
    cancelAnimationFrame(geometryRaf);
    geometryRaf = 0;
  }
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

/** Repaint only when a popup surface actually moved/resized/appeared —
 *  pointermove fires constantly while the pointer roams the page. */
function repaintIfPopupGeometryChanged(doc: Document): void {
  if (geometryRaf || !overlay) return;
  geometryRaf = requestAnimationFrame(() => {
    geometryRaf = 0;
    const key = holesKey(popupRects(doc));
    if (key !== lastHolesKey) repaintSentenceBands();
  });
}

function watchPopupGeometry(doc: Document, subtitleShadow: ShadowRoot | null): void {
  // The host mounts empty and React fills its shadow root a tick later, so a
  // document-level observer alone repaints before the surface exists. Watching
  // each popup's shadow root catches the card mount and any later restyle.
  const watchedRoots = new WeakSet<ShadowRoot>();
  const surfaceObserver = new MutationObserver(() => repaintSentenceBands());
  const watchPopupRoot = (host: Element): void => {
    const root = host.shadowRoot;
    if (root && !watchedRoots.has(root)) {
      watchedRoots.add(root);
      surfaceObserver.observe(root, { childList: true, subtree: true, attributes: true });
    }
  };
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      const touched = [...record.addedNodes, ...record.removedNodes].some(
        (node) =>
          node instanceof HTMLElement &&
          (node.classList.contains(POPUP_HOST_CLASS) || !!node.querySelector(`.${POPUP_HOST_CLASS}`)),
      );
      if (touched) {
        for (const host of doc.querySelectorAll(`.${POPUP_HOST_CLASS}`)) watchPopupRoot(host);
        for (const host of subtitleShadow?.querySelectorAll(`.${POPUP_HOST_CLASS}`) ?? []) watchPopupRoot(host);
        repaintSentenceBands();
        return;
      }
    }
  });
  observer.observe(doc.documentElement, { childList: true, subtree: true });
  if (subtitleShadow) observer.observe(subtitleShadow, { childList: true, subtree: true });
  for (const host of doc.querySelectorAll(`.${POPUP_HOST_CLASS}`)) watchPopupRoot(host);
  for (const host of subtitleShadow?.querySelectorAll(`.${POPUP_HOST_CLASS}`) ?? []) watchPopupRoot(host);

  const onScroll = (): void => {
    // Bands are absolute in page coords and scroll with the text; the popup is
    // fixed in the viewport, so the clip re-intersects on every scroll.
    if (overlay && popupRects(doc).length) repaintSentenceBands();
  };
  doc.addEventListener('scroll', onScroll, { capture: true, passive: true });
  const onGeometryEvent = (): void => repaintIfPopupGeometryChanged(doc);
  doc.defaultView?.addEventListener('pointermove', onGeometryEvent, { passive: true });
  popupObserver = {
    disconnect() {
      observer.disconnect();
      surfaceObserver.disconnect();
      doc.removeEventListener('scroll', onScroll, { capture: true });
      doc.defaultView?.removeEventListener('pointermove', onGeometryEvent);
    },
  };
}

function paintSentenceBandsInto(host: HTMLElement, spans: readonly HTMLElement[]): void {
  const first = spans[0];
  if (!first) return;
  const doc = first.ownerDocument;
  const view = doc.defaultView;
  const fontSize = parseFloat(view?.getComputedStyle(first).fontSize ?? '') || 16;
  const bands = computeSentenceBands(collectWashRects(spans), BAND_GAP_EM * fontSize);
  const holes = popupRects(doc);
  lastHolesKey = holesKey(holes);
  const visible = holes.length ? bands.flatMap((band) => subtractRects(band, holes)) : bands;
  const scrollX = view?.scrollX ?? 0;
  const scrollY = view?.scrollY ?? 0;
  for (const band of visible) {
    const el = doc.createElement('div');
    el.className = 'js-Tihoka-sentence-band';
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
  const doc = first.ownerDocument;
  const host = doc.createElement('div');
  host.id = OVERLAY_ID;
  host.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;pointer-events:none;';
  mount.appendChild(host);
  overlay = host;
  overlaySpans = spans;
  paintSentenceBandsInto(host, spans);
  watchPopupGeometry(doc, doc.getElementById('Tihoka-subtitle-root')?.shadowRoot ?? null);
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
