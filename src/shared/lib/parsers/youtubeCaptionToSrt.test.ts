import { youtubeTimedtextBodyToSrt } from './youtubeCaptionToSrt';

describe('youtubeTimedtextBodyToSrt', () => {
  it('converts srv3 XML to SRT', () => {
    const srv3 = `<?xml version="1.0" encoding="utf-8" ?><timedtext format="3"><body><p t="1000" d="2000"><s>Hello</s> <s>world</s></p><p t="3500" d="1500">Second line</p></body></timedtext>`;
    const srt = youtubeTimedtextBodyToSrt(srv3);
    expect(srt).toBe(
      '1\n00:00:01,000 --> 00:00:03,000\nHello world\n\n2\n00:00:03,500 --> 00:00:05,000\nSecond line\n',
    );
  });

  it('converts json3 to SRT', () => {
    const json3 = JSON.stringify({
      wireMagic: 'pb3',
      events: [
        { tStartMs: 61000, dDurationMs: 1000, segs: [{ utf8: 'Hi\n' }, { utf8: 'there' }] },
        { tStartMs: 62000, dDurationMs: 2000, segs: [{ utf8: 'Bye' }] },
      ],
    });
    const srt = youtubeTimedtextBodyToSrt(json3);
    expect(srt).toBe(
      '1\n00:01:01,000 --> 00:01:02,000\nHi\nthere\n\n2\n00:01:02,000 --> 00:01:04,000\nBye\n',
    );
  });

  it('returns null for WebVTT (caller uses it as-is)', () => {
    expect(youtubeTimedtextBodyToSrt('WEBVTT\n\n00:01.000 --> 00:02.000\nHi')).toBeNull();
  });

  it('returns null for garbage', () => {
    expect(youtubeTimedtextBodyToSrt('not a subtitle')).toBeNull();
    expect(youtubeTimedtextBodyToSrt('<html><body>Sorry</body></html>')).toBeNull();
    expect(youtubeTimedtextBodyToSrt('{"a":1}')).toBeNull();
  });
});
