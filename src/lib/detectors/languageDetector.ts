import type { SubtitleFormat } from '@/types/media';

/**
 * A language profile for frequency-based detection.
 *
 * Each profile contains a list of the most common words/characters for that
 * language (typically positions 5-14 from a frequency corpus, skipping the
 * top 4 which may be too generic). If enough of these words appear in the
 * subtitle text, the language is detected.
 */
export interface LanguageProfile {
  /** Display label shown in the UI (e.g. "English", "Chinese", "Vietnamese"). */
  readonly label: string;
  /** Top words/characters to check for presence. */
  readonly topWords: readonly string[];
  /** Minimum number of matching words to classify as this language. */
  readonly threshold: number;
  /**
   * Tokenizer regex for extracting word tokens from plain text.
   * Defaults to ASCII letters. CJK languages override this to match
   * Unicode CJK characters.
   */
  readonly tokenPattern?: RegExp;
}

/**
 * Language profiles for detection, ordered by priority (first match wins).
 *
 * Sources:
 * - English: Wikipedia "Most common words in English" (OEC ranking), positions 5-14
 *   https://en.wikipedia.org/wiki/Most_common_words_in_English
 * - Chinese: Jun Da's Modern Chinese Character Frequency List, positions 5-14
 *   https://lingua.mtsu.edu/chinese-computing/statistics/char/list.php
 * - Vietnamese: Vietnamese word frequency corpus, positions 5-14
 *   https://ioecmcomc.github.io/danh_sach_tan_suat/
 * - Korean: Kimchi Reader Korean word frequency (350K+ media), positions 5-14
 *   https://kimchi-reader.app/explore/freq/words
 * - Japanese: Wiktionary 5000 Most Frequent Japanese Words, positions 5-14
 *   https://en.wiktionary.org/wiki/Wiktionary:Frequency_lists/Japanese/5000_Most_Frequent_Words
 * - Russian: Russian National Corpus frequency dictionary, positions 5-14
 *   https://en.wiktionary.org/wiki/Appendix:Frequency_dictionary_of_the_modern_Russian_language
 */
export const LANGUAGE_PROFILES: readonly LanguageProfile[] = [
  {
    label: 'English',
    topWords: ['and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not', 'on'],
    threshold: 8,
  },
  {
    label: 'Chinese',
    topWords: ['我', '他', '在', '人', '有', '这', '来', '个', '说', '上'],
    threshold: 8,
    // CJK Unified Ideographs + Extension A
    tokenPattern: /[\u4e00-\u9fff\u3400-\u4dbf]/g,
  },
  {
    label: 'Vietnamese',
    topWords: ['có', 'trong', 'được', 'cho', 'một', 'với', 'người', 'này', 'không', 'cũng'],
    threshold: 8,
  },
  {
    label: 'Korean',
    topWords: ['같다', '이', '않다', '하다', '아', '이렇다', '되다', '우리', '진짜', '더'],
    threshold: 8,
    // Hangul Syllables (U+AC00-U+D7AF) + Hangul Jamo (U+1100-U+11FF)
    tokenPattern: /[\uac00-\ud7af\u1100-\u11ff]+/g,
  },
  {
    label: 'Japanese',
    topWords: ['を', 'だ', 'が', 'て', 'と', 'ます', 'も', 'で', 'ている', 'です'],
    threshold: 8,
    // Hiragana (U+3040-U+309F) + Katakana (U+30A0-U+30FF) — match individual
    // kana characters/runes (not CJK kanji, which overlap with Chinese).
    // Multi-char entries like "ている" are matched as substrings below.
    tokenPattern: /[\u3040-\u309f\u30a0-\u30ff]+/g,
  },
  {
    label: 'Russian',
    topWords: ['я', 'быть', 'он', 'с', 'что', 'а', 'по', 'это', 'она', 'этот'],
    threshold: 8,
    // Cyrillic (U+0400-U+04FF) + Cyrillic Supplement (U+0500-U+052F)
    tokenPattern: /[\u0400-\u052f]+/g,
  },
] as const;

/**
 * ISO 639-1 (2-letter) and ISO 639-2 (3-letter) code → English label mapping.
 *
 * Source: https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes
 * Only the bibliographic (B) variant is included for 639-2 where multiple exist.
 */
