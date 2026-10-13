/**
 * Sentence and clause punctuation across the scripts Tihoka tokenizes.
 *
 * Sentence terminators are not "dot, bang, question" everywhere:
 * - Latin / Greek / Cyrillic / Hebrew (modern) use `. ! ?`
 * - CJK uses the ideographic full stop `。`, fullwidth `！？`, halfwidth `｡`,
 *   and the ellipsis `…` (also used as a terminator in English prose)
 * - Arabic and Urdu use `؟` and the Urdu full stop `۔`
 * - Devanagari and other Indic scripts use the danda `।` and double danda `॥`
 * - Tibetan, Ethiopic, Myanmar, Khmer, Armenian and Mongolian each carry
 *   their own terminator (see the class below)
 * Thai and Lao are deliberately absent: they separate sentences with spaces,
 * so no character marks the boundary and a space-based guess would split
 * mid-sentence. Splitting there is left to the reader.
 */
export const SENTENCE_END_PUNCT_RE =
  /[.!?。．｡！？…‥؟۔।॥།༎༏༐༑༔።፧፨။។៕։՜՞‽⁇⁈⁉᠃᠉]/;

/** Clause separators — a softer boundary (comma, semicolon, colon, dash). */
export const CLAUSE_PUNCT_RE = /[,;:，、；：،؛\-–—]/;

/** True when `text` contains a sentence terminator. */
export function hasSentenceEnd(text: string): boolean {
  return SENTENCE_END_PUNCT_RE.test(text);
}
