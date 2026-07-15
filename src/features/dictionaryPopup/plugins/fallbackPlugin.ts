// fallbackPlugin — spec §4.6.3: minimal plugin for languages without a
// dedicated implementation. Tokenizes by whitespace + punctuation only,
// no lemma, no possessive, no phrase match. The orchestrator falls back
// to single-word dictionary lookup.

import type { LanguagePlugin, Token, Accent } from './languagePlugin';

/** Fallback accents — empty (no audio priority for unknown languages). */
const FALLBACK_ACCENTS: readonly Accent[] = [];

const WORD_CHAR = /[\p{L}\p{N}'-]/u;

/**
 * Minimal fallback plugin. Tokenizes by whitespace + punctuation only.
 * No lemma, no possessive, no phrase match — the orchestrator uses the
 * hovered token verbatim for dictionary lookup.
 */
export function createFallbackPlugin(langCode: string): LanguagePlugin {
  return {
    langCode,
    readingKind: 'none',
    accents: FALLBACK_ACCENTS,
    tokenize(sentence: string): readonly Token[] {
      return fallbackTokenize(sentence);
    },
  };
}

/** Whitespace + punctuation tokenizer for unknown languages. */
export function fallbackTokenize(sentence: string): readonly Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < sentence.length) {
    // Skip whitespace + punctuation.
    while (i < sentence.length && !WORD_CHAR.test(sentence[i]!)) i++;
    if (i >= sentence.length) break;
    const start = i;
    while (i < sentence.length && WORD_CHAR.test(sentence[i]!)) i++;
    const text = sentence.slice(start, i).toLowerCase();
    tokens.push({ text, start, end: i });
  }
  return tokens;
}
