import {
  buildWiktionarySearchUrl,
  buildLinguaLibreSearchUrl,
  buildCommonsFileInfoUrl,
  detectAccentFromFilename,
  isWiktionaryAudioFilename,
  isLinguaLibreAudioFilename,
} from './communityAudioService';

describe('communityAudioService', () => {
  describe('buildWiktionarySearchUrl', () => {
    it('builds a regex-based Commons search URL', () => {
      const url = buildWiktionarySearchUrl('hello', 'en');
      expect(url).toContain('action=query');
      expect(url).toContain('list=search');
      expect(url).toContain('srnamespace=6');
      expect(url).toContain('origin=*');
    });
  });

  describe('buildLinguaLibreSearchUrl', () => {
    it('includes category and wav search', () => {
      const url = buildLinguaLibreSearchUrl('hello', 'eng');
      expect(url).toContain('Lingua_Libre_pronunciation-eng');
      expect(url).toContain('-hello.wav');
    });
  });

  describe('buildCommonsFileInfoUrl', () => {
    it('builds file info URL', () => {
      const url = buildCommonsFileInfoUrl('File:En-uk-hello.ogg');
      expect(url).toContain('prop=imageinfo');
      expect(url).toContain('titles=File%3AEn-uk-hello.ogg');
      expect(url).toContain('iiprop=user%7Curl');
    });
  });

  describe('detectAccentFromFilename', () => {
    it.each([
      ['File:en-us-hello.ogg', 'US'],
      ['File:En-uk-hello.ogg', 'UK'],
      ['File:En-au-hello.ogg', 'AU'],
      ['File:En-ca-hello.ogg', 'CA'],
      ['File:En-gb-hello.ogg', 'UK'],
      ['File:Fr-hello.ogg', undefined],
    ])('detects %s as %s', (filename, expected) => {
      expect(detectAccentFromFilename(filename)).toBe(expected);
    });
  });

  describe('isWiktionaryAudioFilename', () => {
    it.each([
      ['File:en-us-hello.ogg', 'hello', 'en', true],
      ['File:En-uk-hello.ogg', 'hello', 'en', true],
      ['File:en-hello-1.ogg', 'hello', 'en', true],
      ['File:fr-hello.ogg', 'hello', 'fr', true],
      ['File:en-hello-world.ogg', 'hello', 'en', false],
      ['File:LL-Q1860(eng)-user-hello.wav', 'hello', 'en', false],
    ])('validates %s for term=%s lang=%s → %s', (filename, term, lang, expected) => {
      expect(isWiktionaryAudioFilename(filename, term, lang)).toBe(expected);
    });
  });

  describe('isLinguaLibreAudioFilename', () => {
    it.each([
      ['File:LL-Q1860 (eng)-GonFreeaks-hello.wav', 'hello', 'eng', true],
      ['File:LL-Q1860 (fra)-User-bonjour.wav', 'bonjour', 'fra', true],
      ['File:en-us-hello.ogg', 'hello', 'eng', false],
    ])('validates %s for term=%s iso3=%s → %s', (filename, term, iso3, expected) => {
      expect(isLinguaLibreAudioFilename(filename, term, iso3)).toBe(expected);
    });
  });
});
