// wordlistJsonStrategy — tagged word-list .json ({index, list} tag lists).
//
// Shape: {name, index: {tag: description}, list: [[term, reading, [tags]]]}.
// Stored as DICTIONARY entries with definition = comma-joined tags so lookups
// surface e.g. "N5" / "HSK 3" for a hovered word.
//
// Streaming port: the `list` member's rows are scanned + parsed one at a
// time; other members (index map etc.) are skipped without buffering.

import { BaseDictionaryStrategy } from './baseImportStrategy';
import type { StrategyOptions, RawDictionaryEntry } from './baseImportStrategy';
import { pickDataJsonPath } from '../logic/formatDetector';
import {
  resolveImportSource,
  streamByteSource,
  streamTextChunks,
  zipEntryBytes,
  type ImportSourceInput,
} from '../logic/importStreams';
import { iterJsonObjectMemberElements } from '../logic/jsonElementScanner';
import { MalformedJsonArrayError } from '../logic/jsonObjectScanner';
import type { ReadableFile } from '../logic/fileDetector';
import { ParseError } from '../logic/importErrors';
import { bulkInsertDictionaryEntries } from '../repositories/resourceEntryRepository';
import type { DictionaryEntry } from '@/entities/dictionary';

/** Kept for the existing import surface. */
export type WordlistJsonStrategyOptions = ImportSourceInput;

export class WordlistJsonStrategy extends BaseDictionaryStrategy {
  readonly format = 'wordlist-json' as const;
  private readonly fileData: ImportSourceInput;

  constructor(options: StrategyOptions, fileData: ImportSourceInput) {
    super(options);
    this.fileData = fileData;
  }

  protected async *parse(): AsyncGenerator<RawDictionaryEntry> {
    const { file, manifest } = await resolveImportSource(this.fileData);

    // Count pass for the exact total, then emit (same as the old
    // parsed.list.length upfront report).
    const countPass = this.listRows(this.freshBytes(file, manifest));
    let total = 0;
    for await (const _ of countPass) total++;
    this.reportTotal(total);

    for await (const row of this.listRows(this.freshBytes(file, manifest))) {
      const [term, reading, tags] = row;
      if (!term) continue;
      yield {
        term,
        reading: reading || term,
        definition: Array.isArray(tags) ? tags.join(', ') : '',
      };
    }
  }

  private freshBytes(
    file: ReadableFile,
    manifest: Record<string, Uint8Array> | null,
  ): AsyncGenerator<Uint8Array> {
    return manifest === null
      ? streamByteSource(file)
      : zipEntryBytes(file, pickDataJsonPath(manifest, 'wordlist'));
  }

  private async *listRows(
    bytes: AsyncIterable<Uint8Array>,
  ): AsyncGenerator<readonly [string, string?, string[]?]> {
    let found = false;
    try {
      for await (const el of iterJsonObjectMemberElements(
        streamTextChunks(bytes),
        'list',
        { onFound: () => { found = true; } },
      )) {
        let row: unknown;
        try {
          row = JSON.parse(el.text);
        } catch (e) {
          throw new ParseError('wordlist: invalid JSON.', e);
        }
        if (!Array.isArray(row)) continue;
        yield row as unknown as readonly [string, string?, string[]?];
      }
    } catch (e) {
      if (e instanceof MalformedJsonArrayError) {
        throw new ParseError('wordlist: invalid JSON.', e);
      }
      throw e;
    }
    if (!found) {
      throw new ParseError('wordlist: expected {index, list} object.');
    }
  }

  protected async flushBatch(batch: ReadonlyArray<Omit<DictionaryEntry, 'id'>>): Promise<void> {
    await bulkInsertDictionaryEntries(this.options.langCode, batch);
  }
}
