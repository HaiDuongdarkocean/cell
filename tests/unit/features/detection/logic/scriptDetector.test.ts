import {
  detectScript,
  scriptToCandidateLanguages,
  SCRIPT_RANGES,
  type ScriptId,
} from '@/features/detection/logic/scriptDetector';

describe('scriptDetector', () => {
  describe('SCRIPT_RANGES', () => {
    it('covers all major subtitle scripts', () => {
      const ids = SCRIPT_RANGES.map((r) => r.id);
      const expected: ScriptId[] = [
        'latin',
        'cyrillic',
        'arabic',
        'devanagari',
        'hangul',
        'hiragana',
        'katakana',
        'han',
        'thai',
        'lao',
        'greek',
        'hebrew',
        'armenian',
        'georgian',
        'bengali',
        'tamil',
        'telugu',
        'gurmukhi',
        'gujarati',
        'kannada',
        'malayalam',
        'sinhala',
        'tibetan',
        'myanmar',
        'khmer',
        'ethiopic',
      ];
      for (const id of expected) {
        expect(ids).toContain(id);
      }
    });

    it('each range has start <= end and a non-empty label', () => {
      for (const range of SCRIPT_RANGES) {
        expect(range.start).toBeLessThanOrEqual(range.end);
        expect(range.label.length).toBeGreaterThan(0);
      }
    });
  });

  describe('detectScript', () => {
    it('returns "latin" for English text', () => {
      expect(detectScript('Hello and welcome to the show')).toBe('latin');
    });

    it('returns "latin" for Vietnamese text with diacritics', () => {
      expect(detectScript('Xin chào, đây là phụ đề tiếng Việt')).toBe('latin');
    });

    it('returns "cyrillic" for Russian text', () => {
      expect(detectScript('Привет мир, это русский язык')).toBe('cyrillic');
    });

    it('returns "arabic" for Arabic text', () => {
      expect(detectScript('مرحبا بالعالم هذا نص عربي')).toBe('arabic');
    });

    it('returns "devanagari" for Hindi text', () => {
      expect(detectScript('नमस्ते दुनिया यह हिंदी है')).toBe('devanagari');
    });

    it('returns "hangul" for Korean text', () => {
      expect(detectScript('안녕하세요 세계 이것은 한국어입니다')).toBe('hangul');
    });

    it('returns "hiragana" for Japanese hiragana-dominant text', () => {
      // Hiragana + katakana mix — hiragana usually dominates in subtitles
      expect(detectScript('こんにちは これ は てすと です')).toBe('hiragana');
    });

    it('returns "katakana" for katakana-dominant text', () => {
      expect(detectScript('コンニチハ セカイ テスト')).toBe('katakana');
    });

    it('returns "han" for Chinese-only CJK text (no kana)', () => {
      expect(detectScript('你好世界这是中文')).toBe('han');
    });

    it('returns "thai" for Thai text', () => {
      expect(detectScript('สวัสดีชาวโลกนี่คือภาษาไทย')).toBe('thai');
    });

    it('returns "greek" for Greek text', () => {
      expect(detectScript('Γεια σας κόσμε αυτό είναι ελληνικά')).toBe('greek');
    });

    it('returns "hebrew" for Hebrew text', () => {
      expect(detectScript('שלום עולם זה טקסט בעברית')).toBe('hebrew');
    });

    it('returns "armenian" for Armenian text', () => {
      expect(detectScript('Բարև աշխարհ սա հայերեն է')).toBe('armenian');
    });

    it('returns "georgian" for Georgian text', () => {
      expect(detectScript('გამარჯობა მსოფლიო ეს ქართულია')).toBe('georgian');
    });

    it('returns "bengali" for Bengali text', () => {
      expect(detectScript('হ্যালো বিশ্ব এটি বাংলা')).toBe('bengali');
    });

    it('returns "tamil" for Tamil text', () => {
      expect(detectScript('வணக்கம் உலகம் இது தமிழ்')).toBe('tamil');
    });

    it('returns "telugu" for Telugu text', () => {
      expect(detectScript('నమస్తే ప్రపంచం ఇది తెలుగు')).toBe('telugu');
    });

    it('returns "gurmukhi" for Punjabi text', () => {
      expect(detectScript('ਸਤ ਸ੍ਰੀ ਅਕਾਲ ਦੁਨੀਆ ਇਹ ਪੰਜਾਬੀ ਹੈ')).toBe('gurmukhi');
    });

    it('returns "gujarati" for Gujarati text', () => {
      expect(detectScript('નમસ્તે દુનિયા આ ગુજરાતી છે')).toBe('gujarati');
    });

    it('returns "kannada" for Kannada text', () => {
      expect(detectScript('ನಮಸ್ಕಾರ ಜಗತ್ತು ಇದು ಕನ್ನಡ')).toBe('kannada');
    });

    it('returns "malayalam" for Malayalam text', () => {
      expect(detectScript('നമസ്കാരം ലോകം ഇത് മലയാളം')).toBe('malayalam');
    });

    it('returns "sinhala" for Sinhala text', () => {
      expect(detectScript('ආයුබෝවන් ලෝකය මෙය සිංහල')).toBe('sinhala');
    });

    it('returns "tibetan" for Tibetan text', () => {
      expect(detectScript('བཀྲ་ཤིས་བདེ་ལེགས་འཛམ་གླིང་')).toBe('tibetan');
    });

    it('returns "myanmar" for Burmese text', () => {
      expect(detectScript('မင်္ဂလာပါ ကမ္ဘာကြီး ဤသည်မှာ မြန်မာ')).toBe('myanmar');
    });

    it('returns "khmer" for Khmer text', () => {
      expect(detectScript('សួស្តីពិភពលោកនេះគឺភាសាខ្មែរ')).toBe('khmer');
    });

    it('returns "ethiopic" for Amharic text', () => {
      expect(detectScript('ሰላም ዓለም ይህ አማርኛ ነው')).toBe('ethiopic');
    });

    it('returns null for empty string', () => {
      expect(detectScript('')).toBeNull();
    });

    it('returns null for whitespace-only string', () => {
      expect(detectScript('   \n\t  ')).toBeNull();
    });

    it('returns null for digits and punctuation only', () => {
      expect(detectScript('12345 !@#$%')).toBeNull();
    });

    it('returns the dominant script for mixed text', () => {
      // Mostly Cyrillic with a few Latin words
      expect(detectScript('Привет мир hello world это русский')).toBe('cyrillic');
    });

    it('prefers han when CJK ideographs dominate over kana', () => {
      // Han-heavy text with minimal kana — Chinese-style
      expect(detectScript('我們今天去電影院看電影很好看')).toBe('han');
    });
  });

  describe('scriptToCandidateLanguages', () => {
    it('returns single language for hangul (Korean)', () => {
      const langs = scriptToCandidateLanguages('hangul');
      expect(langs).toContain('Korean');
    });

    it('returns single language for greek', () => {
      const langs = scriptToCandidateLanguages('greek');
      expect(langs).toContain('Greek');
    });

    it('returns single language for thai', () => {
      const langs = scriptToCandidateLanguages('thai');
      expect(langs).toContain('Thai');
    });

    it('returns multiple languages for latin script', () => {
      const langs = scriptToCandidateLanguages('latin');
      expect(langs.length).toBeGreaterThan(10);
      expect(langs).toContain('English');
      expect(langs).toContain('Spanish');
      expect(langs).toContain('French');
      expect(langs).toContain('German');
    });

    it('returns multiple languages for cyrillic script', () => {
      const langs = scriptToCandidateLanguages('cyrillic');
      expect(langs.length).toBeGreaterThan(3);
      expect(langs).toContain('Russian');
      expect(langs).toContain('Ukrainian');
      expect(langs).toContain('Bulgarian');
    });

    it('returns multiple languages for arabic script', () => {
      const langs = scriptToCandidateLanguages('arabic');
      expect(langs.length).toBeGreaterThan(2);
      expect(langs).toContain('Arabic');
      expect(langs).toContain('Persian');
      expect(langs).toContain('Urdu');
    });

    it('returns multiple languages for devanagari script', () => {
      const langs = scriptToCandidateLanguages('devanagari');
      expect(langs.length).toBeGreaterThan(2);
      expect(langs).toContain('Hindi');
      expect(langs).toContain('Marathi');
      expect(langs).toContain('Nepali');
    });

    it('returns empty array for unknown script id', () => {
      expect(scriptToCandidateLanguages('nonexistent' as ScriptId)).toEqual([]);
    });
  });
});
