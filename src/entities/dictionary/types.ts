// Dictionary entity types (ADR-023 D1, spec F7).
//
// 3 object stores: langResourceInfo, langFrequencyEntry, langDictionaryEntry.
// Module boundary: entities/types only — no logic, no storage deps.

/** Import format — 7 supported formats (spec F8, pos-dictionary-variants).
 *  Structural ids only — never named after a source product. */
export type ImportFormat =
  | 'txt'
  | 'json-array'
  | 'term-bank'
  | 'sqlite'
  | 'json-entries'
  | 'json-frequency'
  | 'wordlist-json';

/** Resource type — frequency list vs dictionary (spec F7). */
export type ResourceType = 'FREQUENCY' | 'DICTIONARY';

/** A toggleable content component of a dictionary resource. Detected per
 *  resource at import (or by a lazy store scan) into `ResourceInfo.components`;
 *  `disabledComponents` drops the part at lookup-merge time so lower-priority
 *  dictionaries supply it instead (e.g. word forms/IPA from dictionary 2
 *  when dictionary 1's toggle is off). */
export type DictionaryComponent =
  | 'definitions'
  | 'examples'
  | 'translations'
  | 'synonyms'
  | 'pronunciation'
  | 'inflections'
  | 'etymology'
  | 'wordFamily'
  | 'wordNet'
  | 'derivedTerms'
  | 'related'
  | 'level'
  | 'frequencyStars';

/** Resource info — 1 row per imported file (langResourceInfo store). */
export interface ResourceInfo {
  readonly id?: number;
  readonly name: string;
  readonly langCode: string;
  readonly type: ResourceType;
  readonly format: ImportFormat;
  /** SHA-256(first1MB)_size_name — dedupe key (ADR-023 D7). */
  readonly signature: string;
  /** sha256 of the portable serialized content — cross-device identity and
   *  remote blob name (sync spec: `resource:<contentHash>`, `blobs/<hash>`).
   *  Populated lazily at first sync materialization; never falls back to
   *  `signature` (signature embeds the filename and stays local-only). */
  readonly contentHash?: string;
  readonly wordCount: number;
  readonly installationFinished: boolean;
  readonly importedAt: number;
  readonly enabled?: boolean; // absent means enabled
  readonly priority?: number; // lower wins; absent falls back to resourceId-descending default
  readonly profileIds?: readonly string[]; // absent means belongs to all language profiles
  /** Canonical components this resource contains — drives the per-resource
   *  component toggles in settings. */
  readonly components?: readonly DictionaryComponent[];
  /** Components the user turned off for this resource. */
  readonly disabledComponents?: readonly DictionaryComponent[];
  readonly metadata?: Record<string, unknown>;
}

/** Canonical genre buckets on a frequency row (pos-dictionary-variants).
 *  All keys optional — rows without a genre keep it absent, never 0. */
export interface FrequencyGenres {
  readonly spoken?: number;
  readonly fiction?: number;
  readonly magazine?: number;
  readonly newspaper?: number;
  readonly academic?: number;
}

/** Frequency entry — 1 row per word (or per (word,pos) for pos-aware
 *  lists — langFrequencyEntry store). Old rows lack pos/total/genres and
 *  behave as term-level fallbacks for every variant. */
export interface FrequencyEntry {
  readonly id?: number;
  readonly resourceId: number;
  readonly term: string;
  readonly reading: string;
  /** Rank — lower = more frequent (`rankToBand` semantics). */
  readonly frequency: number;
  /** Canonical pos (posNormalize output); absent = term-level row. */
  readonly pos?: string;
  /** Raw occurrence count when the source provides it. */
  readonly total?: number;
  readonly genres?: FrequencyGenres;
}

/** One content line inside a sense. `text` is always rendered;
 *  `translation` (native-side of a `target — native` pair) is the
 *  revealable part — the popup hides it until the user expands the line. */
export interface SenseLine {
  readonly role: 'gloss' | 'example' | 'note';
  readonly text: string;
  readonly translation?: string;
  /** Source attribution, e.g. "The Guardian, 2019". */
  readonly citation?: string;
  /** Grammar pattern attached to the line, e.g. "[VERB noun]". */
  readonly pattern?: string;
}

/** One structured sense — optional pos label + ordered content lines.
 *  `labels` carries register/grammar/audience tags rendered as `[label]`
 *  (e.g. 'transitive', 'informal', 'move', 'kids', 'slang'). */
