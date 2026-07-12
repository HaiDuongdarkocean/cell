import type { SubtitleFormat } from '@/entities/media';
import {
  detectScript,
  scriptToCandidateLanguages,
  type ScriptId,
} from './scriptDetector';
// ADR-029: language maps + conversion/matching functions now live in the
// single-source-of-truth registry. Re-export here so existing callers
// (`@/features/detection`) keep working without changing their imports.
export {
  isoCodeToLabel,
  labelToIsoCode,
  toIso6391,
  isValidIsoCode,
  languageMatches,
  ISO_LANGUAGE_MAP,
  LABEL_TO_ISO_CODE,
  ISO_639_2_TO_639_1,
} from '@/shared/config/languageRegistry';

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
    // Unique signature words (language-unique-signature-words.md):
    // "th" digraph + "ould" modal — only English has these in Latin group.
    topWords: ['the', 'and', 'that', 'with', 'this', 'but', 'not', 'have', 'from', 'would'],
    threshold: 4,
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
    // Unique signature words: "đ" + 5 tone marks — only Vietnamese in Latin group.
    topWords: ['không', 'của', 'với', 'một', 'được', 'cho', 'người', 'này', 'cũng', 'những'],
    threshold: 4,
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

  // === Latin-script languages — unique signature words (threshold 4) ===
  // Source: docs/knowledge/language-unique-signature-words.md
  // Each word is unique to its language (no overlap with other Latin profiles).
  // Threshold lowered from 6 to 4 because unique words don't cross-match.
  // Norwegian/Danish use threshold 3 (heavily overlapping pair, fewer unique words).
  {
    label: 'Spanish',
    // Unique: "ñ" — only Spanish in Latin group.
    topWords: ['qué', 'después', 'también', 'entonces', 'señor', 'mañana', 'niño', 'pequeño', 'español', 'gracias'],
    threshold: 4,
    script: 'latin',
  },
  {
    label: 'French',
    // Unique: accents (é/è/ê/ç), "être"/"même"/"très".
    topWords: ['avec', 'dans', 'sont', 'être', 'avoir', 'fait', 'comme', 'même', 'très', 'toujours'],
    threshold: 4,
    script: 'latin',
  },
  {
    label: 'German',
    // Unique: umlaut (ä/ö/ü), "sch", "ch".
    topWords: ['und', 'nicht', 'auch', 'sich', 'schon', 'noch', 'immer', 'wieder', 'zwischen', 'während'],
    threshold: 4,
    script: 'latin',
  },
  {
    label: 'Portuguese',
    // Unique: "ão" nasal, "você".
    topWords: ['não', 'você', 'também', 'então', 'ainda', 'depois', 'outro', 'muito', 'obrigado', 'vez'],
    threshold: 4,
    script: 'latin',
  },
  {
    label: 'Italian',
    // Unique: double consonants, "gli". "sempre" removed (Portuguese overlap).
    topWords: ['sono', 'come', 'anche', 'bene', 'male', 'questo', 'quello', 'invece', 'mentre', 'ancora'],
    threshold: 4,
    script: 'latin',
  },
  {
    label: 'Dutch',
    // Unique: "ij" digraph, "ui" diphthong.
    topWords: ['het', 'dat', 'niet', 'een', 'zijn', 'naar', 'maar', 'nog', 'wel', 'alleen'],
    threshold: 4,
    script: 'latin',
  },
  {
    label: 'Swedish',
    // Unique: "och"/"att"/"inte"/"hon"/"från" vs Danish/Norwegian.
    topWords: ['och', 'att', 'inte', 'hon', 'från', 'mycket', 'aldrig', 'tack', 'också', 'hej'],
    threshold: 4,
    script: 'latin',
  },
  {
    label: 'Norwegian',
    // Unique: "nå"/"nei"/"blitt" vs Danish/Swedish. Fewer uniques → threshold 3.
    topWords: ['nå', 'nei', 'blitt', 'svært', 'gjerne', 'fortelle', 'fjord', 'knall', 'ønsker', 'måtte'],
    threshold: 3,
    script: 'latin',
  },
  {
    label: 'Danish',
    // Unique: "af"/"hvad"/"undskyld" vs Norwegian/Swedish. Fewer uniques → threshold 3.
    topWords: ['af', 'hvad', 'undskyld', 'blev', 'farvel', 'mange', 'godt', 'hvorfor', 'lille', 'store'],
    threshold: 3,
    script: 'latin',
  },
  {
    label: 'Finnish',
    // Unique: "ä"/"ö" (no "å"), agglutinative.
    topWords: ['että', 'joka', 'hän', 'myös', 'mutta', 'tämä', 'voida', 'tulla', 'kun', 'olla'],
    threshold: 4,
    script: 'latin',
  },
  {
    label: 'Polish',
    // Unique: "ł"/"ż"/"ź"/"ś"/"ć"/"ą"/"ę".
    topWords: ['się', 'jest', 'przez', 'także', 'jeszcze', 'ponieważ', 'zawsze', 'między', 'dzięki', 'trochę'],
    threshold: 4,
    script: 'latin',
  },
  {
    label: 'Czech',
    // Unique: "ř"/"ů", "ž"/"š" (vs Polish "sz"/"cz").
    topWords: ['který', 'jsou', 'ještě', 'protože', 'když', 'aby', 'nebo', 'už', 'vůbec', 'moc'],
    threshold: 4,
    script: 'latin',
  },
  {
    label: 'Hungarian',
    // Unique: "cs"/"gy"/"ty"/"sz"/"zs"/"ly", agglutinative.
    topWords: ['egy', 'van', 'meg', 'csak', 'még', 'mint', 'hogy', 'volt', 'nem', 'majd'],
    threshold: 4,
    script: 'latin',
  },
  {
    label: 'Romanian',
    // Unique: "ă"/"â"/"î"/"ș"/"ț" (comma below).
    topWords: ['pentru', 'sunt', 'din', 'mai', 'sau', 'care', 'acest', 'aici', 'ăsta', 'foarte'],
    threshold: 4,
    script: 'latin',
  },
  {
    label: 'Croatian',
    // Unique: "č"/"ć"/"đ"/"lj"/"nj". "bez" removed (Polish overlap).
    topWords: ['biti', 'kako', 'samo', 'jer', 'kod', 'preko', 'gdje', 'uvijek', 'dok', 'već'],
    threshold: 4,
    script: 'latin',
  },
  {
    label: 'Estonian',
    // Unique: "õ", double vowels.
    topWords: ['see', 'mis', 'kuid', 'tema', 'kui', 'aga', 'sest', 'nii', 'siis', 'veel'],
    threshold: 4,
    script: 'latin',
  },
  {
    label: 'Latvian',
    // Unique: "ā"/"ē"/"ī"/"ū", "ņ"/"ķ"/"ģ"/"ļ".
    topWords: ['kas', 'bet', 'viņš', 'tad', 'kur', 'gan', 'nav', 'jau', 'lai', 'arī'],
    threshold: 4,
    script: 'latin',
  },
  {
    label: 'Turkish',
    // Unique: "ğ"/"ı"/"ş"/"ç".
    topWords: ['için', 'ile', 'var', 'ben', 'sen', 'daha', 'hiç', 'ama', 'çok', 'bir'],
    threshold: 4,
    script: 'latin',
  },
  {
    label: 'Indonesian',
    // Unique: "ng", "ny", prefix ber-/di-/ke-.
    topWords: ['tidak', 'yang', 'ini', 'itu', 'dan', 'akan', 'apa', 'dia', 'karena', 'bisa'],
    threshold: 4,
    script: 'latin',
  },
  {
    label: 'Tagalog',
    // Unique: "mga", "siya", "ako". "para" removed (Spanish overlap).
    topWords: ['ang', 'mga', 'siya', 'mula', 'nang', 'hindi', 'ako', 'ito', 'pag', 'niya'],
    threshold: 4,
    script: 'latin',
  },
  {
    label: 'Catalan',
    // Unique: "cap", "aquest"/"aquell". "però"/"mentre" kept (Italian has "però" but rare).
    topWords: ['també', 'després', 'cap', 'aquest', 'aquell', 'molts', 'però', 'mentre', 'són', 'més'],
    threshold: 4,
    script: 'latin',
  },
  {
    label: 'Galician',
    // Unique: "sen"/"máis"/"hai" vs Portuguese.
    topWords: ['sen', 'máis', 'hai', 'ten', 'seu', 'súa', 'galego', 'logo', 'sendo', 'poden'],
    threshold: 4,
    script: 'latin',
  },
  {
    label: 'Welsh',
    // Unique: "ll"/"dd"/"ff", "w"/"y" as vowels.
    topWords: ['bod', 'ond', 'mae', 'oedd', 'gyda', 'hyn', 'yna', 'wedi', 'nid', 'dyw'],
    threshold: 4,
    script: 'latin',
  },
  {
    label: 'Icelandic',
    // Unique: "þ"/"ð".
    topWords: ['sem', 'til', 'var', 'með', 'það', 'þar', 'hafi', 'hefur', 'hans', 'ekki'],
    threshold: 4,
    script: 'latin',
  },
  {
    label: 'Afrikaans',
    // Unique: "hulle"/"baie"/"vir" vs Dutch.
    topWords: ['het', 'dat', 'vir', 'was', 'ook', 'nog', 'sal', 'hulle', 'daar', 'baie'],
    threshold: 4,
    script: 'latin',
  },
  {
    label: 'Swahili',
    // Unique: Bantu prefixes.
    topWords: ['kwa', 'kutoka', 'kama', 'pia', 'mtu', 'mahali', 'baada', 'moja', 'watu', 'sana'],
    threshold: 4,
    script: 'latin',
  },
  {
    label: 'Slovenian',
    // Unique: "ker"/"brez"/"tudi"/"vendar"/"ali" vs Croatian.
    topWords: ['kako', 'samo', 'ali', 'ker', 'pri', 'bil', 'brez', 'tudi', 'vendar', 'zato'],
    threshold: 4,
    script: 'latin',
  },
  {
    label: 'Albanian',
    // Unique: "ë"/"nj".
    topWords: ['një', 'dhe', 'për', 'është', 'nga', 'nuk', 'por', 'jam', 'njeri', 'kjo'],
    threshold: 4,
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

// ADR-029: ISO_LANGUAGE_MAP, LABEL_TO_ISO_CODE, ISO_639_2_TO_639_1 and the
// conversion functions (isoCodeToLabel, isValidIsoCode, toIso6391,
// labelToIsoCode, languageMatches) now live in @/shared/config/languageRegistry
// and are re-exported at the top of this file. The duplicate definitions that
// used to live here have been removed — the registry is the single source.

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

  return detectLanguageFromText(plainText);
}

