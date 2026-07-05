import { chunkCuesByCharBudget, buildSequentialIndices } from '@/features/translate/logic/translateChunker';
import type { SrtCue } from '@/entities/media';

function makeCue(text: string, i: number): SrtCue {
  return {
    index: i,
    start: i * 1000,
    end: (i + 1) * 1000,
    text,
  };
}

function makeCues(texts: string[]): SrtCue[] {
  return texts.map((t, i) => makeCue(t, i));
}

describe('translateChunker', () => {
  describe('chunkCuesByCharBudget', () => {
    it('returns empty array for empty indices', () => {
      const cues = makeCues(['hello']);
      expect(chunkCuesByCharBudget(cues, [])).toEqual([]);
    });

    it('returns single chunk when total chars ≤ budget', () => {
      const cues = makeCues(['hello', 'world']);
      const chunks = chunkCuesByCharBudget(cues, [0, 1], 100);
      expect(chunks).toEqual([[0, 1]]);
    });

    it('splits into 2 chunks when total exceeds budget', () => {
      const cues = makeCues(['aaaa', 'bbbb', 'cccc']); // 4+4+4=12
      const chunks = chunkCuesByCharBudget(cues, [0, 1, 2], 8);
      expect(chunks).toEqual([[0, 1], [2]]);
    });

    it('puts single cue > budget in its own chunk (no splitting)', () => {
      const cues = makeCues(['abcdefghij']); // 10 chars, budget 5
      const chunks = chunkCuesByCharBudget(cues, [0], 5);
      expect(chunks).toEqual([[0]]);
    });

    it('exact budget boundary — cue fills chunk exactly', () => {
      const cues = makeCues(['aaaa', 'bbbb']); // 4+4=8
      const chunks = chunkCuesByCharBudget(cues, [0, 1], 8);
      expect(chunks).toEqual([[0, 1]]);
    });

    it('cue that exactly fills + 1 more → 2 chunks', () => {
      const cues = makeCues(['aaaa', 'bbbb', 'c']); // 4+4+1=9, budget 8
      const chunks = chunkCuesByCharBudget(cues, [0, 1, 2], 8);
      expect(chunks).toEqual([[0, 1], [2]]);
    });

    it('handles single cue', () => {
      const cues = makeCues(['hello']);
      const chunks = chunkCuesByCharBudget(cues, [0], 100);
      expect(chunks).toEqual([[0]]);
    });

    it('handles large cue in middle of sequence', () => {
      const cues = makeCues(['aa', 'abcdefghij', 'bb']); // 2+10+2=14, budget 8
      const chunks = chunkCuesByCharBudget(cues, [0, 1, 2], 8);
      // [0,1] → 2+10=12 > 8? No: first cue 2 ≤ 8, add second 2+10=12 > 8 → flush [0], start [1]
      // [1] alone 10 > 8 but single cue → own chunk. Then [2] 2 ≤ 8.
      expect(chunks).toEqual([[0], [1], [2]]);
    });

    it('uses default budget 1500 when not specified', () => {
      const cues = makeCues(['a'.repeat(1000), 'b'.repeat(1000)]); // 2000 total
      const chunks = chunkCuesByCharBudget(cues, [0, 1]);
      expect(chunks).toEqual([[0], [1]]);
    });

    it('skips invalid indices (out of range)', () => {
      const cues = makeCues(['hello']);
      const chunks = chunkCuesByCharBudget(cues, [0, 5, 10], 100);
      expect(chunks).toEqual([[0]]);
    });

    it('handles non-sequential indices (seek range)', () => {
      const cues = makeCues(['aa', 'bb', 'cc', 'dd', 'ee']); // 2 each, budget 4
      const chunks = chunkCuesByCharBudget(cues, [2, 3, 4], 4);
      expect(chunks).toEqual([[2, 3], [4]]);
    });
  });

  describe('buildSequentialIndices', () => {
    it('returns [0..n-1] for default start', () => {
      expect(buildSequentialIndices(5)).toEqual([0, 1, 2, 3, 4]);
    });

    it('returns [start..n-1] for given start', () => {
      expect(buildSequentialIndices(5, 2)).toEqual([2, 3, 4]);
    });

    it('returns empty for totalCues=0', () => {
      expect(buildSequentialIndices(0)).toEqual([]);
    });

    it('returns empty when startIdx >= totalCues', () => {
      expect(buildSequentialIndices(3, 3)).toEqual([]);
      expect(buildSequentialIndices(3, 5)).toEqual([]);
    });

    it('clamps negative startIdx to 0', () => {
      expect(buildSequentialIndices(3, -1)).toEqual([0, 1, 2]);
    });
  });
});
