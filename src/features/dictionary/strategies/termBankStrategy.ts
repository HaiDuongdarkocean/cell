// termBankStrategy — term-bank ZIP format (ADR-023 D3, spec F9).
//
// Handles BOTH bank families in one pass (unified-resource-import):
// - term_bank_*.json → dictionary entries (term, reading, definition)
//   Format: [[expression, reading, definitionTags, rules, score, definitions[], ...], ...]
// - term_meta_bank_*.json → frequency entries (term, reading, frequency)
//   Format: [[term, type, {reading?, frequency?} | number], ...]
//
// A zip containing both families produces one resource with components
// {definitions, frequency}; the user's component subset can drop a family.

import { BaseImportStrategy, type RawFrequencyEntry, type RawDictionaryEntry, type StrategyOptions } from './baseImportStrategy';
import { unzipAll, isImportZipEntry, decodeText } from '../logic/fileDetector';
import { yieldToEventLoop } from '../logic/yieldToEventLoop';
import { toCanonicalDefinition } from '../logic/normalize/canonical';
import { collectEntryComponents } from '../logic/dictionaryComponents';
import { ParseError, CorruptedFileError } from '../logic/importErrors';
import { bulkInsertFrequencyEntries, bulkInsertDictionaryEntries } from '../repositories/resourceEntryRepository';
import type { FrequencyEntry, DictionaryEntry } from '@/entities/dictionary';

/** Options for termBankStrategy. */
export interface TermBankStrategyOptions {
  readonly data: Uint8Array;
  readonly fileName: string;
  /** Pre-inflated zip entries (importOrchestrator already unzipped for the
   *  format sniff) — reused instead of inflating `data` a second time. */
  readonly zipFiles?: Record<string, Uint8Array>;
}

/** Bank index.json structure. */
interface BankIndex {
  readonly title: string;
  readonly revision: string;
  readonly format: number;
}

/** term_bank entry: [expression, reading, definitionTags, rules, score, definitions[], ...]. */
type TermBankEntry = [string, string, string, string, number, unknown[]];

/** term_meta_bank entry: [term, type, {reading?, frequency?} | string | number]. */
type TermMetaEntry = [string, string, { reading?: string; frequency?: number } | string | number];

type StoredRow = Omit<FrequencyEntry, 'id'> | Omit<DictionaryEntry, 'id'>;

const isFreqRow = (e: StoredRow): e is Omit<FrequencyEntry, 'id'> => 'frequency' in e;

/** term-bank ZIP strategy — emits every bank family the zip contains. */
export class TermBankStrategy extends BaseImportStrategy<RawFrequencyEntry | RawDictionaryEntry, StoredRow> {
  readonly format = 'term-bank' as const;
  private readonly data: Uint8Array;
  private readonly zipFiles?: Record<string, Uint8Array>;
  private attemptedTotal = 0;

  constructor(options: StrategyOptions, fileData: TermBankStrategyOptions) {
    super(options);
    this.data = fileData.data;
    this.zipFiles = fileData.zipFiles;
  }

  protected async *parse(): AsyncGenerator<RawFrequencyEntry | RawDictionaryEntry> {
    let files: Record<string, Uint8Array>;
    if (this.zipFiles) {
      files = this.zipFiles;
    } else {
      try {
        files = unzipAll(this.data, isImportZipEntry);
      } catch (e) {
        throw new CorruptedFileError('Failed to unzip term-bank file.', e);
      }
    }

    // Parse index.json (validate structure)
    const indexPath = Object.keys(files).find((p) => p.endsWith('index.json'));
    if (!indexPath) {
      throw new ParseError('term-bank format: index.json not found in zip.');
    }
    try {
      const indexJson: BankIndex = JSON.parse(decodeText(files[indexPath]!));
      void indexJson;
    } catch (e) {
      throw new ParseError('term-bank format: invalid index.json.', e);
    }

    const paths = Object.keys(files);
    const emitDict = this.wants('definitions') && paths.some((p) => p.includes('term_bank'));
    const emitFreq = this.wants('frequency') && paths.some((p) => p.includes('term_meta_bank'));
    if (!emitDict && !emitFreq) {
      throw new ParseError('term-bank format: no term_bank_*.json or term_meta_bank_*.json files found.');
    }

    if (emitDict) yield* this.parseTermBanks(files);
    if (emitFreq) yield* this.parseTermMetaBanks(files);
  }

  /** Grow the attempted-entry total as each bank lands (progress total is
   *  cumulative — it grows mid-import instead of a second parse pass). */
  private addToAttemptedTotal(count: number): void {
    this.attemptedTotal += count;
    this.batchProcessor.setTotal(this.attemptedTotal);
  }

