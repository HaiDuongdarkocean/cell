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
//
// Streaming port: bank files are inflated + scanned element-by-element —
// JSON.parse runs per row (~KB) instead of on a whole multi-MB array — so
// import no longer holds the inflated zip + decoded text + parsed graph.

import { BaseImportStrategy, type RawFrequencyEntry, type RawDictionaryEntry, type StrategyOptions, type StrategyResult } from './baseImportStrategy';
import { decodeText } from '../logic/fileDetector';
import type { ReadableFile } from '../logic/fileDetector';
import { yieldToEventLoop } from '../logic/yieldToEventLoop';
import { toCanonicalDefinition } from '../logic/normalize/canonical';
import { collectEntryComponents } from '../logic/dictionaryComponents';
import { ParseError, CorruptedFileError } from '../logic/importErrors';
import {
  resolveImportSource,
  streamTextChunks,
  zipEntryBytes,
  concatBytes,
} from '../logic/importStreams';
import type { ImportSourceInput } from '../logic/importStreams';
import { iterJsonArrayElements } from '../logic/jsonElementScanner';
import { MalformedJsonArrayError } from '../logic/jsonObjectScanner';
import { bulkInsertFrequencyEntries, bulkInsertDictionaryEntries } from '../repositories/resourceEntryRepository';
import type { FrequencyEntry, DictionaryEntry } from '@/entities/dictionary';

/** Options for termBankStrategy. */
export interface TermBankStrategyOptions extends ImportSourceInput {
  /** Pre-inflated zip entries (legacy callers/tests) — reused instead of
   *  streaming entries out of `data`. */
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
  private readonly fileData: TermBankStrategyOptions;
  private attemptedTotal = 0;
  private readonly profile = { parseMs: 0, transformMs: 0, insertMs: 0 };
  private profileStart = 0;
  private source!: ReadableFile;
  private entryMap!: Record<string, Uint8Array>;
  private inflated = false;

  constructor(options: StrategyOptions, fileData: TermBankStrategyOptions) {
    super(options);
    this.fileData = fileData;
  }

  protected async *parse(): AsyncGenerator<RawFrequencyEntry | RawDictionaryEntry> {
    this.profileStart = performance.now();
    if (this.fileData.zipFiles) {
      // Legacy/test path — caller already inflated every entry.
      this.entryMap = this.fileData.zipFiles;
      this.inflated = true;
      this.source = this.fileData.file ?? { size: 0, name: this.fileData.fileName, slice: () => ({ arrayBuffer: async () => new ArrayBuffer(0) }) };
    } else {
      const { file, manifest } = await resolveImportSource(this.fileData);
      if (manifest === null) {
        throw new CorruptedFileError('Failed to unzip term-bank file.');
      }
      this.source = file;
      this.entryMap = manifest;
    }

    const indexPath = Object.keys(this.entryMap).find((p) => p.endsWith('index.json'));
    if (!indexPath) {
      throw new ParseError('term-bank format: index.json not found in zip.');
    }
    try {
      const indexJson: BankIndex = JSON.parse(decodeText(await this.entryAllBytes(indexPath)));
      void indexJson;
    } catch (e) {
      throw new ParseError('term-bank format: invalid index.json.', e);
    }

    const paths = Object.keys(this.entryMap);
    const emitDict = this.wants('definitions') && paths.some((p) => p.includes('term_bank'));
    const emitFreq = this.wants('frequency') && paths.some((p) => p.includes('term_meta_bank'));
    if (!emitDict && !emitFreq) {
      throw new ParseError('term-bank format: no term_bank_*.json or term_meta_bank_*.json files found.');
    }

    if (emitDict) yield* this.parseTermBanks(paths);
    if (emitFreq) yield* this.parseTermMetaBanks(paths);
  }

  /** Entry chunks — raw buffer when caller pre-inflated, streamed inflate
   *  from the source file otherwise. */
  private entryChunks(path: string): AsyncGenerator<Uint8Array> {
    if (this.inflated) {
      const bytes = this.entryMap[path];
      return (async function* () {
        if (bytes) yield bytes;
      })();
    }
    return zipEntryBytes(this.source, path);
  }

  private async entryAllBytes(path: string): Promise<Uint8Array> {
    const parts: Uint8Array[] = [];
    for await (const chunk of this.entryChunks(path)) parts.push(chunk);
    return concatBytes(parts);
  }

  /** Grow the attempted-entry total as entries parse (progress total is
   *  cumulative — it grows mid-import instead of a second parse pass). */
  private addToAttemptedTotal(count: number): void {
    this.attemptedTotal += count;
    this.batchProcessor.setTotal(this.attemptedTotal);
  }