const ISO_LANGUAGE_MAP: ReadonlyMap<string, string> = new Map<string, string>([
  // === 2-letter (ISO 639-1) ===
  ['aa', 'Afar'], ['ab', 'Abkhazian'], ['ae', 'Avestan'], ['af', 'Afrikaans'],
  ['ak', 'Akan'], ['am', 'Amharic'], ['an', 'Aragonese'], ['ar', 'Arabic'],
  ['as', 'Assamese'], ['av', 'Avaric'], ['ay', 'Aymara'], ['az', 'Azerbaijani'],
  ['ba', 'Bashkir'], ['be', 'Belarusian'], ['bg', 'Bulgarian'], ['bh', 'Bihari'],
  ['bi', 'Bislama'], ['bm', 'Bambara'], ['bn', 'Bengali'], ['bo', 'Tibetan'],
  ['br', 'Breton'], ['bs', 'Bosnian'], ['ca', 'Catalan'], ['ce', 'Chechen'],
  ['ch', 'Chamorro'], ['co', 'Corsican'], ['cr', 'Cree'], ['cs', 'Czech'],
  ['cu', 'Church Slavic'], ['cv', 'Chuvash'], ['cy', 'Welsh'], ['da', 'Danish'],
  ['de', 'German'], ['dv', 'Dhivehi'], ['dz', 'Dzongkha'], ['ee', 'Ewe'],
  ['el', 'Greek'], ['en', 'English'], ['eo', 'Esperanto'], ['es', 'Spanish'],
  ['et', 'Estonian'], ['eu', 'Basque'], ['fa', 'Persian'], ['ff', 'Fulah'],
  ['fi', 'Finnish'], ['fj', 'Fijian'], ['fo', 'Faroese'], ['fr', 'French'],
  ['fy', 'Western Frisian'], ['ga', 'Irish'], ['gd', 'Scottish Gaelic'],
  ['gl', 'Galician'], ['gn', 'Guarani'], ['gu', 'Gujarati'], ['gv', 'Manx'],
  ['ha', 'Hausa'], ['he', 'Hebrew'], ['hi', 'Hindi'], ['ho', 'Hiri Motu'],
  ['hr', 'Croatian'], ['ht', 'Haitian Creole'], ['hu', 'Hungarian'],
  ['hy', 'Armenian'], ['hz', 'Herero'], ['ia', 'Interlingua'], ['id', 'Indonesian'],
  ['ie', 'Interlingue'], ['ig', 'Igbo'], ['ii', 'Sichuan Yi'], ['ik', 'Inupiaq'],
  ['io', 'Ido'], ['is', 'Icelandic'], ['it', 'Italian'], ['iu', 'Inuktitut'],
  ['ja', 'Japanese'], ['jv', 'Javanese'], ['ka', 'Georgian'], ['kg', 'Kongo'],
  ['ki', 'Kikuyu'], ['kj', 'Kwanyama'], ['kk', 'Kazakh'], ['kl', 'Kalaallisut'],
  ['km', 'Khmer'], ['kn', 'Kannada'], ['ko', 'Korean'], ['kr', 'Kanuri'],
  ['ks', 'Kashmiri'], ['ku', 'Kurdish'], ['kv', 'Komi'], ['kw', 'Cornish'],
  ['ky', 'Kyrgyz'], ['la', 'Latin'], ['lb', 'Luxembourgish'], ['lg', 'Ganda'],
  ['li', 'Limburgan'], ['ln', 'Lingala'], ['lo', 'Lao'], ['lt', 'Lithuanian'],
  ['lu', 'Luba-Katanga'], ['lv', 'Latvian'], ['mg', 'Malagasy'], ['mh', 'Marshallese'],
  ['mi', 'Maori'], ['mk', 'Macedonian'], ['ml', 'Malayalam'], ['mn', 'Mongolian'],
  ['mr', 'Marathi'], ['ms', 'Malay'], ['mt', 'Maltese'], ['my', 'Burmese'],
  ['na', 'Nauru'], ['nb', 'Norwegian Bokmål'], ['nd', 'North Ndebele'],
  ['ne', 'Nepali'], ['ng', 'Ndonga'], ['nl', 'Dutch'], ['nn', 'Norwegian Nynorsk'],
  ['no', 'Norwegian'], ['nr', 'South Ndebele'], ['nv', 'Navajo'], ['ny', 'Chichewa'],
  ['oc', 'Occitan'], ['oj', 'Ojibwa'], ['om', 'Oromo'], ['or', 'Oriya'],
  ['os', 'Ossetian'], ['pa', 'Punjabi'], ['pi', 'Pali'], ['pl', 'Polish'],
  ['ps', 'Pashto'], ['pt', 'Portuguese'], ['qu', 'Quechua'], ['rm', 'Romansh'],
  ['rn', 'Kirundi'], ['ro', 'Romanian'], ['ru', 'Russian'], ['rw', 'Kinyarwanda'],
  ['sa', 'Sanskrit'], ['sc', 'Sardinian'], ['sd', 'Sindhi'], ['se', 'Northern Sami'],
  ['sg', 'Sango'], ['si', 'Sinhala'], ['sk', 'Slovak'], ['sl', 'Slovenian'],
  ['sm', 'Samoan'], ['sn', 'Shona'], ['so', 'Somali'], ['sq', 'Albanian'],
  ['sr', 'Serbian'], ['ss', 'Swati'], ['st', 'Southern Sotho'], ['su', 'Sundanese'],
  ['sv', 'Swedish'], ['sw', 'Swahili'], ['ta', 'Tamil'], ['te', 'Telugu'],
  ['tg', 'Tajik'], ['th', 'Thai'], ['ti', 'Tigrinya'], ['tk', 'Turkmen'],
  ['tl', 'Tagalog'], ['tn', 'Tswana'], ['to', 'Tongan'], ['tr', 'Turkish'],
  ['ts', 'Tsonga'], ['tt', 'Tatar'], ['ty', 'Tahitian'], ['ug', 'Uyghur'],
  ['uk', 'Ukrainian'], ['ur', 'Urdu'], ['uz', 'Uzbek'], ['ve', 'Venda'],
  ['vi', 'Vietnamese'], ['vo', 'Volapük'], ['wa', 'Walloon'], ['wo', 'Wolof'],
  ['xh', 'Xhosa'], ['yi', 'Yiddish'], ['yo', 'Yoruba'], ['za', 'Zhuang'],
  ['zh', 'Chinese'], ['zu', 'Zulu'],

  // === 3-letter (ISO 639-2) — common ones ===
  ['aar', 'Afar'], ['abk', 'Abkhazian'], ['ave', 'Avestan'], ['afr', 'Afrikaans'],
  ['aka', 'Akan'], ['amh', 'Amharic'], ['arg', 'Aragonese'], ['ara', 'Arabic'],
  ['asm', 'Assamese'], ['ava', 'Avaric'], ['aym', 'Aymara'], ['aze', 'Azerbaijani'],
  ['bak', 'Bashkir'], ['bel', 'Belarusian'], ['bul', 'Bulgarian'], ['bis', 'Bislama'],
  ['bam', 'Bambara'], ['ben', 'Bengali'], ['bod', 'Tibetan'], ['bre', 'Breton'],
  ['bos', 'Bosnian'], ['cat', 'Catalan'], ['che', 'Chechen'], ['cha', 'Chamorro'],
  ['cos', 'Corsican'], ['cre', 'Cree'], ['ces', 'Czech'], ['chu', 'Church Slavic'],
  ['chv', 'Chuvash'], ['cym', 'Welsh'], ['dan', 'Danish'], ['deu', 'German'],
  ['div', 'Dhivehi'], ['dzo', 'Dzongkha'], ['ewe', 'Ewe'], ['ell', 'Greek'],
  ['eng', 'English'], ['epo', 'Esperanto'], ['spa', 'Spanish'], ['est', 'Estonian'],
  ['eus', 'Basque'], ['fas', 'Persian'], ['ful', 'Fulah'], ['fin', 'Finnish'],
  ['fij', 'Fijian'], ['fao', 'Faroese'], ['fra', 'French'], ['fry', 'Western Frisian'],
  ['gle', 'Irish'], ['gla', 'Scottish Gaelic'], ['glg', 'Galician'], ['grn', 'Guarani'],
  ['guj', 'Gujarati'], ['glv', 'Manx'], ['hau', 'Hausa'], ['heb', 'Hebrew'],
  ['hin', 'Hindi'], ['hmo', 'Hiri Motu'], ['hrv', 'Croatian'], ['hat', 'Haitian Creole'],
  ['hun', 'Hungarian'], ['hye', 'Armenian'], ['her', 'Herero'], ['ina', 'Interlingua'],
  ['ind', 'Indonesian'], ['ile', 'Interlingue'], ['ibo', 'Igbo'], ['iii', 'Sichuan Yi'],
  ['ipk', 'Inupiaq'], ['ido', 'Ido'], ['isl', 'Icelandic'], ['ita', 'Italian'],
  ['iku', 'Inuktitut'], ['jpn', 'Japanese'], ['jav', 'Javanese'], ['kat', 'Georgian'],
  ['kon', 'Kongo'], ['kik', 'Kikuyu'], ['kua', 'Kwanyama'], ['kaz', 'Kazakh'],
  ['kal', 'Kalaallisut'], ['khm', 'Khmer'], ['kan', 'Kannada'], ['kor', 'Korean'],
  ['kau', 'Kanuri'], ['kas', 'Kashmiri'], ['kur', 'Kurdish'], ['kom', 'Komi'],
  ['cor', 'Cornish'], ['kir', 'Kyrgyz'], ['lat', 'Latin'], ['ltz', 'Luxembourgish'],
  ['lug', 'Ganda'], ['lim', 'Limburgan'], ['lin', 'Lingala'], ['lao', 'Lao'],
  ['lit', 'Lithuanian'], ['lub', 'Luba-Katanga'], ['lav', 'Latvian'], ['mlg', 'Malagasy'],
  ['mah', 'Marshallese'], ['mri', 'Maori'], ['mkd', 'Macedonian'], ['mal', 'Malayalam'],
  ['mon', 'Mongolian'], ['mar', 'Marathi'], ['msa', 'Malay'], ['mlt', 'Maltese'],
  ['mya', 'Burmese'], ['nau', 'Nauru'], ['nob', 'Norwegian Bokmål'], ['nde', 'North Ndebele'],
  ['nep', 'Nepali'], ['ndo', 'Ndonga'], ['nld', 'Dutch'], ['nno', 'Norwegian Nynorsk'],
  ['nor', 'Norwegian'], ['nbl', 'South Ndebele'], ['nav', 'Navajo'], ['nya', 'Chichewa'],
  ['oci', 'Occitan'], ['oji', 'Ojibwa'], ['orm', 'Oromo'], ['ori', 'Oriya'],
  ['oss', 'Ossetian'], ['pan', 'Punjabi'], ['pli', 'Pali'], ['pol', 'Polish'],
  ['pus', 'Pashto'], ['por', 'Portuguese'], ['que', 'Quechua'], ['roh', 'Romansh'],
  ['run', 'Kirundi'], ['ron', 'Romanian'], ['rus', 'Russian'], ['kin', 'Kinyarwanda'],
  ['san', 'Sanskrit'], ['srd', 'Sardinian'], ['snd', 'Sindhi'], ['sme', 'Northern Sami'],
  ['sag', 'Sango'], ['sin', 'Sinhala'], ['slk', 'Slovak'], ['slv', 'Slovenian'],
  ['smo', 'Samoan'], ['sna', 'Shona'], ['som', 'Somali'], ['sqi', 'Albanian'],
  ['srp', 'Serbian'], ['ssw', 'Swati'], ['sot', 'Southern Sotho'], ['sun', 'Sundanese'],
  ['swe', 'Swedish'], ['swa', 'Swahili'], ['tam', 'Tamil'], ['tel', 'Telugu'],
  ['tgk', 'Tajik'], ['tha', 'Thai'], ['tir', 'Tigrinya'], ['tuk', 'Turkmen'],
  ['tgl', 'Tagalog'], ['tsn', 'Tswana'], ['ton', 'Tongan'], ['tur', 'Turkish'],
  ['tso', 'Tsonga'], ['tat', 'Tatar'], ['tah', 'Tahitian'], ['uig', 'Uyghur'],
  ['ukr', 'Ukrainian'], ['urd', 'Urdu'], ['uzb', 'Uzbek'], ['ven', 'Venda'],
  ['vie', 'Vietnamese'], ['vol', 'Volapük'], ['wln', 'Walloon'], ['wol', 'Wolof'],
  ['xho', 'Xhosa'], ['yid', 'Yiddish'], ['yor', 'Yoruba'], ['zha', 'Zhuang'],
  ['zho', 'Chinese'], ['zul', 'Zulu'],
]);

