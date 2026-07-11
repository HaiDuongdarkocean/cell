/**
 * Field mapping — auto-map Cell source fields to Anki note type fields.
 *
 * On note type change, the Card Creator UI calls `autoMapFields` with the
 * note type's field names. The algorithm matches each source field to the
 * best Anki field by:
 *   1. Exact case-insensitive match against the canonical preferred names.
 *   2. Fuzzy match (Levenshtein distance ≤ 2, or substring contains).
 *   3. "" (unmapped) — user must map manually.
 *
 * Each Anki field is used at most once (first-come-first-served within a
 * priority tier) to avoid two source fields mapping to the same Anki field.
 */

/** Source field keys (Cell side). Tags are NOT a mapped field — they're sent
 *  via the note's `tags` array, not mapped to an Anki note field. */
export type SourceFieldKey =
  | 'targetWord'
  | 'sentence'
  | 'sentenceTranslation'
  | 'definitions'
  | 'images'
  | 'sentenceAudios'
  | 'wordAudios'
  | 'note'
  | 'moreExample';

/** Mapping from source key → Anki field name (or "" if unmapped). */
export type FieldMapping = Partial<Record<SourceFieldKey, string>>;

/** Canonical preferred Anki field names per source key, in priority order. */
const CANONICAL_NAMES: Record<SourceFieldKey, readonly string[]> = {
  targetWord: ['TargetWord', 'Word', 'Front', 'Vocab', 'Vocabulary'],
  sentence: ['Sentence', 'Context', 'Example', 'SentenceText'],
  sentenceTranslation: ['SentenceTranslation', 'Translation', 'Native', 'Meaning'],
  definitions: ['Definitions', 'Definition', 'Glossary', 'Gloss'],
  images: ['Image', 'Picture', 'Screenshot', 'Photo'],
  sentenceAudios: ['SentenceAudio', 'Audio', 'Sound'],
  wordAudios: ['WordAudio', 'Pronunciation', 'WordSound'],
  note: ['Note', 'Notes', 'Extra', 'ExtraNote'],
  moreExample: ['MoreExample', 'Examples', 'ExtraExamples', 'ExtraExample'],
};

/** Source keys in the order they appear in the Card Creator UI. */
export const SOURCE_FIELD_ORDER: readonly SourceFieldKey[] = [
  'targetWord',
  'sentence',
  'sentenceTranslation',
  'definitions',
  'images',
  'sentenceAudios',
  'wordAudios',
  'note',
  'moreExample',
];

/** Human-readable labels for source fields (matches mockup field-label text). */
export const SOURCE_FIELD_LABELS: Record<SourceFieldKey, string> = {
  targetWord: 'Target word',
  sentence: 'Sentence',
  sentenceTranslation: 'Sentence translation',
  definitions: 'Definitions',
  images: 'Image',
  sentenceAudios: 'Sentence audio',
  wordAudios: 'Word audio',
  note: 'Note',
  moreExample: 'More example',
};

/** Levenshtein edit distance between two strings (case-insensitive). */
export function levenshtein(a: string, b: string): number {
  const la = a.toLowerCase();
  const lb = b.toLowerCase();
  const m = la.length;
  const n = lb.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = la[i - 1] === lb[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

/** True if `candidate` contains `needle` (case-insensitive) or vice versa. */
function substringMatch(needle: string, candidate: string): boolean {
  const n = needle.toLowerCase();
  const c = candidate.toLowerCase();
  return c.includes(n) || n.includes(c);
}

/**
 * Auto-map source fields to Anki note type fields.
 *
 * @param ankiFieldNames  field names of the currently selected note type
 * @returns mapping from source key → Anki field name (or "" if unmapped)
 */
export function autoMapFields(ankiFieldNames: readonly string[]): FieldMapping {
  const used = new Set<string>();
  const mapping: FieldMapping = {};

  for (const sourceKey of SOURCE_FIELD_ORDER) {
    const canonicals = CANONICAL_NAMES[sourceKey];
    let matched = '';

    // Tier 1: exact case-insensitive match against canonical names.
    for (const canonical of canonicals) {
      const hit = ankiFieldNames.find(
        (f) => !used.has(f) && f.toLowerCase() === canonical.toLowerCase(),
      );
      if (hit) {
        matched = hit;
        break;
      }
    }

    // Tier 2: fuzzy match (Levenshtein ≤ 2) or substring match against any
    // unused Anki field, preferring canonical names.
    if (!matched) {
      for (const canonical of canonicals) {
        const hit = ankiFieldNames.find((f) => {
          if (used.has(f)) return false;
          return levenshtein(canonical, f) <= 2 || substringMatch(canonical, f);
        });
        if (hit) {
          matched = hit;
          break;
        }
      }
    }

    if (matched) {
      used.add(matched);
      mapping[sourceKey] = matched;
    } else {
      mapping[sourceKey] = '';
    }
  }

  return mapping;
}
