// ocrContentScript tests — T21-T25.

import { describe, expect, it, jest, beforeAll } from '@jest/globals';
import { OcrSession, shouldEnableOcr, findVideoElement } from './ocrContentScript';

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
