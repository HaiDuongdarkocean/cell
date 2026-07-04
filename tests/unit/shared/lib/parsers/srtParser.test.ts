import { parseSrt } from '@/shared/lib/parsers/srtParser';
import type { SrtSubtitle } from '@/types/media';

describe('parseSrt', () => {
  test('parses valid SRT with multiple cues', () => {
    const content = `1
00:00:01,000 --> 00:00:05,000
Hello World

2
00:00:06,000 --> 00:00:10,000
This is another cue`;

    const result: SrtSubtitle = parseSrt(content);

    expect(result.cues).toHaveLength(2);
    expect(result.cues[0]).toEqual({
      index: 1,
      start: 1000,
      end: 5000,
      text: 'Hello World',
    });
    expect(result.cues[1]).toEqual({
      index: 2,
      start: 6000,
      end: 10000,
      text: 'This is another cue',
    });
  });

  test('throws Error on empty content', () => {
    expect(() => parseSrt('')).toThrow(Error);
    expect(() => parseSrt('   \n\n  ')).toThrow(Error);
  });

  test('uses sequential number when cue index is missing', () => {
    const content = `00:00:01,000 --> 00:00:05,000
First cue

00:00:06,000 --> 00:00:10,000
Second cue`;

    const result = parseSrt(content);

    expect(result.cues).toHaveLength(2);
    expect(result.cues[0].index).toBe(1);
    expect(result.cues[0].text).toBe('First cue');
    expect(result.cues[1].index).toBe(2);
    expect(result.cues[1].text).toBe('Second cue');
  });

  test('parses kisskh/angkortv SRT with "None" literal as cue index', () => {
    // kisskh.buzz serves SRT where each cue starts with literal "None"
    // instead of a numeric index. Without the non-timing-line skip logic,
    // every cue is skipped → "No cues found in SRT content" → auto-load fails.
    const content = `None\r\n00:00:10,580 --> 00:00:13,280\r\n(Kim Da Mi)\r\n\r\nNone\r\n00:00:14,320 --> 00:00:16,190\r\n(Shin Ye Eun)\r\n\r\nNone\r\n00:00:18,120 --> 00:00:20,560\r\n(Heo Nam Jun)`;

    const result = parseSrt(content);

    expect(result.cues).toHaveLength(3);
    expect(result.cues[0].index).toBe(1);
    expect(result.cues[0].start).toBe(10580);
    expect(result.cues[0].end).toBe(13280);
    expect(result.cues[0].text).toBe('(Kim Da Mi)');
    expect(result.cues[1].text).toBe('(Shin Ye Eun)');
    expect(result.cues[2].text).toBe('(Heo Nam Jun)');
  });

  test('skips cue with malformed timing', () => {
    const content = `1
00:00:01,000 --> 00:00:05,000
Good cue

2
not-a-valid-timing
Bad cue

3
00:00:06,000 --> 00:00:10,000
Another good cue`;

    const result = parseSrt(content);

    expect(result.cues).toHaveLength(2);
    expect(result.cues[0].index).toBe(1);
    expect(result.cues[0].text).toBe('Good cue');
    expect(result.cues[1].index).toBe(3);
    expect(result.cues[1].text).toBe('Another good cue');
  });

  test('strips BOM character from content', () => {
    const content = `\uFEFF1
00:00:01,000 --> 00:00:05,000
Hello BOM`;

    const result = parseSrt(content);

    expect(result.cues).toHaveLength(1);
    expect(result.cues[0].text).toBe('Hello BOM');
    expect(result.cues[0].start).toBe(1000);
    expect(result.cues[0].end).toBe(5000);
  });

  test('handles CRLF line endings correctly', () => {
    const content =
      '1\r\n00:00:01,000 --> 00:00:05,000\r\nHello CRLF\r\n\r\n2\r\n00:00:06,000 --> 00:00:10,000\r\nSecond line\r\nThird line';

    const result = parseSrt(content);

    expect(result.cues).toHaveLength(2);
    expect(result.cues[0]).toEqual({
      index: 1,
      start: 1000,
      end: 5000,
      text: 'Hello CRLF',
    });
    expect(result.cues[1]).toEqual({
      index: 2,
      start: 6000,
      end: 10000,
      text: 'Second line\nThird line',
    });
  });

  test('parses multi-line cue text', () => {
    const content = `1
00:00:01,000 --> 00:00:05,000
Line one
Line two`;

    const result = parseSrt(content);

    expect(result.cues).toHaveLength(1);
    expect(result.cues[0].text).toBe('Line one\nLine two');
  });

  test('parses timing with non-zero hours, minutes, seconds, milliseconds', () => {
    const content = `1
01:02:03,456 --> 02:03:04,789
Timed cue`;

    const result = parseSrt(content);

    // 1*3600000 + 2*60000 + 3*1000 + 456 = 3723456
    expect(result.cues[0].start).toBe(3723456);
    // 2*3600000 + 3*60000 + 4*1000 + 789 = 7384789
    expect(result.cues[0].end).toBe(7384789);
  });

  test('strips inline tags (<i>, <b>, <u>, ASS override) from cue text', () => {
    const content = `1
00:00:01,000 --> 00:00:05,000
<i>Italic line</i>
<b>Bold</b> {\\an8}plain`;

    const result = parseSrt(content);

    expect(result.cues).toHaveLength(1);
    expect(result.cues[0].text).toBe('Italic line\nBold plain');
    expect(result.cues[0].text).not.toMatch(/[<>]/);
    expect(result.cues[0].text).not.toMatch(/\{[^}]*\}/);
  });

  test('strips <i> tags while preserving multi-line structure for bilingual split', () => {
    const content = `1
00:00:01,000 --> 00:00:05,000
<i>Target line</i>
Native line`;

    const result = parseSrt(content);

    expect(result.cues[0].text).toBe('Target line\nNative line');
    expect(result.cues[0].text.split('\n')).toHaveLength(2);
  });
});
