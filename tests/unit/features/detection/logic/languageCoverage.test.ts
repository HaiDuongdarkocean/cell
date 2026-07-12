import { detectLanguage } from '@/features/detection/logic/languageDetector';

/**
 * Coverage tests for the hybrid script + frequency language detection.
 *
 * Groups:
 * 1. Single-script languages — detectScript resolves directly (no frequency).
 * 2. Multi-script languages with frequency profiles — disambiguated by top words.
 * 3. Multi-script languages without frequency profiles — fallback to first candidate.
 *
 * Each test uses a short SRT sample in the target language. For groups 1 and 3,
 * even short text resolves correctly because script detection is script-based.
 * For group 2, samples include enough top words to meet the threshold (6/10).
 */
describe('detectLanguage — full coverage', () => {
  // Helper: wrap plain text in a minimal SRT structure
  function srt(text: string): string {
    return `1\n00:00:01,000 --> 00:00:04,000\n${text}`;
  }

  // === Group 1: Single-script languages (script → direct resolution) ===
  describe('single-script languages', () => {
    it('detects Korean via Hangul script', () => {
      expect(detectLanguage(srt('안녕하세요'), 'srt')).toBe('korean');
    });

    it('detects Japanese via Hiragana script', () => {
      expect(detectLanguage(srt('こんにちは'), 'srt')).toBe('japanese');
    });

    it('detects Thai via Thai script', () => {
      expect(detectLanguage(srt('สวัสดีครับ'), 'srt')).toBe('thai');
    });

    it('detects Lao via Lao script', () => {
      expect(detectLanguage(srt('ສະບາຍດີ'), 'srt')).toBe('lao');
    });

    it('detects Greek via Greek script', () => {
      expect(detectLanguage(srt('Γεια σας'), 'srt')).toBe('greek');
    });

    it('detects Hebrew via Hebrew script', () => {
      expect(detectLanguage(srt('שלום עולם'), 'srt')).toBe('hebrew');
    });

    it('detects Armenian via Armenian script', () => {
      expect(detectLanguage(srt('Բարև աշխարհ'), 'srt')).toBe('armenian');
    });

    it('detects Georgian via Georgian script', () => {
      expect(detectLanguage(srt('გამარჯობა'), 'srt')).toBe('georgian');
    });

    it('detects Bengali via Bengali script', () => {
      expect(detectLanguage(srt('হ্যালো বিশ্ব'), 'srt')).toBe('bengali');
    });

    it('detects Tamil via Tamil script', () => {
      expect(detectLanguage(srt('வணக்கம் உலகம்'), 'srt')).toBe('tamil');
    });

    it('detects Telugu via Telugu script', () => {
      expect(detectLanguage(srt('నమస్తే ప్రపంచం'), 'srt')).toBe('telugu');
    });

    it('detects Punjabi via Gurmukhi script', () => {
      expect(detectLanguage(srt('ਸਤ ਸ੍ਰੀ ਅਕਾਲ'), 'srt')).toBe('punjabi');
    });

    it('detects Gujarati via Gujarati script', () => {
      expect(detectLanguage(srt('નમસ્તે દુનિયા'), 'srt')).toBe('gujarati');
    });

    it('detects Kannada via Kannada script', () => {
      expect(detectLanguage(srt('ನಮಸ್ಕಾರ ಜಗತ್ತು'), 'srt')).toBe('kannada');
    });

    it('detects Malayalam via Malayalam script', () => {
      expect(detectLanguage(srt('നമസ്കാരം ലോകം'), 'srt')).toBe('malayalam');
    });

    it('detects Sinhala via Sinhala script', () => {
      expect(detectLanguage(srt('ආයුබෝවන් ලෝකය'), 'srt')).toBe('sinhala');
    });

    it('detects Tibetan via Tibetan script', () => {
      expect(detectLanguage(srt('བཀྲ་ཤིས་བདེ་ལེགས'), 'srt')).toBe('tibetan');
    });

    it('detects Burmese via Myanmar script', () => {
      expect(detectLanguage(srt('မင်္ဂလာပါ ကမ္ဘာကြီး'), 'srt')).toBe('burmese');
    });

    it('detects Khmer via Khmer script', () => {
      expect(detectLanguage(srt('សួស្តីពិភពលោក'), 'srt')).toBe('khmer');
    });

    it('detects Amharic via Ethiopic script', () => {
      expect(detectLanguage(srt('ሰላም ዓለም'), 'srt')).toBe('amharic');
    });
  });

  // === Group 2: Multi-script with frequency profiles (3+ char words) ===
  describe('multi-script languages with frequency profiles', () => {
    it('detects Spanish (latin, frequency)', () => {
      // Unique signature words: ñ + accent (language-unique-signature-words.md)
      const text = 'qué después también entonces señor mañana niño pequeño español gracias';
      expect(detectLanguage(srt(text), 'srt')).toBe('spanish');
    });

    it('detects French (latin, frequency)', () => {
      // Unique signature words: accents (é/è/ê/ç), "être"/"même"/"très"
      const text = 'avec dans sont être avoir fait comme même très toujours';
      expect(detectLanguage(srt(text), 'srt')).toBe('french');
    });

    it('detects German (latin, frequency)', () => {
      // Unique signature words: umlaut (ä/ö/ü), "sch", "ch"
      const text = 'und nicht auch sich schon noch immer wieder zwischen während';
      expect(detectLanguage(srt(text), 'srt')).toBe('german');
    });

    it('detects Portuguese (latin, frequency)', () => {
      // Unique signature words: "ão" nasal, "você"
      const text = 'não você também então ainda depois outro muito obrigado vez';
      expect(detectLanguage(srt(text), 'srt')).toBe('portuguese');
    });

    it('detects Italian (latin, frequency)', () => {
      // Unique signature words: double consonants, "gli"
      const text = 'sono come anche bene male questo quello invece mentre ancora';
      expect(detectLanguage(srt(text), 'srt')).toBe('italian');
    });

    it('detects Dutch (latin, frequency)', () => {
      // Unique signature words: "ij" digraph, "ui" diphthong
      const text = 'het dat niet een zijn naar maar nog wel alleen het';
      expect(detectLanguage(srt(text), 'srt')).toBe('dutch');
    });

    it('detects Turkish (latin, frequency)', () => {
      const text = 'için ile var ben sen daha hiç ama çok bir için';
      expect(detectLanguage(srt(text), 'srt')).toBe('turkish');
    });

    it('detects Indonesian (latin, frequency)', () => {
      const text = 'tidak yang ini itu dan akan apa dia karena bisa';
      expect(detectLanguage(srt(text), 'srt')).toBe('indonesian');
    });

    it('detects Polish (latin, frequency)', () => {
      // Unique signature words: ł/ż/ź/ś/ć/ą/ę
      const text = 'się jest przez także jeszcze ponieważ zawsze między dzięki trochę';
      expect(detectLanguage(srt(text), 'srt')).toBe('polish');
    });

    it('detects Czech (latin, frequency)', () => {
      const text = 'který mít jsou jen tak kde při aby nebo ještě';
      expect(detectLanguage(srt(text), 'srt')).toBe('czech');
    });

    it('detects Hungarian (latin, frequency)', () => {
      const text = 'egy van meg csak még mint hogy volt nem majd';
      expect(detectLanguage(srt(text), 'srt')).toBe('hungarian');
    });

    it('detects Romanian (latin, frequency)', () => {
      const text = 'pentru din sunt mai sau care cei ele acest aici';
      expect(detectLanguage(srt(text), 'srt')).toBe('romanian');
    });

    it('detects Croatian (latin, frequency)', () => {
      const text = 'biti kako samo ili jer kod preko gdje uvijek dok';
      expect(detectLanguage(srt(text), 'srt')).toBe('croatian');
    });

    it('detects Finnish (latin, frequency)', () => {
      const text = 'että joka hän myös saada mutta tämä voida tulla';
      expect(detectLanguage(srt(text), 'srt')).toBe('finnish');
    });

    it('detects Swedish (latin, frequency)', () => {
      const text = 'och att det som med han hon inte men var och';
      expect(detectLanguage(srt(text), 'srt')).toBe('swedish');
    });

    it('detects Catalan (latin, frequency)', () => {
      // Unique signature words: "cap", "aquest"/"aquell"
      const text = 'també després cap aquest aquell molts però mentre són més';
      expect(detectLanguage(srt(text), 'srt')).toBe('catalan');
    });

    it('detects Icelandic (latin, frequency)', () => {
      const text = 'sem til var með það þar hafi hefur hans ekki sem';
      expect(detectLanguage(srt(text), 'srt')).toBe('icelandic');
    });

    it('detects Afrikaans (latin, frequency)', () => {
      const text = 'het dat vir was ook nog sal hulle daar toe het';
      expect(detectLanguage(srt(text), 'srt')).toBe('afrikaans');
    });

    it('detects Swahili (latin, frequency)', () => {
      const text = 'kwa kutoka kama pia mtu mahali baada moja watu';
      expect(detectLanguage(srt(text), 'srt')).toBe('swahili');
    });

    it('detects Tagalog (latin, frequency)', () => {
      const text = 'ang mga siya mula para nang hindi pag ako ito';
      expect(detectLanguage(srt(text), 'srt')).toBe('tagalog');
    });

    it('detects Ukrainian (cyrillic, frequency)', () => {
      const text = 'щоб коли тому тільки тоді також завжди після таму';
      expect(detectLanguage(srt(text), 'srt')).toBe('ukrainian');
    });

    it('detects Serbian (cyrillic, frequency)', () => {
      const text = 'како само или код где увек док још након током';
      expect(detectLanguage(srt(text), 'srt')).toBe('serbian');
    });

    it('detects Arabic (arabic, frequency)', () => {
      const text = 'هذا أنا لكن كان لقد عند بين هناك التي الذي';
      expect(detectLanguage(srt(text), 'srt')).toBe('arabic');
    });

    it('detects Persian (arabic, frequency)', () => {
      const text = 'این است برای اما هستند دارند کنند شوند دارند';
      expect(detectLanguage(srt(text), 'srt')).toBe('persian');
    });

    it('detects Urdu (arabic, frequency)', () => {
      const text = 'اور ہیں میں تھا تھے کیا کچھ ابھی کافی مگر';
      expect(detectLanguage(srt(text), 'srt')).toBe('urdu');
    });

    it('detects Hindi (devanagari, frequency)', () => {
      const text = 'लिए गया तथा अपने कुछ साथ होता दिया हुए किया';
      expect(detectLanguage(srt(text), 'srt')).toBe('hindi');
    });
  });

  // === Group 3: Multi-script fallback (no frequency profile → first candidate) ===
  describe('multi-script fallback (no frequency profile)', () => {
    it('detects Chinese as first han candidate for pure CJK text', () => {
      expect(detectLanguage(srt('你好世界'), 'srt')).toBe('chinese');
    });

    it('detects Russian as first cyrillic candidate for short text', () => {
      expect(detectLanguage(srt('Привет мир'), 'srt')).toBe('russian');
    });

    it('detects English as first latin candidate for short text', () => {
      expect(detectLanguage(srt('Hello world'), 'srt')).toBe('english');
    });

    it('detects Marathi via devanagari fallback (first candidate = Hindi)', () => {
      // No Marathi frequency profile → fallback to first devanagari candidate
      expect(detectLanguage(srt('नमस्कार जग'), 'srt')).toBe('hindi');
    });

    it('detects Nepali via devanagari fallback (first candidate = Hindi)', () => {
      expect(detectLanguage(srt('नमस्ते संसार'), 'srt')).toBe('hindi');
    });

    it('detects Malay via latin fallback (first candidate = English)', () => {
      // No Malay frequency profile → fallback to first latin candidate
      expect(detectLanguage(srt('Halo dunia'), 'srt')).toBe('english');
    });
  });

  // === BCP 47 integration (via subtitleDetector, tested separately) ===
  describe('hybrid detection preserves format handling', () => {
    it('works with VTT format', () => {
      const vtt = `WEBVTT\n\n00:00:01.000 --> 00:00:04.000\n안녕하세요`;
      expect(detectLanguage(vtt, 'vtt')).toBe('korean');
    });

    it('works with ASS format', () => {
      const ass = `[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, EffectV, Text\nDialogue: 0,0:00:01.00,0:00:04.00,Default,,0,0,0,,안녕하세요`;
      expect(detectLanguage(ass, 'ass')).toBe('korean');
    });
  });
});
