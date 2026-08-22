// ocrContentScript tests — T21-T25 + Task 7 (split dual-stream).

import { describe, expect, it, jest, beforeAll } from '@jest/globals';
import {
  OcrSession,
  shouldEnableOcr,
  findVideoElement,
  planSplitEngines,
  effectiveSplitRegionPct,
  saveSplitRatioForOrigin,
} from './ocrContentScript';
import { DEFAULT_OCR_ORIGIN_STATE } from '@/features/ocr/persistence/ocrStateTypes';

const storageData: Record<string, unknown> = {};

beforeAll(() => {
  const g = global as unknown as { chrome: unknown };
  g.chrome = {
    storage: {
      local: {
        get: jest.fn(async (keys?: string | string[] | null) => {
          if (typeof keys === 'string') return { [keys]: storageData[keys] };
          return { ...storageData };
        }),
        set: jest.fn(async (items: Record<string, unknown>) => {
          Object.assign(storageData, items);
        }),
      },
    },
    runtime: {
      id: 'test',
      sendMessage: jest.fn(async () => ({ success: true, data: { status: 'ready', backend: 'webgpu' } })),
      onMessage: { addListener: () => {}, removeListener: () => {} },
    },
  };
});

describe('shouldEnableOcr (T21-T25)', () => {
  it('returns false when no OCR settings stored', async () => {
    Object.keys(storageData).forEach((k) => delete storageData[k]);
    expect(await shouldEnableOcr('https://themoviebox.xyz/movies/123')).toBe(false);
  });

  it('returns true when OCR enabled for origin', async () => {
    storageData.ocrSettings = {
      schemaVersion: 1,
      origins: {
        'themoviebox.xyz': { ocrEnabled: true, languageMode: 'auto', subtitleRegionPct: 15 },
      },
    };
    expect(await shouldEnableOcr('https://themoviebox.xyz/movies/123')).toBe(true);
  });

  it('returns false for invalid URL', async () => {
    expect(await shouldEnableOcr('not-a-url')).toBe(false);
  });
});

describe('findVideoElement (T21-T25)', () => {
  it('returns null when no video on page', () => {
    expect(findVideoElement()).toBeNull();
  });

  it('returns video element when present', () => {
    const video = document.createElement('video');
    document.body.appendChild(video);
    expect(findVideoElement()).toBe(video);
    video.remove();
  });
});

describe('OcrSession (T21-T25)', () => {
  it('creates session with controller + overlay', () => {
    const session = new OcrSession();
    expect(session.isRunning()).toBe(false);
  });

  it('stop is safe to call when not running', async () => {
    const session = new OcrSession();
    await expect(session.stop()).resolves.not.toThrow();
  });
});

describe('planSplitEngines (Task 7)', () => {
  it('distinct models + >=4GB RAM → dual engine', () => {
    expect(planSplitEngines('en', 'ru', 8)).toEqual({ targetKey: 'en', nativeKey: 'eslav', dualEngine: true });
  });

  it('same model → single engine, both streams share the target key', () => {
    expect(planSplitEngines('fr', 'de', 8)).toEqual({ targetKey: 'latin', nativeKey: 'latin', dualEngine: false });
  });

  it('low memory (<4GB) → single engine even with distinct models', () => {
    expect(planSplitEngines('en', 'ru', 2)).toEqual({ targetKey: 'en', nativeKey: 'en', dualEngine: false });
  });

  it("'auto' resolves to the default model", () => {
    expect(planSplitEngines('auto', 'auto', 8)).toEqual({ targetKey: 'ch', nativeKey: 'ch', dualEngine: false });
  });
});

describe('effectiveSplitRegionPct (Task 7)', () => {
  it('split + no custom region → SPLIT_DEFAULT_REGION_PCT (40)', () => {
    expect(effectiveSplitRegionPct({ ...DEFAULT_OCR_ORIGIN_STATE, splitEnabled: true })).toBe(40);
  });

  it('split + custom region → keeps stored region pct', () => {
    const state = {
      ...DEFAULT_OCR_ORIGIN_STATE,
      splitEnabled: true,
      customRegion: { xPct: 0, yPct: 50, widthPct: 100, heightPct: 30 },
    };
    expect(effectiveSplitRegionPct(state)).toBe(DEFAULT_OCR_ORIGIN_STATE.subtitleRegionPct);
  });

  it('split off → stored region pct', () => {
    expect(effectiveSplitRegionPct({ ...DEFAULT_OCR_ORIGIN_STATE, subtitleRegionPct: 25 })).toBe(25);
  });
});

describe('saveSplitRatioForOrigin (Task 7)', () => {
  it('persists clamped ratio and keeps other fields (incl. customRegion)', async () => {
    const customRegion = { xPct: 5, yPct: 55, widthPct: 90, heightPct: 30 };
    storageData.ocrSettings = {
      schemaVersion: 1,
      origins: {
        'kisskh.co': { ...DEFAULT_OCR_ORIGIN_STATE, ocrEnabled: true, splitEnabled: true, splitRatio: 0.5, customRegion },
      },
    };
    await saveSplitRatioForOrigin('kisskh.co', 1.7); // out of range → clamped to 0.9
    const saved = (storageData.ocrSettings as {
      origins: Record<string, { splitRatio: number; splitEnabled: boolean; customRegion: unknown }>;
    }).origins['kisskh.co'];
    expect(saved.splitRatio).toBe(0.9);
    expect(saved.splitEnabled).toBe(true);
    expect(saved.customRegion).toEqual(customRegion);
  });

  it('is a no-op for an empty origin', async () => {
    await expect(saveSplitRatioForOrigin('', 0.5)).resolves.not.toThrow();
  });
});
