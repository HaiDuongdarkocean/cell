// yomitanStrategy — Yomitan ZIP format (ADR-023 D3, spec F9).
//
// Handles BOTH:
// - term_bank_*.json → DICTIONARY entries (term, reading, definition)
//   Format: [[expression, reading, definitionTags, rules, score, definitions[], ...], ...]
// - term_meta_bank_*.json → FREQUENCY entries (term, reading, frequency)
//   Format: [[term, type, {reading?, frequency?} | number], ...]
//
// Mode selected by resourceType: DICTIONARY → term_bank, FREQUENCY → term_meta_bank.

import { BaseImportStrategy, type RawFrequencyEntry, type RawDictionaryEntry, type StrategyOptions } from './baseImportStrategy';
import { unzipAll, decodeText } from '../logic/fileDetector';
import { ParseError, CorruptedFileError } from '../logic/importErrors';
import { bulkInsertFrequencyEntries } from '../repositories/frequencyRepository';
import { bulkInsertDictionaryEntries } from '../repositories/dictionaryRepository';
import type { FrequencyEntry, DictionaryEntry, ResourceType } from '@/entities/dictionary';

/** Options for yomitanStrategy. */
export interface YomitanStrategyOptions {
  readonly data: Uint8Array;
  readonly fileName: string;
  readonly resourceType: ResourceType;
}

/** Yomitan index.json structure. */
interface YomitanIndex {
  readonly title: string;
  readonly revision: string;
  readonly format: number;
}

/** Yomitan term_bank entry: [expression, reading, definitionTags, rules, score, definitions[], ...]. */
type YomitanTermBankEntry = [string, string, string, string, number, string[]];

/** Yomitan term_meta_bank entry: [term, type, {reading?, frequency?} | string | number]. */
type YomitanTermMetaEntry = [string, string, { reading?: string; frequency?: number } | string | number];

/** Yomitan ZIP strategy — handles both dictionary (term_bank) + frequency (term_meta_bank). */
export class YomitanStrategy extends BaseImportStrategy<RawFrequencyEntry | RawDictionaryEntry, Omit<FrequencyEntry, 'id'> | Omit<DictionaryEntry, 'id'>> {
  readonly format = 'yomitan' as const;
  private readonly data: Uint8Array;
  private readonly resourceType: ResourceType;

  constructor(options: StrategyOptions, fileData: YomitanStrategyOptions) {
    super(options);
    this.data = fileData.data;
    this.resourceType = fileData.resourceType;
  }

  protected async *parse(): AsyncGenerator<RawFrequencyEntry | RawDictionaryEntry> {
    let files: Record<string, Uint8Array>;
    try {
      files = unzipAll(this.data);
    } catch (e) {
      throw new CorruptedFileError('Failed to unzip Yomitan file.', e);
    }

    // Parse index.json (validate structure)
    const indexPath = Object.keys(files).find((p) => p.endsWith('index.json'));
    if (!indexPath) {
      throw new ParseError('Yomitan format: index.json not found in zip.');
    }
    try {
      const indexJson: YomitanIndex = JSON.parse(decodeText(files[indexPath]!));
      void indexJson;
    } catch (e) {
      throw new ParseError('Yomitan format: invalid index.json.', e);
    }

    if (this.resourceType === 'DICTIONARY') {
      yield* this.parseTermBanks(files);
    } else {
      yield* this.parseTermMetaBanks(files);
    }
  }

  /** Parse term_bank_*.json → dictionary entries. */
  private async *parseTermBanks(files: Record<string, Uint8Array>): AsyncGenerator<RawDictionaryEntry> {
    const bankPaths = Object.keys(files)
      .filter((p) => p.includes('term_bank'))
      .sort();
    if (bankPaths.length === 0) {
      throw new ParseError('Yomitan dictionary format: no term_bank_*.json files found.');
    }

    for (const bankPath of bankPaths) {
      let entries: YomitanTermBankEntry[];
      try {
        entries = JSON.parse(decodeText(files[bankPath]!));
      } catch (e) {
        throw new ParseError(`Yomitan format: invalid ${bankPath}.`, e);
      }
      if (!Array.isArray(entries)) {
        throw new ParseError(`Yomitan format: ${bankPath} is not an array.`);
      }
      for (const entry of entries) {
        const [expression, reading, , , , definitions] = entry;
        const definition = Array.isArray(definitions) ? definitions.join('\n') : String(definitions ?? '');
        yield {
          term: expression,
          reading: reading || expression,
          definition,
        };
      }
    }
  }

  /** Parse term_meta_bank_*.json → frequency entries. */
  private async *parseTermMetaBanks(files: Record<string, Uint8Array>): AsyncGenerator<RawFrequencyEntry> {
    const bankPaths = Object.keys(files)
      .filter((p) => p.includes('term_meta_bank'))
      .sort();
    if (bankPaths.length === 0) {
      throw new ParseError('Yomitan frequency format: no term_meta_bank_*.json files found.');
    }

    for (const bankPath of bankPaths) {
      let entries: YomitanTermMetaEntry[];
      try {
        entries = JSON.parse(decodeText(files[bankPath]!));
      } catch (e) {
        throw new ParseError(`Yomitan format: invalid ${bankPath}.`, e);
      }
      if (!Array.isArray(entries)) {
        throw new ParseError(`Yomitan format: ${bankPath} is not an array.`);
      }
      for (const entry of entries) {
        const [term, type, meta] = entry;
        if (type !== 'freq') continue;
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

  protected transformEntry(raw: RawFrequencyEntry | RawDictionaryEntry): Omit<FrequencyEntry, 'id'> | Omit<DictionaryEntry, 'id'> | null {
    if (this.resourceType === 'DICTIONARY') {
      return this.transformDictionaryEntry(raw as RawDictionaryEntry);
    }
    return this.transformFrequencyEntry(raw as RawFrequencyEntry);
  }

  private transformDictionaryEntry(raw: RawDictionaryEntry): Omit<DictionaryEntry, 'id'> | null {
    const term = raw.term.trim().normalize('NFC').toLowerCase();
    if (term.length === 0) return null;
    return {
      resourceId: this.options.resourceId,
      term,
      reading: raw.reading ? raw.reading.trim().normalize('NFC').toLowerCase() : term,
      altterm: raw.altterm?.trim().normalize('NFC') ?? '',
      pronunciation: '',
      definition: (raw.definition ?? '').trim().normalize('NFC').replace(/\s+/g, ' '),
      pos: '',
      examples: '',
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

  protected async flushBatch(batch: ReadonlyArray<Omit<FrequencyEntry, 'id'> | Omit<DictionaryEntry, 'id'>>): Promise<void> {
    if (this.resourceType === 'DICTIONARY') {
      await bulkInsertDictionaryEntries(
        this.options.langCode,
        batch as ReadonlyArray<Omit<DictionaryEntry, 'id'>>,
      );
    } else {
      await bulkInsertFrequencyEntries(
        this.options.langCode,
        batch as ReadonlyArray<Omit<FrequencyEntry, 'id'>>,
      );
    }
  }
}
