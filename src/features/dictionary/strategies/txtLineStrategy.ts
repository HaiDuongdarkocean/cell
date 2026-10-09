// txtLineStrategy — TXT streaming line-by-line (ADR-023 D3, spec F9).
//
// Auto-unzip if .zip. ReadableStream line-by-line + TextDecoder. Memory ~1 line.

import { BaseFrequencyStrategy } from './baseImportStrategy';
import type { StrategyOptions, RawFrequencyEntry } from './baseImportStrategy';
import { isGzip, gunzipFile, isZip, unzipAll, decodeText, looksLikePlainText } from '../logic/fileDetector';
import { CorruptedFileError } from '../logic/importErrors';
import { bulkInsertFrequencyEntries } from '../repositories/resourceEntryRepository';
import type { FrequencyEntry } from '@/entities/dictionary';

/** Options for txtLineStrategy. */
export interface TxtStrategyOptions {
  readonly data: Uint8Array;
  readonly fileName: string;
  /** Pre-unzipped entries from the orchestrator's format sniff. */
  readonly unzipped?: Record<string, Uint8Array>;
}

/** TXT line-by-line strategy — frequency list (1 word per line). */
export class TxtLineStrategy extends BaseFrequencyStrategy {
  readonly format = 'txt' as const;
  private readonly data: Uint8Array;
  private unzipError: Error | null = null;

  constructor(
    options: StrategyOptions,
    fileData: TxtStrategyOptions,
  ) {
    super(options);
    // Auto-gunzip/-unzip — defer error to parse() so execute() rejects (not constructor)
    try {
      let data = fileData.data;
      if (isGzip(data)) data = gunzipFile(data);
      if (isZip(data) || fileData.unzipped) {
        const files = fileData.unzipped ?? unzipAll(data);
        const txtFile =
          Object.keys(files).find((p) => p.endsWith('.txt')) ??
          Object.keys(files).find((p) => p.endsWith('.json') && looksLikePlainText(files[p]!));
        if (!txtFile) {
          throw new CorruptedFileError(`No .txt file found in zip "${fileData.fileName}".`);
        }
        data = files[txtFile]!;
      }
      this.data = data;
    } catch (e) {
      this.unzipError = e instanceof CorruptedFileError ? e : new CorruptedFileError(`Failed to unzip "${fileData.fileName}".`, e);
      this.data = new Uint8Array(0);
      return;
    }
  }

  protected async *parse(): AsyncGenerator<RawFrequencyEntry> {
    if (this.unzipError) throw this.unzipError;
    const text = decodeText(this.data);
    const lines = text.split(/\r?\n/);
    let nonEmpty = 0;
    for (const line of lines) {
      if (line.trim().length > 0) nonEmpty++;
    }
    this.reportTotal(nonEmpty);
    let lineNum = 0;
    for (const line of lines) {
      lineNum++;
      const trimmed = line.trim();
      if (trimmed.length === 0) continue;
      // TXT frequency: each line is a word, frequency = line number (order-based)
      yield { term: trimmed, reading: trimmed, frequency: lineNum };
    }
  }

  protected async flushBatch(batch: ReadonlyArray<Omit<FrequencyEntry, 'id'>>): Promise<void> {
    await bulkInsertFrequencyEntries(this.options.langCode, batch);
  }
}

// Re-export StrategyOptions for convenience
export type { StrategyOptions, RawFrequencyEntry } from './baseImportStrategy';
