/**
 * Unicode script detection for subtitle language identification.
 *
 * Detects the dominant writing system (script) in a text sample, then maps
 * each script to one or more candidate languages. Scripts that map to a
 * single language (e.g. Hangul → Korean) resolve immediately; scripts that
 * map to multiple languages (e.g. Latin → English/Spanish/French/...) are
 * disambiguated by frequency profiles in `languageDetector.ts`.
 *
 * Sources:
 * - Unicode Script Property: https://www.unicode.org/Public/UNIDATA/Scripts.txt
 *   (Unicode 17.0.0, 2025-07-24)
 * - UAX #24: https://www.unicode.org/reports/tr24/
 */

/** Identifier for a Unicode script relevant to subtitle detection. */
export type ScriptId =
  | 'latin'
  | 'cyrillic'
  | 'arabic'
  | 'devanagari'
  | 'hangul'
  | 'hiragana'
  | 'katakana'
  | 'han'
  | 'thai'
  | 'lao'
  | 'greek'
  | 'hebrew'
  | 'armenian'
  | 'georgian'
  | 'bengali'
  | 'tamil'
  | 'telugu'
  | 'gurmukhi'
  | 'gujarati'
  | 'kannada'
  | 'malayalam'
  | 'sinhala'
  | 'tibetan'
  | 'myanmar'
  | 'khmer'
  | 'ethiopic';

export interface ScriptRange {
  readonly id: ScriptId;
  /** Human-readable script name (e.g. "Latin", "Cyrillic"). */
  readonly label: string;
  /** Inclusive start code point. */
  readonly start: number;
  /** Inclusive end code point. */
  readonly end: number;
}

/**
 * Core Unicode script ranges for subtitle detection.
 *
 * Only letter-bearing ranges are included; combining marks, punctuation,
 * and digits are omitted because they do not help identify the script of
 * subtitle text. Ranges are ordered by detection priority: scripts that
 * are unambiguous (single language) are checked first when ranges overlap
 * (e.g. Hiragana/Katakana before Han, since kana uniquely identifies
 * Japanese while Han is shared with Chinese).
 *
 * Source: https://www.unicode.org/Public/UNIDATA/Scripts.txt (Unicode 17.0.0)
 */
