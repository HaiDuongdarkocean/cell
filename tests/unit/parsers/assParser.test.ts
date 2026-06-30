import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseAss } from '@/shared/lib/parsers/assParser';
import type { AssSubtitle } from '@/types/media';

const fixturePath = join(__dirname, '..', 'fixtures', 'sample.ass');

function loadFixture(): string {
  return readFileSync(fixturePath, 'utf-8');
}

describe('parseAss', () => {
  it('parses a valid ASS file with all sections', () => {
    const content = loadFixture();
    const result = parseAss(content);

    expect(result.scriptInfo['Title']).toBe('Sample Subtitle');
    expect(result.scriptInfo['ScriptType']).toBe('v4.00+');
    expect(result.scriptInfo['PlayResX']).toBe('1920');

    expect(result.styles).toHaveLength(2);
    expect(result.dialogues).toHaveLength(3);

    const first = result.dialogues[0];
    expect(first.layer).toBe(0);
    expect(first.start).toBe(1000);
    expect(first.end).toBe(5000);
    expect(first.style).toBe('Default');
    expect(first.name).toBe('');
    expect(first.text).toBe('Hello World');
  });

  it('throws an Error for empty content', () => {
    expect(() => parseAss('')).toThrow(Error);
    expect(() => parseAss('   \n\n  ')).toThrow(Error);
  });

  it('returns empty dialogues when [Events] section is missing', () => {
    const content = [
      '[Script Info]',
      'Title: No Events',
      'ScriptType: v4.00+',
      '',
      '[V4+ Styles]',
      'Format: Name, Fontname, Fontsize, PrimaryColour, Alignment',
      'Style: Default,Arial,20,&H00FFFFFF,2',
    ].join('\n');

    const result = parseAss(content);

    expect(result.dialogues).toEqual([]);
    expect(result.styles).toHaveLength(1);
    expect(result.scriptInfo['Title']).toBe('No Events');
  });

  it('skips malformed dialogue lines', () => {
    const content = [
      '[Script Info]',
      'Title: Malformed',
      '',
      '[V4+ Styles]',
      'Format: Name, Fontname, Fontsize, PrimaryColour, Alignment',
      'Style: Default,Arial,20,&H00FFFFFF,2',
      '',
      '[Events]',
      'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
      'Dialogue: 0,0:00:01.00,0:00:05.00,Default,,0,0,0,,Good Line',
      'Dialogue: not-a-number,bad-time,bad-time,Default,,0,0,0,,Bad Line',
      'Dialogue: 0,0:00:02.00,0:00:06.00,Default,,0,0,0,,Another Good Line',
      'NotADialogue: foo',
    ].join('\n');

    const result = parseAss(content);

    expect(result.dialogues).toHaveLength(2);
    expect(result.dialogues[0].text).toBe('Good Line');
    expect(result.dialogues[1].text).toBe('Another Good Line');
  });

  it('converts timing H:MM:SS.cc to milliseconds', () => {
    const content = [
      '[Script Info]',
      'Title: Timing',
      '',
      '[V4+ Styles]',
      'Format: Name, Fontname, Fontsize, PrimaryColour, Alignment',
      'Style: Default,Arial,20,&H00FFFFFF,2',
      '',
      '[Events]',
      'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
      'Dialogue: 0,0:01:30.50,0:02:00.00,Default,,0,0,0,,Timing test',
    ].join('\n');

    const result = parseAss(content);

    // 0:01:30.50 = 1*60*1000 + 30*1000 + 50*10 = 90500
    expect(result.dialogues[0].start).toBe(90500);
    // 0:02:00.00 = 2*60*1000 = 120000
    expect(result.dialogues[0].end).toBe(120000);
  });

  it('maps style columns correctly using the Format line', () => {
    const content = [
      '[Script Info]',
      'Title: Style Map',
      '',
      '[V4+ Styles]',
      // Reordered columns: Alignment comes first, Fontsize before Fontname
      'Format: Name, Alignment, Fontsize, Fontname, PrimaryColour',
      'Style: Default,8,40,Comic Sans,&H0000FF00',
      '',
      '[Events]',
      'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
      'Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,Hi',
    ].join('\n');

    const result = parseAss(content);

    expect(result.styles).toHaveLength(1);
    const style = result.styles[0];
    expect(style.name).toBe('Default');
    expect(style.fontName).toBe('Comic Sans');
    expect(style.fontSize).toBe(40);
    expect(style.primaryColor).toBe('&H0000FF00');
    expect(style.alignment).toBe(8);
  });

  it('returns empty styles when [V4+ Styles] section is missing', () => {
    const content = [
      '[Script Info]',
      'Title: No Styles',
      '',
      '[Events]',
      'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
      'Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,Hi',
    ].join('\n');

    const result = parseAss(content);

    expect(result.styles).toEqual([]);
    expect(result.dialogues).toHaveLength(1);
  });

  it('returns an empty scriptInfo when [Script Info] is missing', () => {
    const content = [
      '[V4+ Styles]',
      'Format: Name, Fontname, Fontsize, PrimaryColour, Alignment',
      'Style: Default,Arial,20,&H00FFFFFF,2',
      '',
      '[Events]',
      'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
      'Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,Hi',
    ].join('\n');

    const result: AssSubtitle = parseAss(content);

    expect(result.scriptInfo).toEqual({});
    expect(result.dialogues).toHaveLength(1);
  });
});
