// Dictionary entity types (ADR-023 D1, spec F7).
//
// 3 object stores: langResourceInfo, langFrequencyEntry, langDictionaryEntry.
// Module boundary: entities/types only — no logic, no storage deps.

/** Import format — 5 supported formats (spec F8). */
export type ImportFormat =
  | 'txt'
  | 'json-array'
  | 'yomitan'
  | 'sqlite'
  | 'cambridge-json';

/** Resource type — frequency list vs dictionary (spec F7). */
export type ResourceType = 'FREQUENCY' | 'DICTIONARY';

/** Resource info — 1 row per imported file (langResourceInfo store). */
export interface ResourceInfo {
  readonly id?: number;
  readonly name: string;
  readonly langCode: string;
  readonly type: ResourceType;
  readonly format: ImportFormat;
  /** SHA-256(first1MB)_size_name — dedupe key (ADR-023 D7). */
  readonly signature: string;
  readonly wordCount: number;
  readonly installationFinished: boolean;
  readonly importedAt: number;
  readonly enabled?: boolean; // absent means enabled
  readonly priority?: number; // lower wins; absent falls back to resourceId-descending default
  readonly profileIds?: readonly string[]; // absent means belongs to all language profiles
  readonly metadata?: Record<string, unknown>;
}

/** Frequency entry — 1 row per word (langFrequencyEntry store). */
export interface FrequencyEntry {
  readonly id?: number;
  readonly resourceId: number;
  readonly term: string;
  readonly reading: string;
  readonly frequency: number;
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
