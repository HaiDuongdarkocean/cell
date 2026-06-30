import { detectLanguage, extractPlainText, isoCodeToLabel, labelToIsoCode, LANGUAGE_PROFILES } from '@/features/detection/logic/languageDetector';

describe('languageDetector', () => {
  describe('LANGUAGE_PROFILES', () => {
    it('contains English, Chinese, Vietnamese, Korean, Japanese, and Russian profiles', () => {
      const labels = LANGUAGE_PROFILES.map((p) => p.label);
      expect(labels).toContain('English');
      expect(labels).toContain('Chinese');
      expect(labels).toContain('Vietnamese');
      expect(labels).toContain('Korean');
      expect(labels).toContain('Japanese');
      expect(labels).toContain('Russian');
    });

    it('each profile has 10 top words, all 3+ characters (CJK exempt)', () => {
      // CJK scripts (han, hangul, hiragana) resolve via script detection
      // (single-candidate), so frequency is secondary. CJK characters count
      // as 1 char each, and common CJK words are often 2 chars — exempt.
      const cjkScripts = ['han', 'hangul', 'hiragana'];
      for (const profile of LANGUAGE_PROFILES) {
        expect(profile.topWords).toHaveLength(10);
        if (profile.script && cjkScripts.includes(profile.script)) continue;
        for (const word of profile.topWords) {
          // Each word must have 3+ characters (counting Unicode code points,
          // not UTF-16 units). This avoids cross-language false positives from
          // short words like "a", "en", "я", "с".
          const charCount = [...word].length;
          expect(charCount).toBeGreaterThanOrEqual(3);
        }
      }
    });

    it('original 6 profiles have threshold 8, extended profiles have threshold 6', () => {
      const original = ['English', 'Chinese', 'Vietnamese', 'Korean', 'Japanese', 'Russian'];
      for (const profile of LANGUAGE_PROFILES) {
        if (original.includes(profile.label)) {
          expect(profile.threshold).toBe(8);
        } else {
          expect(profile.threshold).toBe(6);
        }
      }
    });

    it('English top words are 3+ char words from OEC ranking', () => {
      const en = LANGUAGE_PROFILES.find((p) => p.label === 'English')!;
      expect(en.topWords).toEqual([
        'the', 'and', 'for', 'are', 'but',
        'not', 'you', 'all', 'can', 'her',
      ]);
    });

    it('Chinese top words are 3+ char words from Jun Da frequency', () => {
      const zh = LANGUAGE_PROFILES.find((p) => p.label === 'Chinese')!;
      expect(zh.topWords).toEqual([
        '我们', '他们', '一个', '什么', '这个',
        '可以', '没有', '自己', '知道', '现在',
      ]);
    });

    it('Vietnamese top words are 3+ char words from frequency corpus', () => {
      const vi = LANGUAGE_PROFILES.find((p) => p.label === 'Vietnamese')!;
      expect(vi.topWords).toEqual([
        'trong', 'được', 'cho', 'một', 'với',
        'người', 'này', 'không', 'cũng', 'những',
      ]);
    });

    it('Korean top words are 3+ char words from Kimchi Reader', () => {
      const ko = LANGUAGE_PROFILES.find((p) => p.label === 'Korean')!;
      expect(ko.topWords).toEqual([
        '같다', '않다', '하다', '이렇다', '되다',
        '우리', '진짜', '없다', '그리고', '그래서',
      ]);
    });

    it('Japanese top words are 3+ char words from Wiktionary 5000', () => {
      const ja = LANGUAGE_PROFILES.find((p) => p.label === 'Japanese')!;
      expect(ja.topWords).toEqual([
        'ます', 'ている', 'です', 'ない', 'また',
        'しかし', 'そして', 'こと', 'もの', 'する',
      ]);
    });

    it('Russian top words are 3+ char words from RNC', () => {
      const ru = LANGUAGE_PROFILES.find((p) => p.label === 'Russian')!;
      expect(ru.topWords).toEqual([
        'что', 'это', 'как', 'для', 'все',
        'был', 'она', 'этот', 'чтобы', 'или',
      ]);
    });
  });

  describe('isoCodeToLabel', () => {
    it('maps common 2-letter ISO 639-1 codes', () => {
      expect(isoCodeToLabel('en')).toBe('english');
      expect(isoCodeToLabel('vi')).toBe('vietnamese');
      expect(isoCodeToLabel('ko')).toBe('korean');
      expect(isoCodeToLabel('ja')).toBe('japanese');
      expect(isoCodeToLabel('ru')).toBe('russian');
      expect(isoCodeToLabel('zh')).toBe('chinese');
      expect(isoCodeToLabel('es')).toBe('spanish');
      expect(isoCodeToLabel('fr')).toBe('french');
      expect(isoCodeToLabel('de')).toBe('german');
      expect(isoCodeToLabel('pt')).toBe('portuguese');
      expect(isoCodeToLabel('it')).toBe('italian');
      expect(isoCodeToLabel('th')).toBe('thai');
      expect(isoCodeToLabel('ar')).toBe('arabic');
      expect(isoCodeToLabel('hi')).toBe('hindi');
    });

    it('maps 3-letter ISO 639-2 codes', () => {
      expect(isoCodeToLabel('eng')).toBe('english');
      expect(isoCodeToLabel('vie')).toBe('vietnamese');
      expect(isoCodeToLabel('kor')).toBe('korean');
      expect(isoCodeToLabel('jpn')).toBe('japanese');
      expect(isoCodeToLabel('rus')).toBe('russian');
      expect(isoCodeToLabel('zho')).toBe('chinese');
      expect(isoCodeToLabel('spa')).toBe('spanish');
      expect(isoCodeToLabel('fra')).toBe('french');
      expect(isoCodeToLabel('deu')).toBe('german');
      expect(isoCodeToLabel('por')).toBe('portuguese');
      expect(isoCodeToLabel('ita')).toBe('italian');
      expect(isoCodeToLabel('tha')).toBe('thai');
      expect(isoCodeToLabel('ara')).toBe('arabic');
      expect(isoCodeToLabel('hin')).toBe('hindi');
    });

    it('is case-insensitive', () => {
      expect(isoCodeToLabel('EN')).toBe('english');
      expect(isoCodeToLabel('En')).toBe('english');
      expect(isoCodeToLabel('ENG')).toBe('english');
      expect(isoCodeToLabel('Eng')).toBe('english');
    });

    it('returns null for unknown codes', () => {
      expect(isoCodeToLabel('xx')).toBeNull();
      expect(isoCodeToLabel('xyz')).toBeNull();
      expect(isoCodeToLabel('unknown')).toBeNull();
    });

    it('returns null for empty or invalid input', () => {
      expect(isoCodeToLabel('')).toBeNull();
      expect(isoCodeToLabel('e')).toBeNull();
      expect(isoCodeToLabel('en-US')).toBeNull();
      expect(isoCodeToLabel('english')).toBeNull();
    });
  });

  describe('labelToIsoCode', () => {
    it('maps common language labels back to ISO 639-1 (2-letter) codes', () => {
      expect(labelToIsoCode('english')).toBe('en');
      expect(labelToIsoCode('vietnamese')).toBe('vi');
      expect(labelToIsoCode('korean')).toBe('ko');
      expect(labelToIsoCode('japanese')).toBe('ja');
      expect(labelToIsoCode('russian')).toBe('ru');
      expect(labelToIsoCode('chinese')).toBe('zh');
      expect(labelToIsoCode('spanish')).toBe('es');
      expect(labelToIsoCode('french')).toBe('fr');
      expect(labelToIsoCode('german')).toBe('de');
      expect(labelToIsoCode('portuguese')).toBe('pt');
      expect(labelToIsoCode('thai')).toBe('th');
      expect(labelToIsoCode('arabic')).toBe('ar');
      expect(labelToIsoCode('hindi')).toBe('hi');
    });

    it('is case-insensitive (accepts capitalized labels from detectLanguage)', () => {
      expect(labelToIsoCode('English')).toBe('en');
      expect(labelToIsoCode('Vietnamese')).toBe('vi');
      expect(labelToIsoCode('ENGLISH')).toBe('en');
    });

    it('prefers 2-letter codes over 3-letter codes for the same label', () => {
      // "english" maps to both "en" (639-1) and "eng" (639-2) — must return "en"
      expect(labelToIsoCode('english')).toHaveLength(2);
      expect(labelToIsoCode('english')).not.toBe('eng');
    });

    it('returns null for unknown labels', () => {
      expect(labelToIsoCode('klingon')).toBeNull();
      expect(labelToIsoCode('')).toBeNull();
    });

    it('is the inverse of isoCodeToLabel for all known codes', () => {
      // Round-trip: ISO code → label → ISO code should return the original
      // 2-letter code (preferred over 3-letter).
      const testCodes = ['en', 'vi', 'ko', 'ja', 'ru', 'zh', 'es', 'fr', 'de', 'pt', 'th', 'ar', 'hi'];
      for (const code of testCodes) {
        const label = isoCodeToLabel(code);
        expect(label).not.toBeNull();
        const backToCode = labelToIsoCode(label!);
        expect(backToCode).toBe(code);
      }
    });
  });

  describe('end-to-end: detectLanguage → labelToIsoCode → selectBestMedia matching', () => {
    // This test proves the fix: content-detected language labels can be
    // converted to ISO 639-1 codes that match settings.selectedSubtitleLanguages.
    it('English subtitle content → "english" → "en" matches settings ["en"]', () => {
      const englishVtt = `WEBVTT

00:00:01.000 --> 00:00:04.000
Hello and welcome to the show.

00:00:04.500 --> 00:00:07.000
Today we have a guest for you.`;

      const detected = detectLanguage(englishVtt, 'vtt');
      expect(detected).toBe('english');
      const isoCode = labelToIsoCode(detected!);
      expect(isoCode).toBe('en');
      // Simulate selectBestMedia matching:
      const settings = { selectedSubtitleLanguages: ['en'] };
      expect(settings.selectedSubtitleLanguages.includes(isoCode!)).toBe(true);
    });

    it('Vietnamese subtitle content → "vietnamese" → "vi" matches settings ["vi"]', () => {
      // Use enough Vietnamese common words to meet threshold 8.
      const vietnameseVtt = `WEBVTT

00:00:01.000 --> 00:00:04.000
trong này được cho một người không

00:00:04.500 --> 00:00:07.000
những người cũng được cho với`;

      const detected = detectLanguage(vietnameseVtt, 'vtt');
      expect(detected).toBe('vietnamese');
      const isoCode = labelToIsoCode(detected!);
      expect(isoCode).toBe('vi');
      const settings = { selectedSubtitleLanguages: ['vi'] };
      expect(settings.selectedSubtitleLanguages.includes(isoCode!)).toBe(true);
    });

    it('unknown-language subtitle that resolves to English matches settings ["en"]', () => {
      // Simulate: subtitle detected with language='unknown' from URL,
      // content detection resolves it to English → ISO code "en".
      const subtitleLanguage = 'unknown'; // from URL detection
      const englishContent = `WEBVTT

00:00:01.000 --> 00:00:04.000
The quick brown fox jumps over the lazy dog.

00:00:04.500 --> 00:00:07.000
She was not able to find her book.`;

      // Before fix: subtitleLanguage='unknown' does NOT match settings
      const settings = { selectedSubtitleLanguages: ['en'] };
      expect(settings.selectedSubtitleLanguages.includes(subtitleLanguage)).toBe(false);

      // After content detection + labelToIsoCode:
      const detected = detectLanguage(englishContent, 'vtt');
      const isoCode = labelToIsoCode(detected!);
      expect(isoCode).toBe('en');
      // Now it matches!
      expect(settings.selectedSubtitleLanguages.includes(isoCode!)).toBe(true);
    });
  });

  describe('extractPlainText', () => {
    it('extracts text from SRT content, stripping indices and timing', () => {
      const srt = `1
00:00:01,000 --> 00:00:04,000
Hello and welcome to the show.

2
00:00:04,500 --> 00:00:07,000
Today we have a guest.`;
      const text = extractPlainText(srt, 'srt');
      expect(text).toContain('Hello and welcome to the show');
      expect(text).toContain('Today we have a guest');
      expect(text).not.toContain('00:00:01');
      expect(text).not.toContain('-->');
    });

    it('extracts text from VTT content, stripping WEBVTT header and timing', () => {
      const vtt = `WEBVTT

00:00:01.000 --> 00:00:04.000
Hello and welcome to the show.

00:00:04.500 --> 00:00:07.000
Today we have a guest.`;
      const text = extractPlainText(vtt, 'vtt');
      expect(text).toContain('Hello and welcome to the show');
      expect(text).not.toContain('WEBVTT');
      expect(text).not.toContain('-->');
    });

    it('strips HTML tags from VTT cue text', () => {
      const vtt = `WEBVTT

00:00:01.000 --> 00:00:04.000
<c.en> and <b>welcome</b> to the show.`;
      const text = extractPlainText(vtt, 'vtt');
      expect(text).toContain('and welcome to the show');
      expect(text).not.toContain('<');
    });

    it('extracts text from ASS Dialogue lines, stripping override tags', () => {
      const ass = `[Script Info]
Title: Test

[V4+ Styles]
Format: Name, Fontname, Fontsize
Style: Default,Arial,20

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, EffectV, Text
Dialogue: 0,0:00:01.00,0:00:04.00,Default,,0,0,0,,Hello and welcome to the show.
Dialogue: 0,0:00:04.50,0:00:07.00,Default,,0,0,0,,{\\i1}Today{\\i0} we have {\\b1}a{\\b0} guest.`;
      const text = extractPlainText(ass, 'ass');
      expect(text).toContain('Hello and welcome to the show');
      expect(text).toContain('Today we have a guest');
      expect(text).not.toContain('{\\i1}');
    });

    it('returns empty string for empty content', () => {
      expect(extractPlainText('', 'srt')).toBe('');
      expect(extractPlainText('', 'vtt')).toBe('');
      expect(extractPlainText('', 'ass')).toBe('');
    });
  });

  describe('detectLanguage — English', () => {
    const englishSrt = `1
00:00:01,000 --> 00:00:04,000
Hello, and welcome to the show. I am your host.

2
00:00:04,500 --> 00:00:07,000
Today we have a special guest in the studio.

3
00:00:07,500 --> 00:00:10,000
He is known for his work in that field.

4
00:00:10,500 --> 00:00:13,000
We have a lot to talk about, so let's get started.

5
00:00:13,500 --> 00:00:16,000
It is not often that we get to sit down on this couch.

6
00:00:16,500 --> 00:00:19,000
For those of you who don't know, he has been working on this.

7
00:00:19,500 --> 00:00:22,000
And on that note, let's begin the interview.

8
00:00:22,500 --> 00:00:25,000
You are all invited, but you can bring her along.`;

    it('returns "English" for English SRT', () => {
      expect(detectLanguage(englishSrt, 'srt')).toBe('english');
    });

    it('returns "English" for English VTT', () => {
      const vtt = `WEBVTT\n\n${englishSrt.replace(/^\d+\n/gm, '').replace(/,/g, '.')}`;
      expect(detectLanguage(vtt, 'vtt')).toBe('english');
    });

    it('returns "English" for English ASS', () => {
      const ass = `[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, EffectV, Text
Dialogue: 0,0:00:01.00,0:00:04.00,Default,,0,0,0,,Hello, and welcome to the show. I am your host.
Dialogue: 0,0:00:04.50,0:00:07.00,Default,,0,0,0,,Today we have a special guest in the studio.
Dialogue: 0,0:00:07.50,0:00:10.00,Default,,0,0,0,,He is known for his work in that field.
Dialogue: 0,0:00:10.50,0:00:13.00,Default,,0,0,0,,We have a lot to talk about, so let us get started.
Dialogue: 0,0:00:13.50,0:00:16.00,Default,,0,0,0,,It is not often that we get to sit down on this couch.
Dialogue: 0,0:00:16.50,0:00:19.00,Default,,0,0,0,,For those of you who do not know, he has been working on this.
Dialogue: 0,0:00:19.50,0:00:22.00,Default,,0,0,0,,And on that note, let us begin the interview.
Dialogue: 0,0:00:22.50,0:00:25.00,Default,,0,0,0,,You are all invited, but you can bring her along.`;
      expect(detectLanguage(ass, 'ass')).toBe('english');
    });

    it('returns "English" (latin fallback) when fewer than 8 of 10 words present', () => {
      // Top words: the, and, for, are, but, not, you, all, can, her
      // This text has 7/10: the, and, for, are, but, not, you (missing all, can, her)
      // Hybrid: script=latin, frequency 7/10 < 8, fallback to first latin candidate.
      const srt = `1
00:00:01,000 --> 00:00:04,000
The show and the host are for you, but not here.`;
      expect(detectLanguage(srt, 'srt')).toBe('english');
    });

    it('returns "English" at exactly 8/10 threshold', () => {
      // Top words: the, and, for, are, but, not, you, all, can, her
      // This text has 8/10: the, and, for, are, but, not, you, all (missing can, her)
      const srt = `1
00:00:01,000 --> 00:00:04,000
The show and the host are for you, but not all come.`;
      expect(detectLanguage(srt, 'srt')).toBe('english');
    });
  });

  describe('detectLanguage — Chinese', () => {
    // Top words: 我们, 他们, 一个, 什么, 这个, 可以, 没有, 自己, 知道, 现在
    const chineseSrt = `1
00:00:01,000 --> 00:00:04,000
我们知道他们没有来。

2
00:00:04,500 --> 00:00:07,000
我们现在可以自己去。

3
00:00:07,500 --> 00:00:10,000
这是一个好的开始。

4
00:00:10,500 --> 00:00:13,000
这个朋友什么都知道。

5
00:00:13,500 --> 00:00:16,000
他们说自己可以来。

6
00:00:16,500 --> 00:00:19,000
我们知道这个没有问题。

7
00:00:19,500 --> 00:00:22,000
现在他们一个也没有来。`;

    it('returns "Chinese" for Chinese SRT', () => {
      expect(detectLanguage(chineseSrt, 'srt')).toBe('chinese');
    });

    it('returns "Chinese" (han fallback) for short Chinese text below threshold', () => {
      // Hybrid: script=han detected, frequency < 8, fallback to first
      // han candidate (Chinese).
      const srt = `1
00:00:01,000 --> 00:00:04,000
你好，世界。`;
      expect(detectLanguage(srt, 'srt')).toBe('chinese');
    });
  });

  describe('detectLanguage — Vietnamese', () => {
    // Top words: trong, được, cho, một, với, người, này, không, cũng, những
    const vietnameseSrt = `1
00:00:01,000 --> 00:00:04,000
Xin chào, tôi có một người bạn trong này.

2
00:00:04,500 --> 00:00:07,000
Anh ấy được cho là người cũng có ở đây.

3
00:00:07,500 --> 00:00:10,000
Có người trong này, không ai cũng được.

4
00:00:10,500 --> 00:00:13,000
Tôi có một người bạn, với anh ấy này.

5
00:00:13,500 --> 00:00:16,000
Người này có trong đây, cũng được cho.

6
00:00:16,500 --> 00:00:19,000
Không có ai trong này, một người cũng không, những người khác cũng vậy.

7
00:00:19,500 --> 00:00:22,000
Với người này, có một cũng được, không sao, những bạn bè cũng đến.`;

    it('returns "Vietnamese" for Vietnamese SRT', () => {
      expect(detectLanguage(vietnameseSrt, 'srt')).toBe('vietnamese');
    });

    it('returns "English" (latin fallback) for short Vietnamese text below threshold', () => {
      // Hybrid: script=latin, frequency < 8, fallback to first latin
      // candidate (English). Real subtitles have enough cues for frequency
      // to match Vietnamese correctly.
      const srt = `1
00:00:01,000 --> 00:00:04,000
Xin chào, thế giới.`;
      expect(detectLanguage(srt, 'srt')).toBe('english');
    });
  });

  describe('detectLanguage — Korean', () => {
    // Top words: 같다, 않다, 하다, 이렇다, 되다, 우리, 진짜, 없다, 그리고, 그래서
    const koreanSrt = `1
00:00:01,000 --> 00:00:04,000
이것은 같다. 우리가 하다, 되다, 않다.

2
00:00:04,500 --> 00:00:07,000
이렇다, 진짜로, 없다, 그리고 더 많이 하다.

3
00:00:07,500 --> 00:00:10,000
우리는 같다, 이렇다, 되다, 않다, 하다, 그래서.

4
00:00:10,500 --> 00:00:13,000
이것이 같다. 우리 더 진짜로 하다, 없다.

5
00:00:13,500 --> 00:00:16,000
이렇다, 되다, 않다, 하다, 같다, 그리고.

6
00:00:16,500 --> 00:00:19,000
우리 진짜 더 이렇다, 되다, 하다, 그래서, 없다.

7
00:00:19,500 --> 00:00:22,000
같다, 않다, 하다, 이렇다, 되다, 우리, 진짜, 없다, 그리고, 그래서.`;

    it('returns "Korean" for Korean SRT', () => {
      expect(detectLanguage(koreanSrt, 'srt')).toBe('korean');
    });

    it('returns "Korean" for short Korean text (single-candidate hangul script)', () => {
      // Hybrid: script=hangul → single candidate → Korean (no frequency needed).
      const srt = `1
00:00:01,000 --> 00:00:04,000
안녕하세요.`;
      expect(detectLanguage(srt, 'srt')).toBe('korean');
    });
  });

  describe('detectLanguage — Japanese', () => {
    // Top words: ます, ている, です, ない, また, しかし, そして, こと, もの, する
    const japaneseSrt = `1
00:00:01,000 --> 00:00:04,000
これはないです。ます、ている、しかし、そして。

2
00:00:04,500 --> 00:00:07,000
です、ます、ている、ない、また、こと。

3
00:00:07,500 --> 00:00:10,000
しかし、です、もの、する、そして、ている。

4
00:00:10,500 --> 00:00:13,000
ます、ない、です、また、こと、もの。

5
00:00:13,500 --> 00:00:16,000
ている、する、しかし、そして、ます、です。

6
00:00:16,500 --> 00:00:19,000
ない、また、こと、もの、する、ている。

7
00:00:19,500 --> 00:00:22,000
ます、ている、です、ない、また、しかし、そして、こと、もの、する。`;

    it('returns "Japanese" for Japanese SRT', () => {
      expect(detectLanguage(japaneseSrt, 'srt')).toBe('japanese');
    });

    it('returns "Japanese" for short Japanese text (single-candidate hiragana script)', () => {
      // Hybrid: script=hiragana → single candidate → Japanese.
      const srt = `1
00:00:01,000 --> 00:00:04,000
こんにちは。`;
      expect(detectLanguage(srt, 'srt')).toBe('japanese');
    });
  });

  describe('detectLanguage — Russian', () => {
    // Top words: что, это, как, для, все, был, она, этот, чтобы, или
    const russianSrt = `1
00:00:01,000 --> 00:00:04,000
Что это как для все, она этот был чтобы.

2
00:00:04,500 --> 00:00:07,000
Что это как для все, она этот был чтобы.

3
00:00:07,500 --> 00:00:10,000
Это как для все, она этот был чтобы или.

4
00:00:10,500 --> 00:00:13,000
Как для все это, она этот был чтобы что.

5
00:00:13,500 --> 00:00:16,000
Для все что это, как она этот был чтобы.

6
00:00:16,500 --> 00:00:19,000
Все это как для, она этот был чтобы или.

7
00:00:19,500 --> 00:00:22,000
Что это как для все, она этот был чтобы или.`;

    it('returns "Russian" for Russian SRT', () => {
      expect(detectLanguage(russianSrt, 'srt')).toBe('russian');
    });

    it('returns "Russian" (cyrillic fallback) for short Russian text below threshold', () => {
      // Hybrid: script=cyrillic, frequency < 8, fallback to first
      // cyrillic candidate (Russian).
      const srt = `1
00:00:01,000 --> 00:00:04,000
Привет, мир.`;
      expect(detectLanguage(srt, 'srt')).toBe('russian');
    });
  });

  describe('detectLanguage — edge cases', () => {
    it('returns null for empty content', () => {
      expect(detectLanguage('', 'srt')).toBeNull();
    });

    it('returns "English" (latin fallback) for content with no recognizable language', () => {
      // Hybrid: script=latin (ASCII letters), no frequency match, fallback
      // to first latin candidate (English).
      const srt = `1
00:00:01,000 --> 00:00:04,000
xyz qwe abc def ghi jkl mno pqr stu vwx yza`;
      expect(detectLanguage(srt, 'srt')).toBe('english');
    });
  });
});
