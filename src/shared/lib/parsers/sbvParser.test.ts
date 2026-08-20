import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseSbv } from './sbvParser';
import type { SrtCue } from '@/entities/media';

/**
 * SBV (SubViewer) parser tests — loads ALL 12 real-world sample files from
 * `tests/data-test/local-player/samples/sbv/` and verifies cue count,
 * timestamps, and text content per the YouTube SBV format spec.
 *
 * Source: YouTube Help — Supported subtitle and closed caption files
 *   https://support.google.com/youtube/answer/2734698
 *   "No style info (markup) is recognized. The file must be in plain UTF-8."
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

describe('parseSbv', () => {
  test('throws on empty content', () => {
    expect(() => parseSbv('')).toThrow();
    expect(() => parseSbv('   \n\n  ')).toThrow();
  });

  test('sample-01-basic.sbv → 6 cues, single-digit hours, no header', () => {
    const cues = parseSbv(loadSample('sample-01-basic.sbv'));
    expect(cues).toHaveLength(6);
    // First cue: 0:00:00.940,0:00:05.050
    expect(cues[0]).toEqual<SrtCue>({
      index: 1,
      start: 940,
      end: 5050,
      text: 'This is a test of the SBV file converter.',
    });
    // Last cue: 0:00:24.810,0:00:25.430
    expect(cues[5]).toEqual<SrtCue>({
      index: 6,
      start: 24810,
      end: 25430,
      text: 'files.',
    });
  });

  test('sample-02-multiline.sbv → 6 cues, multi-line text preserved, leading space trimmed', () => {
    const cues = parseSbv(loadSample('sample-02-multiline.sbv'));
    expect(cues).toHaveLength(6);
    // First cue has leading space " TIM:" → trimmed; multi-line joined with \n
    expect(cues[0].text).toBe(
      'TIM: So its 1976 I\'m coming to the end\nof my career at Oxford learning physics -',
    );
    // Last cue
    expect(cues[5].text).toBe(
      'But I know I need to make a change.\nI can\'t stay here forever.',
    );
    expect(cues[5].start).toBe(39000);
    expect(cues[5].end).toBe(45000);
  });

  test('sample-03-special-chars.sbv → 10 cues, CJK + accents preserved (UTF-8)', () => {
    const cues = parseSbv(loadSample('sample-03-special-chars.sbv'));
    expect(cues).toHaveLength(10);
    expect(cues[0].text).toBe('Bonjour tout le monde, comment allez-vous?');
    // CJK Chinese
    expect(cues[2].text).toBe('大家好，欢迎收看今天的节目。');
    // CJK Japanese
    expect(cues[3].text).toBe('こんにちは、今日は良い天気ですね。');
    // German umlauts + ß
    expect(cues[8].text).toBe(
      'Über den Flügen fliegen Vögel — German umlauts: ä ö ü ß',
    );
    // French apostrophes + accents
    expect(cues[9].text).toBe(
      "C'est l'été à Paris — French apostrophes and accents: é è ê ë",
    );
  });

  test('sample-04-html-tags.sbv → 8 cues, HTML tags stripped per YouTube spec', () => {
    const cues = parseSbv(loadSample('sample-04-html-tags.sbv'));
    expect(cues).toHaveLength(8);
    // <b>Welcome</b> → Welcome
    expect(cues[0].text).toBe('Welcome to the amazing world of subtitles!');
    // <b><i>Bold and italic combined</i></b>
    expect(cues[3].text).toBe('Bold and italic combined in one line.');
    // <font color="red">Red text</font>
    expect(cues[4].text).toBe('Red text using font tags.');
    // Multi-line with tags
    expect(cues[6].text).toBe('Line one is bold\nLine two is italic');
  });

  test('sample-05-empty-cues.sbv → 7 cues, empty text cues kept as blank', () => {
    const cues = parseSbv(loadSample('sample-05-empty-cues.sbv'));
    expect(cues).toHaveLength(7);
    expect(cues[0].text).toBe('This cue has text.');
    // Empty cue (index 2)
    expect(cues[1].text).toBe('');
    expect(cues[1].start).toBe(3500);
    expect(cues[1].end).toBe(6500);
    // Another empty cue (index 4)
    expect(cues[3].text).toBe('');
    // Last cue has content
    expect(cues[6].text).toBe('The last cue with actual content.');
  });

  test('sample-06-short-cues.sbv → 11 cues, <1s duration precision', () => {
    const cues = parseSbv(loadSample('sample-06-short-cues.sbv'));
    expect(cues).toHaveLength(11);
    // 0:00:00.000,0:00:00.400 → 400ms duration
    expect(cues[0].start).toBe(0);
    expect(cues[0].end).toBe(400);
    expect(cues[0].text).toBe('Hi!');
    // Last: 0:00:04.200,0:00:04.500
    expect(cues[10].start).toBe(4200);
    expect(cues[10].end).toBe(4500);
    expect(cues[10].text).toBe('Done!');
  });

  test('sample-07-long-cues.sbv → 6 cues, >10s duration + single-digit hours at 1min', () => {
    const cues = parseSbv(loadSample('sample-07-long-cues.sbv'));
    expect(cues).toHaveLength(6);
    // 0:00:45.000,0:01:00.000 → single-digit hour "0:01:00.000"
    expect(cues[3].start).toBe(45000);
    expect(cues[3].end).toBe(60000);
    // 0:01:15.000,0:01:30.000
    expect(cues[5].start).toBe(75000);
    expect(cues[5].end).toBe(90000);
  });

  test('sample-08-overlapping.sbv → 6 cues, overlapping timestamps parsed as-is', () => {
    const cues = parseSbv(loadSample('sample-08-overlapping.sbv'));
    expect(cues).toHaveLength(6);
    // Cue 1: 0-5000, Cue 2: 3000-8000 (overlaps cue 1)
    expect(cues[0].start).toBe(0);
    expect(cues[0].end).toBe(5000);
    expect(cues[1].start).toBe(3000);
    expect(cues[1].end).toBe(8000);
    // Last: 0:00:16.000,0:00:20.000
    expect(cues[5].start).toBe(16000);
    expect(cues[5].end).toBe(20000);
  });

  test('sample-09-single-cue.sbv → 1 cue, minimal valid file', () => {
    const cues = parseSbv(loadSample('sample-09-single-cue.sbv'));
    expect(cues).toHaveLength(1);
    expect(cues[0]).toEqual<SrtCue>({
      index: 1,
      start: 0,
      end: 5000,
      text: 'This is the only cue in this entire file.',
    });
  });

  test('sample-10-long-content.sbv → 60 cues, scale test', () => {
    const cues = parseSbv(loadSample('sample-10-long-content.sbv'));
    expect(cues).toHaveLength(60);
    expect(cues[0].text).toBe('Welcome to the lecture on machine learning.');
    expect(cues[0].start).toBe(0);
    // Last cue: 0:01:58.000,0:02:00.000
    expect(cues[59].start).toBe(118000);
    expect(cues[59].end).toBe(120000);
    expect(cues[59].text).toBe(
      'That concludes our lecture for today. Thank you!',
    );
    // Sequential indices 1..60
    expect(cues[0].index).toBe(1);
    expect(cues[59].index).toBe(60);
  });

  test('sample-11-sound-effects.sbv → 12 cues, [MUSIC] preserved in text', () => {
    const cues = parseSbv(loadSample('sample-11-sound-effects.sbv'));
    expect(cues).toHaveLength(12);
    expect(cues[0].text).toBe('[MUSIC] Intro music playing softly.');
    expect(cues[1].text).toBe('[APPLAUSE] The audience claps enthusiastically.');
    expect(cues[11].text).toBe('[UPBEAT MUSIC] The theme song begins playing.');
  });

  test('sample-12-parentheses.sbv → 12 cues, (applause) preserved in text', () => {
    const cues = parseSbv(loadSample('sample-12-parentheses.sbv'));
    expect(cues).toHaveLength(12);
    expect(cues[0].text).toBe('(quietly) Can you keep it down?');
    expect(cues[3].text).toBe('(applause) Thank you, thank you all!');
    expect(cues[11].text).toBe('(cheering) We did it! We actually did it!');
  });

  test('format quirks: single-digit hours, no header, no cue indices, leading spaces', () => {
    // Inline minimal SBV with single-digit hour
    const inline = '0:00:01.000,0:00:03.000,Hello inline';
    const cues = parseSbv(inline);
    expect(cues).toHaveLength(1);
    expect(cues[0].start).toBe(1000);
    expect(cues[0].end).toBe(3000);
    expect(cues[0].text).toBe('Hello inline');
  });

  test('handles CRLF line endings', () => {
    const crlf = '0:00:01.000,0:00:03.000\r\nLine one\r\nLine two\r\n\r\n0:00:04.000,0:00:06.000\r\nSecond\r\n';
    const cues = parseSbv(crlf);
    expect(cues).toHaveLength(2);
    expect(cues[0].text).toBe('Line one\nLine two');
    expect(cues[1].text).toBe('Second');
  });

  test('strips BOM if present', () => {
    const bom = '\uFEFF0:00:01.000,0:00:03.000\nHello';
    const cues = parseSbv(bom);
    expect(cues).toHaveLength(1);
    expect(cues[0].text).toBe('Hello');
  });
});
