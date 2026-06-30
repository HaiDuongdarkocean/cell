import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { convertAssToSrt } from '@/shared/lib/parsers/assToSrt';

const fixturePath = join(__dirname, '..', '..', '..', 'fixtures', 'sample.ass');

function loadFixture(): string {
  return readFileSync(fixturePath, 'utf-8');
}

/** Build a minimal ASS document around the given dialogue Text fields. */
function buildAss(dialogueTexts: string[]): string {
  const dialogues = dialogueTexts
    .map((text, i) => {
      const start = `0:00:0${i + 1}.00`;
      const end = `0:00:0${i + 1 + 1}.00`;
      return `Dialogue: 0,${start},${end},Default,,0,0,0,,${text}`;
    })
    .join('\n');
  return [
    '[Script Info]',
    'Title: Test',
    'ScriptType: v4.00+',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    'Style: Default,Arial,20,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,2,2,10,10,10,1',
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
    dialogues,
  ].join('\n');
}

describe('convertAssToSrt', () => {
  it('converts basic ASS to SRT with correct format, timing, and index', () => {
    const result = convertAssToSrt(loadFixture());

    const expected = [
      '1',
      '00:00:01,000 --> 00:00:05,000',
      'Hello World',
      '',
      '2',
      '00:00:05,500 --> 00:00:10,000',
      'This is a bold line',
      '',
      '3',
      '00:01:30,500 --> 00:01:35,000',
      'Title Card',
      '',
    ].join('\n');

    expect(result).toBe(expected);
  });

  it('strips ASS styling tags while preserving text', () => {
    const ass = buildAss(['{\\an8}Top text', 'Normal {\\b1}bold{\\b0} word']);
    const result = convertAssToSrt(ass);

    expect(result).not.toContain('{\\an8}');
    expect(result).not.toContain('{\\b1}');
    expect(result).not.toContain('{\\b0}');
    expect(result).toContain('Top text');
    expect(result).toContain('Normal bold word');
  });

  it('strips ASS drawing commands while preserving surrounding text', () => {
    const ass = buildAss(['{\\p1}m 0 0 l 100 0 100 100 0 100{\\p0}Real text']);
    const result = convertAssToSrt(ass);

    expect(result).not.toContain('m 0 0');
    expect(result).not.toContain('l 100 0');
    expect(result).not.toContain('{\\p1}');
    expect(result).not.toContain('{\\p0}');
    expect(result).toContain('Real text');
  });

  it('converts \\N hard newlines into actual newlines', () => {
    const ass = buildAss(['Line one\\NLine two']);
    const result = convertAssToSrt(ass);

    expect(result).toContain('Line one\nLine two');
    expect(result).not.toContain('\\N');
  });

  it('converts \\n soft newlines into spaces', () => {
    const ass = buildAss(['Soft one\\nSoft two']);
    const result = convertAssToSrt(ass);

    expect(result).toContain('Soft one Soft two');
    expect(result).not.toContain('\\n');
  });

  it('skips dialogues that become empty after stripping', () => {
    const ass = buildAss(['{\\an8}', 'Keep me', '{\\b1}{\\i1}']);
    const result = convertAssToSrt(ass);

    // Only one non-empty cue remains, indexed as 1.
    expect(result).toBe(
      [
        '1',
        '00:00:02,000 --> 00:00:03,000',
        'Keep me',
        '',
      ].join('\n'),
    );
  });

  it('sorts dialogues by start time', () => {
    const ass = [
      '[Script Info]',
      'Title: Test',
      'ScriptType: v4.00+',
      '',
      '[V4+ Styles]',
      'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
      'Style: Default,Arial,20,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,2,2,10,10,10,1',
      '',
      '[Events]',
      'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
      'Dialogue: 0,0:00:10.00,0:00:15.00,Default,,0,0,0,,Second',
      'Dialogue: 0,0:00:01.00,0:00:05.00,Default,,0,0,0,,First',
    ].join('\n');

    const result = convertAssToSrt(ass);

    expect(result.indexOf('First')).toBeLessThan(result.indexOf('Second'));
    expect(result).toContain('1\n00:00:01,000 --> 00:00:05,000\nFirst');
    expect(result).toContain('2\n00:00:10,000 --> 00:00:15,000\nSecond');
  });

  it('returns an empty string when every dialogue becomes empty after stripping', () => {
    const ass = buildAss(['{\\an8}', '{\\b1}{\\i1}']);
    expect(convertAssToSrt(ass)).toBe('');
  });

  it('returns an empty string for an ASS document with no dialogues', () => {
    const ass = [
      '[Script Info]',
      'Title: Test',
      'ScriptType: v4.00+',
      '',
      '[V4+ Styles]',
      'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
      'Style: Default,Arial,20,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,2,2,10,10,10,1',
      '',
      '[Events]',
      'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
    ].join('\n');

    expect(convertAssToSrt(ass)).toBe('');
  });
});
