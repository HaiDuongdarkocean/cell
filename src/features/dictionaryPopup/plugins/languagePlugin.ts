// languagePlugin — spec §4.6.3/§9: plugin interface for language-specific
// tokenization, lemmatization, possessive normalization, phrase matching,
// and reading kind. Each language implements this interface; the lookup
// orchestrator dispatches to the plugin for the active subtitle language.
//
// The English plugin reuses phraseMatcher (ADR-037). The Chinese plugin
// (Task 2.2) adds dictionary-driven FMM segmentation + pinyin. A fallback
// "minimal" plugin handles languages without a dedicated implementation.

/** A token in a tokenized/segmented sentence. */
export interface Token {
  readonly text: string;
  readonly start: number;
  readonly end: number;
}

/** Request for phrase matching at a cursor position. */
export interface PhraseMatchRequest {
  readonly sentence: string;
  readonly cursorOffset: number;
}

/** Quality of a phrase match (ADR-037 §9). */
export type PhraseMatchQuality =
  | 'fixed'
  | 'inflected'
  | 'possessive-template'
  | 'slot-template';

/** A phrase match result. */
export interface PhraseMatch {
  readonly dictionaryTerm: string;
  readonly surface: string;
  readonly span: { readonly start: number; readonly end: number };
  readonly quality: PhraseMatchQuality;
  readonly sourceResourceId: number;
}

/** Accent/voice priority for audio playback. */
export interface Accent {
  readonly id: string;
  readonly label: string;
}

/** Dictionary probe for segmentation — checks if a term exists in the dict. */
export interface TermProbe {
  hasTerm(term: string): boolean;
}

/** Reading kind for the language. */
export type ReadingKind = 'ipa' | 'pinyin' | 'none';

/**
 * Language plugin interface (spec §4.6.3).
 *
 * Each language implements this. The orchestrator dispatches to the plugin
 * for the active subtitle language. Methods marked optional are only
 * implemented by languages that need them (e.g. segment for Chinese).
 */
export interface LanguagePlugin {
  readonly langCode: string;
  readonly readingKind: ReadingKind;
  /** Tokenize a sentence into tokens with UTF-16 offsets. */
  tokenize(sentence: string): readonly Token[];
  /** Segment spaceless text (Chinese) — dictionary-driven forward max matching. */
  segment?(text: string, dict: TermProbe): readonly Token[];
  /** Lemmatize a word (was → be, handed → hand). */
  lemma?(word: string): string;
  /** Multi-candidate lemmatization: returns all possible base forms (ADR-041). */
  lemmaCandidates?(word: string): string[];
  /** Normalize possessive pronouns to a placeholder. */
  normalizePossessive?(text: string): string;
  /** Match a phrase from the full sentence at the cursor position. */
  matchPhrase?(request: PhraseMatchRequest): PhraseMatch | null;
  /** Accent/voice priority for audio playback. */
  readonly accents: readonly Accent[];
}