/**
 * Maps an ISO 639-1 (2-letter) or ISO 639-2 (3-letter) language code to a
 * display label (e.g. "en" → "English", "kor" → "Korean").
 *
 * @param code - Language code (2 or 3 letters, case-insensitive)
 * @returns Display label, or null if the code is not recognized
 */
export function isoCodeToLabel(code: string): string | null {
  if (!/^[a-z]{2,3}$/i.test(code)) return null;
  const label = ISO_LANGUAGE_MAP.get(code.toLowerCase());
  return label ? label.toLowerCase() : null;
}

/**
 * Default tokenizer: Latin letters including Vietnamese diacritics.
 * Covers Latin-1 Supplement (U+00E0-U+00FF), Latin Extended-A/B (U+0100-U+024F),
 * and Latin Extended Additional (U+1E00-U+1EFF) for composed Vietnamese chars.
 */
const DEFAULT_TOKEN_PATTERN = /[a-z\u00e0-\u024f\u1e00-\u1eff]+/g;

/**
 * Extract plain text from subtitle content, stripping format-specific metadata.
 *
 * - SRT: removes cue indices, timing lines (containing "-->"), keeps text lines.
 * - VTT: removes "WEBVTT" header, timing lines, NOTE blocks, cue settings,
 *   strips HTML-like tags (<c>, <b>, etc.).
 * - ASS: parses "Dialogue:" lines, extracts the text field (after 9th comma),
 *   strips ASS override tags {\...} and \N/\n line breaks.
 */
