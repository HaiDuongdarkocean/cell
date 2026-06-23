import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { convertVttToSrt } from '@/lib/converters/vttToSrt';

const fixturePath = join(__dirname, '..', 'fixtures', 'sample.vtt');

describe('convertVttToSrt', () => {
  it('performs a basic VTT -> SRT conversion (comma timing, sequential index, format)', () => {
    const vtt = [
      'WEBVTT',
      '',
      '1',
      '00:00:01.000 --> 00:00:05.000',
      'Hello World',
      '',
      '00:00:06.000 --> 00:00:10.000',
      'This is another cue',
      '',
    ].join('\n');

    const srt = convertVttToSrt(vtt);

    const expected = [
      '1',
      '00:00:01,000 --> 00:00:05,000',
      'Hello World',
      '',
      '2',
      '00:00:06,000 --> 00:00:10,000',
      'This is another cue',
      '',
    ].join('\n');

    expect(srt).toBe(expected);
  });

  it('strips cue settings (align, line, position) from the timing line', () => {
    const vtt = [
      'WEBVTT',
      '',
      '00:00:01.000 --> 00:00:05.000 align:start line:0 position:50%',
      'Cue with settings',
      '',
    ].join('\n');

    const srt = convertVttToSrt(vtt);

    expect(srt).toContain('00:00:01,000 --> 00:00:05,000');
    expect(srt).not.toContain('align:start');
    expect(srt).not.toContain('line:0');
    expect(srt).not.toContain('position:50%');
    expect(srt).toContain('Cue with settings');
  });

  it('produces correct sequential indexing for multiple cues ignoring original ids', () => {
    const vtt = [
      'WEBVTT',
      '',
      '7',
      '00:00:01.000 --> 00:00:02.000',
      'First',
      '',
      '42',
      '00:00:03.000 --> 00:00:04.000',
      'Second',
      '',
      '99',
      '00:00:05.000 --> 00:00:06.000',
      'Third',
      '',
    ].join('\n');

    const srt = convertVttToSrt(vtt);

    expect(srt).toContain('1\n00:00:01,000 --> 00:00:02,000\nFirst');
    expect(srt).toContain('2\n00:00:03,000 --> 00:00:04,000\nSecond');
    expect(srt).toContain('3\n00:00:05,000 --> 00:00:06,000\nThird');
    expect(srt).not.toMatch(/^7$/m);
    expect(srt).not.toMatch(/^42$/m);
    expect(srt).not.toMatch(/^99$/m);
  });

  it('preserves multi-line cue text with newlines', () => {
    const vtt = [
      'WEBVTT',
      '',
      '00:00:01.000 --> 00:00:05.000',
      'Line one',
      'Line two',
      'Line three',
      '',
    ].join('\n');

    const srt = convertVttToSrt(vtt);

    const expected = [
      '1',
      '00:00:01,000 --> 00:00:05,000',
      'Line one',
      'Line two',
      'Line three',
      '',
    ].join('\n');

    expect(srt).toBe(expected);
  });

  it('converts the sample.vtt fixture correctly', () => {
    const content = readFileSync(fixturePath, 'utf-8');
    const srt = convertVttToSrt(content);

    expect(srt).toContain('1\n00:00:01,000 --> 00:00:05,000\nHello World');
    expect(srt).toContain('2\n00:00:06,000 --> 00:00:10,000\nThis is another cue');
    expect(srt).toContain('3\n00:00:11,000 --> 00:00:15,000\nCue with settings');
    expect(srt).not.toContain('align:start');
    expect(srt).not.toContain('position:50%');
  });
});
