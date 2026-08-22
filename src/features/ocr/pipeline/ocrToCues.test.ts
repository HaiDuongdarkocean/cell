// ocrToCues.test.ts — TDD: 10 test cases cho dedup algorithm.
// Mỗi test mô phỏng 1 real-world OCR duplicate scenario.
import { describe, expect, it } from '@jest/globals';
import { ocrTextToCues, CUE_TAIL_MS, CUE_MERGE_GAP_MS, normalizeText } from './ocrToCues';

describe('ocrTextToCues — 10 subtitle dedup scenarios', () => {
  // 1. Exact duplicate within merge gap → 1 cue (baseline, đã hoạt động)
  it('1. exact duplicate within gap → 1 cue', () => {
    const cues = ocrTextToCues([
      { text: 'hello', timeMs: 1000 }, { text: 'hello', timeMs: 1330 }, { text: 'hello', timeMs: 1660 },
    ]);
    expect(cues).toHaveLength(1);
    expect(cues[0]).toMatchObject({ start: 1000, text: 'hello', index: 0 });
  });

  // 2. Trailing space variation → 1 cue (normalization fix)
  it('2. trailing space variation → 1 cue', () => {
    const cues = ocrTextToCues([
      { text: 'Hello world', timeMs: 1000 },
      { text: 'Hello world ', timeMs: 1330 },
      { text: ' Hello world ', timeMs: 1660 },
    ]);
    expect(cues).toHaveLength(1);
    expect(cues[0]).toMatchObject({ start: 1000, text: 'Hello world' });
  });

  // 3. Case variation → 1 cue (case-insensitive merge)
  it('3. case variation → 1 cue', () => {
    const cues = ocrTextToCues([
      { text: 'Hello World', timeMs: 1000 },
      { text: 'hello world', timeMs: 1330 },
      { text: 'HELLO WORLD', timeMs: 1660 },
    ]);
    expect(cues).toHaveLength(1);
    expect(cues[0]).toMatchObject({ start: 1000, text: 'Hello World' });
  });

  // 4. Punctuation noise → 1 cue (strip trailing punctuation)
  it('4. punctuation noise → 1 cue', () => {
    const cues = ocrTextToCues([
      { text: 'Hello', timeMs: 1000 },
      { text: 'Hello!', timeMs: 1330 },
      { text: 'Hello.', timeMs: 1660 },
    ]);
    expect(cues).toHaveLength(1);
    expect(cues[0]).toMatchObject({ start: 1000, text: 'Hello' });
  });

  // 5. Flicker: A → miss → A within gap → 1 cue (flicker protection, baseline)
  it('5. flicker A → miss → A within gap → 1 cue', () => {
    const cues = ocrTextToCues([
      { text: 'a', timeMs: 1000 }, { text: 'a', timeMs: 1330 },
      { text: 'b', timeMs: 1660 },
      { text: 'a', timeMs: 1900 },
      { text: 'a', timeMs: 2200 },
    ]);
    expect(cues).toHaveLength(2);
    expect(cues[0]).toMatchObject({ text: 'a', start: 1000 });
    expect(cues[1]).toMatchObject({ text: 'b', start: 1660 });
  });

  // 6. Same text beyond merge gap, NOTHING between → 1 cue (post-dedup merges
  //    consecutive same-text cues regardless of gap — real OCR detects the same
  //    subtitle every 3-4s while it stays on screen; each detection beyond 700ms
  //    gap created a duplicate cue. Same subtitle line = 1 cue.)
  it('6. same text beyond gap, nothing between → 1 cue (post-dedup merge)', () => {
    const t1 = 1000, t2 = t1 + CUE_TAIL_MS + CUE_MERGE_GAP_MS + 100;
    const cues = ocrTextToCues([{ text: 'a', timeMs: t1 }, { text: 'a', timeMs: t2 }]);
    expect(cues).toHaveLength(1);
    expect(cues[0]).toMatchObject({ start: t1, text: 'a' });
  });

  // 7. 10 unique sentences → 10 cues (no false positives)
  it('7. 10 unique sentences → 10 cues', () => {
    const detections = Array.from({ length: 10 }, (_, i) => ({
      text: `Sentence ${i + 1} is unique`,
      timeMs: 1000 + i * 3000,
    }));
    const cues = ocrTextToCues(detections);
    expect(cues).toHaveLength(10);
    cues.forEach((c, i) => expect(c.text).toBe(`Sentence ${i + 1} is unique`));
  });

  // 8. OCR noise: "Hello" → "Hello!" → "Hello" → 1 cue (fuzzy merge)
  it('8. OCR noise with punctuation flicker → 1 cue', () => {
    const cues = ocrTextToCues([
      { text: 'Hello', timeMs: 1000 },
      { text: 'Hello!', timeMs: 1330 },
      { text: 'Hello', timeMs: 1660 },
      { text: 'Hello.', timeMs: 1990 },
    ]);
    expect(cues).toHaveLength(1);
    expect(cues[0]).toMatchObject({ start: 1000, text: 'Hello' });
  });

  // 9. Long subtitle: 15 detections over 5s → 1 cue (long merge)
  it('9. long subtitle 15 detections over 5s → 1 cue', () => {
    const detections = Array.from({ length: 15 }, (_, i) => ({
      text: 'What have you been up to',
      timeMs: 1000 + i * 350,
    }));
    const cues = ocrTextToCues(detections);
    expect(cues).toHaveLength(1);
    expect(cues[0]).toMatchObject({ start: 1000, text: 'What have you been up to' });
  });

  // 10. Alternating A → B → A → B → 4 cues (not merged — different text between)
  it('10. alternating A → B → A → B → 4 cues', () => {
    const cues = ocrTextToCues([
      { text: 'Hello', timeMs: 1000 },
      { text: 'Goodbye', timeMs: 2000 },
      { text: 'Hello', timeMs: 3000 },
      { text: 'Goodbye', timeMs: 4000 },
    ]);
    // Post-dedup only merges CONSECUTIVE same-text cues. Hello/Goodbye/Hello/Goodbye
    // → no consecutive same-text pairs → 4 cues (correct: these ARE different lines).
    expect(cues).toHaveLength(4);
  });

  // 11. E2E scenario: same subtitle detected every 3-4s (beyond merge gap) with
  //     leading space variation → 1 cue (the real-world duplicate the user reported).
  it('11. E2E: same subtitle 3-4s apart with space variation → 1 cue', () => {
    const cues = ocrTextToCues([
      { text: 'Are you still getting up late in the morning', timeMs: 26832 },
      { text: ' Are you still getting up late in the morning', timeMs: 30959 },
    ]);
    expect(cues).toHaveLength(1);
    expect(cues[0]).toMatchObject({ start: 26832, text: 'Are you still getting up late in the morning' });
  });

  // 12. E2E scenario: "After you've reached your goal" detected 3 times over 6s
  //     with space + exact variations → 1 cue.
  it('12. E2E: same subtitle 3x over 6s → 1 cue', () => {
    const cues = ocrTextToCues([
      { text: "After you've reached your goal", timeMs: 39407 },
      { text: " After you've reached your goal", timeMs: 42296 },
      { text: "After you've reached your goal", timeMs: 44408 },
    ]);
    expect(cues).toHaveLength(1);
    expect(cues[0]).toMatchObject({ start: 39407, text: "After you've reached your goal" });
  });

  // 13. OCR typo: "stll" vs "still" (1 char missing) → 1 cue (fuzzy match)
  it('13. OCR typo stll vs still → 1 cue', () => {
    const cues = ocrTextToCues([
      { text: 'Are you still getting up late in the morning', timeMs: 26978 },
      { text: ' Are you stll getting up late in the morning', timeMs: 31001 },
      { text: 'Are you still getting up late in the morning', timeMs: 31933 },
    ]);
    expect(cues).toHaveLength(1);
    expect(cues[0]).toMatchObject({ start: 26978, text: 'Are you still getting up late in the morning' });
  });

  // 14. Trailing OCR garbage: "emotions 4", "emotions A" → 1 cue
  it('14. trailing OCR garbage (digits/letters) → 1 cue', () => {
    const cues = ocrTextToCues([
      { text: "Don't stop giving me all your emotions", timeMs: 75462 },
      { text: "Don't stop giving me all your emotions 4", timeMs: 77151 },
      { text: "Don't stop giving me all your emotions A", timeMs: 78690 },
      { text: "Don't stop giving me all your emotions", timeMs: 79958 },
    ]);
    expect(cues).toHaveLength(1);
    expect(cues[0]).toMatchObject({ start: 75462, text: "Don't stop giving me all your emotions" });
  });

  // 15. Trailing OCR garbage multi-char: "TOJEETA", "103B?入" → 1 cue (prefix match)
  it('15. trailing OCR garbage multi-char (TOJEETA, 103B) → 1 cue', () => {
    const cues = ocrTextToCues([
      { text: 'My ego got in the way', timeMs: 51023 },
      { text: ' My ego got in the way TOJEETA', timeMs: 52528 },
      { text: ' My ego got in the way', timeMs: 52981 },
      { text: 'My ego got in the way 103B?入', timeMs: 53796 },
    ]);
    expect(cues).toHaveLength(1);
    expect(cues[0]).toMatchObject({ start: 51023, text: 'My ego got in the way' });
  });

  // 16. Short subtitle (28 chars) with OCR typo: "Wll" vs "Will" → 1 cue
  //     Edgecase từ E2E 3+ phút: "Will you still take me back" (28 chars) < 30
  //     cũ threshold → không fuzzy match → 4 duplicate cues.
  it('16. short subtitle (28 chars) OCR typo Wll vs Will → 1 cue', () => {
    const cues = ocrTextToCues([
      { text: 'Will you still take me back', timeMs: 171514 },
      { text: 'Wll you still take me back', timeMs: 171912 },
      { text: 'Wil you still take me back', timeMs: 174469 },
      { text: 'Will you still take me back', timeMs: 174946 },
    ]);
    expect(cues).toHaveLength(1);
    expect(cues[0]).toMatchObject({ start: 171514, text: 'Will you still take me back' });
  });

  // 17. OCR misread "I'll" → "IM" / "IIl" / "I" (edit distance 2) → 1 cue
  //     Edgecase từ E2E 3+ phút: OCR nuốt apostrophe, misread "I'll" thành
  //     "IM", "IIl", "I". Edit distance 2 nhưng threshold cũ chỉ 1 → không merge.
  it('17. OCR misread Ill → IM / IIl / I (edit distance 2) → 1 cue', () => {
    const cues = ocrTextToCues([
      { text: "IM be a different and better version of me", timeMs: 104778 },
      { text: "IIl be a different and better version of me", timeMs: 105335 },
      { text: "I be a different and better version of me", timeMs: 107588 },
    ]);
    expect(cues).toHaveLength(1);
    expect(cues[0]).toMatchObject({ start: 104778, text: "IM be a different and better version of me" });
  });

  // ─── normalizeText unit tests ───
  describe('normalizeText', () => {
    it('trims leading/trailing whitespace', () => {
      expect(normalizeText('  hello  ')).toBe('hello');
    });
    it('collapses internal whitespace', () => {
      expect(normalizeText('hello    world')).toBe('hello world');
    });
    it('lowercases', () => {
      expect(normalizeText('HELLO')).toBe('hello');
    });
    it('strips trailing punctuation', () => {
      expect(normalizeText('Hello!')).toBe('hello');
      expect(normalizeText('Hello.')).toBe('hello');
      expect(normalizeText('Hello?')).toBe('hello');
    });
    it('preserves internal punctuation', () => {
      expect(normalizeText("don't worry")).toBe("don't worry");
    });
    it('strips trailing single-char OCR garbage (digits/letters)', () => {
      expect(normalizeText('emotions 4')).toBe('emotions');
      expect(normalizeText('emotions A')).toBe('emotions');
      expect(normalizeText('emotions a')).toBe('emotions');
    });
  });

  // ─── Legacy tests (backward compat) ───
  it('text change closes cue and opens new one; timeline continuity extends cue[0].end to cue[1].start', () => {
    const cues = ocrTextToCues([
      { text: 'a', timeMs: 1000 }, { text: 'b', timeMs: 2000 },
    ]);
    expect(cues).toHaveLength(2);
    expect(cues[0]!.end).toBe(2000);
    expect(cues[1]!.start).toBe(2000);
  });

  it('empty detections → empty cues; single detection → single cue', () => {
    expect(ocrTextToCues([])).toEqual([]);
    expect(ocrTextToCues([{ text: 'x', timeMs: 5 }])).toHaveLength(1);
  });
});
