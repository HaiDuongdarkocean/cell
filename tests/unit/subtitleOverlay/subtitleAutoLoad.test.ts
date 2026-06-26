import { shouldAutoLoad, validateOverride } from '../../../src/content/subtitleAutoLoad';

describe('subtitleAutoLoad', () => {
  describe('shouldAutoLoad', () => {
    it('should return true when autoLoad enabled and target language set', () => {
      expect(shouldAutoLoad({ autoLoad: true, targetLanguage: 'en' })).toBe(true);
    });

    it('should return false when autoLoad disabled', () => {
      expect(shouldAutoLoad({ autoLoad: false, targetLanguage: 'en' })).toBe(false);
    });

    it('should return false when target language empty', () => {
      expect(shouldAutoLoad({ autoLoad: true, targetLanguage: '' })).toBe(false);
    });

    it('should return false when target language is whitespace only', () => {
      expect(shouldAutoLoad({ autoLoad: true, targetLanguage: '   ' })).toBe(false);
    });
  });

  describe('validateOverride', () => {
    it('should allow override when file language matches target language', () => {
      const result = validateOverride({
        targetLanguage: 'en',
        fileLanguage: 'en',
      });
      expect(result.allowed).toBe(true);
    });

    it('should block override when file language differs from target', () => {
      const result = validateOverride({
        targetLanguage: 'en',
        fileLanguage: 'vi',
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('different from target');
    });

    it('should allow override when target language is empty (no restriction)', () => {
      const result = validateOverride({
        targetLanguage: '',
        fileLanguage: 'vi',
      });
      expect(result.allowed).toBe(true);
    });

    it('should match case-insensitively', () => {
      const result = validateOverride({
        targetLanguage: 'en',
        fileLanguage: 'EN',
      });
      expect(result.allowed).toBe(true);
    });

    it('should trim whitespace before comparing', () => {
      const result = validateOverride({
        targetLanguage: '  en  ',
        fileLanguage: 'en',
      });
      expect(result.allowed).toBe(true);
    });
  });
});
