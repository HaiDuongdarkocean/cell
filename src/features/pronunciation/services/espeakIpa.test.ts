import { espeakIpas, supportsEspeakIpa } from './espeakIpa';
import type { EspeakPhonemeEngine } from './espeakPhonemeEngine';

function makeEngine(ipas: Record<string, string>): EspeakPhonemeEngine {
  return {
    toIpa: jest.fn(async (text: string) => ipas[text] ?? ''),
  };
}

describe('supportsEspeakIpa', () => {
  it('accepts English language codes', () => {
    expect(supportsEspeakIpa('en')).toBe(true);
    expect(supportsEspeakIpa('en-US')).toBe(true);
    expect(supportsEspeakIpa('en-GB')).toBe(true);
  });

  it('rejects other languages', () => {
    expect(supportsEspeakIpa('ja')).toBe(false);
    expect(supportsEspeakIpa('vi')).toBe(false);
    expect(supportsEspeakIpa('zh')).toBe(false);
  });
});

describe('espeakIpas', () => {
  it('returns ipa per term for English', async () => {
    const engine = makeEngine({ cloud: 'klaʊd', from: 'fɹɒm' });
    const map = await espeakIpas(['cloud', 'from'], 'en', engine);

    expect(map.get('cloud')).toBe('klaʊd');
    expect(map.get('from')).toBe('fɹɒm');
  });

  it('does not call the engine for unsupported languages', async () => {
    const engine = makeEngine({});
    const map = await espeakIpas(['cloud'], 'ja', engine);

    expect(map.size).toBe(0);
    expect(engine.toIpa).not.toHaveBeenCalled();
  });

  it('returns an empty map for empty input', async () => {
    const engine = makeEngine({});
    const map = await espeakIpas([], 'en', engine);

    expect(map.size).toBe(0);
    expect(engine.toIpa).not.toHaveBeenCalled();
  });

  it('omits terms the engine cannot pronounce', async () => {
    const engine = makeEngine({ cloud: 'klaʊd' });
    const map = await espeakIpas(['cloud', 'xyzqw'], 'en', engine);

    expect(map.has('cloud')).toBe(true);
    expect(map.has('xyzqw')).toBe(false);
  });

  it('keeps per-term failures absent instead of rejecting', async () => {
    const engine: EspeakPhonemeEngine = {
      toIpa: jest.fn(async (text: string) => {
        if (text === 'boom') throw new Error('engine exploded');
        return 'klaʊd';
      }),
    };
    const map = await espeakIpas(['cloud', 'boom'], 'en', engine);

    expect(map.get('cloud')).toBe('klaʊd');
    expect(map.has('boom')).toBe(false);
  });
});
