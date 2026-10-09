import { hasSentenceEnd } from '@/shared/lib/sentencePunct';

/**
 * One rendered text block as the sentence run sees it: a block is a text node,
 * so a sentence split by inline elements (links, emphasis, references) spans
 * several blocks. Sentence indices are per block, which is why the run has to
 * be rebuilt from both ends.
 */
export interface SentenceSegment {
  /** Sentence index of the segment's last token; -1 when it holds no token. */
  readonly lastSentenceIndex: number;
  /** Text between the last token and the end of the segment — it carries the
   *  terminator when the sentence closes here. */
  readonly trailingText: string;
}

export interface SentenceRunEntry {
  /** Position of the segment in the input list. */
  readonly segment: number;
  /** Sentence index to highlight inside that segment. */
  readonly sentenceIndex: number;
}

/**
 * Segments that belong to the hovered sentence, in input order.
 *
 * The list must be in DOM order (the caller reads it from the rendered spans);
 * block scan order is not document order, so an index-based walk over the scan
 * list joins unrelated neighbours.
 */
export function collectSentenceRun(
  segments: readonly SentenceSegment[],
  hoveredSegment: number,
  sentenceIndex: number,
): SentenceRunEntry[] {
  if (hoveredSegment < 0 || hoveredSegment >= segments.length) {
    return [{ segment: hoveredSegment, sentenceIndex }];
  }

  const run: SentenceRunEntry[] = [{ segment: hoveredSegment, sentenceIndex }];

  // Right: the sentence must still be open at the end of the segment we extend
  // from. When the segment's last token belongs to a later sentence, the
  // hovered sentence already closed inside it.
  let rightIndex = sentenceIndex;
  for (let i = hoveredSegment; i + 1 < segments.length; i++) {
    const current = segments[i]!;
    if (current.lastSentenceIndex !== rightIndex || hasSentenceEnd(current.trailingText)) break;
    const next = segments[i + 1]!;
    if (next.lastSentenceIndex < 0) break;
    run.push({ segment: i + 1, sentenceIndex: 0 });
    if (next.lastSentenceIndex > 0) break;
    rightIndex = 0;
  }

  // Left: only when the hovered sentence starts at the beginning of its own
  // segment — otherwise the sentence began mid-block. A previous segment whose
  // trailing text closes a sentence is the boundary, never a continuation.
  if (sentenceIndex === 0) {
    for (let i = hoveredSegment; i > 0; i--) {
      const previous = segments[i - 1]!;
      if (previous.lastSentenceIndex < 0 || hasSentenceEnd(previous.trailingText)) break;
      run.push({ segment: i - 1, sentenceIndex: previous.lastSentenceIndex });
      if (previous.lastSentenceIndex > 0) break;
    }
  }

  return run;
}
