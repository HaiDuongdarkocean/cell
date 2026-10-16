// txtLineStrategy — TXT streaming line-by-line (ADR-023 D3, spec F9).
//
// Auto-unzip if .zip / auto-gunzip if .gz. Streamed chunks → lines; memory
// ~one chunk + one line instead of the whole decoded file.

import { BaseFrequencyStrategy } from './baseImportStrategy';
import type { StrategyOptions, RawFrequencyEntry } from './baseImportStrategy';
import { looksLikePlainText } from '../logic/fileDetector';
import type { ReadableFile } from '../logic/fileDetector';
import {
  iterTextLines,
  resolveImportSource,
  streamByteSource,
  streamTextChunks,
  zipEntryBytes,
  type ImportSourceInput,
} from '../logic/importStreams';
import { CorruptedFileError } from '../logic/importErrors';
import { bulkInsertFrequencyEntries } from '../repositories/resourceEntryRepository';
import type { FrequencyEntry } from '@/entities/dictionary';

/** TXT line-by-line strategy — frequency list (1 word per line). */
export class TxtLineStrategy extends BaseFrequencyStrategy {
  readonly format = 'txt' as const;
  private readonly fileData: ImportSourceInput;

  constructor(
    options: StrategyOptions,
    fileData: ImportSourceInput,
  ) {
    super(options);
    this.fileData = fileData;
  }

  protected async *parse(): AsyncGenerator<RawFrequencyEntry> {
    const { file, manifest } = await resolveImportSource(this.fileData);
    // Pass 1 counts non-empty lines (exact total upfront, same as before);
    // pass 2 emits. Two streamed passes keep peak memory at one chunk.
    let total = 0;
    for await (const line of this.makeLines(file, manifest)) {
      if (line.trim().length > 0) total++;
    }
    this.reportTotal(total);
    let lineNum = 0;
    for await (const line of this.makeLines(file, manifest)) {
      lineNum++;
      const trimmed = line.trim();
      if (trimmed.length === 0) continue;
      // TXT frequency: each line is a word, frequency = line number (order-based)
      yield { term: trimmed, reading: trimmed, frequency: lineNum };
    }
  }

  private makeLines(
    file: ReadableFile,
    manifest: Record<string, Uint8Array> | null,
  ): AsyncIterable<string> {
    if (manifest === null) {
      return iterTextLines(streamTextChunks(streamByteSource(file)));
    }
    const txtFile =
      Object.keys(manifest).find((p) => p.endsWith('.txt')) ??
      Object.keys(manifest).find((p) => p.endsWith('.json') && looksLikePlainText(manifest[p]!));
    if (!txtFile) {
      throw new CorruptedFileError(`No .txt file found in zip "${this.fileData.fileName}".`);
    }
    return iterTextLines(streamTextChunks(zipEntryBytes(file, txtFile)));
  }

  protected async flushBatch(batch: ReadonlyArray<Omit<FrequencyEntry, 'id'>>): Promise<void> {
    await bulkInsertFrequencyEntries(this.options.langCode, batch);
  }
}

/** Options for txtLineStrategy — kept for the existing import surface. */
export type TxtStrategyOptions = ImportSourceInput;

// Re-export StrategyOptions for convenience
export type { StrategyOptions, RawFrequencyEntry } from './baseImportStrategy';
