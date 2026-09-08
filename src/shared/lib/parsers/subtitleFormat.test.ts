import { formatFromContent } from './subtitleFormat';

describe('formatFromContent', () => {
  it('detects WebVTT', () => {
    expect(formatFromContent('WEBVTT\n\n1\n00:00:00 --> 00:00:01\nA')).toBe('vtt');
    expect(formatFromContent('\uFEFFWEBVTT\n')).toBe('vtt');
  });

  it('detects ASS', () => {
    expect(formatFromContent('[Script Info]\nTitle: x')).toBe('ass');
    expect(formatFromContent('Dialogue: 0,0:00:00.00,0:00:01.00,Default,,0,0,0,,Hi')).toBe('ass');
  });

  it('detects SRT', () => {
    expect(formatFromContent('1\n00:00:00,000 --> 00:00:01,000\nHello')).toBe('srt');
    expect(formatFromContent('1\r\n00:00:00,000 --> 00:00:01,000\r\nHello')).toBe('srt');
  });

  it('returns null for unrecognised content', () => {
    expect(formatFromContent('random text')).toBeNull();
  });
});
