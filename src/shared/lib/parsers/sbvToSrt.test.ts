import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { convertSbvToSrt } from './sbvToSrt';

/**
 * SBV → SRT converter tests.
 *
 * Verifies:
 * - Timestamp format conversion: `0:00:01.000,0:00:03.000` → `00:00:01,000 --> 00:00:03,000`
 *   (single-digit hours padded to 2 digits, comma decimal separator, ` --> ` arrow)
 * - Cue numbering added (SRT requires sequential 1-based indices)
 * - Cue text preservation (multi-line, special chars)
 *
 * Source: YouTube Help — https://support.google.com/youtube/answer/2734698
 */
const SAMPLES_DIR = join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'tests',
  'data-test',
  'local-player',
  'samples',
  'sbv',
);

function loadSample(name: string): string {
  return readFileSync(join(SAMPLES_DIR, name), 'utf-8');
}

describe('convertSbvToSrt', () => {
  test('converts sample-01-basic.sbv: timestamp format + sequential numbering', () => {
    const srt = convertSbvToSrt(loadSample('sample-01-basic.sbv'));

    // First cue: 0:00:00.940,0:00:05.050 → 00:00:00,940 --> 00:00:05,050
    expect(srt).toContain('1\n00:00:00,940 --> 00:00:05,050\nThis is a test of the SBV file converter.');
    // Last cue: 0:00:24.810,0:00:25.430 → index 6
    expect(srt).toContain('6\n00:00:24,810 --> 00:00:25,430\nfiles.');
    // No SBV-style single-digit hours remain
    expect(srt).not.toMatch(/^0:\d{2}:\d{2}\.\d{3},/m);
  });

  test('converts sample-02-multiline.sbv: multi-line text preserved', () => {
    const srt = convertSbvToSrt(loadSample('sample-02-multiline.sbv'));

    // First cue multi-line, leading space trimmed
    expect(srt).toContain(
      "1\n00:00:00,000 --> 00:00:07,000\nTIM: So its 1976 I'm coming to the end\nof my career at Oxford learning physics -",
    );
    // 6 cues → indices 1..6
    expect(srt).toContain('6\n00:00:39,000 --> 00:00:45,000');
  });

  test('converts sample-03-special-chars.sbv: CJK + accents preserved', () => {
    const srt = convertSbvToSrt(loadSample('sample-03-special-chars.sbv'));

    expect(srt).toContain('1\n00:00:00,000 --> 00:00:03,000\nBonjour tout le monde, comment allez-vous?');
    // CJK
    expect(srt).toContain('大家好，欢迎收看今天的节目。');
    expect(srt).toContain('こんにちは、今日は良い天気ですね。');
    // 10 cues → last index 10
    expect(srt).toContain('10\n00:00:31,500 --> 00:00:34,500');
  });

  test('adds sequential cue numbering (SRT requires indices)', () => {
    const srt = convertSbvToSrt(loadSample('sample-10-long-content.sbv'));
    // 60 cues → first index 1, last index 60
    expect(srt).toMatch(/^1\n/m);
    expect(srt).toContain('60\n00:01:58,000 --> 00:02:00,000');
  });

  test('timestamp conversion: single-digit hour padded to 2 digits', () => {
    const sbv = '0:01:30.000,0:01:35.000\nOver one minute';
    const srt = convertSbvToSrt(sbv);
    expect(srt).toContain('00:01:30,000 --> 00:01:35,000');
    // No SBV-style single-digit hour at the start of a timestamp (SRT pads to 2).
    expect(srt).not.toMatch(/(^|\n)0:\d{2}:\d{2},\d{3}/);
  });

  test('inline variant (text on timestamp line) converts correctly', () => {
    const sbv = '0:00:01.000,0:00:03.000,Inline text';
    const srt = convertSbvToSrt(sbv);
    expect(srt).toBe('1\n00:00:01,000 --> 00:00:03,000\nInline text\n');
  });

  test('output ends with trailing newline', () => {
    const srt = convertSbvToSrt('0:00:01.000,0:00:03.000\nHello');
    expect(srt.endsWith('\n')).toBe(true);
  });

  test('empty content returns empty string', () => {
    expect(convertSbvToSrt('')).toBe('');
    expect(convertSbvToSrt('   \n\n  ')).toBe('');
  });
});
