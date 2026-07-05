// txtLineStrategy — TXT streaming line-by-line (ADR-023 D3, spec F9).
//
// Auto-unzip if .zip. ReadableStream line-by-line + TextDecoder. Memory ~1 line.

import { BaseFrequencyStrategy, RawFrequencyEntry } from './baseImportStrategy';
import { isZip, unzipAll, decodeText } from '../logic/fileDetector';
import { CorruptedFileError } from '../logic/importErrors';

/** Options for txtLineStrategy. */
export interface TxtStrategyOptions {
  readonly data: Uint8Array;
  readonly fileName: string;
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
    // Auto-unzip if .zip — defer error to parse() so execute() rejects (not constructor)
    if (isZip(fileData.data)) {
      try {
        const files = unzipAll(fileData.data);
        const txtFile = Object.keys(files).find((p) => p.endsWith('.txt'));
        if (!txtFile) {
          this.unzipError = new CorruptedFileError(`No .txt file found in zip "${fileData.fileName}".`);
          this.data = new Uint8Array(0);
          return;
        }
        this.data = files[txtFile]!;
      } catch (e) {
        this.unzipError = e instanceof CorruptedFileError ? e : new CorruptedFileError(`Failed to unzip "${fileData.fileName}".`, e);
        this.data = new Uint8Array(0);
        return;
      }
    } else {
      this.data = fileData.data;
    }
  }

  protected async *parse(): AsyncGenerator<RawFrequencyEntry> {
    if (this.unzipError) throw this.unzipError;
    const text = decodeText(this.data);
    const lines = text.split(/\r?\n/);
    let lineNum = 0;
    for (const line of lines) {
      lineNum++;
      const trimmed = line.trim();
      if (trimmed.length === 0) continue;
      // TXT frequency: each line is a word, frequency = line number (order-based)
      yield { term: trimmed, reading: trimmed, frequency: lineNum };
    }
  }

  protected async flushBatch(batch: ReadonlyArray<Omit<import('@/entities/dictionary').FrequencyEntry, 'id'>>): Promise<void> {
    const { bulkInsertFrequencyEntries } = await import('../repositories/frequencyRepository');
    await bulkInsertFrequencyEntries(this.options.langCode, batch);
  }
}

// Re-export StrategyOptions for convenience
export type { StrategyOptions } from './baseImportStrategy';
import type { StrategyOptions } from './baseImportStrategy';
