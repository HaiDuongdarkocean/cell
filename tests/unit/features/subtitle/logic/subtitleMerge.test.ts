import { mergeCuesForPanel } from '@/features/subtitle/logic/subtitleMerge';
import type { SrtCue } from '@/entities/media';

function cue(index: number, start: number, end: number, text: string): SrtCue {
  return { index, start, end, text };
}

describe('mergeCuesForPanel', () => {
  it('returns empty array when both target and native are empty', () => {
    expect(mergeCuesForPanel([], [])).toEqual([]);
  });

  it('merges perfectly matching cues (same timestamps)', () => {
    const target = [cue(1, 0, 1000, 'Hello'), cue(2, 1000, 2000, 'World')];
    const native = [cue(1, 0, 1000, 'Xin chào'), cue(2, 1000, 2000, 'Thế giới')];
    const result = mergeCuesForPanel(target, native);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      index: 1, start: 0, end: 1000,
      targetText: 'Hello', nativeText: 'Xin chào',
    });
    expect(result[1]).toEqual({
      index: 2, start: 1000, end: 2000,
      targetText: 'World', nativeText: 'Thế giới',
    });
  });

  it('best-effort matches when timestamps are offset (native slightly earlier)', () => {
    // Native cues start 50ms before target cues — still active at target.start.
    const target = [cue(1, 0, 1000, 'Hello'), cue(2, 1000, 2000, 'World')];
    const native = [cue(1, 0, 1000, 'Xin chào'), cue(2, 950, 1950, 'Thế giới')];
    const result = mergeCuesForPanel(target, native);
    expect(result[0]?.nativeText).toBe('Xin chào'); // active at target[0].start=0
    expect(result[1]?.nativeText).toBe('Thế giới'); // active at target[1].start=1000
  });

  it('leaves nativeText empty when target has more cues than native', () => {
    const target = [cue(1, 0, 1000, 'A'), cue(2, 1000, 2000, 'B'), cue(3, 2000, 3000, 'C')];
    const native = [cue(1, 0, 1000, '甲')];
    const result = mergeCuesForPanel(target, native);
    expect(result).toHaveLength(3);
    expect(result[0]?.nativeText).toBe('甲');
    expect(result[1]?.nativeText).toBe('');
    expect(result[2]?.nativeText).toBe('');
  });

  it('only uses overlapping native cues when native has more cues than target', () => {
    const target = [cue(1, 0, 1000, 'A')];
    const native = [cue(1, 0, 1000, '甲'), cue(2, 1000, 2000, '乙')];
    const result = mergeCuesForPanel(target, native);
    expect(result).toHaveLength(1);
    expect(result[0]?.targetText).toBe('A');
    expect(result[0]?.nativeText).toBe('甲');
  });

  it('falls back to native as skeleton when target is empty', () => {
    // Spec F6 + ADR-007 D1: target rỗng → fallback native xương (panel list để click seek native).
    const native = [cue(1, 0, 1000, 'Xin chào'), cue(2, 1000, 2000, 'Thế giới')];
    const result = mergeCuesForPanel([], native);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      index: 1, start: 0, end: 1000,
      targetText: '', nativeText: 'Xin chào',
    });
    expect(result[1]).toEqual({
      index: 2, start: 1000, end: 2000,
      targetText: '', nativeText: 'Thế giới',
    });
  });

  it('returns target-only with empty nativeText when native is empty', () => {
    const target = [cue(1, 0, 1000, 'Hello'), cue(2, 1000, 2000, 'World')];
    const result = mergeCuesForPanel(target, []);
    expect(result).toHaveLength(2);
    expect(result[0]?.targetText).toBe('Hello');
    expect(result[0]?.nativeText).toBe('');
    expect(result[1]?.targetText).toBe('World');
    expect(result[1]?.nativeText).toBe('');
  });

  it('picks the native cue with the largest overlap at target.start', () => {
    // Two native cues overlap target.start=500: native[0] (0-600, overlap=100)
    // and native[1] (400-1000, overlap=100). Either is acceptable as long as
    // one is picked deterministically. Here we just assert a non-empty match.
    const target = [cue(1, 500, 1500, 'Hi')];
    const native = [cue(1, 0, 600, 'A'), cue(2, 400, 1000, 'B')];
    const result = mergeCuesForPanel(target, native);
    expect(result).toHaveLength(1);
    expect(result[0]?.nativeText.length).toBeGreaterThan(0);
  });

  it('breaks overlap ties by picking the first native cue in list order', () => {
    const target = [cue(1, 500, 1500, 'Hi')];
    const native = [cue(1, 0, 600, 'A'), cue(2, 400, 1000, 'B')];
    const result = mergeCuesForPanel(target, native);
    expect(result[0]?.nativeText).toBe('A');
  });

  it('slides the candidate window across sorted target cues', () => {
    const target = [
      cue(1, 100, 500, 'A'),
      cue(2, 800, 1200, 'B'),
      cue(3, 2000, 2400, 'C'),
    ];
    const native = [
      cue(1, 50, 600, '甲'),
      cue(2, 700, 1500, '乙'),
      cue(3, 900, 1100, '丙'),
    ];
    const result = mergeCuesForPanel(target, native);
    expect(result.map((r) => r.nativeText)).toEqual(['甲', '乙', '']);
  });

  it('still resolves the overlap when native cues are unsorted', () => {
    const target = [cue(1, 500, 900, 'A')];
    const native = [
      cue(1, 2000, 3000, 'late'),
      cue(2, 400, 700, 'hit'),
      cue(3, 0, 100, 'early'),
    ];
    const result = mergeCuesForPanel(target, native);
    expect(result[0]?.nativeText).toBe('hit');
  });

  it('preserves target order and per-cue matches when target cues are unsorted', () => {
    const target = [cue(1, 2000, 2400, 'late'), cue(2, 100, 500, 'early')];
    const native = [cue(1, 0, 600, 'first'), cue(2, 1900, 2500, 'second')];
    const result = mergeCuesForPanel(target, native);
    expect(result.map((r) => r.nativeText)).toEqual(['second', 'first']);
  });
});
