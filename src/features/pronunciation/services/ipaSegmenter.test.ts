import { parseIPA } from './ipaSegmenter';

describe('parseIPA', () => {
  it('parses simple monosyllables', () => {
    const phonemes = parseIPA('həlˈəʊ');
    const ipas = phonemes.map((p) => p.ipa);
    expect(ipas).toEqual(['h', 'ə', 'l', 'ˈ', 'əʊ']);
    expect(phonemes[0].type).toBe('consonant');
    expect(phonemes[1].type).toBe('vowel');
    expect(phonemes[2].type).toBe('consonant');
    expect(phonemes[3].type).toBe('stress');
    expect(phonemes[4].type).toBe('diphthong');
  });

  it('recognises affricates as single consonants', () => {
    const phonemes = parseIPA('tʃˈeə');
    expect(phonemes.map((p) => p.ipa)).toEqual(['tʃ', 'ˈ', 'eə']);
    expect(phonemes[0].type).toBe('consonant');
    expect(phonemes[2].type).toBe('diphthong');
  });

  it('recognises long vowels', () => {
    const phonemes = parseIPA('wˈɜːld');
    expect(phonemes.map((p) => p.ipa)).toEqual(['w', 'ˈ', 'ɜː', 'l', 'd']);
    expect(phonemes[2].type).toBe('vowel');
  });

  it('splits a sentence into words separated by space', () => {
    const phonemes = parseIPA('ðə kwˈɪk bɹˈaʊn');
    expect(phonemes.map((p) => p.ipa)).toEqual([
      'ð', 'ə', ' ',
      'k', 'w', 'ˈ', 'ɪ', 'k', ' ',
      'b', 'ɹ', 'ˈ', 'aʊ', 'n',
    ]);
  });

  it('handles secondary stress', () => {
    const phonemes = parseIPA('ˌəʊvə');
    expect(phonemes.map((p) => p.ipa)).toEqual(['ˌ', 'əʊ', 'v', 'ə']);
    expect(phonemes[0].type).toBe('stress');
  });

  it('handles multiple diphthongs', () => {
    const phonemes = parseIPA('dʒˈʌdʒ');
    expect(phonemes.map((p) => p.ipa)).toEqual(['dʒ', 'ˈ', 'ʌ', 'dʒ']);
  });

  it('returns no timeline (all zeros)', () => {
    const phonemes = parseIPA('həloʊ');
    for (const p of phonemes) {
      expect(p.startMs).toBe(0);
      expect(p.endMs).toBe(0);
    }
  });
});
