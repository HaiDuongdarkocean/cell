// ocrToCues.test.ts
import { describe, expect, it } from '@jest/globals';
import { ocrTextToCues, CUE_TAIL_MS, CUE_MERGE_GAP_MS } from './ocrToCues';

describe('ocrTextToCues', () => {
  it('groups consecutive identical text into one cue', () => {
    const cues = ocrTextToCues([
      { text: 'hello', timeMs: 1000 }, { text: 'hello', timeMs: 1330 }, { text: 'hello', timeMs: 1660 },
    ]);
    expect(cues).toHaveLength(1);
    expect(cues[0]).toMatchObject({ start: 1000, end: 1660 + CUE_TAIL_MS, text: 'hello', index: 0 });
  });
  it('text change closes cue and opens new one', () => {
    const cues = ocrTextToCues([
      { text: 'a', timeMs: 1000 }, { text: 'b', timeMs: 2000 },
    ]);
    expect(cues).toHaveLength(2);
    expect(cues[0]!.end).toBe(1000 + CUE_TAIL_MS);
    expect(cues[1]!.start).toBe(2000);
  });
  it('flicker A → miss → A within merge gap extends the SAME cue (no overlap)', () => {
    const cues = ocrTextToCues([
      { text: 'a', timeMs: 1000 }, { text: 'a', timeMs: 1330 },
      { text: 'b', timeMs: 1660 },
      { text: 'a', timeMs: 1900 }, // gap từ cue 'a' end (1330+500=1830) đến 1900 = 70ms < 700 merge gap
      { text: 'a', timeMs: 2200 },
    ]);
    // 'a' (1000-1830) + 'b' (1660? không — b bắt đầu 1660, a-end 1830 > b start → b nằm TRONG merge gap của a?
    // Theo spec: chỉ MERGE khi CÙNG text với cue vừa đóng. 'a' mới (1900) cùng text 'a' và 1900 - 1830 <= MERGE_GAP → extend cue 'a' cũ.
    // 'b' là cue riêng. Kết quả: 2 cues, cue[0].end = 2200+500, cue[0].start = 1000.
    expect(cues).toHaveLength(2);
    expect(cues[0]).toMatchObject({ text: 'a', start: 1000 });
    expect(cues[0]!.end).toBe(2200 + CUE_TAIL_MS);
    expect(cues[1]).toMatchObject({ text: 'b', start: 1660 });
  });
  it('same text beyond merge gap opens a NEW cue', () => {
    const t1 = 1000, t2 = t1 + CUE_TAIL_MS + CUE_MERGE_GAP_MS + 100;
    const cues = ocrTextToCues([{ text: 'a', timeMs: t1 }, { text: 'a', timeMs: t2 }]);
    expect(cues).toHaveLength(2);
  });
  it('empty detections → empty cues; single detection → single cue', () => {
    expect(ocrTextToCues([])).toEqual([]);
    expect(ocrTextToCues([{ text: 'x', timeMs: 5 }])).toHaveLength(1);
  });
});
