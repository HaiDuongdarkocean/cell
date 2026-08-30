import { createPronunciationEngine } from './pronunciationEngine';
import type { EspeakPhonemeEngine } from './espeakPhonemeEngine';
import type { PronunciationAudio } from '../types';

describe('createPronunciationEngine', () => {
  function makeEngine(ipa: string): EspeakPhonemeEngine {
    return {
      toIpa: jest.fn().mockResolvedValue(ipa),
    };
  }

  it('returns structured result with phonemes', async () => {
    const engine = createPronunciationEngine(makeEngine('həlˈəʊ'));
    const result = await engine.toPronunciation('hello', 'en');

    expect(result.text).toBe('hello');
    expect(result.language).toBe('en');
    expect(result.ipa).toBe('həlˈəʊ');
    expect(result.audio).toBeNull();
    expect(result.phonemes.map((p) => p.ipa)).toEqual(['h', 'ə', 'l', 'ˈ', 'əʊ']);
    expect(result.metadata.engine).toBe('espeak-phonemes');
  });

  it('uses en-us voice when language is en-us', async () => {
    const phonemeEngine = makeEngine('həlˈoʊ');
    const engine = createPronunciationEngine(phonemeEngine);
    await engine.toPronunciation('hello', 'en-us');

    expect(phonemeEngine.toIpa).toHaveBeenCalledWith('hello', { voice: 'en-us' });
  });

  it('estimates timeline when audio is provided', async () => {
    const audio: PronunciationAudio = {
      samples: new Float32Array(22050),
      sampleRate: 22050,
      source: 'browserTts',
      duration: 1,
    };

    const engine = createPronunciationEngine(makeEngine('həlˈəʊ'));
    const result = await engine.toPronunciation('hello', 'en', audio);

    const last = result.phonemes[result.phonemes.length - 1];
    expect(last.endMs).toBeCloseTo(1000);
  });
});
