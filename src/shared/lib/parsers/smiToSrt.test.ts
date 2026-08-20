import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { convertSmiToSrt } from '@/shared/lib/parsers/smiToSrt';

const SAMPLES_DIR = resolve(
  process.cwd(),
  'tests/data-test/local-player/samples/smi',
);

function loadSample(name: string): string {
  return readFileSync(resolve(SAMPLES_DIR, name), 'utf-8');
}

describe('convertSmiToSrt', () => {
  it('sample-01: converts SMI to SRT with ms→timecode + computed end time', () => {
    const srt = convertSmiToSrt(loadSample('sample-01-basic.smi'));
    const blocks = srt.trim().split('\n\n');

    expect(blocks).toHaveLength(6);
    // Start=1000 not present here; first cue Start=0 → 00:00:00,000
    expect(blocks[0]).toBe(
      [
        '1',
        '00:00:00,000 --> 00:00:03,000',
        'Welcome to the presentation',
      ].join('\n'),
    );
    // Start=3000 → 00:00:03,000, end from next SYNC (6000)
    expect(blocks[1]).toBe(
      [
        '2',
        '00:00:03,000 --> 00:00:06,000',
        'Today we will discuss subtitle formats',
      ].join('\n'),
    );
    // Last cue: end = start + 2000 (no next SYNC)
    expect(blocks[5]).toBe(
      [
        '6',
        '00:00:15,000 --> 00:00:17,000',
        'Thank you for watching!',
      ].join('\n'),
    );
  });

  it('Start=1000 ms converts to 00:00:01,000 timecode', () => {
    // Build a minimal SMI with Start=1000 to verify ms→timecode.
    const smi = [
      '<SAMI>',
      '<BODY>',
      '<SYNC Start=1000><P Class=ENUSCC>First cue</P>',
      '<SYNC Start=4000><P Class=ENUSCC>Second cue</P>',
      '</BODY>',
      '</SAMI>',
    ].join('\n');
    const srt = convertSmiToSrt(smi);
    expect(srt).toContain('00:00:01,000 --> 00:00:04,000');
    expect(srt).toContain('First cue');
  });

  it('sample-02: extracts ENUSCC class only (multi-language)', () => {
    const srt = convertSmiToSrt(loadSample('sample-02-multilang.smi'));
    const blocks = srt.trim().split('\n\n');
    expect(blocks).toHaveLength(5);
    expect(blocks[0]).toContain('Welcome to our tutorial');
    expect(srt).not.toContain('우리의 튜토리얼');
  });

  it('sample-02: extracts KRCC class when specified', () => {
    const srt = convertSmiToSrt(loadSample('sample-02-multilang.smi'), 'KRCC');
    expect(srt).toContain('우리의 튜토리얼에 오신 것을 환영합니다');
    expect(srt).not.toContain('Welcome to our tutorial');
  });

  it('sample-05: preserves CJK characters in conversion', () => {
    const srt = convertSmiToSrt(loadSample('sample-05-cjk.smi'), 'KRCC');
    expect(srt).toContain('안녕하세요 여러분, 쇼에 오신 것을 환영합니다.');
  });

  it('strips HTML tags while preserving text', () => {
    const srt = convertSmiToSrt(loadSample('sample-03-html-formatting.smi'));
    expect(srt).not.toContain('<B>');
    expect(srt).not.toContain('<I>');
    expect(srt).not.toContain('<FONT');
    expect(srt).toContain('Welcome to the amazing world of SAMI!');
    // <BR> → newline
    expect(srt).toContain('Line one is bold\nLine two is italic');
  });

  it('drops empty cues (&nbsp;) from SRT output', () => {
    const srt = convertSmiToSrt(loadSample('sample-04-empty-sync.smi'));
    const blocks = srt.trim().split('\n\n');
    // 7 SYNC, 3 empty (&nbsp;/empty) → 4 non-empty cues
    expect(blocks).toHaveLength(4);
    expect(srt).toContain('This cue has text content.');
    expect(srt).toContain('The last cue with actual content.');
  });

  it('output ends with trailing newline', () => {
    const srt = convertSmiToSrt(loadSample('sample-01-basic.smi'));
    expect(srt.endsWith('\n')).toBe(true);
  });

  it('returns empty string for content with no SYNC blocks', () => {
    const smi = '<SAMI><HEAD><TITLE>Empty</TITLE></HEAD><BODY></BODY></SAMI>';
    expect(convertSmiToSrt(smi)).toBe('');
  });
});
