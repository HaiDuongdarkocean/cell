// jsonArrayStrategy — JSON array of strings streaming (ADR-023 D3, spec F9).
//
// ["word1", "word2", ...] — frequency list. Element-level streaming scan:
// memory ~one chunk + one string instead of the whole decoded array.

import { BaseFrequencyStrategy } from './baseImportStrategy';
import type { StrategyOptions, RawFrequencyEntry } from './baseImportStrategy';
import { pickDataJsonPath } from '../logic/formatDetector';
import {
  resolveImportSource,
  streamByteSource,
  streamTextChunks,
  zipEntryBytes,
  type ImportSourceInput,
} from '../logic/importStreams';
import { iterJsonArrayElements } from '../logic/jsonElementScanner';
import { MalformedJsonArrayError } from '../logic/jsonObjectScanner';
import type { ScannedElement } from '../logic/jsonElementScanner';
import type { ReadableFile } from '../logic/fileDetector';
import { ParseError } from '../logic/importErrors';
import { bulkInsertFrequencyEntries } from '../repositories/resourceEntryRepository';
import type { FrequencyEntry } from '@/entities/dictionary';

/** Kept for the existing import surface. */
export type JsonArrayStrategyOptions = ImportSourceInput;

/** JSON array of strings strategy — frequency list. */
export class JsonArrayStrategy extends BaseFrequencyStrategy {
  readonly format = 'json-array' as const;
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
    // Pass 1: validate every element is a string + count (exact total upfront,
    // same as the old residue check before any insert). Pass 2 emits.
    let total = 0;
    try {
      for await (const el of this.elements(file, manifest)) {
        if (el.kind !== 'string') throw new ParseError('Expected a JSON array of strings.');
        total++;
      }
    } catch (e) {
      if (e instanceof ParseError) throw e;
      if (e instanceof MalformedJsonArrayError) {
        throw new ParseError('Expected a JSON array of strings.', e);
      }
      throw e;
    }
    this.reportTotal(total);

    let index = 0;
    for await (const el of this.elements(file, manifest)) {
      let unescaped: string;
      try {
        unescaped = JSON.parse(el.text) as string;
      } catch (e) {
        throw new ParseError('Malformed string entry in JSON array.', e);
      }
      index++;
      yield { term: unescaped, reading: unescaped, frequency: index };
    }
  }

  private elements(
    file: ReadableFile,
    manifest: Record<string, Uint8Array> | null,
  ): AsyncGenerator<ScannedElement> {
    const bytes =
      manifest === null
        ? streamByteSource(file)
        : zipEntryBytes(file, pickDataJsonPath(manifest, 'JSON array'));
    return iterJsonArrayElements(streamTextChunks(bytes));
  }

  protected async flushBatch(batch: ReadonlyArray<Omit<FrequencyEntry, 'id'>>): Promise<void> {
    await bulkInsertFrequencyEntries(this.options.langCode, batch);
  }
}