/**
 * Detect language from already-extracted plain text (no format parsing).
 *
 * Use this when the caller already has clean cue text (e.g. `parseAndDetectFiles`
 * has `cues[].text` from the parser — `stripSubtitleTags` already ran, so
 * `extractPlainText` would be double work). Callers with raw subtitle content
 * (e.g. background `resolveUnknownSubtitleLanguages` with fetched bytes) should
 * use `detectLanguage` instead.
 */
export function detectLanguageFromText(plainText: string): string | null {
  if (!plainText || plainText.trim().length === 0) return null;

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
 *
 * Scoring mode (replaces first-match-wins): counts matches for every profile,
 * then picks the profile with the highest match count that meets its
 * threshold. Ties break by profile order (earlier wins). This is more
 * accurate than first-match-wins when profiles have overlapping words —
 * unique signature words make scoring viable because cross-matches are rare.
 *
 * Returns the winning profile label (lowercase), or null if no profile
 * meets its threshold.
 */
function matchByFrequency(
  plainText: string,
  profiles: readonly LanguageProfile[],
): string | null {
  const lowerText = plainText.toLowerCase();

  let bestLabel: string | null = null;
  let bestCount = 0;

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

    // Scoring: must meet threshold, then pick highest match count.
    // Tie-break: earlier profile wins (preserves priority order for CJK).
    if (matchCount >= profile.threshold && matchCount > bestCount) {
      bestCount = matchCount;
      bestLabel = profile.label.toLowerCase();
    }
  }

  return bestLabel;
}
