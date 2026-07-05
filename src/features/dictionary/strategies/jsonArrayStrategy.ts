// jsonArrayStrategy — JSON array of strings streaming (ADR-023 D3, spec F9).
//
// ["word1", "word2", ...] — frequency list. Token-level streaming parse
// (không load full array vào RAM). Memory ~1 string at a time.

import { BaseFrequencyStrategy, RawFrequencyEntry } from './baseImportStrategy';
import { decodeText } from '../logic/fileDetector';
import { ParseError } from '../logic/importErrors';
import type { StrategyOptions } from './baseImportStrategy';

/** Options for jsonArrayStrategy. */
export interface JsonArrayStrategyOptions {
  readonly data: Uint8Array;
  readonly fileName: string;
}

/** JSON array of strings strategy — frequency list. */
export class JsonArrayStrategy extends BaseFrequencyStrategy {
  readonly format = 'json-array' as const;
  private readonly data: Uint8Array;

  constructor(
    options: StrategyOptions,
    fileData: JsonArrayStrategyOptions,
  ) {
    super(options);
    this.data = fileData.data;
  }

  protected async *parse(): AsyncGenerator<RawFrequencyEntry> {
    let text: string;
    try {
      text = decodeText(this.data);
    } catch (e) {
      throw new ParseError(`Failed to decode JSON array file.`, e);
    }

    const trimmed = text.trim();
    if (!trimmed.startsWith('[')) {
      throw new ParseError(`Expected JSON array, got: ${trimmed.slice(0, 50)}...`);
    }

    // Streaming parse: extract strings one at a time via regex
    // Matches "..." strings inside the array. Use JSON.parse for correct unescape.
    const stringRegex = /"((?:[^"\\]|\\.)*)"/g;
    let match: RegExpExecArray | null;
    let index = 0;
    while ((match = stringRegex.exec(trimmed)) !== null) {
      const raw = match[1]!;
      // Use JSON.parse for correct unescape (handles \\n, \\", \\\\, \\uXXXX, etc.)
      let unescaped: string;
      try {
        unescaped = JSON.parse(`"${raw}"`);
      } catch {
        continue; // skip malformed string
      }
      index++;
      yield { term: unescaped, reading: unescaped, frequency: index };
    }
  }

  protected async flushBatch(batch: ReadonlyArray<Omit<import('@/entities/dictionary').FrequencyEntry, 'id'>>): Promise<void> {
    const { bulkInsertFrequencyEntries } = await import('../repositories/frequencyRepository');
    await bulkInsertFrequencyEntries(this.options.langCode, batch);
  }
}
