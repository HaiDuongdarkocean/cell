import type { WordStatus } from '@/entities/dictionary';
import type { AnnotationDisplayMode } from '@/entities/settings';
import type { TokenFrequencyBand } from '@/shared/lib/frequencyBand';

export type { TokenFrequencyBand };
export type TokenStatus = WordStatus;

export interface Token {
  /** Surface text as it appears in the page. */
  readonly text: string;
  /** Normalized term for status/frequency lookup. */
  readonly term: string;
  /** Start index in the block's text. */
  readonly start: number;
  /** End index in the block's text. */
  readonly end: number;
  /** True if this token is whitespace/punctuation and should not be clickable. */
  readonly isSeparator: boolean;
  /** Index of the sentence this token belongs to (0-based, increments at .!?). */
  readonly sentenceIndex: number;
  /** Status for known words; undefined until resolved. */
  status: TokenStatus | undefined;
  /** Frequency band for known words; undefined until resolved. */
  frequencyBand: TokenFrequencyBand | undefined;
  /** Pronunciation/reading annotation; undefined until resolved or absent. */
  reading: string | undefined;
  /** Native-language gloss; undefined until resolved or absent. */
  gloss?: string;
  /** True when the term has ≥1 flashcard (Ocean SRS note or stored Anki card
   *  link) — the status capsule appends the card color as a third layer. */
  hasCard?: boolean;
}

export interface TokenBlock {
  /** Stable id for cache key. */
  readonly id: string;
  /** Container element (paragraph/section/cue). */
  readonly element: Element;
  /** Source text node(s) that make up the block. */
  sourceNodes: Text[];
  /** Original text content before tokenization. */
  originalText: string;
  /** Prepared token metadata; undefined if not prepared yet. */
  tokens: Token[] | undefined;
  /** True if spans are currently mounted. */
  isBound: boolean;
  /** Timestamp of last access for LRU. */
  lastAccessedAt: number;
}

export interface TokenizeOptions {
  /** Resolve status for a term. */
  readonly getStatus: (term: string) => TokenStatus | Promise<TokenStatus>;
  /** Resolve frequency band for a term. */
  readonly getFrequencyBand: (term: string) => TokenFrequencyBand | Promise<TokenFrequencyBand>;
  /** Language code for lookups. */
  readonly langCode: string;
}

export interface TokenizeDisplayOptions {
  /** Show status underline/highlight. */
  readonly showStatus: boolean;
  /** Show frequency background/text color. */
  readonly showFrequency: boolean;
  /** Reading cap display mode above tokens (controlled surfaces only). */
  readonly readingDisplay: AnnotationDisplayMode;
  /** Native-language gloss display mode below tokens (subtitle overlay only). */
  readonly glossDisplay: AnnotationDisplayMode;
}

export interface TokenizeSettings {
  /** Schema version for migration. */
  readonly schemaVersion: number;
  /** Map origin → enabled state. */
  readonly origins: Readonly<Record<string, boolean>>;
  /** Map exact URL → enabled state (overrides origin). */
  readonly urls: Readonly<Record<string, boolean>>;
  /** Map origin → subtitle tokenize enabled state (site-wide default). */
  readonly subtitleOrigins: Readonly<Record<string, boolean>>;
  /** Map exact URL → subtitle tokenize enabled state (independent from web tokenize). */
  readonly subtitleUrls: Readonly<Record<string, boolean>>;
}

export interface TokenizeState extends TokenizeDisplayOptions {
  /** Whether tokenization is active on this page. */
  readonly enabled: boolean;
  /** Currently selected terms for batch status change. */
  readonly selectedTerms: ReadonlySet<string>;
  /** Term currently hovered for keyboard shortcut preview. */
  readonly hoveredTerm: string | undefined;
}

/** Tokenize runtime state surfaced to UI toggles (universal panel header).
 *  Mirrors the subset of {@link TokenizeState} that the header binds to. */
export interface TokenizePanelState {
  readonly enabled: boolean;
  readonly showStatus: boolean;
  readonly showFrequency: boolean;
  readonly subtitleEnabled: boolean;
}

export interface TokenizeController {
  readonly enable: () => void;
  readonly disable: () => void;
  readonly setShowStatus: (show: boolean) => void;
  readonly setShowFrequency: (show: boolean) => void;
  readonly setReadingDisplay?: (mode: AnnotationDisplayMode) => void;
  readonly setGlossDisplay?: (mode: AnnotationDisplayMode) => void;
  readonly destroy: () => void;
}

export interface CueWindow {
  /** Active cue index. */
  readonly activeIndex: number;
  /** Half-size of the time window (number of cues before/after active). */
  readonly windowSize: number;
}
