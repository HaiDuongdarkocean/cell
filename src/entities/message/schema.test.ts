import { describe, expect, it } from '@jest/globals';
import {
  ResolveSubtitleDownloadPayloadSchema,
  SubtitleCuesLoadedPayloadSchema,
  VideoPlayStatePayloadSchema,
  VideoTimeUpdatePayloadSchema,
} from './schema';

describe('VideoTimeUpdatePayloadSchema', () => {
  it('accepts float currentTimeMs/durationMs/offsetMs (content script sends video.currentTime * 1000)', () => {
    const r = VideoTimeUpdatePayloadSchema.safeParse({
      tabId: 42,
      currentTimeMs: 47293.333,
      durationMs: 362000.5,
      offsetMs: 120.7,
    });
    expect(r.success).toBe(true);
  });

  it('accepts missing optional fields', () => {
    expect(
      VideoTimeUpdatePayloadSchema.safeParse({
        currentTimeMs: 0,
        durationMs: 1000,
      }).success,
    ).toBe(true);
  });

  it('rejects non-numeric fields', () => {
    expect(
      VideoTimeUpdatePayloadSchema.safeParse({
        currentTimeMs: '12',
        durationMs: 1000,
      }).success,
    ).toBe(false);
  });
});

describe('VideoPlayStatePayloadSchema', () => {
  it('accepts a boolean isPlaying', () => {
    expect(VideoPlayStatePayloadSchema.safeParse({ tabId: 1, isPlaying: true }).success).toBe(true);
  });
});

describe('SubtitleCuesLoadedPayloadSchema', () => {
  it('accepts real bilingual cues', () => {
    expect(
      SubtitleCuesLoadedPayloadSchema.safeParse({
        tabId: 1,
        cues: [{ index: 0, start: 100, end: 200, targetText: 'Hello', nativeText: 'Xin chào' }],
      }).success,
    ).toBe(true);
  });

  it('rejects cues missing required fields', () => {
    expect(
      SubtitleCuesLoadedPayloadSchema.safeParse({
        cues: [{ index: 0, start: 100 }],
      }).success,
    ).toBe(false);
  });
});

describe('ResolveSubtitleDownloadPayloadSchema', () => {
  it('accepts a real search result (direct + handshake)', () => {
    const base = {
      id: '1',
      name: 'Movie',
      providerLanguage: 'English',
      isoLanguage: 'en',
      format: 'srt',
      source: 'subdl',
    };
    expect(
      ResolveSubtitleDownloadPayloadSchema.safeParse({
        result: { ...base, download: { kind: 'direct', url: 'https://x/f.srt' } },
        role: 'target',
      }).success,
    ).toBe(true);
    expect(
      ResolveSubtitleDownloadPayloadSchema.safeParse({
        result: { ...base, source: 'opensubtitles', download: { kind: 'handshake', fileId: 9 } },
        role: 'native',
      }).success,
    ).toBe(true);
  });

  it('rejects malformed results (bad download kind / bad format)', () => {
    const base = {
      id: '1',
      name: 'M',
      providerLanguage: 'E',
      isoLanguage: 'en',
      format: 'srt',
      source: 'subdl',
    };
    expect(
      ResolveSubtitleDownloadPayloadSchema.safeParse({
        result: { ...base, download: { kind: 'magic' } },
        role: 'target',
      }).success,
    ).toBe(false);
    expect(
      ResolveSubtitleDownloadPayloadSchema.safeParse({
        result: { ...base, format: 'ttml', download: { kind: 'direct', url: 'x' } },
        role: 'target',
      }).success,
    ).toBe(false);
  });
});