export interface SenseBlock {
  readonly pos?: string;
  readonly labels?: readonly string[];
  /** CEFR or provider level, e.g. 'B1' — rendered as plain `[B1]`. */
  readonly level?: string;
  readonly lines: readonly SenseLine[];
  readonly subsenses?: readonly { readonly num: string; readonly text: string }[];
  /** Per-sense relations — "Synonyms: a, b" / "Opposite: c". */
  readonly synonyms?: readonly string[];
  readonly antonyms?: readonly string[];
}

/** A kind-tagged link to another entry — phrasal verbs, idioms, collocations,
 *  phrases are all dictionary entries; `kind` is provider-declared, never
 *  inferred. Unknown kinds render under a generic pluralized label. */
export interface RelatedEntry {
  readonly term: string;
  readonly kind: string;
  /** Inline gloss so the related list reads without fetching the entry. */
  readonly preview?: string;
}

/** Word origin — `chain` is the primary lineage; `variants` holds the same
 *  field contributed by other providers, each independently selectable. */
export interface EtymologyBlock {
  readonly chain: string;
  readonly firstKnownUse?: string;
  readonly variants?: readonly { readonly text: string; readonly source?: string }[];
}

export interface InflectionGroup {
  readonly type: string;
  readonly forms: readonly string[];
}

export interface WordFamily {
  readonly nouns?: readonly string[];
  readonly verbs?: readonly string[];
  readonly adjectives?: readonly string[];
  readonly adverbs?: readonly string[];
}

export interface WordNetInfo {
  readonly synset?: readonly string[];
  readonly hypernyms?: readonly string[];
}

/** One accent-scoped pronunciation of an entry (pos-dictionary-variants).
 *  `accent` is a short provider label — 'AmE' | 'BrE' | free text;
 *  `audioRef` keeps `sound://…` refs verbatim until the audio store
 *  resolves them (mdd extraction phase). */
export interface PronunciationAccent {
  readonly accent: string;
  readonly ipa: string;
  readonly audioRef?: string;
}

/** Dictionary entry — 1 row per term with rich fields (langDictionaryEntry store). */
export interface DictionaryEntry {
  readonly id?: number;
  readonly resourceId: number;
  readonly term: string;
  readonly reading: string;
  readonly altterm: string;
  readonly pronunciation: string;
  readonly definition: string;
  readonly pos: string;
  readonly examples: string;
  readonly audio: string;
  /** Structured senses (SSOT for rendering). `definition` is the derived
   *  canonical serialization of the same data; absent on rows imported
   *  before this field existed — consumers fall back to `definition`. */
  readonly senses?: readonly SenseBlock[];
  /** Kind-tagged links to other entries (phrasal verbs, idioms,
   *  collocations, phrases, derivatives). */
  readonly related?: readonly RelatedEntry[];
  readonly inflections?: readonly InflectionGroup[];
  /** Entry-level CEFR/provider level. */
  readonly level?: string;
  readonly frequencyStars?: number;
  /** Accent-scoped pronunciations — one per homograph/accent the source
   *  declares. `pronunciation` stays the legacy first-IPA string. */
  readonly prons?: readonly PronunciationAccent[];
  readonly etymology?: EtymologyBlock;
  readonly wordFamily?: WordFamily;
  readonly wordNet?: WordNetInfo;
  readonly derivedTerms?: readonly string[];
  readonly anagrams?: readonly string[];
}

/** Result of an import operation. */
export interface ImportResult {
  readonly resourceId: number;
  readonly wordCount: number;
  readonly format: ImportFormat;
  /** True when the file was skipped because a resource with the same signature already exists. */
  readonly skippedAsDuplicate?: boolean;
  /** The existing resource when skippedAsDuplicate is true. */
  readonly existingResource?: ResourceInfo;
}

/** Progress callback for import streaming. */
export type ImportProgressCallback = (processed: number, estimatedTotal: number) => void;

/** Duplicate resolution decision. */
export type DuplicateDecision = 'skip' | 'replace';

/** Options for import orchestrator. */
export interface ImportOptions {
  readonly langCode: string;
  readonly onProgress?: ImportProgressCallback;
  readonly onResourceCreated?: (resourceId: number) => void;
  /** Called when a resource with the same signature already exists. Defaults to 'skip'. */
  readonly onDuplicate?: (existing: ResourceInfo) => DuplicateDecision | Promise<DuplicateDecision>;
}

export interface LookupRequest {
  readonly term: string;
  readonly langCode: string;
  readonly contextSentence: string;
  /** UTF-16 character offset of hovered token; worker derives token index. */
  readonly cursorOffset: number;
  /** true khi user bôi đen text: bỏ qua plugin phraseMatch, dùng term verbatim + lemma only. */
  readonly fallback?: boolean;
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
