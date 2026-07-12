import {
  LANGUAGES,
  ISO_LANGUAGE_MAP,
  LABEL_TO_ISO_CODE,
  ISO_639_2_TO_639_1,
  SUBTITLE_LANGUAGES,
  OVERLAY_LANGUAGE_OPTIONS,
  languageMatches,
  isoCodeToLabel,
  labelToIsoCode,
  toIso6391,
  isValidIsoCode,
} from '@/shared/config/languageRegistry';

describe('languageRegistry — single source of truth (ADR-029)', () => {
  describe('LANGUAGES array', () => {
    it('every entry has a 2-letter iso1 code', () => {
      for (const l of LANGUAGES) {
        expect(l.iso1.length).toBe(2);
      }
    });

    it('iso1 codes are unique', () => {
      const codes = LANGUAGES.map((l) => l.iso1);
      expect(new Set(codes).size).toBe(codes.length);
    });

    it('iso2 codes (when non-empty) are 3-letter and unique', () => {
      const iso2s = LANGUAGES.map((l) => l.iso2).filter((s) => s.length > 0);
      for (const s of iso2s) expect(s.length).toBe(3);
      expect(new Set(iso2s).size).toBe(iso2s.length);
    });

    it('every entry has non-empty english + native names', () => {
      for (const l of LANGUAGES) {
        expect(l.english.length).toBeGreaterThan(0);
        expect(l.native.length).toBeGreaterThan(0);
      }
    });
  });

  describe('derived maps are consistent with LANGUAGES', () => {
    it('ISO_LANGUAGE_MAP has 2x entries (iso1 + iso2) when iso2 present', () => {
      let expected = 0;
      for (const l of LANGUAGES) {
        expected += 1; // iso1
        if (l.iso2) expected += 1; // iso2
      }
      expect(ISO_LANGUAGE_MAP.size).toBe(expected);
    });

    it('ISO_LANGUAGE_MAP maps iso1 -> english', () => {
      for (const l of LANGUAGES) {
        expect(ISO_LANGUAGE_MAP.get(l.iso1)).toBe(l.english);
      }
    });

    it('ISO_LANGUAGE_MAP maps iso2 -> english when iso2 present', () => {
      for (const l of LANGUAGES) {
        if (l.iso2) expect(ISO_LANGUAGE_MAP.get(l.iso2)).toBe(l.english);
      }
    });

    it('LABEL_TO_ISO_CODE maps english.toLowerCase() -> iso1', () => {
      for (const l of LANGUAGES) {
        expect(LABEL_TO_ISO_CODE.get(l.english.toLowerCase())).toBe(l.iso1);
      }
    });

    it('ISO_639_2_TO_639_1 maps iso2 -> iso1 when iso2 present', () => {
      for (const l of LANGUAGES) {
        if (l.iso2) expect(ISO_639_2_TO_639_1.get(l.iso2)).toBe(l.iso1);
      }
    });
  });

  describe('UI dropdown lists are derived correctly', () => {
    it('SUBTITLE_LANGUAGES starts with "all" and has 1 entry per LANGUAGES entry', () => {
      expect(SUBTITLE_LANGUAGES[0]).toEqual({ value: 'all', label: 'All languages' });
      // +1 for the "all" option at index 0
      expect(SUBTITLE_LANGUAGES.length).toBe(LANGUAGES.length + 1);
    });

    it('SUBTITLE_LANGUAGES values match LANGUAGES iso1 codes (after "all")', () => {
      const values = SUBTITLE_LANGUAGES.slice(1).map((o) => o.value);
      const iso1s = LANGUAGES.map((l) => l.iso1);
      expect(values).toEqual(iso1s);
    });

    it('OVERLAY_LANGUAGE_OPTIONS starts with "None" and ends with zh-hans/zh-hant', () => {
      expect(OVERLAY_LANGUAGE_OPTIONS[0]).toEqual({ value: '', label: 'None' });
      const last2 = OVERLAY_LANGUAGE_OPTIONS.slice(-2);
      expect(last2[0].value).toBe('zh-hans');
      expect(last2[1].value).toBe('zh-hant');
    });

    it('OVERLAY_LANGUAGE_OPTIONS has no "all" option', () => {
      expect(OVERLAY_LANGUAGE_OPTIONS.find((o) => o.value === 'all')).toBeUndefined();
    });

    it('OVERLAY_LANGUAGE_OPTIONS count = 1 (None) + LANGUAGES + 2 (variants)', () => {
      expect(OVERLAY_LANGUAGE_OPTIONS.length).toBe(LANGUAGES.length + 3);
    });
  });

  describe('drift detector — UI list stays in sync with registry', () => {
    // This test fails if someone adds a language to LANGUAGES but forgets
    // to update the UI list, or vice versa. The whole point of the registry
    // is that the UI list derives automatically — so this is a safety net.
    it('every LANGUAGES iso1 appears in SUBTITLE_LANGUAGES', () => {
      const uiValues = new Set(SUBTITLE_LANGUAGES.map((o) => o.value));
      for (const l of LANGUAGES) {
        expect(uiValues.has(l.iso1)).toBe(true);
      }
    });

    it('every LANGUAGES iso1 appears in OVERLAY_LANGUAGE_OPTIONS', () => {
      const uiValues = new Set(OVERLAY_LANGUAGE_OPTIONS.map((o) => o.value));
      for (const l of LANGUAGES) {
        expect(uiValues.has(l.iso1)).toBe(true);
      }
    });
  });

  describe('languageMatches — BCP 47 subtag-aware', () => {
    it('exact match (case-insensitive)', () => {
      expect(languageMatches('en', 'en')).toBe(true);
      expect(languageMatches('EN', 'en')).toBe(true);
      expect(languageMatches(' en ', 'en')).toBe(true);
    });

    it('macrolanguage matches script variants', () => {
      expect(languageMatches('zh', 'zh-hans')).toBe(true);
      expect(languageMatches('zh', 'zh-hant')).toBe(true);
      expect(languageMatches('zh', 'zh')).toBe(true);
    });

    it('script variant matches itself', () => {
      expect(languageMatches('zh-hans', 'zh-hans')).toBe(true);
      expect(languageMatches('zh-hant', 'zh-hant')).toBe(true);
    });

    it('script variant falls back to macrolanguage', () => {
      expect(languageMatches('zh-hans', 'zh')).toBe(true);
      expect(languageMatches('zh-hant', 'zh')).toBe(true);
    });

    it('script variants do NOT cross-match', () => {
      expect(languageMatches('zh-hans', 'zh-hant')).toBe(false);
      expect(languageMatches('zh-hant', 'zh-hans')).toBe(false);
    });

    it('unrelated languages do not match', () => {
      expect(languageMatches('en', 'vi')).toBe(false);
      expect(languageMatches('en', 'zh')).toBe(false);
      expect(languageMatches('en', 'zh-hans')).toBe(false);
    });

    it('region subtag matches (en matches en-US)', () => {
      expect(languageMatches('en', 'en-US')).toBe(true);
      expect(languageMatches('en-US', 'en')).toBe(true);
    });

    it('empty strings do not match non-empty', () => {
      expect(languageMatches('', 'en')).toBe(false);
      expect(languageMatches('en', '')).toBe(false);
    });
  });

  describe('conversion functions', () => {
    it('isoCodeToLabel: 2-letter + 3-letter -> lowercase english', () => {
      expect(isoCodeToLabel('en')).toBe('english');
      expect(isoCodeToLabel('eng')).toBe('english');
      expect(isoCodeToLabel('vi')).toBe('vietnamese');
      expect(isoCodeToLabel('vie')).toBe('vietnamese');
    });

    it('isoCodeToLabel: invalid code -> null', () => {
      expect(isoCodeToLabel('xx')).toBeNull();
      expect(isoCodeToLabel('')).toBeNull();
      expect(isoCodeToLabel('english')).toBeNull();
    });

    it('labelToIsoCode: english label -> iso1', () => {
      expect(labelToIsoCode('English')).toBe('en');
      expect(labelToIsoCode('english')).toBe('en');
      expect(labelToIsoCode('Vietnamese')).toBe('vi');
      expect(labelToIsoCode('Chinese')).toBe('zh');
    });

    it('labelToIsoCode: unknown label -> null', () => {
      expect(labelToIsoCode('Klingon')).toBeNull();
      expect(labelToIsoCode('')).toBeNull();
    });

    it('toIso6391: 3-letter -> 2-letter, 2-letter unchanged', () => {
      expect(toIso6391('eng')).toBe('en');
      expect(toIso6391('vie')).toBe('vi');
      expect(toIso6391('en')).toBe('en');
      expect(toIso6391('EN')).toBe('en');
    });

    it('isValidIsoCode: true for real codes, false for folder names', () => {
      expect(isValidIsoCode('en')).toBe(true);
      expect(isValidIsoCode('eng')).toBe(true);
      expect(isValidIsoCode('sub')).toBe(false);
      expect(isValidIsoCode('vid')).toBe(false);
      expect(isValidIsoCode('api')).toBe(false);
      expect(isValidIsoCode('xxxx')).toBe(false);
    });
  });
});