export const SCRIPT_RANGES: readonly ScriptRange[] = [
  // === Single-script-per-language (checked first for uniqueness) ===
  // Hangul — uniquely Korean
  { id: 'hangul', label: 'Hangul', start: 0xac00, end: 0xd7af },
  { id: 'hangul', label: 'Hangul Jamo', start: 0x1100, end: 0x11ff },
  { id: 'hangul', label: 'Hangul Compatibility Jamo', start: 0x3130, end: 0x318f },

  // Hiragana — uniquely Japanese (kana)
  { id: 'hiragana', label: 'Hiragana', start: 0x3040, end: 0x309f },
  // Katakana — uniquely Japanese (kana)
  { id: 'katakana', label: 'Katakana', start: 0x30a0, end: 0x30ff },

  // Thai — uniquely Thai (Lao has its own block)
  { id: 'thai', label: 'Thai', start: 0x0e00, end: 0x0e7f },
  // Lao — uniquely Lao
  { id: 'lao', label: 'Lao', start: 0x0e80, end: 0x0eff },

  // Greek — uniquely Greek
  { id: 'greek', label: 'Greek and Coptic', start: 0x0370, end: 0x03ff },
  { id: 'greek', label: 'Greek Extended', start: 0x1f00, end: 0x1fff },

  // Hebrew — Hebrew (also Yiddish, but rare in subtitles)
  { id: 'hebrew', label: 'Hebrew', start: 0x0590, end: 0x05ff },

  // Armenian — uniquely Armenian
  { id: 'armenian', label: 'Armenian', start: 0x0530, end: 0x058f },

  // Georgian — uniquely Georgian
  { id: 'georgian', label: 'Georgian', start: 0x10a0, end: 0x10ff },

  // Bengali (Assamese shares this script)
  { id: 'bengali', label: 'Bengali', start: 0x0980, end: 0x09ff },
  // Tamil — uniquely Tamil
  { id: 'tamil', label: 'Tamil', start: 0x0b80, end: 0x0bff },
  // Telugu — uniquely Telugu
  { id: 'telugu', label: 'Telugu', start: 0x0c00, end: 0x0c7f },
  // Gurmukhi — Punjabi
  { id: 'gurmukhi', label: 'Gurmukhi', start: 0x0a00, end: 0x0a7f },
  // Gujarati — uniquely Gujarati
  { id: 'gujarati', label: 'Gujarati', start: 0x0a80, end: 0x0aff },
  // Kannada — uniquely Kannada
  { id: 'kannada', label: 'Kannada', start: 0x0c80, end: 0x0cff },
  // Malayalam — uniquely Malayalam
  { id: 'malayalam', label: 'Malayalam', start: 0x0d00, end: 0x0d7f },
  // Sinhala — uniquely Sinhala
  { id: 'sinhala', label: 'Sinhala', start: 0x0d80, end: 0x0dff },
  // Tibetan — uniquely Tibetan
  { id: 'tibetan', label: 'Tibetan', start: 0x0f00, end: 0x0fff },
  // Myanmar — uniquely Burmese
  { id: 'myanmar', label: 'Myanmar', start: 0x1000, end: 0x109f },
  // Khmer — uniquely Khmer
  { id: 'khmer', label: 'Khmer', start: 0x1780, end: 0x17ff },
  // Ethiopic — Amharic/Tigrinya
  { id: 'ethiopic', label: 'Ethiopic', start: 0x1200, end: 0x139f },

  // === Multi-language scripts (disambiguated by frequency) ===
  // Devanagari — Hindi/Marathi/Nepali/Sanskrit/Bihari/Konkani
  { id: 'devanagari', label: 'Devanagari', start: 0x0900, end: 0x097f },
  { id: 'devanagari', label: 'Devanagari Extended', start: 0xa8e0, end: 0xa8ff },

  // Arabic — Arabic/Persian/Urdu/Pashto/Sindhi/Kurdish
  { id: 'arabic', label: 'Arabic', start: 0x0600, end: 0x06ff },
  { id: 'arabic', label: 'Arabic Supplement', start: 0x0750, end: 0x077f },
  { id: 'arabic', label: 'Arabic Extended-A', start: 0x08a0, end: 0x08ff },
  { id: 'arabic', label: 'Arabic Presentation Forms-A', start: 0xfb50, end: 0xfdff },
  { id: 'arabic', label: 'Arabic Presentation Forms-B', start: 0xfe70, end: 0xfeff },

  // Cyrillic — Russian/Ukrainian/Belarusian/Bulgarian/Serbian/Macedonian/Mongolian/Kyrgyz/Tajik/Kazakh/Uzbek
  { id: 'cyrillic', label: 'Cyrillic', start: 0x0400, end: 0x052f },
  { id: 'cyrillic', label: 'Cyrillic Supplement', start: 0x2de0, end: 0x2dff },
  { id: 'cyrillic', label: 'Cyrillic Extended-A', start: 0xa640, end: 0xa69f },
  { id: 'cyrillic', label: 'Cyrillic Extended-C', start: 0x1c80, end: 0x1c8f },

  // Han (CJK Unified Ideographs) — Chinese/Japanese kanji
  // Checked AFTER hiragana/katakana so kana-heavy Japanese text resolves to
  // kana first; only pure-ideograph text resolves to Han (→ Chinese default).
  { id: 'han', label: 'CJK Unified Ideographs', start: 0x4e00, end: 0x9fff },
  { id: 'han', label: 'CJK Unified Ideographs Extension A', start: 0x3400, end: 0x4dbf },
  { id: 'han', label: 'CJK Compatibility Ideographs', start: 0xf900, end: 0xfaff },

  // Latin — checked LAST because it is the fallback for most European languages.
  // Includes Latin-1 Supplement, Latin Extended-A/B, Latin Extended Additional
  // (Vietnamese diacritics), and fullwidth Latin.
  { id: 'latin', label: 'Basic Latin', start: 0x0041, end: 0x007a },
  { id: 'latin', label: 'Latin-1 Supplement', start: 0x00c0, end: 0x00ff },
  { id: 'latin', label: 'Latin Extended-A/B', start: 0x0100, end: 0x024f },
  { id: 'latin', label: 'Latin Extended Additional', start: 0x1e00, end: 0x1eff },
  { id: 'latin', label: 'Latin Extended-C', start: 0x2c60, end: 0x2c7f },
  { id: 'latin', label: 'Latin Extended-D', start: 0xa720, end: 0xa7ff },
  { id: 'latin', label: 'Latin Extended-E', start: 0xab30, end: 0xab64 },
  { id: 'latin', label: 'Fullwidth Latin', start: 0xff21, end: 0xff5a },
];

/**
 * Map of script id → candidate language labels (display names matching
 * `LANGUAGE_PROFILES` labels in languageDetector.ts).
 *
 * Scripts with a single candidate resolve immediately without frequency
 * analysis. Scripts with multiple candidates require frequency-based
 * disambiguation.
 */
const SCRIPT_LANGUAGE_MAP: ReadonlyMap<ScriptId, readonly string[]> = new Map<
  ScriptId,
  readonly string[]
