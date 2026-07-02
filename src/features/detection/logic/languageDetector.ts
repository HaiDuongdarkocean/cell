import type { SubtitleFormat } from '@/entities/media';
import {
  detectScript,
  scriptToCandidateLanguages,
  type ScriptId,
} from './scriptDetector';

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
  /**
   * Unicode script this profile disambiguates. When set, `detectLanguage`
   * only runs this profile against text whose dominant script matches.
   * Profiles without `script` are always evaluated (legacy fallback).
   */
  readonly script?: ScriptId;
  /**
   * When true, top words are matched as substrings of contiguous token runs
   * (needed for scripts without word boundaries: Han, Hiragana, Katakana).
   * Defaults to false — exact token match is used for scripts with spaces.
   */
  readonly substringMatch?: boolean;
}

/**
 * Language profiles for detection, ordered by priority (first match wins).
 *
 * Each profile's `topWords` contains the 10 most frequent words with **3 or
 * more characters**, ranked by actual corpus frequency (most frequent first).
 * Short words (1-2 chars) are excluded because they cause cross-language
 * false positives (e.g. Russian "а" matching inside "за", or English "a"
 * appearing in almost every Latin-script language).
 *
 * Sources:
 * - English: Wikipedia "Most common words in English" (OEC ranking)
 *   https://en.wikipedia.org/wiki/Most_common_words_in_English
 * - Chinese: Jun Da's Modern Chinese Character Frequency List
 *   https://lingua.mtsu.edu/chinese-computing/statistics/char/list.php
 * - Vietnamese: Vietnamese word frequency corpus
 *   https://ioecmcomc.github.io/danh_sach_tan_suat/
 * - Korean: Kimchi Reader Korean word frequency (350K+ media)
 *   https://kimchi-reader.app/explore/freq/words
 * - Japanese: Wiktionary 5000 Most Frequent Japanese Words
 *   https://en.wiktionary.org/wiki/Wiktionary:Frequency_lists/Japanese/5000_Most_Frequent_Words
 * - Russian: Russian National Corpus frequency dictionary
 *   https://en.wiktionary.org/wiki/Appendix:Frequency_dictionary_of_the_modern_Russian_language
 * - Other Latin/Cyrillic/Arabic/Devanagari: Wikipedia frequency lists,
 *   Wiktionary frequency lists, Leipzig Corpora Collection
 *   https://en.wiktionary.org/wiki/Wiktionary:Frequency_lists
 */
