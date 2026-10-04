// baseImportStrategy — template method pattern (ADR-023 D3, spec F9).
//
// Subclass KHÔNG override execute(). Override 3 hooks:
// - getRepository(): BaseRepository (which store to write)
// - transformEntry(raw, index): StoredEntry | null (raw → normalized entry)
// - parse(): AsyncGenerator<RawEntry> (streaming, 1 entry at a time)
//
// execute() template: for await (raw of parse()) → transformEntry → batch.add → flush at 5000.

import { BatchProcessor } from '../logic/batchProcessor';
import { normalizeWord } from '../logic/normalizationPipeline';
import { toCanonicalDefinition } from '../logic/normalize/canonical';
import { collectEntryComponents, sortedComponents } from '../logic/dictionaryComponents';
import { normalizePos } from '@/shared/lib/posNormalize';
import type { ImportFormat, FrequencyEntry, DictionaryEntry, DictionaryComponent, SenseBlock, RelatedEntry, InflectionGroup, EtymologyBlock, WordFamily, WordNetInfo, FrequencyGenres, PronunciationAccent } from '@/entities/dictionary';

/** Raw entry from parser (before normalization). */
export interface RawFrequencyEntry {
  readonly term: string;
  readonly reading?: string;
  readonly frequency: number;
  /** Raw pos label — normalized to canonical form on transform
   *  (pos-dictionary-variants). Absent = term-level row. */
  readonly pos?: string;
  readonly total?: number;
  readonly genres?: FrequencyGenres;
}

/** Raw dictionary entry from parser. */
export interface RawDictionaryEntry {
  readonly term: string;
  readonly reading?: string;
  readonly altterm?: string;
  readonly pronunciation?: string;
  readonly definition?: string;
  /** List-shaped sources: definitions as raw elements (strings, redirects,
   *  structured objects). Fed to the listDefinitions normalize rule. */
  readonly definitions?: readonly unknown[];
  /** Pre-normalized sources: structured senses ready to store verbatim.
   *  Fed to the preNormalized normalize rule (first in the chain). */
  readonly senses?: readonly SenseBlock[];
  readonly pos?: string;
  readonly examples?: string;
  readonly audio?: string;
  /** Canonical entry-level fields — pass through verbatim on import
   *  (converter output already carries the normalized shape). */
  readonly related?: readonly RelatedEntry[];
  readonly inflections?: readonly InflectionGroup[];
  readonly level?: string;
  readonly frequencyStars?: number;
  /** Accent-scoped pronunciations (pos-dictionary-variants) — one row per
   *  homograph carries that homograph's own prons. */
  readonly prons?: readonly PronunciationAccent[];
  readonly etymology?: EtymologyBlock;
  readonly wordFamily?: WordFamily;
  readonly wordNet?: WordNetInfo;
  readonly derivedTerms?: readonly string[];
  readonly anagrams?: readonly string[];
}

/** Result of a strategy run. */
export interface StrategyResult {
  readonly wordCount: number;
  readonly format: string;
  /** Canonical components detected across stored entries (dictionaries only). */
  readonly components?: readonly DictionaryComponent[];
}

/** Options passed to strategy. */
export interface StrategyOptions {
  readonly resourceId: number;
  readonly langCode: string;
  /** Progress: processed entries so far + exact attempted-entry total (0 = unknown). */
  readonly onProgress?: (processed: number, total: number) => void;
  readonly signal?: AbortSignal;
  /** Component subset the user picked on a multi-component file
   *  ('definitions' = dictionary content). Absent = emit everything found. */
  readonly components?: readonly DictionaryComponent[];
}

/** Abstract base — template method execute(). */
export abstract class BaseImportStrategy<TRaw, TStored> {
  protected readonly options: StrategyOptions;
  protected readonly batchProcessor: BatchProcessor<TStored>;
  protected readonly componentSet = new Set<DictionaryComponent>();

  constructor(options: StrategyOptions) {
    this.options = options;
    this.batchProcessor = new BatchProcessor<TStored>(
      (batch) => this.flushBatch(batch),
      options.onProgress,
    );
  }

