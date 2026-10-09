import { describe, expect, it } from '@jest/globals';
import { collectSentenceRun, type SentenceSegment } from './sentenceRun';

const seg = (lastSentenceIndex: number, trailingText = ''): SentenceSegment => ({ lastSentenceIndex, trailingText });

describe('collectSentenceRun', () => {
  it('joins the neighbouring segments of one sentence split by inline elements', () => {
    // "A " | link "Hello, world" | " program runs." (hovered) | ". Next"
    const segments = [seg(0, ' '), seg(0), seg(0, '.'), seg(1, '')];
    const run = collectSentenceRun(segments, 1, 0);
    expect(run.map((e) => e.segment).sort()).toEqual([0, 1, 2]);
    expect(run.every((e) => e.sentenceIndex === 0)).toBe(true);
  });

  it('stops at the segment that closes the sentence', () => {
    const segments = [seg(0, '. '), seg(0, '')];
    expect(collectSentenceRun(segments, 1, 0).map((e) => e.segment)).toEqual([1]);
  });

  it('stops when the next segment opens with the terminator of the hovered sentence', () => {
    // "…use in BCPL" (hovered) | ". The example program" — the second segment's
    // own sentence 0 is a different sentence that merely starts at its beginning.
    const segments = [seg(0, ''), seg(1, '')];
    const run = collectSentenceRun(segments, 0, 0);
    expect(run.map((e) => e.segment)).toEqual([0, 1]);
    // Only the leading terminator gap of the next segment belongs to the
    // hovered sentence; its words are sentence 1 and stay unwashed.
    expect(run.find((e) => e.segment === 1)!.sentenceIndex).toBe(0);
  });

  it('does not walk left from a sentence that starts mid-segment', () => {
    const segments = [seg(1, ' '), seg(1, '')];
    expect(collectSentenceRun(segments, 1, 1).map((e) => e.segment)).toEqual([1]);
  });

  it('picks the previous segment tail sentence when the hovered one starts mid-segment', () => {
    // Hovered sentence 0 continues into the previous segment's tail sentence 1.
    const segments = [seg(1, ' '), seg(0, '')];
    const run = collectSentenceRun(segments, 1, 0);
    expect(run).toEqual([
      { segment: 1, sentenceIndex: 0 },
      { segment: 0, sentenceIndex: 1 },
    ]);
  });

  it('ignores segments without tokens', () => {
    const segments = [seg(0, ' '), seg(-1, ''), seg(0, '')];
    const run = collectSentenceRun(segments, 0, 0);
    // The empty middle segment closes the walk (no tokens to continue through).
    expect(run.map((e) => e.segment)).toEqual([0]);
  });
});
