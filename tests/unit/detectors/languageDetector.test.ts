import { detectLanguage, extractPlainText, isoCodeToLabel, LANGUAGE_PROFILES } from '@/lib/detectors/languageDetector';

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

    it('each profile has 10 top words and threshold 8', () => {
      for (const profile of LANGUAGE_PROFILES) {
        expect(profile.topWords).toHaveLength(10);
        expect(profile.threshold).toBe(8);
      }
    });

    it('English top words are Wikipedia OEC positions 5-14', () => {
      const en = LANGUAGE_PROFILES.find((p) => p.label === 'English')!;
      expect(en.topWords).toEqual([
        'and', 'a', 'in', 'that', 'have',
        'i', 'it', 'for', 'not', 'on',
      ]);
    });

    it('Chinese top words are Jun Da positions 5-14', () => {
      const zh = LANGUAGE_PROFILES.find((p) => p.label === 'Chinese')!;
      expect(zh.topWords).toEqual([
        '我', '他', '在', '人', '有',
        '这', '来', '个', '说', '上',
      ]);
    });

    it('Vietnamese top words are positions 5-14', () => {
      const vi = LANGUAGE_PROFILES.find((p) => p.label === 'Vietnamese')!;
      expect(vi.topWords).toEqual([
        'có', 'trong', 'được', 'cho', 'một',
        'với', 'người', 'này', 'không', 'cũng',
      ]);
    });

    it('Korean top words are Kimchi Reader positions 5-14', () => {
      const ko = LANGUAGE_PROFILES.find((p) => p.label === 'Korean')!;
      expect(ko.topWords).toEqual([
        '같다', '이', '않다', '하다', '아',
        '이렇다', '되다', '우리', '진짜', '더',
      ]);
    });

    it('Japanese top words are Wiktionary 5000 positions 5-14', () => {
      const ja = LANGUAGE_PROFILES.find((p) => p.label === 'Japanese')!;
      expect(ja.topWords).toEqual([
        'を', 'だ', 'が', 'て', 'と',
        'ます', 'も', 'で', 'ている', 'です',
      ]);
    });

    it('Russian top words are RNC positions 5-14', () => {
      const ru = LANGUAGE_PROFILES.find((p) => p.label === 'Russian')!;
      expect(ru.topWords).toEqual([
        'я', 'быть', 'он', 'с', 'что',
        'а', 'по', 'это', 'она', 'этот',
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
And on that note, let's begin the interview.`;

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
Dialogue: 0,0:00:19.50,0:00:22.00,Default,,0,0,0,,And on that note, let us begin the interview.`;
      expect(detectLanguage(ass, 'ass')).toBe('english');
    });

    it('returns null when fewer than 8 of 10 words present', () => {
      const srt = `1
00:00:01,000 --> 00:00:04,000
Hello and welcome. I have a gift in that box. It is nice.`;
      expect(detectLanguage(srt, 'srt')).toBeNull();
    });

    it('returns "English" at exactly 8/10 threshold', () => {
      const srt = `1
00:00:01,000 --> 00:00:04,000
Hello and welcome. I have a gift in that box. It is for you.`;
      expect(detectLanguage(srt, 'srt')).toBe('english');
    });
  });

  describe('detectLanguage — Chinese', () => {
    const chineseSrt = `1
00:00:01,000 --> 00:00:04,000
你好，我在这里等了很久。

2
00:00:04,500 --> 00:00:07,000
他说这个人有来过这里。

3
00:00:07,500 --> 00:00:10,000
有人在上面说话，不知道说些什么。

4
00:00:10,500 --> 00:00:13,000
他来了，我们有个新朋友在这。

5
00:00:13,500 --> 00:00:16,000
人在上面看，有人在说，有人在来。

6
00:00:16,500 --> 00:00:19,000
我有他在，这上面有人来过。

7
00:00:19,500 --> 00:00:22,000
他说这人在上面，有个朋友来。`;

    it('returns "Chinese" for Chinese SRT', () => {
      expect(detectLanguage(chineseSrt, 'srt')).toBe('chinese');
    });

    it('returns null for Chinese text with fewer than 8 characters present', () => {
      const srt = `1
00:00:01,000 --> 00:00:04,000
你好，世界。`;
      expect(detectLanguage(srt, 'srt')).toBeNull();
    });
  });

  describe('detectLanguage — Vietnamese', () => {
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
Không có ai trong này, một người cũng không.

7
00:00:19,500 --> 00:00:22,000
Với người này, có một cũng được, không sao.`;

    it('returns "Vietnamese" for Vietnamese SRT', () => {
      expect(detectLanguage(vietnameseSrt, 'srt')).toBe('vietnamese');
    });

    it('returns null for Vietnamese text with fewer than 8 words present', () => {
      const srt = `1
00:00:01,000 --> 00:00:04,000
Xin chào, thế giới.`;
      expect(detectLanguage(srt, 'srt')).toBeNull();
    });
  });

  describe('detectLanguage — Korean', () => {
    const koreanSrt = `1
00:00:01,000 --> 00:00:04,000
이것은 같다. 우리가 하다, 되다, 않다.

2
00:00:04,500 --> 00:00:07,000
이렇다, 진짜로, 아, 더 많이 하다.

3
00:00:07,500 --> 00:00:10,000
우리는 같다, 이렇다, 되다, 않다, 하다.

4
00:00:10,500 --> 00:00:13,000
아, 이것이 같다. 우리 더 진짜로 하다.

5
00:00:13,500 --> 00:00:16,000
이렇다, 되다, 않다, 하다, 같다, 이.

6
00:00:16,500 --> 00:00:19,000
우리 진짜 더 아, 이렇다, 되다, 하다.

7
00:00:19,500 --> 00:00:22,000
같다, 이, 않다, 하다, 아, 이렇다, 되다, 우리, 진짜, 더.`;

    it('returns "Korean" for Korean SRT', () => {
      expect(detectLanguage(koreanSrt, 'srt')).toBe('korean');
    });

    it('returns null for Korean text with fewer than 8 words present', () => {
      const srt = `1
00:00:01,000 --> 00:00:04,000
안녕하세요.`;
      expect(detectLanguage(srt, 'srt')).toBeNull();
    });
  });

  describe('detectLanguage — Japanese', () => {
    const japaneseSrt = `1
00:00:01,000 --> 00:00:04,000
これをだが、てとますもでているです。

2
00:00:04,500 --> 00:00:07,000
をだがてとますもでているです。

3
00:00:07,500 --> 00:00:10,000
これがだ、てとますもでているです。

4
00:00:10,500 --> 00:00:13,000
をだがてと、ますもでているです。

5
00:00:13,500 --> 00:00:16,000
がてとますもで、ているですをだ。

6
00:00:16,500 --> 00:00:19,000
もでているです、をだがてとます。

7
00:00:19,500 --> 00:00:22,000
をだがてとますもでているです。`;

    it('returns "Japanese" for Japanese SRT', () => {
      expect(detectLanguage(japaneseSrt, 'srt')).toBe('japanese');
    });

    it('returns null for Japanese text with fewer than 8 words present', () => {
      const srt = `1
00:00:01,000 --> 00:00:04,000
こんにちは。`;
      expect(detectLanguage(srt, 'srt')).toBeNull();
    });
  });

  describe('detectLanguage — Russian', () => {
    const russianSrt = `1
00:00:01,000 --> 00:00:04,000
Я быть он с что а по это она этот.

2
00:00:04,500 --> 00:00:07,000
Я быть он с что а по это она этот.

3
00:00:07,500 --> 00:00:10,000
Он с что а по это, она этот я быть.

4
00:00:10,500 --> 00:00:13,000
С что а по это, она этот я быть он.

5
00:00:13,500 --> 00:00:16,000
Что а по это, она этот я быть он с.

6
00:00:16,500 --> 00:00:19,000
А по это, она этот я быть он с что.

7
00:00:19,500 --> 00:00:22,000
По это, она этот я быть он с что а.`;

    it('returns "Russian" for Russian SRT', () => {
      expect(detectLanguage(russianSrt, 'srt')).toBe('russian');
    });

    it('returns null for Russian text with fewer than 8 words present', () => {
      const srt = `1
00:00:01,000 --> 00:00:04,000
Привет, мир.`;
      expect(detectLanguage(srt, 'srt')).toBeNull();
    });
  });

  describe('detectLanguage — edge cases', () => {
    it('returns null for empty content', () => {
      expect(detectLanguage('', 'srt')).toBeNull();
    });

    it('returns null for content with no recognizable language', () => {
      const srt = `1
00:00:01,000 --> 00:00:04,000
xyz qwe abc def ghi jkl mno pqr stu vwx yza`;
      expect(detectLanguage(srt, 'srt')).toBeNull();
    });
  });
});