  /** Template method — subclass KHÔNG override. */
  async execute(): Promise<StrategyResult> {
    let count = 0;
    try {
      for await (const raw of this.parse()) {
        if (this.options.signal?.aborted) {
          throw new Error('CANCELLED');
        }
        const stored = this.transformEntry(raw, count);
        if (stored !== null) {
          this.collectComponents(stored);
          await this.batchProcessor.add(stored);
          count++;
        }
      }
      await this.batchProcessor.flush();
    } catch (e) {
      // Flush any remaining before rethrowing (for partial count reporting)
      try {
        await this.batchProcessor.flush();
      } catch {
        // ignore flush error during error path
      }
      throw e;
    }
    return { wordCount: count, format: this.format, components: this.components() };
  }

  /** Hook 4 (optional): fold a stored entry into component detection. */
  protected collectComponents(_stored: TStored): void {}

  /** Components detected during execute(). */
  components(): readonly DictionaryComponent[] {
    return sortedComponents(this.componentSet);
  }

  /** True when the user's component subset includes this component
   *  (or no subset was given — emit everything found). */
  protected wants(component: DictionaryComponent): boolean {
    const sel = this.options.components;
    return sel === undefined || sel.includes(component);
  }

  /** Hook 1: streaming parser — yield raw entries 1 at a time. */
  protected abstract parse(): AsyncGenerator<TRaw>;

  /** Hook 2: transform raw → stored (normalize, filter). Return null to skip. */
  protected abstract transformEntry(raw: TRaw, index: number): TStored | null;

  /** Hook 3: flush batch to repository. */
  protected abstract flushBatch(batch: ReadonlyArray<TStored>): Promise<void>;

  /** Report the exact attempted-entry total once known (before first insert). */
  protected reportTotal(total: number): void {
    this.batchProcessor.setTotal(total);
    this.options.onProgress?.(0, total);
  }

  /** Helper: check if word is valid (non-empty after normalization). */
  protected isValidWord(word: string): boolean {
    return normalizeWord(word).length > 0;
  }

  /** Format this strategy handles. */
  abstract readonly format: ImportFormat;
}

/** Base for frequency strategies (writes freq-kind rows to the unified store). */
export abstract class BaseFrequencyStrategy extends BaseImportStrategy<RawFrequencyEntry, Omit<FrequencyEntry, 'id'>> {
  readonly format: ImportFormat = 'txt';

  protected collectComponents(_stored: Omit<FrequencyEntry, 'id'>): void {
    this.componentSet.add('frequency');
  }

  protected transformEntry(raw: RawFrequencyEntry, _index: number): Omit<FrequencyEntry, 'id'> | null {
    const term = normalizeWord(raw.term);
    if (term.length === 0) return null;
    const reading = raw.reading ? raw.reading.trim().normalize('NFC') : term;
    const pos = raw.pos ? normalizePos(raw.pos) : undefined;
    return {
      resourceId: this.options.resourceId,
      term,
      reading,
      frequency: Math.max(0, Math.floor(raw.frequency)),
      ...(pos ? { pos } : {}),
      ...(raw.total != null && Number.isFinite(raw.total) ? { total: Math.floor(raw.total) } : {}),
      ...(raw.genres ? { genres: raw.genres } : {}),
    };
  }
}

/** Base for dictionary strategies (writes dict rows to the unified store). */
export abstract class BaseDictionaryStrategy extends BaseImportStrategy<RawDictionaryEntry, Omit<DictionaryEntry, 'id'>> {
  readonly format: ImportFormat = 'json-entries';

  protected collectComponents(stored: Omit<DictionaryEntry, 'id'>): void {
    collectEntryComponents(this.componentSet, stored);
  }

  protected transformEntry(raw: RawDictionaryEntry, _index: number): Omit<DictionaryEntry, 'id'> | null {
    const term = normalizeWord(raw.term);
    if (term.length === 0) return null;
    const canonical = toCanonicalDefinition(raw);
    return {
      resourceId: this.options.resourceId,
      term,
      reading: raw.reading ? normalizeWord(raw.reading) : term,
      altterm: raw.altterm ? normalizeWord(raw.altterm) : '',
      pronunciation: raw.pronunciation?.trim().normalize('NFC') ?? '',
      definition: canonical.definition,
      senses: canonical.senses,
      pos: canonical.pos,
      examples: canonical.examples,
      audio: raw.audio?.trim() ?? '',
      related: raw.related,
      inflections: raw.inflections,
      level: raw.level,
      frequencyStars: raw.frequencyStars,
      prons: raw.prons,
      etymology: raw.etymology,
      wordFamily: raw.wordFamily,
      wordNet: raw.wordNet,
      derivedTerms: raw.derivedTerms,
      anagrams: raw.anagrams,
    };
  }
}
