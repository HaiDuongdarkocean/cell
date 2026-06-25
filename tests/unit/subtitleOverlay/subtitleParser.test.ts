import { parseSubtitle } from '@/content/subtitleParser';

describe('parseSubtitle', () => {
  const sampleSrt = `1
00:00:01,000 --> 00:00:03,000
Hello world

2
00:00:03,500 --> 00:00:05,000
How are you?`;

  const sampleVtt = `WEBVTT

00:00:01.000 --> 00:00:03.000
Hello world

00:00:03.500 --> 00:00:05.000
How are you?`;

  it('parses SRT content and returns cues', () => {
    const result = parseSubtitle(sampleSrt, 'srt');
    expect(result.success).toBe(true);
    expect(result.format).toBe('srt');
    expect(result.cues).toHaveLength(2);
    expect(result.cues[0].start).toBe(1000);
    expect(result.cues[0].end).toBe(3000);
    expect(result.cues[0].text).toBe('Hello world');
    expect(result.cues[1].start).toBe(3500);
    expect(result.cues[1].text).toBe('How are you?');
  });

  it('parses VTT content and returns cues', () => {
    const result = parseSubtitle(sampleVtt, 'vtt');
    expect(result.success).toBe(true);
    expect(result.format).toBe('vtt');
    expect(result.cues).toHaveLength(2);
    expect(result.cues[0].start).toBe(1000);
    expect(result.cues[0].end).toBe(3000);
    expect(result.cues[0].text).toBe('Hello world');
  });

  it('auto-detects SRT format when format is unknown', () => {
    const result = parseSubtitle(sampleSrt, 'unknown');
    expect(result.success).toBe(true);
    expect(result.format).toBe('srt');
    expect(result.cues).toHaveLength(2);
  });

  it('auto-detects VTT format when format is unknown', () => {
    const result = parseSubtitle(sampleVtt, 'unknown');
    expect(result.success).toBe(true);
    expect(result.format).toBe('vtt');
    expect(result.cues).toHaveLength(2);
  });

  it('returns error result for empty content', () => {
    const result = parseSubtitle('', 'srt');
    expect(result.success).toBe(false);
    expect(result.cues).toHaveLength(0);
    expect(result.error).toBeDefined();
  });

  it('returns error result for invalid content', () => {
    const result = parseSubtitle('not a subtitle', 'srt');
    expect(result.success).toBe(false);
    expect(result.cues).toHaveLength(0);
    expect(result.error).toBeDefined();
  });

  it('preserves cue index from SRT', () => {
    const result = parseSubtitle(sampleSrt, 'srt');
    expect(result.cues[0].index).toBe(1);
    expect(result.cues[1].index).toBe(2);
  });

  it('handles multi-line cue text', () => {
    const multiLineSrt = `1
00:00:01,000 --> 00:00:03,000
Line one
Line two`;
    const result = parseSubtitle(multiLineSrt, 'srt');
    expect(result.success).toBe(true);
    expect(result.cues[0].text).toBe('Line one\nLine two');
  });
});
