// yomitanStrategy — Yomitan ZIP format (ADR-023 D3, spec F9).
//
// unzip all, parse index.json, sort term_meta_bank_*.json, yield {term, reading, frequency}.
// Yomitan term_meta_bank format: [[term, type, {reading, frequency}], ...]

import { BaseFrequencyStrategy, RawFrequencyEntry } from './baseImportStrategy';
import { unzipAll, decodeText } from '../logic/fileDetector';
import { ParseError, CorruptedFileError } from '../logic/importErrors';
import type { StrategyOptions } from './baseImportStrategy';

/** Options for yomitanStrategy. */
export interface YomitanStrategyOptions {
  readonly data: Uint8Array;
  readonly fileName: string;
}

/** Yomitan index.json structure. */
interface YomitanIndex {
  readonly title: string;
  readonly revision: string;
  readonly format: number;
}

/** Yomitan term_meta entry: [term, type, {reading?, frequency?}]. */
type YomitanTermMeta = [string, string, { reading?: string; frequency?: number } | string | number];

/** Yomitan ZIP strategy — frequency meta from term_meta_bank_*.json. */
export class YomitanStrategy extends BaseFrequencyStrategy {
  readonly format = 'yomitan' as const;
  private readonly data: Uint8Array;

  constructor(options: StrategyOptions, fileData: YomitanStrategyOptions) {
    super(options);
    this.data = fileData.data;
  }

  protected async *parse(): AsyncGenerator<RawFrequencyEntry> {
    let files: Record<string, Uint8Array>;
    try {
      files = unzipAll(this.data);
    } catch (e) {
      throw new CorruptedFileError(`Failed to unzip Yomitan file.`, e);
    }

    // Parse index.json
    const indexPath = Object.keys(files).find((p) => p.endsWith('index.json'));
    if (!indexPath) {
      throw new ParseError('Yomitan format: index.json not found in zip.');
    }
    try {
      const indexJson: YomitanIndex = JSON.parse(decodeText(files[indexPath]!));
      void indexJson; // validate structure
    } catch (e) {
      throw new ParseError('Yomitan format: invalid index.json.', e);
    }

    // Sort term_meta_bank files by name
    const bankPaths = Object.keys(files)
      .filter((p) => p.includes('term_meta_bank'))
      .sort();
    if (bankPaths.length === 0) {
      throw new ParseError('Yomitan format: no term_meta_bank_*.json files found.');
    }

    for (const bankPath of bankPaths) {
      let entries: YomitanTermMeta[];
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

  protected async flushBatch(batch: ReadonlyArray<Omit<import('@/entities/dictionary').FrequencyEntry, 'id'>>): Promise<void> {
    const { bulkInsertFrequencyEntries } = await import('../repositories/frequencyRepository');
    await bulkInsertFrequencyEntries(this.options.langCode, batch);
  }
}
