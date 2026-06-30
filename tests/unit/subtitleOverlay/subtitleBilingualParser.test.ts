import { parseBilingualSrt } from '@/features/subtitle/logic/subtitleBilingualParser';

describe('parseBilingualSrt', () => {
  // Bilingual SRT: 2 dòng/cue — target (lẻ) + native (chẵn)
  const bilingualSrt = `1
00:00:01,000 --> 00:00:03,000
Hello world
Xin chào thế giới

2
00:00:03,500 --> 00:00:05,000
How are you?
Bạn khỏe không?`;

  // Single-language SRT: 1 dòng/cue — chỉ target
  const singleLangSrt = `1
00:00:01,000 --> 00:00:03,000
Hello world

2
00:00:03,500 --> 00:00:05,000
How are you?`;

  // Multi-line target + native: > 2 dòng — dòng cuối = native, rest = target
  const multiLineSrt = `1
00:00:01,000 --> 00:00:03,000
Line one
Line two
Dòng một
Dòng hai`;

  it('parses bilingual SRT (2 lines/cue) into targetText + nativeText', () => {
    const result = parseBilingualSrt(bilingualSrt);
    expect(result.success).toBe(true);
    expect(result.cues).toHaveLength(2);
    expect(result.cues[0].targetText).toBe('Hello world');
    expect(result.cues[0].nativeText).toBe('Xin chào thế giới');
    expect(result.cues[1].targetText).toBe('How are you?');
    expect(result.cues[1].nativeText).toBe('Bạn khỏe không?');
  });

  it('parses single-language SRT (1 line/cue) with nativeText = empty', () => {
    const result = parseBilingualSrt(singleLangSrt);
    expect(result.success).toBe(true);
    expect(result.cues).toHaveLength(2);
    expect(result.cues[0].targetText).toBe('Hello world');
    expect(result.cues[0].nativeText).toBe('');
    expect(result.cues[1].targetText).toBe('How are you?');
    expect(result.cues[1].nativeText).toBe('');
  });

  it('parses multi-line cue (> 2 lines): last line = native, rest = target', () => {
    const result = parseBilingualSrt(multiLineSrt);
    expect(result.success).toBe(true);
    expect(result.cues).toHaveLength(1);
    // 4 lines: last = native, rest (3) = target
    // ponytail: ADR-005 D2 — if > 2 lines, last = native, rest = target
    expect(result.cues[0].targetText).toBe('Line one\nLine two\nDòng một');
    expect(result.cues[0].nativeText).toBe('Dòng hai');
  });

  it('preserves index, start, end from SRT cues', () => {
    const result = parseBilingualSrt(bilingualSrt);
    expect(result.cues[0].index).toBe(1);
    expect(result.cues[0].start).toBe(1000);
    expect(result.cues[0].end).toBe(3000);
    expect(result.cues[1].index).toBe(2);
    expect(result.cues[1].start).toBe(3500);
    expect(result.cues[1].end).toBe(5000);
  });

  it('returns error result for empty content', () => {
    const result = parseBilingualSrt('');
    expect(result.success).toBe(false);
    expect(result.cues).toHaveLength(0);
    expect(result.error).toBeDefined();
  });

  it('returns error result for invalid content (no timing)', () => {
    const result = parseBilingualSrt('not a subtitle');
    expect(result.success).toBe(false);
    expect(result.cues).toHaveLength(0);
    expect(result.error).toBeDefined();
  });

  it('handles BOM character', () => {
    const bomSrt = '\uFEFF' + bilingualSrt;
    const result = parseBilingualSrt(bomSrt);
    expect(result.success).toBe(true);
    expect(result.cues).toHaveLength(2);
  });

  it('handles CRLF line endings', () => {
    const crlfSrt = bilingualSrt.replace(/\n/g, '\r\n');
    const result = parseBilingualSrt(crlfSrt);
    expect(result.success).toBe(true);
    expect(result.cues).toHaveLength(2);
    expect(result.cues[0].targetText).toBe('Hello world');
    expect(result.cues[0].nativeText).toBe('Xin chào thế giới');
  });
});
