import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeSrt } from '@/lib/converters/srtNormalizer';

describe('normalizeSrt', () => {
  it('passes through already-clean SRT unchanged', () => {
    const srt = [
      '1',
      '00:00:01,000 --> 00:00:05,000',
      'Hello World',
      '',
      '2',
      '00:00:06,000 --> 00:00:10,000',
      'Second cue',
      '',
    ].join('\n');

    expect(normalizeSrt(srt)).toBe(srt);
  });

  it('strips VTT/ASS override tags {\\an8} from cue text', () => {
    const srt = [
      '1',
      '00:00:01,000 --> 00:00:05,000',
      '{\\an8}Stay with me.',
      '',
    ].join('\n');

    const result = normalizeSrt(srt);

    expect(result).not.toContain('{\\an8}');
    expect(result).toContain('Stay with me.');
  });

  it('strips all HTML/VTT tags (<i>, <b>, <u>, <c>, <v>) from cue text', () => {
    const srt = [
      '1',
      '00:00:01,000 --> 00:00:05,000',
      '<i>Italic text</i>',
      '',
      '2',
      '00:00:06,000 --> 00:00:10,000',
      '<c.yellow>Yellow</c> and <v Bob>Bob said</v>',
      '',
      '3',
      '00:00:11,000 --> 00:00:15,000',
      '{\\an8}<i>Combined tags</i>',
      '',
    ].join('\n');

    const result = normalizeSrt(srt);

    expect(result).not.toContain('<i>');
    expect(result).not.toContain('</i>');
    expect(result).not.toContain('<c');
    expect(result).not.toContain('</c>');
    expect(result).not.toContain('<v');
    expect(result).not.toContain('</v>');
    expect(result).not.toContain('{\\an8}');
    expect(result).toContain('Italic text');
    expect(result).toContain('Yellow and Bob said');
    expect(result).toContain('Combined tags');
  });

  it('converts dot timestamps to comma (VTT-style → SRT-style)', () => {
    const srt = [
      '1',
      '00:00:01.000 --> 00:00:05.000',
      'Dot timestamps',
      '',
    ].join('\n');

    const result = normalizeSrt(srt);

    expect(result).toContain('00:00:01,000 --> 00:00:05,000');
    expect(result).not.toContain('00:00:01.000');
  });

  it('pads MM:SS.mmm timestamps to HH:MM:SS,mmm', () => {
    const srt = [
      '1',
      '01:05.000 --> 02:10.000',
      'No hours',
      '',
    ].join('\n');

    const result = normalizeSrt(srt);

    expect(result).toContain('00:01:05,000 --> 00:02:10,000');
  });

  it('strips WEBVTT header (file was VTT renamed to .srt)', () => {
    const content = [
      'WEBVTT',
      '',
      '1',
      '00:00:01.000 --> 00:00:05.000',
      'Hello',
      '',
    ].join('\n');

    const result = normalizeSrt(content);

    expect(result).not.toContain('WEBVTT');
    expect(result).toContain('00:00:01,000 --> 00:00:05,000');
    expect(result).toContain('Hello');
  });

  it('strips WEBVTT header with metadata lines', () => {
    const content = [
      'WEBVTT',
      'NOTE This is a comment',
      'REGION id:top width:50%',
      '',
      '00:00:01.000 --> 00:00:05.000',
      'Hello',
      '',
    ].join('\n');

    const result = normalizeSrt(content);

    expect(result).not.toContain('WEBVTT');
    expect(result).not.toContain('NOTE');
    expect(result).not.toContain('REGION');
    expect(result).toContain('Hello');
  });

  it('strips cue settings from timing line (align, line, position)', () => {
    const srt = [
      '1',
      '00:00:01,000 --> 00:00:05,000 align:start line:0 position:50%',
      'Cue with settings',
      '',
    ].join('\n');

    const result = normalizeSrt(srt);

    expect(result).toContain('00:00:01,000 --> 00:00:05,000');
    expect(result).not.toContain('align:start');
    expect(result).not.toContain('line:0');
    expect(result).not.toContain('position:50%');
    expect(result).toContain('Cue with settings');
  });

  it('re-numbers cues sequentially from 1', () => {
    const srt = [
      '42',
      '00:00:01,000 --> 00:00:02,000',
      'First',
      '',
      '99',
      '00:00:03,000 --> 00:00:04,000',
      'Second',
      '',
      '7',
      '00:00:05,000 --> 00:00:06,000',
      'Third',
      '',
    ].join('\n');

    const result = normalizeSrt(srt);

    expect(result).toContain('1\n00:00:01,000 --> 00:00:02,000\nFirst');
    expect(result).toContain('2\n00:00:03,000 --> 00:00:04,000\nSecond');
    expect(result).toContain('3\n00:00:05,000 --> 00:00:06,000\nThird');
    expect(result).not.toMatch(/^42$/m);
    expect(result).not.toMatch(/^99$/m);
    expect(result).not.toMatch(/^7$/m);
  });

  it('handles cues without sequence numbers', () => {
    const srt = [
      '00:00:01,000 --> 00:00:02,000',
      'First',
      '',
      '00:00:03,000 --> 00:00:04,000',
      'Second',
      '',
    ].join('\n');

    const result = normalizeSrt(srt);

    expect(result).toContain('1\n00:00:01,000 --> 00:00:02,000\nFirst');
    expect(result).toContain('2\n00:00:03,000 --> 00:00:04,000\nSecond');
  });

  it('drops cues that become empty after stripping tags', () => {
    const srt = [
      '1',
      '00:00:01,000 --> 00:00:02,000',
      '{\\an8}',
      '',
      '2',
      '00:00:03,000 --> 00:00:04,000',
      'Real text',
      '',
    ].join('\n');

    const result = normalizeSrt(srt);

    expect(result).toContain('1\n00:00:03,000 --> 00:00:04,000\nReal text');
    expect(result).not.toContain('00:00:01,000');
  });

  it('preserves multi-line cue text', () => {
    const srt = [
      '1',
      '00:00:01,000 --> 00:00:05,000',
      'Line one',
      'Line two',
      'Line three',
      '',
    ].join('\n');

    const result = normalizeSrt(srt);

    expect(result).toContain('Line one\nLine two\nLine three');
  });

  it('strips BOM from content', () => {
    const srt = '\uFEFF' + [
      '1',
      '00:00:01,000 --> 00:00:05,000',
      'Hello',
      '',
    ].join('\n');

    const result = normalizeSrt(srt);

    expect(result).not.toContain('\uFEFF');
    expect(result).toContain('Hello');
  });

  it('handles mixed CRLF and LF line endings', () => {
    const srt = [
      '1',
      '00:00:01,000 --> 00:00:05,000',
      'Hello',
      '',
    ].join('\r\n') + '\n' + [
      '2',
      '00:00:06,000 --> 00:00:10,000',
      'World',
      '',
    ].join('\n');

    const result = normalizeSrt(srt);

    expect(result).toContain('Hello');
    expect(result).toContain('World');
    // Output should use \n only.
    expect(result).not.toContain('\r');
  });

  it('returns empty string for empty/whitespace-only input', () => {
    expect(normalizeSrt('')).toBe('');
    expect(normalizeSrt('   \n\n  ')).toBe('');
  });

  it('returns empty string for content with no valid cues', () => {
    expect(normalizeSrt('Just some random text\nwithout any timing')).toBe('');
  });

  it('converts the real English.eng VTT fixture to clean SRT', () => {
    const vttPath = join(__dirname, '..', '..', 'data-test', 'English.eng (1).vtt');
    const vtt = readFileSync(vttPath, 'utf-8');

    const result = normalizeSrt(vtt);

    // No VTT/HTML tags.
    expect(result).not.toContain('<i>');
    expect(result).not.toContain('</i>');
    expect(result).not.toContain('<b>');
    expect(result).not.toContain('</b>');
    expect(result).not.toContain('{\\an');
    expect(result).not.toContain('WEBVTT');

    // Comma timestamps.
    expect(result).toContain(' --> ');
    expect(result).not.toMatch(/\d{2}:\d{2}:\d{2}\.\d{3}/);

    // Sequential numbering.
    expect(result).toMatch(/^1$/m);
    expect(result).toMatch(/^2$/m);

    // Has content.
    const cueCount = result.split('\n\n').filter(Boolean).length;
    expect(cueCount).toBeGreaterThan(10);
  });

  it('handles a completely non-standard SRT (VTT tags + dot timestamps + no sequence numbers + WEBVTT header)', () => {
    const nonStandard = [
      'WEBVTT',
      '',
      '00:00:01.000 --> 00:00:05.000 align:start',
      '{\\an8}<i>Hello World</i>',
      '',
      '00:00:06.000 --> 00:00:10.000',
      '<b>Second</b> cue',
      '',
    ].join('\n');

    const result = normalizeSrt(nonStandard);

    // Clean SRT output.
    expect(result).not.toContain('WEBVTT');
    expect(result).not.toContain('{\\an8}');
    expect(result).not.toContain('<i>');
    expect(result).not.toContain('</i>');
    expect(result).not.toContain('<b>');
    expect(result).not.toContain('</b>');
    expect(result).not.toContain('align:start');
    expect(result).not.toMatch(/\.\d{3}/);

    expect(result).toContain('1\n00:00:01,000 --> 00:00:05,000\nHello World');
    expect(result).toContain('2\n00:00:06,000 --> 00:00:10,000\nSecond cue');
  });
});
