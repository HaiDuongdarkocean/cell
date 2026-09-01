import 'fake-indexeddb/auto';
import { resolveImageDataUrl, createImageBlobUrl, revokeImageBlobUrl } from './imageStimulusResolver';
import { cacheAudioBytes, resolveWordAudio, createAudioBlobUrl, revokeAudioBlobUrl } from './audioStimulusResolver';
import { closeAllSrsDBs, clearAllSrsStores, getSrsDbName, deleteSrsDB } from '@/features/srs/repositories/srsDatabase';
import { sendMessage } from '@/shared/lib/chrome-apis/runtime';

jest.mock('@/shared/lib/chrome-apis/runtime', () => ({
  sendMessage: jest.fn(),
}));

const storageLocalGetMock = jest.fn<Promise<Record<string, unknown>>, [string | string[] | null]>();

beforeAll(() => {
  global.chrome = {
    storage: {
      local: {
        get: storageLocalGetMock as unknown as typeof chrome.storage.local.get,
        set: jest.fn(),
      },
    },
  } as unknown as typeof chrome;
});

beforeEach(() => {
  storageLocalGetMock.mockReset();
  storageLocalGetMock.mockResolvedValue({});
  closeAllSrsDBs();
});

beforeEach(async () => {
  await clearAllSrsStores();
});

afterEach(() => {
  closeAllSrsDBs();
});

afterAll(async () => {
  delete (global as { chrome?: unknown }).chrome;
  const dbName = await getSrsDbName();
  await deleteSrsDB(dbName);
});

describe('imageStimulusResolver', () => {
  it('caches a data-URL image and creates a blob URL', async () => {
    const b64 = btoa('png-image');
    const dataUrl = `data:image/png;base64,${b64}`;
    const asset = await resolveImageDataUrl('n1', 'image', dataUrl);
    expect(asset).toBeDefined();

    const url = createImageBlobUrl(asset!);
    expect(url).toMatch(/^data:image\/png;base64/);

    revokeImageBlobUrl(url);
  });
});

describe('audioStimulusResolver', () => {
  it('caches audio bytes and creates a blob URL', async () => {
    const bytes = new Uint8Array([0x00, 0x01, 0x02, 0x03]).buffer;
    const asset = await cacheAudioBytes('n1', 'wordAudio', bytes, 'audio/mpeg', 'tts');
    const url = createAudioBlobUrl(asset);
    expect(url).toMatch(/^data:audio\/mpeg;base64/);
    revokeAudioBlobUrl(url);
  });

  it('resolves word audio through the fallback chain', async () => {
    const b64 = btoa('word-audio');
    (sendMessage as jest.Mock).mockResolvedValue({
      success: true,
      data: { url: `data:audio/mpeg;base64,${b64}` },
    });

    const asset = await resolveWordAudio('n1', 'wordAudio', 'hello', 'en', {
      fallbackEngines: ['browserTts'],
      downloadEspeakTtsData: false,
      localFile: {} as import('@/entities/settings/types').LocalFileAudioSettings,
    });
    expect(asset).toBeDefined();
    expect(asset?.mimeType).toBe('audio/mpeg');
  });
});
