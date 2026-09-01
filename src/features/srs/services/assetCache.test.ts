import 'fake-indexeddb/auto';
import { storeAudioAsset, getCachedAudioAsset, fetchAndCacheSentenceAudio } from './audioAssetCache';
import { storeImageAsset, getCachedImageAsset } from './imageAssetCache';
import { evictAudioIfNeeded } from './quotaManager';
import { closeAllSrsDBs, clearAllSrsStores, getSrsDbName, deleteSrsDB } from '@/features/srs/repositories/srsDatabase';

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

import { sendMessage } from '@/shared/lib/chrome-apis/runtime';

jest.mock('@/shared/lib/chrome-apis/runtime', () => ({
  sendMessage: jest.fn(),
}));

const b64ToBuffer = (b64: string): ArrayBuffer => {
  const binary = atob(b64);
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
  return buf.buffer;
};

const dataUrl = (b64: string, mime = 'image/png') => `data:${mime};base64,${b64}`;

const makeAudio = (id: string): ArrayBuffer => {
  const b64 = id;
  return b64ToBuffer(btoa(b64));
};

describe('audioAssetCache', () => {
  it('stores and retrieves a cached audio asset', async () => {
    const bytes = makeAudio('word-audio');
    await storeAudioAsset('n1', 'wordAudio', bytes, 'audio/mpeg', 'tts');
    const found = await getCachedAudioAsset('n1', 'wordAudio');
    expect(found).toBeDefined();
    expect(found?.size).toBe(bytes.byteLength);
  });

  it('fetches and caches sentence audio', async () => {
    const b64 = btoa('sentence-audio');
    (sendMessage as jest.Mock).mockResolvedValue({ success: true, data: { url: dataUrl(b64, 'audio/mpeg') } });
    const asset = await fetchAndCacheSentenceAudio('n1', 'sentAudio', 'Hello world', 'en');
    expect(asset).toBeDefined();
    expect(asset?.mimeType).toBe('audio/mpeg');
  });
});

describe('imageAssetCache', () => {
  it('stores a data-URL image and rejects external URLs', async () => {
    const b64 = btoa('png-image');
    const asset = await storeImageAsset('n1', 'image', dataUrl(b64, 'image/png'));
    expect(asset).toBeDefined();
    expect(asset.mimeType).toBe('image/png');

    const found = await getCachedImageAsset('n1', 'image');
    expect(found).toBeDefined();

    await expect(storeImageAsset('n2', 'image', 'https://example.com/image.png')).rejects.toThrow();
  });
});

describe('quotaManager', () => {
  it('evicts least recently used audio assets when quota is exceeded', async () => {
    const smallMb = 0.00001; // tiny quota
    const first = makeAudio('first-audio');
    const second = makeAudio('second-audio');

    await storeAudioAsset('n1', 'f1', first, 'audio/mpeg', 'tts');
    await new Promise((r) => setTimeout(r, 10));
    const asset2 = await storeAudioAsset('n2', 'f2', second, 'audio/mpeg', 'tts');

    await evictAudioIfNeeded(smallMb, new Set([asset2.id]));

    const evicted = await getCachedAudioAsset('n1', 'f1');
    expect(evicted).toBeUndefined();
    const kept = await getCachedAudioAsset('n2', 'f2');
    expect(kept?.id).toBe(asset2.id);
  });
});
