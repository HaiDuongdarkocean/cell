import {
  normalizeWord,
  normalizeTerm,
  normalizeReading,
  normalizeDefinition,
  processFrequencyEntry,
  processDictionaryEntry,
  isValidWord,
} from '@/features/dictionary/logic/normalizationPipeline';

describe('normalizationPipeline', () => {
  describe('normalizeWord', () => {
    it('trims whitespace', () => {
      expect(normalizeWord('  hello  ')).toBe('hello');
    });
    it('lowercases', () => {
      expect(normalizeWord('HELLO')).toBe('hello');
      expect(normalizeWord('Hello')).toBe('hello');
    });
    it('NFC normalizes', () => {
      // NFD: e + combining accent → NFC: é
      const nfd = 'e\u0301';
      const nfc = '\u00e9';
      expect(normalizeWord(nfd)).toBe(nfc);
    });
    it('handles empty string', () => {
      expect(normalizeWord('')).toBe('');
    });
    it('handles whitespace-only', () => {
      expect(normalizeWord('   ')).toBe('');
    });
  });

  describe('normalizeTerm', () => {
    it('same as normalizeWord', () => {
      expect(normalizeTerm('  Hello  ')).toBe('hello');
    });
  });

  describe('normalizeReading', () => {
    it('trims + NFC but keeps case', () => {
      expect(normalizeReading('  Hello  ')).toBe('Hello');
    });
    it('returns empty for whitespace-only', () => {
      expect(normalizeReading('   ')).toBe('');
    });
  });

  describe('normalizeDefinition', () => {
    it('trims + NFC + collapses whitespace', () => {
      expect(normalizeDefinition('  hello   world  ')).toBe('hello world');
    });
    it('preserves single spaces', () => {
      expect(normalizeDefinition('hello world')).toBe('hello world');
    });
  });

  describe('processFrequencyEntry', () => {
    it('normalizes term + reading + frequency', () => {
      const result = processFrequencyEntry('  Hello  ', '  Hello  ', 5);
      expect(result).toEqual({ term: 'hello', reading: 'Hello', frequency: 5 });
    });
    it('falls back reading to normalized term when empty', () => {
      const result = processFrequencyEntry('  Hello  ', '', 5);
      expect(result.reading).toBe('hello');
    });
    it('floors + clamps frequency to non-negative', () => {
      expect(processFrequencyEntry('a', 'a', 5.7).frequency).toBe(5);
      expect(processFrequencyEntry('a', 'a', -3).frequency).toBe(0);
    });
  });

  describe('processDictionaryEntry', () => {
    it('normalizes all fields', () => {
      const result = processDictionaryEntry({
        term: '  Hello  ',
        altterm: '  Hi  ',
        pronunciation: '  həˈloʊ  ',
        definition: '  a   greeting  ',
        pos: '  noun  ',
        examples: '  Hello world  ',
        audio: '  audio.mp3  ',
      });
      expect(result).toEqual({
        term: 'hello',
        altterm: 'hi',
        pronunciation: 'həˈloʊ',
        definition: 'a greeting',
        pos: 'noun',
        examples: 'Hello world',
        audio: 'audio.mp3',
      });
    });
  });

  describe('isValidWord', () => {
    it('true for non-empty after normalization', () => {
      expect(isValidWord('hello')).toBe(true);
      expect(isValidWord('  Hello  ')).toBe(true);
    });
    it('false for empty or whitespace-only', () => {
      expect(isValidWord('')).toBe(false);
      expect(isValidWord('   ')).toBe(false);
    });
  });
});
