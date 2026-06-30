import { mergeTsSegments } from '@/features/transmux/merging/segmentMerger';

/** Reads a Blob's content as a UTF-8 string using FileReader (jsdom-compatible). */
function readBlobAsText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (): void => {
      resolve(reader.result as string);
    };
    reader.onerror = (): void => {
      reject(reader.error);
    };
    reader.readAsText(blob);
  });
}

describe('mergeTsSegments', () => {
  describe('empty array', () => {
    it('throws an Error when segments array is empty', () => {
      expect(() => mergeTsSegments([])).toThrow(
        'Cannot merge empty segments array',
      );
    });
  });

  describe('single segment', () => {
    it('returns the same blob instance when only one segment is provided', () => {
      const segment = new Blob(['only-one'], { type: 'video/mp2t' });

      const result = mergeTsSegments([segment]);

      expect(result).toBe(segment);
    });
  });

  describe('multiple segments', () => {
    it('produces a merged blob whose size equals the sum of all segment sizes', () => {
      const segments = [
        new Blob(['hello'], { type: 'video/mp2t' }),
        new Blob(['world'], { type: 'video/mp2t' }),
        new Blob(['!'], { type: 'video/mp2t' }),
      ];

      const result = mergeTsSegments(segments);

      expect(result.size).toBe(
        segments.reduce((sum, blob) => sum + blob.size, 0),
      );
    });

    it('sets the merged blob type to video/mp2t', () => {
      const segments = [
        new Blob(['a'], { type: 'video/mp2t' }),
        new Blob(['b'], { type: 'video/mp2t' }),
      ];

      const result = mergeTsSegments(segments);

      expect(result.type).toBe('video/mp2t');
    });
  });

  describe('order preservation', () => {
    it('merges segments in the provided order (segments[0] first, segments[n] last)', async () => {
      const segments = [
        new Blob(['AAA'], { type: 'video/mp2t' }),
        new Blob(['BBB'], { type: 'video/mp2t' }),
        new Blob(['CCC'], { type: 'video/mp2t' }),
      ];

      const result = mergeTsSegments(segments);
      const text = await readBlobAsText(result);

      expect(text).toBe('AAABBBCCC');
    });
  });
});