  /** Parse term_bank_*.json → dictionary entries. */
  private async *parseTermBanks(files: Record<string, Uint8Array>): AsyncGenerator<RawDictionaryEntry> {
    const bankPaths = Object.keys(files)
      .filter((p) => p.includes('term_bank') && !p.includes('term_meta_bank'))
      .sort();

    for (const bankPath of bankPaths) {
      await yieldToEventLoop();
      let entries: TermBankEntry[];
      try {
        entries = JSON.parse(decodeText(files[bankPath]!));
      } catch (e) {
        throw new ParseError(`term-bank format: invalid ${bankPath}.`, e);
      }
      delete files[bankPath];
      if (!Array.isArray(entries)) {
        throw new ParseError(`term-bank format: ${bankPath} is not an array.`);
      }
      this.addToAttemptedTotal(entries.length);
      for (const entry of entries) {
        const [expression, reading, definitionTags, rules, , definitions] = entry;
        yield {
          term: expression,
          reading: reading || expression,
          definition: typeof definitions === 'string' ? definitions : '',
          definitions: Array.isArray(definitions) ? definitions : undefined,
          pos: definitionTags || rules || '',
        };
      }
    }
  }

  /** Parse term_meta_bank_*.json → frequency entries. */
  private async *parseTermMetaBanks(files: Record<string, Uint8Array>): AsyncGenerator<RawFrequencyEntry> {
    const bankPaths = Object.keys(files)
      .filter((p) => p.includes('term_meta_bank'))
      .sort();

    for (const bankPath of bankPaths) {
      await yieldToEventLoop();
      let entries: TermMetaEntry[];
      try {
        entries = JSON.parse(decodeText(files[bankPath]!));
      } catch (e) {
        throw new ParseError(`term-bank format: invalid ${bankPath}.`, e);
      }
      delete files[bankPath];
      if (!Array.isArray(entries)) {
        throw new ParseError(`term-bank format: ${bankPath} is not an array.`);
      }
      for (const entry of entries) {
        const [term, type, meta] = entry;
        if (type !== 'freq') continue;
        this.addToAttemptedTotal(1);
        let reading = term;
        let frequency = 0;
        if (meta && typeof meta === 'object') {
          if (typeof meta.reading === 'string') reading = meta.reading;
          if (typeof meta.frequency === 'number') frequency = meta.frequency;
        } else if (typeof meta === 'number') {
          frequency = meta;
        }
        yield { term, reading, frequency };
      }
    }
  }

  protected transformEntry(raw: RawFrequencyEntry | RawDictionaryEntry): StoredRow | null {
    if ('frequency' in raw) {
      return this.transformFrequencyEntry(raw);
    }
    return this.transformDictionaryEntry(raw);
  }

  protected collectComponents(stored: StoredRow): void {
    if (isFreqRow(stored)) {
      this.componentSet.add('frequency');
    } else {
      collectEntryComponents(this.componentSet, stored);
    }
  }

  private transformDictionaryEntry(raw: RawDictionaryEntry): Omit<DictionaryEntry, 'id'> | null {
    const term = raw.term.trim().normalize('NFC').toLowerCase();
    if (term.length === 0) return null;
    const canonical = toCanonicalDefinition(raw);
    return {
      resourceId: this.options.resourceId,
      term,
      reading: raw.reading ? raw.reading.trim().normalize('NFC').toLowerCase() : term,
      altterm: raw.altterm?.trim().normalize('NFC') ?? '',
      pronunciation: '',
      definition: canonical.definition,
      senses: canonical.senses,
      pos: canonical.pos,
      examples: canonical.examples,
      audio: '',
    };
  }

  private transformFrequencyEntry(raw: RawFrequencyEntry): Omit<FrequencyEntry, 'id'> | null {
    const term = raw.term.trim().normalize('NFC').toLowerCase();
    if (term.length === 0) return null;
    const reading = raw.reading ? raw.reading.trim().normalize('NFC') : term;
    return {
      resourceId: this.options.resourceId,
      term,
      reading,
      frequency: Math.max(0, Math.floor(raw.frequency)),
    };
  }

  protected async flushBatch(batch: ReadonlyArray<StoredRow>): Promise<void> {
    const dict = batch.filter((e): e is Omit<DictionaryEntry, 'id'> => !isFreqRow(e));
    const freq = batch.filter(isFreqRow);
    if (dict.length > 0) await bulkInsertDictionaryEntries(this.options.langCode, dict);
    if (freq.length > 0) await bulkInsertFrequencyEntries(this.options.langCode, freq);
  }
}
