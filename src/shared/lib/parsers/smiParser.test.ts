import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseSmi } from '@/shared/lib/parsers/smiParser';
import type { SrtCue } from '@/entities/media';

const SAMPLES_DIR = resolve(
  process.cwd(),
  'tests/data-test/local-player/samples/smi',
);

function loadSample(name: string): string {
  return readFileSync(resolve(SAMPLES_DIR, name), 'utf-8');
}

describe('parseSmi', () => {
  it('throws on empty content', () => {
    expect(() => parseSmi('')).toThrow(Error);
    expect(() => parseSmi('   \n\n  ')).toThrow(Error);
  });

  // --- sample-01: basic single-language, 6 SYNC ---
  it('sample-01-basic: parses 6 SYNC blocks with correct Start + text', () => {
    const cues = parseSmi(loadSample('sample-01-basic.smi'));
    expect(cues).toHaveLength(6);
    expect(cues[0]).toEqual<SrtCue>({
      index: 1,
      start: 0,
      end: 3000,
      text: 'Welcome to the presentation',
    });
    expect(cues[1].start).toBe(3000);
    expect(cues[1].end).toBe(6000);
    expect(cues[1].text).toBe('Today we will discuss subtitle formats');
    expect(cues[5].start).toBe(15000);
    // last cue end = start + default 2000ms (no next SYNC)
    expect(cues[5].end).toBe(17000);
    expect(cues[5].text).toBe('Thank you for watching!');
  });

  // --- sample-02: multi-language ENUSCC + KRCC, 5 SYNC ---
  it('sample-02-multilang: extracts ENUSCC class by default, 5 SYNC', () => {
    const cues = parseSmi(loadSample('sample-02-multilang.smi'));
    expect(cues).toHaveLength(5);
    expect(cues[0].start).toBe(0);
    expect(cues[0].end).toBe(3000);
    expect(cues[0].text).toBe('Welcome to our tutorial');
    expect(cues[4].text).toBe('Thank you for watching!');
  });

  it('sample-02-multilang: extracts KRCC class when requested', () => {
    const cues = parseSmi(loadSample('sample-02-multilang.smi'), 'KRCC');
    expect(cues).toHaveLength(5);
    expect(cues[0].text).toBe('우리의 튜토리얼에 오신 것을 환영합니다');
    expect(cues[4].text).toBe('시청해주셔서 감사합니다!');
  });

  // --- sample-03: HTML formatting, 8 SYNC ---
  it('sample-03-html-formatting: strips HTML tags, preserves text, 8 SYNC', () => {
    const cues = parseSmi(loadSample('sample-03-html-formatting.smi'));
    expect(cues).toHaveLength(8);
    expect(cues[0].text).toBe('Welcome to the amazing world of SAMI!');
    expect(cues[2].text).toBe('Red text using font color tags.');
    // <BR> becomes newline
    expect(cues[6].text).toBe('Line one is bold\nLine two is italic');
  });

  // --- sample-04: empty SYNC blocks, 7 SYNC ---
  it('sample-04-empty-sync: handles &nbsp; and empty <P>, 7 SYNC', () => {
    const cues = parseSmi(loadSample('sample-04-empty-sync.smi'));
    expect(cues).toHaveLength(7);
    expect(cues[0].text).toBe('This cue has text content.');
    // &nbsp; → empty after trim
    expect(cues[1].text).toBe('');
    expect(cues[2].text).toBe('This cue also has text content.');
    // empty <P></P>
    expect(cues[3].text).toBe('');
    expect(cues[6].text).toBe('The last cue with actual content.');
  });

  // --- sample-05: CJK 4 languages, 4 SYNC ---
  it('sample-05-cjk: preserves CJK characters, 4 SYNC', () => {
    const cues = parseSmi(loadSample('sample-05-cjk.smi'));
    expect(cues).toHaveLength(4);
    expect(cues[0].text).toBe('Hello everyone, welcome to the show.');
    expect(cues[3].text).toBe(
      'Special characters: café, naïve, résumé, façade',
    );
  });

  it('sample-05-cjk: extracts KRCC class', () => {
    const cues = parseSmi(loadSample('sample-05-cjk.smi'), 'KRCC');
    expect(cues[0].text).toBe(
      '안녕하세요 여러분, 쇼에 오신 것을 환영합니다.',
    );
  });

  // --- sample-06: long text, 4 SYNC ---
  it('sample-06-long-text: preserves paragraph-length cues, 4 SYNC', () => {
    const cues = parseSmi(loadSample('sample-06-long-text.smi'));
    expect(cues).toHaveLength(4);
    expect(cues[0].start).toBe(0);
    expect(cues[0].end).toBe(10000);
    expect(cues[0].text).toContain('Welcome to this comprehensive lecture');
    expect(cues[3].start).toBe(30000);
  });

  // --- sample-07: nested tags, 6 SYNC ---
  it('sample-07-nested-tags: strips nested HTML tags, 6 SYNC', () => {
    const cues = parseSmi(loadSample('sample-07-nested-tags.smi'));
    expect(cues).toHaveLength(6);
    expect(cues[0].text).toBe('Deeply nested formatting in one line.');
    expect(cues[1].text).toBe('Bold inside font color with outer text.');
  });

  // --- sample-08: CSS styling, 5 SYNC ---
  it('sample-08-css-styling: parses CSS in HEAD + ID styles, 5 SYNC', () => {
    const cues = parseSmi(loadSample('sample-08-css-styling.smi'));
    expect(cues).toHaveLength(5);
    // First SYNC has two ENUSCC P tags: ID=Source (speaker) + caption.
    // Default extracts ENUSCC — first matching P block (speaker label).
    expect(cues[0].text).toBe('The Speaker');
    expect(cues[1].text).toBe('Dr. Smith');
  });

  // --- sample-09: sync gaps, 8 SYNC ---
  it('sample-09-sync-gaps: handles 12-20s silent periods, 8 SYNC', () => {
    const cues = parseSmi(loadSample('sample-09-sync-gaps.smi'));
    expect(cues).toHaveLength(8);
    expect(cues[0].start).toBe(0);
    expect(cues[0].end).toBe(3000);
    // 12s gap: 3000 → 15000
    expect(cues[1].start).toBe(3000);
    expect(cues[1].end).toBe(15000);
    expect(cues[1].text).toBe('');
    expect(cues[2].start).toBe(15000);
    // 20s gap: 40000 → 60000
    expect(cues[6].start).toBe(40000);
    expect(cues[6].end).toBe(60000);
    expect(cues[6].text).toBe('');
  });

  // --- sample-10: sound effects, 10 SYNC ---
  it('sample-10-sound-effects: preserves [MUSIC] bracket text, 10 SYNC', () => {
    const cues = parseSmi(loadSample('sample-10-sound-effects.smi'));
    expect(cues).toHaveLength(10);
    expect(cues[0].text).toBe('[MUSIC] Intro music playing softly.');
    expect(cues[9].text).toBe('[GLASS BREAKING] A window shatters loudly.');
  });

  // --- sample-11: minimal (no HEAD), 3 SYNC ---
  it('sample-11-minimal: parses without HEAD section, 3 SYNC', () => {
    const cues = parseSmi(loadSample('sample-11-minimal.smi'), 'ENCC');
    expect(cues).toHaveLength(3);
    expect(cues[0].start).toBe(0);
    expect(cues[0].end).toBe(2000);
    expect(cues[0].text).toBe('First subtitle');
    expect(cues[2].start).toBe(4000);
  });

  it('sample-11-minimal: defaults to first P class when preferred absent', () => {
    // ENUSCC not present → fall back to first P class (ENCC)
    const cues = parseSmi(loadSample('sample-11-minimal.smi'));
    expect(cues).toHaveLength(3);
    expect(cues[0].text).toBe('First subtitle');
  });

  // --- sample-12: multiple P classes per SYNC, 3 SYNC ---
  it('sample-12-multiple-p-classes: 6 P per SYNC, extracts ENUSCC, 3 SYNC', () => {
    const cues = parseSmi(loadSample('sample-12-multiple-p-classes.smi'));
    expect(cues).toHaveLength(3);
    // First ENUSCC P is the ID=Source speaker label
    expect(cues[0].text).toBe('Narrator');
    expect(cues[1].text).toBe('Hero');
  });

  // --- format quirk: end time computed from next SYNC Start ---
  it('computes end time from next SYNC Start (no explicit end in SAMI)', () => {
    const cues = parseSmi(loadSample('sample-01-basic.smi'));
    for (let i = 0; i < cues.length - 1; i++) {
      expect(cues[i].end).toBe(cues[i + 1].start);
    }
  });

  // --- format quirk: sequential 1-based index ---
  it('assigns sequential 1-based indices', () => {
    const cues = parseSmi(loadSample('sample-01-basic.smi'));
    cues.forEach((cue, i) => {
      expect(cue.index).toBe(i + 1);
    });
  });
});
