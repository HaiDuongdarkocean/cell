import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseVtt } from '@/shared/lib/parsers/vttParser';
import type { VttSubtitle } from '@/types/media';

const fixturePath = join(__dirname, '..', '..', '..', 'fixtures', 'sample.vtt');

describe('parseVtt', () => {
  it('parses a valid VTT with multiple cues', () => {
    const content = readFileSync(fixturePath, 'utf-8');
    const result = parseVtt(content);

    expect(result.cues).toHaveLength(3);
    expect(result.cues[0]).toEqual({
      id: '1',
      start: 1000,
      end: 5000,
      text: 'Hello World',
    });
    // cue without id
    expect(result.cues[1].id).toBeUndefined();
    expect(result.cues[1].start).toBe(6000);
    expect(result.cues[1].end).toBe(10000);
    expect(result.cues[1].text).toBe('This is another cue');
  });

  it('throws on empty content', () => {
    expect(() => parseVtt('')).toThrow(Error);
    expect(() => parseVtt('   \n\n  ')).toThrow(Error);
  });

  it('throws on missing WEBVTT header', () => {
    const content = `1
00:00:01.000 --> 00:00:05.000
Hello World`;
    expect(() => parseVtt(content)).toThrow(Error);
  });

  it('skips cues with malformed timing', () => {
    const content = `WEBVTT

00:00:01.000 --> 00:00:05.000
Good cue

not-a-timing --> 00:00:05.000
Bad cue

00:bad --> 00:00:10.000
Another bad

00:00:11.000 --> 00:00:15.000
Good cue 2`;
    const result = parseVtt(content);
    expect(result.cues).toHaveLength(2);
    expect(result.cues[0].text).toBe('Good cue');
    expect(result.cues[1].text).toBe('Good cue 2');
  });

  it('ignores cue settings (align, line, position)', () => {
    const content = `WEBVTT

00:00:01.000 --> 00:00:05.000 align:start line:10% position:50%
Cue with settings`;
    const result = parseVtt(content);
    expect(result.cues).toHaveLength(1);
    expect(result.cues[0].start).toBe(1000);
    expect(result.cues[0].end).toBe(5000);
    expect(result.cues[0].text).toBe('Cue with settings');
  });

  it('strips BOM character', () => {
    const bom = '\uFEFF';
    const content = `${bom}WEBVTT

00:00:01.000 --> 00:00:05.000
Hello BOM`;
    const result = parseVtt(content);
    expect(result.cues).toHaveLength(1);
    expect(result.cues[0].text).toBe('Hello BOM');
  });

  it('returns empty cues for header-only VTT', () => {
    const result = parseVtt('WEBVTT\n');
    const empty: VttSubtitle = { cues: [] };
    expect(result).toEqual(empty);
  });

  it('parses multiline cue text', () => {
    const content = `WEBVTT

00:00:01.000 --> 00:00:05.000
Line one
Line two`;
    const result = parseVtt(content);
    expect(result.cues).toHaveLength(1);
    expect(result.cues[0].text).toBe('Line one\nLine two');
  });
});
