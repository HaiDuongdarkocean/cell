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
import type { ImportFormat, FrequencyEntry, DictionaryEntry } from '@/entities/dictionary';

/** Raw entry from parser (before normalization). */
export interface RawFrequencyEntry {
  readonly term: string;
  readonly reading?: string;
  readonly frequency: number;
}

/** Raw dictionary entry from parser. */
export interface RawDictionaryEntry {
  readonly term: string;
  readonly reading?: string;
  readonly altterm?: string;
  readonly pronunciation?: string;
  readonly definition?: string;
  readonly pos?: string;
  readonly examples?: string;
  readonly audio?: string;
}

/** Result of a strategy run. */
export interface StrategyResult {
  readonly wordCount: number;
  readonly format: string;
}

/** Options passed to strategy. */
export interface StrategyOptions {
  readonly resourceId: number;
  readonly langCode: string;
  readonly onProgress?: (processed: number) => void;
  readonly signal?: AbortSignal;
}

/** Abstract base — template method execute(). */
export abstract class BaseImportStrategy<TRaw, TStored> {
  protected readonly options: StrategyOptions;
  protected readonly batchProcessor: BatchProcessor<TStored>;

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
    return { wordCount: count, format: this.format };
  }

  /** Hook 1: streaming parser — yield raw entries 1 at a time. */
  protected abstract parse(): AsyncGenerator<TRaw>;

  /** Hook 2: transform raw → stored (normalize, filter). Return null to skip. */
  protected abstract transformEntry(raw: TRaw, index: number): TStored | null;

  /** Hook 3: flush batch to repository. */
  protected abstract flushBatch(batch: ReadonlyArray<TStored>): Promise<void>;

  /** Helper: check if word is valid (non-empty after normalization). */
  protected isValidWord(word: string): boolean {
    return normalizeWord(word).length > 0;
  }

  /** Format this strategy handles. */
  abstract readonly format: ImportFormat;
}

/** Base for frequency strategies (writes to frequencyRepository). */
export abstract class BaseFrequencyStrategy extends BaseImportStrategy<RawFrequencyEntry, Omit<FrequencyEntry, 'id'>> {
  readonly format: ImportFormat = 'txt';

  protected transformEntry(raw: RawFrequencyEntry, _index: number): Omit<FrequencyEntry, 'id'> | null {
    const term = normalizeWord(raw.term);
    if (term.length === 0) return null;
    const reading = raw.reading ? raw.reading.trim().normalize('NFC') : term;
    return {
      resourceId: this.options.resourceId,
      term,
      reading,
      frequency: Math.max(0, Math.floor(raw.frequency)),
    };
  }
}

/** Base for dictionary strategies (writes to dictionaryRepository). */
export abstract class BaseDictionaryStrategy extends BaseImportStrategy<RawDictionaryEntry, Omit<DictionaryEntry, 'id'>> {
  readonly format: ImportFormat = 'cambridge-json';

  protected transformEntry(raw: RawDictionaryEntry, _index: number): Omit<DictionaryEntry, 'id'> | null {
    const term = normalizeWord(raw.term);
    if (term.length === 0) return null;
    return {
      resourceId: this.options.resourceId,
      term,
      reading: raw.reading ? normalizeWord(raw.reading) : term,
      altterm: raw.altterm ? normalizeWord(raw.altterm) : '',
      pronunciation: raw.pronunciation?.trim().normalize('NFC') ?? '',
      definition: raw.definition?.trim().normalize('NFC').replace(/\s+/g, ' ') ?? '',
      pos: raw.pos?.trim().normalize('NFC') ?? '',
      examples: raw.examples?.trim().normalize('NFC') ?? '',
      audio: raw.audio?.trim() ?? '',
    };
  }
}