>([
  // Single-candidate scripts → resolve directly
  ['hangul', ['Korean']],
  ['hiragana', ['Japanese']],
  ['katakana', ['Japanese']],
  ['thai', ['Thai']],
  ['lao', ['Lao']],
  ['greek', ['Greek']],
  ['hebrew', ['Hebrew']],
  ['armenian', ['Armenian']],
  ['georgian', ['Georgian']],
  ['bengali', ['Bengali']],
  ['tamil', ['Tamil']],
  ['telugu', ['Telugu']],
  ['gurmukhi', ['Punjabi']],
  ['gujarati', ['Gujarati']],
  ['kannada', ['Kannada']],
  ['malayalam', ['Malayalam']],
  ['sinhala', ['Sinhala']],
  ['tibetan', ['Tibetan']],
  ['myanmar', ['Burmese']],
  ['khmer', ['Khmer']],
  ['ethiopic', ['Amharic']],

  // Multi-candidate scripts → need frequency disambiguation
  ['han', ['Chinese', 'Japanese']],
  ['devanagari', ['Hindi', 'Marathi', 'Nepali', 'Sanskrit']],
  [
    'arabic',
    ['Arabic', 'Persian', 'Urdu', 'Pashto', 'Sindhi', 'Kurdish'],
  ],
  [
    'cyrillic',
    [
      'Russian',
      'Ukrainian',
      'Belarusian',
      'Bulgarian',
      'Serbian',
      'Macedonian',
      'Mongolian',
      'Kyrgyz',
      'Tajik',
      'Kazakh',
      'Uzbek',
    ],
  ],
  [
    'latin',
    [
      'English',
      'Spanish',
      'French',
      'German',
      'Portuguese',
      'Italian',
      'Dutch',
      'Swedish',
      'Norwegian',
      'Danish',
      'Finnish',
      'Polish',
      'Czech',
      'Slovak',
      'Hungarian',
      'Romanian',
      'Croatian',
      'Albanian',
      'Estonian',
      'Latvian',
      'Lithuanian',
      'Turkish',
      'Indonesian',
      'Malay',
      'Tagalog',
      'Catalan',
      'Galician',
      'Basque',
      'Welsh',
      'Irish',
      'Icelandic',
      'Afrikaans',
      'Swahili',
      'Hausa',
      'Yoruba',
      'Igbo',
      'Zulu',
      'Xhosa',
      'Somali',
      'Kinyarwanda',
      'Lingala',
      'Slovenian',
      'Vietnamese',
    ],
  ],
]);

/**
 * Returns the candidate language labels for a given script id.
 *
 * @param scriptId - Script identifier from `detectScript`
 * @returns Array of candidate language labels (may be empty for unknown scripts)
 */
export function scriptToCandidateLanguages(scriptId: ScriptId): readonly string[] {
  return SCRIPT_LANGUAGE_MAP.get(scriptId) ?? [];
}

/**
 * Detect the dominant Unicode script in a text sample.
 *
 * Counts characters belonging to each script range and returns the script
 * with the most characters. Returns `null` if the text contains no
 * script-bearing characters (empty, whitespace, digits, or punctuation only).
 *
 * Detection priority: when two scripts have equal counts, the one listed
 * earlier in `SCRIPT_RANGES` wins. This ensures kana (Hiragana/Katakana)
 * wins over Han for mixed Japanese text, and Han wins only when ideographs
 * truly dominate.
 *
 * @param text - Plain text (preferably extracted via `extractPlainText`)
 * @returns Dominant script id, or `null` if no script detected
 */
export function detectScript(text: string): ScriptId | null {
  if (!text || text.trim().length === 0) return null;

  const counts = new Map<ScriptId, number>();

  for (const ch of text) {
    const code = ch.codePointAt(0);
    if (code === undefined) continue;
    // Skip ASCII control chars, digits, punctuation, whitespace (0x00-0x40,
    // 0x5B-0x60, 0x7B-0x7F) — they belong to "Common" script and don't help.
    if (code < 0x41 || (code > 0x5a && code < 0x61) || (code > 0x7a && code < 0xc0)) {
      continue;
    }
    for (const range of SCRIPT_RANGES) {
      if (code >= range.start && code <= range.end) {
        counts.set(range.id, (counts.get(range.id) ?? 0) + 1);
        break; // a char belongs to at most one range in our list
      }
    }
  }

  if (counts.size === 0) return null;

  let bestId: ScriptId | null = null;
  let bestCount = 0;
  for (const range of SCRIPT_RANGES) {
    const count = counts.get(range.id);
    if (count !== undefined && count > bestCount) {
      bestCount = count;
      bestId = range.id;
    }
  }

  return bestId;
}
