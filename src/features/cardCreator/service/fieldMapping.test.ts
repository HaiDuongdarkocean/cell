import {
  autoMapFields,
  levenshtein,
  SOURCE_FIELD_ORDER,
  type SourceFieldKey,
} from './fieldMapping';

describe('fieldMapping', () => {
  describe('levenshtein', () => {
    it('returns 0 for identical strings', () => {
      expect(levenshtein('hello', 'hello')).toBe(0);
    });

    it('returns length for empty vs non-empty', () => {
      expect(levenshtein('', 'abc')).toBe(3);
      expect(levenshtein('abc', '')).toBe(3);
    });

    it('is case-insensitive', () => {
      expect(levenshtein('Hello', 'hello')).toBe(0);
    });

    it('computes edit distance', () => {
      expect(levenshtein('kitten', 'sitting')).toBe(3);
    });
  });

  describe('autoMapFields', () => {
    it('maps exact canonical names (Cell Video Card defaults)', () => {
      const ankiFields = [
        'TargetWord',
        'Sentence',
        'SentenceTranslation',
        'Definitions',
        'Image',
        'SentenceAudio',
        'WordAudio',
        'Note',
        'MoreExample',
      ];
      const mapping = autoMapFields(ankiFields);
      expect(mapping.targetWord).toBe('TargetWord');
      expect(mapping.sentence).toBe('Sentence');
      expect(mapping.sentenceTranslation).toBe('SentenceTranslation');
      expect(mapping.definitions).toBe('Definitions');
      expect(mapping.images).toBe('Image');
      expect(mapping.sentenceAudios).toBe('SentenceAudio');
      expect(mapping.wordAudios).toBe('WordAudio');
      expect(mapping.note).toBe('Note');
      expect(mapping.moreExample).toBe('MoreExample');
    });

    it('maps to alternative canonical names when exact missing', () => {
      const ankiFields = ['Word', 'Context', 'Translation', 'Glossary', 'Picture', 'Audio', 'Pronunciation', 'Extra', 'Examples'];
      const mapping = autoMapFields(ankiFields);
      expect(mapping.targetWord).toBe('Word');
      expect(mapping.sentence).toBe('Context');
      expect(mapping.sentenceTranslation).toBe('Translation');
      expect(mapping.definitions).toBe('Glossary');
      expect(mapping.images).toBe('Picture');
      expect(mapping.sentenceAudios).toBe('Audio');
      expect(mapping.wordAudios).toBe('Pronunciation');
      expect(mapping.note).toBe('Extra');
      expect(mapping.moreExample).toBe('Examples');
    });

    it('fuzzy matches close variants (Levenshtein ≤ 2)', () => {
      const ankiFields = ['TargetWord', 'Sentences', 'SentenceTranslations', 'Definition', 'Image', 'SentenceAudio', 'WordAudio', 'Note', 'MoreExample'];
      const mapping = autoMapFields(ankiFields);
      expect(mapping.sentence).toBe('Sentences');
      expect(mapping.sentenceTranslation).toBe('SentenceTranslations');
      expect(mapping.definitions).toBe('Definition');
    });

    it('leaves unmapped as empty string when no match', () => {
      const ankiFields = ['Foo', 'Bar'];
      const mapping = autoMapFields(ankiFields);
      expect(mapping.targetWord).toBe('');
      expect(mapping.sentence).toBe('');
    });

    it('does not map two source fields to the same Anki field', () => {
      // Only one field 'Audio' — both sentenceAudios and wordAudios want it.
      // sentenceAudios is processed first (per SOURCE_FIELD_ORDER) → wins.
      const ankiFields = ['Audio'];
      const mapping = autoMapFields(ankiFields);
      expect(mapping.sentenceAudios).toBe('Audio');
      expect(mapping.wordAudios).toBe('');
    });

    it('handles empty Anki field list', () => {
      const mapping = autoMapFields([]);
      for (const key of SOURCE_FIELD_ORDER) {
        expect(mapping[key as SourceFieldKey]).toBe('');
      }
    });

    it('preserves mapping shape for all source keys', () => {
      const mapping = autoMapFields(['TargetWord']);
      expect(Object.keys(mapping).sort()).toEqual(
        [...SOURCE_FIELD_ORDER].sort(),
      );
    });
  });
});