export function extractPlainText(content: string, format: SubtitleFormat): string {
  if (!content || content.trim().length === 0) return '';

  if (format === 'ass') {
    return extractAssText(content);
  }

  // SRT and VTT share similar block structure
  const stripped = content.replace(/^\uFEFF/, '');
  const lines = stripped.split(/\r\n|\r|\n/);
  const textLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    if (trimmed.startsWith('WEBVTT')) continue;
    if (trimmed.includes('-->')) continue;
    if (/^\d+$/.test(trimmed)) continue;
    if (/^(align|line|position|size|vertical|region)/i.test(trimmed)) continue;
    if (trimmed.startsWith('NOTE')) continue;
    textLines.push(trimmed.replace(/<[^>]+>/g, ''));
  }

  return textLines.join(' ');
}

/**
 * Extract text from ASS subtitle by parsing Dialogue lines.
 * ASS Dialogue format: Dialogue: Layer,Start,End,Style,Name,MarginL,MarginR,EffectV,Text
 */
function extractAssText(content: string): string {
  const lines = content.split(/\r\n|\r|\n/);
  const textParts: string[] = [];

  for (const line of lines) {
    if (!line.startsWith('Dialogue:')) continue;
    const commaIdx = nthIndexOf(line, ',', 9);
    if (commaIdx === -1) continue;
    let text = line.substring(commaIdx + 1);
    text = text.replace(/\{[^}]*\}/g, '');
    text = text.replace(/\\N|\\n/g, ' ');
    textParts.push(text);
  }

  return textParts.join(' ');
}

