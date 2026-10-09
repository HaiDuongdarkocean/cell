import { collectSentenceRun, type SentenceSegment } from '@/features/tokenize/logic/sentenceRun';
import { SENTENCE_ATTR, SEPARATOR_CLASS } from './tokenSpanRenderer';

/** Class the CSS washes the sentence with (see buildTokenSpanCss). */
export const SENTENCE_CLASS = 'js-cell-token--sentence';

const BLOCK_ATTR = 'data-cell-block-id';

/** Paragraph-ish container: a sentence never reaches past one visual
 *  paragraph, so the run is read from the spans inside the same container. */
const CONTAINER_SELECTOR = 'p, li, dd, dt, blockquote, figcaption, td, th, h1, h2, h3, h4, h5, h6';

interface Segment extends SentenceSegment {
  readonly spans: HTMLElement[];
}

/** Group the container's rendered spans into text blocks, in DOM order.
 *  Block scan order is not document order (links are scanned in a different
 *  pass than the surrounding text), so the DOM is the only reliable order. */
function readSegments(container: Element): Segment[] {
  const segments: Segment[] = [];
  let current: { id: string; spans: HTMLElement[]; lastSentenceIndex: number; trailingText: string } | null = null;

  for (const span of container.querySelectorAll<HTMLElement>(`[${BLOCK_ATTR}]`)) {
    const id = span.getAttribute(BLOCK_ATTR)!;
    if (!current || current.id !== id) {
      current = { id, spans: [], lastSentenceIndex: -1, trailingText: '' };
      segments.push(current);
    }
    const isSeparator = span.classList.contains(SEPARATOR_CLASS);
    current.spans.push(span);
    if (isSeparator) {
      current.trailingText = span.textContent ?? '';
    } else {
      current.trailingText = '';
      current.lastSentenceIndex = Number(span.getAttribute(SENTENCE_ATTR) ?? '0');
    }
  }

  return segments;
}

/** Remove the wash from every span of the previous run. */
export function clearSentenceHighlight(spans: readonly HTMLElement[]): void {
  for (const span of spans) span.classList.remove(SENTENCE_CLASS);
}

/** Wash every rendered token of the sentence `span` belongs to, and return the
 *  washed spans so the caller can clear them later. */
export function highlightSentence(span: HTMLElement): HTMLElement[] {
  const container = span.closest(CONTAINER_SELECTOR) ?? span.parentElement;
  if (!container) return [];

  const segments = readSegments(container);
  const hoveredSegment = segments.findIndex((segment) => segment.spans.includes(span));
  if (hoveredSegment < 0) return [];

  const sentenceIndex = Number(span.getAttribute(SENTENCE_ATTR) ?? '0');
  const washed: HTMLElement[] = [];
  for (const entry of collectSentenceRun(segments, hoveredSegment, sentenceIndex)) {
    const segment = segments[entry.segment];
    if (!segment) continue;
    for (const candidate of segment.spans) {
      if (candidate.getAttribute(SENTENCE_ATTR) !== String(entry.sentenceIndex)) continue;
      candidate.classList.add(SENTENCE_CLASS);
      washed.push(candidate);
    }
  }
  return washed;
}