  /** Streamed elements of one bank file's top-level array. */
  private async *bankElements(bankPath: string): AsyncGenerator<string> {
    try {
      for await (const el of iterJsonArrayElements(streamTextChunks(this.entryChunks(bankPath)))) {
        yield el.text;
      }
    } catch (e) {
      if (e instanceof MalformedJsonArrayError) {
        throw new ParseError(`term-bank format: invalid ${bankPath}.`, e);
      }
      throw e;
    }
  }

  /** Count elements without copying slices — the upfront progress total a
   *  bank contributes (same semantics as the old whole-array .length). */
  private async countBankElements(bankPath: string): Promise<number> {
    let count = 0;
    try {
      for await (const _ of iterJsonArrayElements(
        streamTextChunks(this.entryChunks(bankPath)),
        { collectText: false },
      )) {
        count++;
      }
    } catch (e) {
      if (e instanceof MalformedJsonArrayError) {
        throw new ParseError(`term-bank format: invalid ${bankPath}.`, e);
      }
      throw e;
    }
    return count;
  }

  /** Parse term_bank_*.json → dictionary entries. */
  private async *parseTermBanks(paths: string[]): AsyncGenerator<RawDictionaryEntry> {
    const bankPaths = paths
      .filter((p) => p.includes('term_bank') && !p.includes('term_meta_bank'))
      .sort();

    for (const bankPath of bankPaths) {
      await yieldToEventLoop();
      let segStart = performance.now();
      this.addToAttemptedTotal(await this.countBankElements(bankPath));
      for await (const text of this.bankElements(bankPath)) {
        let entry: TermBankEntry;
        try {
          entry = JSON.parse(text) as TermBankEntry;
        } catch (e) {
          throw new ParseError(`term-bank format: invalid ${bankPath}.`, e);
        }
        const [expression, reading, definitionTags, rules, , definitions] = entry;
        const raw: RawDictionaryEntry = {
          term: expression,
          reading: reading || expression,
          definition: typeof definitions === 'string' ? definitions : '',
          definitions: Array.isArray(definitions) ? definitions : undefined,
          pos: definitionTags || rules || '',
        };
        this.profile.parseMs += performance.now() - segStart;
        yield raw;
        segStart = performance.now();
      }
      this.profile.parseMs += performance.now() - segStart;
    }
  }

  /** Parse term_meta_bank_*.json → frequency entries. */
  private async *parseTermMetaBanks(paths: string[]): AsyncGenerator<RawFrequencyEntry> {
    const bankPaths = paths
      .filter((p) => p.includes('term_meta_bank'))
      .sort();

    for (const bankPath of bankPaths) {
      await yieldToEventLoop();
      let segStart = performance.now();
      for await (const text of this.bankElements(bankPath)) {
        let entry: TermMetaEntry;
        try {
          entry = JSON.parse(text) as TermMetaEntry;
        } catch (e) {
          throw new ParseError(`term-bank format: invalid ${bankPath}.`, e);
        }
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
        const raw: RawFrequencyEntry = { term, reading, frequency };
        this.profile.parseMs += performance.now() - segStart;
        yield raw;
        segStart = performance.now();
      }
      this.profile.parseMs += performance.now() - segStart;
    }
  }

  protected transformEntry(raw: RawFrequencyEntry | RawDictionaryEntry): StoredRow | null {
    const t = performance.now();
    try {
      if ('frequency' in raw) {
        return this.transformFrequencyEntry(raw);
      }
      return this.transformDictionaryEntry(raw);
    } finally {
      this.profile.transformMs += performance.now() - t;
    }
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
    const t = performance.now();
    try {
      const dict = batch.filter((e): e is Omit<DictionaryEntry, 'id'> => !isFreqRow(e));
      const freq = batch.filter(isFreqRow);
      if (dict.length > 0) await bulkInsertDictionaryEntries(this.options.langCode, dict);
      if (freq.length > 0) await bulkInsertFrequencyEntries(this.options.langCode, freq);
    } finally {
      this.profile.insertMs += performance.now() - t;
    }
  }

  protected resultExtras(): Partial<StrategyResult> {
    const totalMs = performance.now() - this.profileStart;
    const { parseMs, transformMs, insertMs } = this.profile;
    const waitMs = Math.max(0, totalMs - parseMs - transformMs - insertMs);
    const ms = (v: number) => v.toFixed(0);
    console.info(
      `[import] term-bank profile total=${ms(totalMs)}ms parse=${ms(parseMs)}ms transform=${ms(transformMs)}ms insert=${ms(insertMs)}ms wait=${ms(waitMs)}ms`,
    );
    return {};
  }
}
