import { describe, expect, it } from '@jest/globals';
import {
  youTubeCaptionTrackArraySchema,
  iqiyiSubtitleTrackArraySchema,
  netflixSubtitleTrackArraySchema,
} from './trackSchemas';

describe('youTubeCaptionTrackArraySchema', () => {
  it('accepts a real InnerTube captionTrack and strips extra keys', () => {
    const raw = {
      baseUrl: 'https://www.youtube.com/api/timedtext?v=abc&lang=en',
      name: { simpleText: 'English', runs: [{ text: 'English' }] },
      vssId: '.en',
      languageCode: 'en',
      kind: 'asr',
      isTranslatable: true,
      track: { id: 'x' },
      accessibilityData: { label: 'foo' },
    };
    const r = youTubeCaptionTrackArraySchema.safeParse([raw]);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data[0]).toEqual({
        baseUrl: raw.baseUrl,
        name: { simpleText: 'English' },
        vssId: '.en',
        languageCode: 'en',
        kind: 'asr',
        isTranslatable: true,
      });
    }
  });

  it('rejects a track missing baseUrl', () => {
    expect(
      youTubeCaptionTrackArraySchema.safeParse([{ languageCode: 'en' }]).success,
    ).toBe(false);
  });

  it('rejects the whole array when one element is malformed', () => {
    expect(
      youTubeCaptionTrackArraySchema.safeParse([
        { baseUrl: 'https://x', languageCode: 'en' },
        { baseUrl: 42, languageCode: 'vi' },
      ]).success,
    ).toBe(false);
  });

  it('accepts an empty array (overlay-clear path)', () => {
    expect(youTubeCaptionTrackArraySchema.safeParse([]).success).toBe(true);
  });
});

describe('iqiyiSubtitleTrackArraySchema', () => {
  it('accepts a real stl element with extra keys', () => {
    const raw = {
      _name: 'English',
      lid: 3,
      ss: 0,
      srt: '/20260115/6c/7b/c112.srt?qyb=1',
      webvtt: '/x.vtt',
      xml: '/x.xml',
      _limited: 0,
      uuid: 'u-1',
      extraField: { nested: true },
    };
    const r = iqiyiSubtitleTrackArraySchema.safeParse([raw]);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data[0]).not.toHaveProperty('extraField');
  });

  it('rejects a track missing lid', () => {
    expect(
      iqiyiSubtitleTrackArraySchema.safeParse([{ _name: 'x', ss: 0, srt: '/a' }]).success,
    ).toBe(false);
  });
});

describe('netflixSubtitleTrackArraySchema', () => {
  const exact = {
    trackId: 'T:2:0;1;vi;0;0;0;',
    bcp47: 'vi',
    displayName: 'Vietnamese',
    rawTrackType: 'SUBTITLES',
    isNoneTrack: false,
    isForcedNarrative: false,
    isImageBased: false,
    url: 'https://cdn.netflix.com/x.vtt',
  };

  it('accepts the exact producer shape', () => {
    expect(netflixSubtitleTrackArraySchema.safeParse([exact]).success).toBe(true);
  });

  it('rejects a track missing a required boolean flag', () => {
    const bad = { ...exact } as Record<string, unknown>;
    delete bad.isForcedNarrative;
    expect(netflixSubtitleTrackArraySchema.safeParse([bad]).success).toBe(false);
  });
});