export const LANGUAGE_PROFILES: readonly LanguageProfile[] = [
  // === Original 6 profiles (verified, threshold 8) ===
  // CJK/Korean/Japanese use script-based resolution (single-candidate scripts),
  // so frequency is only a secondary signal. Words are kept 3+ chars where
  // possible; CJK characters are counted as 1 char each.
  {
    label: 'English',
    topWords: ['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her'],
    threshold: 8,
    script: 'latin',
  },
  {
    label: 'Chinese',
    topWords: ['我们', '他们', '一个', '什么', '这个', '可以', '没有', '自己', '知道', '现在'],
    threshold: 8,
    script: 'han',
    substringMatch: true,
    // CJK Unified Ideographs + Extension A
    tokenPattern: /[\u4e00-\u9fff\u3400-\u4dbf]/g,
  },
  {
    label: 'Vietnamese',
    topWords: ['trong', 'được', 'cho', 'một', 'với', 'người', 'này', 'không', 'cũng', 'những'],
    threshold: 8,
    script: 'latin',
  },
  {
    label: 'Korean',
    topWords: ['같다', '않다', '하다', '이렇다', '되다', '우리', '진짜', '없다', '그리고', '그래서'],
    threshold: 8,
    script: 'hangul',
    // Hangul Syllables (U+AC00-U+D7AF) + Hangul Jamo (U+1100-U+11FF)
    tokenPattern: /[\uac00-\ud7af\u1100-\u11ff]+/g,
  },
  {
    label: 'Japanese',
    topWords: ['ます', 'ている', 'です', 'ない', 'また', 'しかし', 'そして', 'こと', 'もの', 'する'],
    threshold: 8,
    script: 'hiragana',
    substringMatch: true,
    // Hiragana (U+3040-U+309F) + Katakana (U+30A0-U+30FF) — match individual
    // kana characters/runes (not CJK kanji, which overlap with Chinese).
    // Multi-char entries like "ている" are matched as substrings below.
    tokenPattern: /[\u3040-\u309f\u30a0-\u30ff]+/g,
  },
  {
    label: 'Russian',
    topWords: ['что', 'это', 'как', 'для', 'все', 'был', 'она', 'этот', 'чтобы', 'или'],
    threshold: 8,
    script: 'cyrillic',
    // Cyrillic (U+0400-U+04FF) + Cyrillic Supplement (U+0500-U+052F)
    tokenPattern: /[\u0400-\u052f]+/g,
  },

  // === Latin-script languages (threshold 6 — corpus-derived, 3+ char words) ===
  // Sources: Wikipedia frequency lists, Wiktionary, Leipzig Corpora.
  {
    label: 'Spanish',
    topWords: ['los', 'las', 'por', 'con', 'una', 'sus', 'del', 'más', 'como', 'pero'],
    threshold: 6,
    script: 'latin',
  },
  {
    label: 'French',
    topWords: ['les', 'des', 'une', 'que', 'est', 'pour', 'qui', 'dans', 'pas', 'sur'],
    threshold: 6,
    script: 'latin',
  },
  {
    label: 'German',
    topWords: ['den', 'von', 'das', 'mit', 'sich', 'des', 'auf', 'für', 'ist', 'dem'],
    threshold: 6,
    script: 'latin',
  },
  {
    label: 'Portuguese',
    topWords: ['que', 'dos', 'das', 'para', 'com', 'uma', 'por', 'mais', 'como', 'não'],
    threshold: 6,
    script: 'latin',
  },
  {
    label: 'Italian',
    topWords: ['che', 'per', 'una', 'sono', 'come', 'mai', 'tra', 'gli', 'suo', 'poi'],
    threshold: 6,
    script: 'latin',
  },
  {
    label: 'Dutch',
    topWords: ['het', 'dat', 'voor', 'met', 'die', 'niet', 'een', 'zijn', 'ook', 'naar'],
    threshold: 6,
    script: 'latin',
  },
  {
    label: 'Swedish',
    topWords: ['och', 'att', 'det', 'som', 'med', 'han', 'hon', 'inte', 'men', 'var'],
    threshold: 6,
    script: 'latin',
  },
  {
    label: 'Norwegian',
    topWords: ['jeg', 'det', 'til', 'som', 'med', 'han', 'hun', 'inte', 'men', 'var'],
    threshold: 6,
    script: 'latin',
  },
  {
    label: 'Danish',
    topWords: ['jeg', 'det', 'til', 'som', 'med', 'han', 'hun', 'ikke', 'men', 'var'],
    threshold: 6,
    script: 'latin',
  },
  {
    label: 'Finnish',
    topWords: ['että', 'joka', 'hän', 'myös', 'saada', 'mutta', 'tämä', 'voida', 'tulla', 'kun'],
    threshold: 6,
    script: 'latin',
  },
  {
    label: 'Polish',
    topWords: ['się', 'roku', 'jest', 'przez', 'nie', 'ale', 'jak', 'też', 'oraz', 'temu'],
    threshold: 6,
    script: 'latin',
  },
  {
    label: 'Czech',
    topWords: ['který', 'mít', 'jsou', 'jen', 'tak', 'kde', 'při', 'aby', 'nebo', 'ještě'],
    threshold: 6,
    script: 'latin',
  },
  {
    label: 'Hungarian',
    topWords: ['egy', 'van', 'meg', 'csak', 'még', 'mint', 'hogy', 'volt', 'nem', 'majd'],
    threshold: 6,
    script: 'latin',
  },
  {
    label: 'Romanian',
    topWords: ['pentru', 'din', 'sunt', 'mai', 'sau', 'care', 'cei', 'ele', 'acest', 'aici'],
    threshold: 6,
    script: 'latin',
  },
  {
    label: 'Croatian',
    topWords: ['biti', 'kako', 'samo', 'ili', 'jer', 'kod', 'preko', 'gdje', 'uvijek', 'dok'],
    threshold: 6,
    script: 'latin',
  },
  {
    label: 'Estonian',
    topWords: ['see', 'mis', 'kuid', 'tema', 'kui', 'aga', 'sest', 'nii', 'siis', 'veel'],
    threshold: 6,
    script: 'latin',
  },
  {
    label: 'Latvian',
    topWords: ['kas', 'bet', 'viņš', 'tad', 'kur', 'gan', 'nav', 'jau', 'lai', 'arī'],
    threshold: 6,
    script: 'latin',
  },
  {
    label: 'Turkish',
    topWords: ['için', 'ile', 'var', 'ben', 'sen', 'daha', 'hiç', 'ama', 'çok', 'bir'],
    threshold: 6,
    script: 'latin',
  },
  {
    label: 'Indonesian',
    topWords: ['tidak', 'yang', 'ini', 'itu', 'dan', 'akan', 'apa', 'dia', 'karena', 'bisa'],
    threshold: 6,
    script: 'latin',
  },
  {
    label: 'Tagalog',
    topWords: ['ang', 'mga', 'siya', 'mula', 'para', 'nang', 'hindi', 'pag', 'ako', 'ito'],
    threshold: 6,
    script: 'latin',
  },
  {
    label: 'Catalan',
    topWords: ['que', 'per', 'una', 'els', 'les', 'del', 'com', 'més', 'son', 'són'],
    threshold: 6,
    script: 'latin',
  },
  {
    label: 'Galician',
    topWords: ['que', 'para', 'por', 'sen', 'como', 'máis', 'ten', 'hai', 'seu', 'súa'],
    threshold: 6,
    script: 'latin',
  },
  {
    label: 'Welsh',
    topWords: ['bod', 'ond', 'mae', 'oedd', 'gyda', 'hyn', 'yna', 'wedi', 'nid', 'dyw'],
    threshold: 6,
    script: 'latin',
  },
  {
    label: 'Icelandic',
    topWords: ['sem', 'til', 'var', 'með', 'það', 'þar', 'hafi', 'hefur', 'hans', 'ekki'],
    threshold: 6,
    script: 'latin',
  },
  {
    label: 'Afrikaans',
    topWords: ['het', 'dat', 'vir', 'was', 'ook', 'nog', 'sal', 'hulle', 'daar', 'toe'],
    threshold: 6,
    script: 'latin',
  },
  {
    label: 'Swahili',
    topWords: ['kwa', 'kutoka', 'kama', 'pia', 'mtu', 'mahali', 'baada', 'moja', 'watu', 'sana'],
    threshold: 6,
    script: 'latin',
  },
  {
    label: 'Slovenian',
    topWords: ['kako', 'samo', 'ali', 'ker', 'pri', 'bil', 'brez', 'tudi', 'zato', 'vendar'],
    threshold: 6,
    script: 'latin',
  },
  {
    label: 'Albanian',
    topWords: ['një', 'dhe', 'për', 'është', 'nga', 'nuk', 'por', 'jam', 'njeri', 'kjo'],
    threshold: 6,
    script: 'latin',
  },

  // === Cyrillic-script languages (3+ char words) ===
  // Order matters: more specific profiles (with unique characters) are checked
  // before more generic ones. Serbian uses ј (U+0458) which Bulgarian/Macedonian
  // do not, so it is checked first. Ukrainian/Belarusian use і (U+0456) which
  // Russian does not, so they precede Russian.
  {
    label: 'Serbian',
    topWords: ['како', 'само', 'или', 'код', 'где', 'увек', 'док', 'још', 'након', 'током'],
    threshold: 6,
    script: 'cyrillic',
    tokenPattern: /[\u0400-\u052f]+/g,
  },
  {
    label: 'Ukrainian',
    topWords: ['щоб', 'коли', 'тому', 'тільки', 'тоді', 'також', 'завжди', 'після', 'таму', 'потім'],
    threshold: 6,
    script: 'cyrillic',
    tokenPattern: /[\u0400-\u052f]+/g,
  },
  {
    label: 'Belarusian',
    topWords: ['што', 'гэта', 'каб', 'калі', 'дзе', 'толькі', 'таксама', 'пасля', 'заўсёды', 'таму'],
    threshold: 6,
    script: 'cyrillic',
    tokenPattern: /[\u0400-\u052f]+/g,
  },
  {
    label: 'Bulgarian',
    topWords: ['това', 'как', 'само', 'или', 'защо', 'след', 'тези', 'него', 'тяло', 'също'],
    threshold: 6,
    script: 'cyrillic',
    tokenPattern: /[\u0400-\u052f]+/g,
  },
  {
    label: 'Macedonian',
    topWords: ['како', 'само', 'или', 'код', 'каде', 'секогаш', 'додека', 'уште', 'зашто', 'ниту'],
    threshold: 6,
    script: 'cyrillic',
    tokenPattern: /[\u0400-\u052f]+/g,
  },

  // === Arabic-script languages (3+ char words) ===
  {
    label: 'Arabic',
    topWords: ['هذا', 'أنا', 'لكن', 'كان', 'لقد', 'عند', 'بين', 'هناك', 'التي', 'الذي'],
    threshold: 6,
    script: 'arabic',
    tokenPattern: /[\u0600-\u06ff\u0750-\u077f\ufb50-\ufeff]+/g,
  },
  {
    label: 'Persian',
    topWords: ['این', 'است', 'برای', 'اما', 'هستند', 'دارند', 'کنند', 'شوند', 'می‌کنند', 'داشتند'],
    threshold: 6,
    script: 'arabic',
    tokenPattern: /[\u0600-\u06ff\u0750-\u077f\ufb50-\ufeff]+/g,
  },
  {
    label: 'Urdu',
    topWords: ['اور', 'ہیں', 'میں', 'تھا', 'تھے', 'کیا', 'کچھ', 'ابھی', 'کافی', 'مگر'],
    threshold: 6,
    script: 'arabic',
    tokenPattern: /[\u0600-\u06ff\u0750-\u077f\ufb50-\ufeff]+/g,
  },

  // === Devanagari-script languages (3+ char words) ===
  {
    label: 'Hindi',
    topWords: ['लिए', 'गया', 'तथा', 'अपने', 'कुछ', 'साथ', 'होता', 'दिया', 'हुए', 'किया'],
    threshold: 6,
    script: 'devanagari',
    tokenPattern: /[\u0900-\u097f]+/g,
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
 * Validate whether a candidate string is a recognized ISO 639-1 (2-letter) or
 * ISO 639-2 (3-letter) language code. Used by `extractLanguage` in the subtitle
 * detector to reject URL path segments that match the BCP47 shape but are not
 * real language codes (e.g. kisskh.co's `/sub/<hash>.srt` path → "sub" is a
 * folder name, not a language; themoviebox's `/subtitle/<hash>.srt` →
 * "subtitle" already fails BCP47 length, but 3-letter folder names like "sub",
 * "vid", "api" would slip through without this check).
 *
 * @param code - Candidate language code (case-insensitive)
 * @returns true if the code is a recognized ISO 639-1/639-2 language code
 */
export function isValidIsoCode(code: string): boolean {
  if (!/^[a-z]{2,3}$/i.test(code)) return false;
  return ISO_LANGUAGE_MAP.has(code.toLowerCase());
}

/**
 * Reverse map: language label (lowercase) → ISO 639-1 (2-letter) code.
 * Built once from {@link ISO_LANGUAGE_MAP} by inverting the entries and
 * preferring the 2-letter code when both 2-letter and 3-letter codes map to
 * the same label (e.g. "english" → "en", not "eng").
 *
 * Used to convert the output of {@link detectLanguage} (a label like "english")
 * back into an ISO 639-1 code so it can be stored on
 * `DetectedSubtitle.language` and matched against
 * `settings.selectedSubtitleLanguages` (which stores ISO 639-1 codes).
 */
const LABEL_TO_ISO_CODE: ReadonlyMap<string, string> = (() => {
  const map = new Map<string, string>();
  for (const [code, label] of ISO_LANGUAGE_MAP) {
    const key = label.toLowerCase();
    // Prefer 2-letter codes over 3-letter codes for the same label.
    if (!map.has(key) || code.length === 2) {
      map.set(key, code);
    }
  }
  return map;
})();

/**
 * Maps a language display label (e.g. "English", "english", "Vietnamese")
 * back to its ISO 639-1 (2-letter) code (e.g. "en", "vi").
 *
 * @param label - Language label (case-insensitive)
 * @returns ISO 639-1 code, or null if the label is not recognized
 */
export function labelToIsoCode(label: string): string | null {
  if (!label) return null;
  return LABEL_TO_ISO_CODE.get(label.toLowerCase()) ?? null;
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
 * Detect the language of subtitle content using a hybrid two-stage approach:
 *
 * 1. **Script detection** — identify the dominant Unicode script. If the
 *    script maps to a single language (e.g. Hangul → Korean), return it
 *    immediately without frequency analysis.
 * 2. **Frequency disambiguation** — for scripts that map to multiple
 *    languages (Latin, Cyrillic, Arabic, Devanagari, Han), run only the
 *    frequency profiles whose `script` matches the detected script. The
 *    first profile that meets its threshold wins.
 * 3. **Fallback** — if no frequency profile matches but the script was
 *    detected, return the first candidate language for that script
 *    (best-effort default). If no script was detected, fall back to the
 *    legacy all-profiles scan.
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

  // Stage 1: Script detection
  const script = detectScript(plainText);

  if (script !== null) {
    const candidates = scriptToCandidateLanguages(script);

    // Single-candidate script → resolve immediately
    if (candidates.length === 1) {
      return candidates[0].toLowerCase();
    }

    // Multi-candidate script → frequency disambiguation
    if (candidates.length > 1) {
      const scriptProfiles = LANGUAGE_PROFILES.filter(
        (p) => p.script === script,
      );
      const matched = matchByFrequency(plainText, scriptProfiles);
      if (matched !== null) return matched;

      // No frequency profile met threshold — return best-effort default
      // (first candidate for the detected script).
      return candidates[0].toLowerCase();
    }
  }

  // Legacy fallback: no script detected — scan all profiles without a
  // `script` filter (preserves backward compatibility for edge cases).
  return matchByFrequency(plainText, LANGUAGE_PROFILES);
}

/**
 * Run frequency-based matching against a set of profiles.
 * Returns the first profile label that meets its threshold, or null.
 */
function matchByFrequency(
  plainText: string,
  profiles: readonly LanguageProfile[],
): string | null {
  const lowerText = plainText.toLowerCase();

  for (const profile of profiles) {
    const pattern = profile.tokenPattern ?? DEFAULT_TOKEN_PATTERN;
    const tokens = new Set(lowerText.match(pattern) ?? []);

    let matchCount = 0;
    for (const word of profile.topWords) {
      const candidate = profile.tokenPattern ? word : word.toLowerCase();
      if (tokens.has(candidate)) {
        matchCount++;
      } else if (profile.substringMatch) {
        // Only for scripts without word boundaries (Han, Hiragana, Katakana):
        // tokens are contiguous runs and a word may be a substring of a
        // longer run. For scripts with spaces (Cyrillic, Arabic, etc.) this
        // would cause false positives (e.g. "а" matching inside "за").
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
