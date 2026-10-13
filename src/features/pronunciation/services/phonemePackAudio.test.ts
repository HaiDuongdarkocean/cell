import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { resolvePhonemeAudio, invalidatePhonemePacks } from './phonemePackAudio';
import { synthesizeEspeakPhonemeAudio } from './espeakPhonemeAudio';
import { decodeAudioUrl } from './audioDecoder';
import type { StorageArea } from './phonemePackStorage';

jest.mock('./espeakPhonemeAudio', () => ({
  synthesizeEspeakPhonemeAudio: jest.fn(),
}));
jest.mock('./audioDecoder', () => ({
  decodeAudioUrl: jest.fn(),
}));
jest.mock('@/shared/lib/chrome-apis/runtime', () => ({
  getURL: (p: string) => `chrome-extension://test/${p}`,
}));
jest.mock('@/shared/lib/base64', () => ({
  decodeBase64ToArrayBuffer: () => new ArrayBuffer(8),
}));

const mockedSynth = jest.mocked(synthesizeEspeakPhonemeAudio);
const mockedDecode = jest.mocked(decodeAudioUrl);

const CLIP = {
  samples: new Float32Array([0, 0.1]),
  sampleRate: 22050,
  source: 'localFile' as const,
  duration: 2 / 22050,
};

function memStorage(packs: Record<string, unknown> = {}): StorageArea {
  const store: Record<string, unknown> = { ...packs };
  return {
    get: async (keys) => {
      const list = Array.isArray(keys) ? keys : [keys];
      const out: Record<string, unknown> = {};
      for (const k of list) if (k in store) out[k] = store[k];
      return out;
    },
    set: async (items) => { Object.assign(store, items); },
    remove: async (keys) => {
      for (const k of Array.isArray(keys) ? keys : [keys]) delete store[k];
    },
  };
}

const BUILTIN_MANIFEST = {
  name: 'builtin',
  files: {
    p: { d: 'p.opus' },
    'ɪə': { br: 'uk-ear.opus', us: 'us-ear.opus' },
    'ɜː': { d: 'u25c.opus', us: 'us-er.opus' },
  },
};

describe('resolvePhonemeAudio', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    invalidatePhonemePacks();
    mockedSynth.mockResolvedValue(CLIP);
    mockedDecode.mockResolvedValue(CLIP);
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => BUILTIN_MANIFEST,
    })) as unknown as typeof fetch;
    URL.createObjectURL = jest.fn(() => 'blob:custom-pack');
    URL.revokeObjectURL = jest.fn();
  });

  it('plays the bundled recording for a mapped symbol', async () => {
    const audio = await resolvePhonemeAudio('p', 'BrE', 'en', memStorage());
    expect(audio).toBe(CLIP);
    expect(mockedDecode).toHaveBeenCalledWith(
      'chrome-extension://test/pronunciation/phonemes/p.opus',
      'localFile',
    );
    expect(mockedSynth).not.toHaveBeenCalled();
  });

  it('picks the accent-specific file where realization differs', async () => {
    await resolvePhonemeAudio('ɪə', 'AmE', 'en', memStorage());
    expect(mockedDecode).toHaveBeenCalledWith(
      expect.stringContaining('us-ear.opus'),
      'localFile',
    );
    mockedDecode.mockClear();
    await resolvePhonemeAudio('ɪə', 'BrE', 'en', memStorage());
    expect(mockedDecode).toHaveBeenCalledWith(
      expect.stringContaining('uk-ear.opus'),
      'localFile',
    );
  });

  it('falls back to the shared file when no accent slot exists', async () => {
    await resolvePhonemeAudio('ɜː', 'BrE', 'en', memStorage());
    expect(mockedDecode).toHaveBeenCalledWith(
      expect.stringContaining('u25c.opus'),
      'localFile',
    );
  });

  it('prefers an imported pack over the bundled one', async () => {
    const storage = memStorage({
      phonemePacks: [{ id: 'custom-1', name: 'Mine', symbolCount: 1, addedAt: 1 }],
      'phonemePack:custom-1': { name: 'Mine', files: { p: { d: 'QUJD' } } },
    });
    const audio = await resolvePhonemeAudio('p', 'BrE', 'en', storage);
    expect(audio).toBe(CLIP);
    expect(mockedDecode).toHaveBeenCalledWith(expect.any(String), 'localFile');
    // custom blob path — not the bundled asset URL
    expect(mockedDecode.mock.calls[0]?.[0]).not.toContain('pronunciation/phonemes/p.opus');
  });

  it('falls back to eSpeak with the accent voice when no pack covers the symbol', async () => {
    await resolvePhonemeAudio('n̩', 'AmE', 'en', memStorage());
    expect(mockedSynth).toHaveBeenCalledWith('n̩', 'en-us');
    mockedSynth.mockClear();
    await resolvePhonemeAudio('n̩', 'BrE', 'en', memStorage());
    expect(mockedSynth).toHaveBeenCalledWith('n̩', 'en');
  });
});
