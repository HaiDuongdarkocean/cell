import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { espeakPhonemeInput, synthesizeEspeakPhonemeAudio } from './espeakPhonemeAudio';
import { synthesizeEspeakAudio } from './espeakWordAudio';

jest.mock('./espeakWordAudio', () => ({
  synthesizeEspeakAudio: jest.fn(),
}));

const mockedSynth = jest.mocked(synthesizeEspeakAudio);

describe('espeakPhonemeInput', () => {
  it('adds a trailing schwa so consonants voice audibly', () => {
    expect(espeakPhonemeInput('t')).toBe('[[t@]]');
    expect(espeakPhonemeInput('b')).toBe('[[b@]]');
    expect(espeakPhonemeInput('ŋ')).toBe('[[N@]]');
    expect(espeakPhonemeInput('θ')).toBe('[[T@]]');
  });

  it('maps affricates to merged phoneme mnemonics with schwa', () => {
    expect(espeakPhonemeInput('tʃ')).toBe('[[tS@]]');
    expect(espeakPhonemeInput('dʒ')).toBe('[[dZ@]]');
  });

  it('keeps vowels and diphthongs bare', () => {
    expect(espeakPhonemeInput('ɜː')).toBe('[[3:]]');
    expect(espeakPhonemeInput('aɪ')).toBe('[[aI]]');
    expect(espeakPhonemeInput('əʊ')).toBe('[[@U]]');
    expect(espeakPhonemeInput('eə')).toBe('[[e@]]');
    expect(espeakPhonemeInput('ɑ')).toBe('[[A:]]');
  });

  it('returns null for symbols without an input', () => {
    expect(espeakPhonemeInput('ˈ')).toBeNull();
    expect(espeakPhonemeInput(' ')).toBeNull();
    expect(espeakPhonemeInput('ç')).toBeNull();
  });
});

describe('synthesizeEspeakPhonemeAudio', () => {
  beforeEach(() => {
    mockedSynth.mockReset().mockResolvedValue({
      samples: new Float32Array([0, 0, 0.5, -0.5, 0, 0]),
      sampleRate: 22050,
      source: 'espeak',
      duration: 6 / 22050,
    });
  });

  it('sends the mapped phoneme input at phoneme rate', async () => {
    await synthesizeEspeakPhonemeAudio('aɪ', 'en');
    expect(mockedSynth).toHaveBeenCalledWith('[[aI]]', 'en', 140);
  });

  it('trims silence and normalizes the returned clip', async () => {
    const audio = await synthesizeEspeakPhonemeAudio('aɪ', 'en');
    expect(audio).not.toBeNull();
    let peak = 0;
    for (const s of audio!.samples) peak = Math.max(peak, Math.abs(s));
    expect(peak).toBeCloseTo(0.65, 2);
    expect(audio!.duration).toBe(audio!.samples.length / audio!.sampleRate);
  });

  it('does not synthesize phonemes without an input', async () => {
    expect(await synthesizeEspeakPhonemeAudio('ˈ', 'en')).toBeNull();
    expect(mockedSynth).not.toHaveBeenCalled();
  });

  it('caches clips per ipa and language', async () => {
    const a = await synthesizeEspeakPhonemeAudio('t', 'en');
    const b = await synthesizeEspeakPhonemeAudio('t', 'en');
    expect(a).toBe(b);
    expect(mockedSynth).toHaveBeenCalledTimes(1);
  });
});

describe('vendored espeak worker', () => {
  it('enables espeakPHONEMES for [[ ]] phoneme input', () => {
    const worker = readFileSync(
      resolve(process.cwd(), 'public/espeakng/espeakng.worker.js'),
      'latin1',
    );
    expect(worker).toContain('$e(b,0,0,1,0,(c[b>>2]&65535)==23387?256:0,0,0)');
  });
});