function nthIndexOf(str: string, substr: string, n: number): number {
  let idx = -1;
  for (let i = 0; i < n; i++) {
    idx = str.indexOf(substr, idx + 1);
    if (idx === -1) return -1;
  }
  return idx;
}

/**
 * Detect the language of subtitle content by checking word presence against
 * all registered language profiles. First profile that meets its threshold wins.
 *
 * @param content - Raw subtitle file content (SRT, VTT, or ASS)
 * @param format  - Subtitle format
 * @returns Language label (e.g. "English") if detected, null otherwise
 */
export function detectLanguage(
  content: string,
  format: SubtitleFormat,
): string | null {
  if (!content || content.trim().length === 0) return null;

  const plainText = extractPlainText(content, format);
  if (plainText.trim().length === 0) return null;

  for (const profile of LANGUAGE_PROFILES) {
    const pattern = profile.tokenPattern ?? DEFAULT_TOKEN_PATTERN;
    const lowerText = plainText.toLowerCase();
    const tokens = new Set(lowerText.match(pattern) ?? []);

    let matchCount = 0;
    for (const word of profile.topWords) {
      const candidate = profile.tokenPattern ? word : word.toLowerCase();
      if (tokens.has(candidate)) {
        matchCount++;
      } else if (profile.tokenPattern) {
        // For CJK/kana scripts, tokens are contiguous runs — a word may
        // be a substring of a longer run (e.g. Japanese "て" within "てと").
        for (const token of tokens) {
          if (token.includes(candidate)) {
            matchCount++;
            break;
          }
        }
      }
    }

    if (matchCount >= profile.threshold) {
      return profile.label.toLowerCase();
    }
  }

  return null;
}
