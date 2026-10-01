import { expect } from '@playwright/test';
import { test } from './extension.fixture';

test.describe('audio hot-path wire transport', () => {
  test('PRONUNCIATION_ESPEAK_TTS returns base64 audioBytesB64 over real runtime messaging', async ({
    popupPage,
  }) => {
    const res = await popupPage.evaluate(
      async () =>
        (await chrome.runtime.sendMessage({
          type: 'PRONUNCIATION_ESPEAK_TTS',
          payload: { text: 'hello', langCode: 'en' },
        })) as { success: boolean; error?: string; data?: { audioBytesB64?: string; audioBytes?: unknown } },
    );

    expect(res.success, res.error).toBe(true);
    expect(res.data?.audioBytes).toBeUndefined();
    expect(typeof res.data?.audioBytesB64).toBe('string');

    const bytes = Buffer.from(res.data!.audioBytesB64!, 'base64');
    expect(bytes.subarray(0, 4).toString('ascii')).toBe('RIFF');
    expect(bytes.length).toBeGreaterThan(44);
  });

  test('FETCH_LOCAL_AUDIO round-trips over real runtime messaging', async ({ popupPage }) => {
    const res = await popupPage.evaluate(
      async () =>
        (await chrome.runtime.sendMessage({
          type: 'FETCH_LOCAL_AUDIO',
          payload: { tabId: 0, term: 'hello', langCode: 'en', kind: 'word' },
        })) as { success: boolean; data?: { items: unknown[] } },
    );

    expect(res.success).toBe(true);
    expect(Array.isArray(res.data?.items)).toBe(true);
  });
});
