import { describe, expect, it } from '@jest/globals';
import { VideoPlayStatePayloadSchema, VideoTimeUpdatePayloadSchema } from './schema';

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
