// jsonFrequencyStrategy — JSON array of pos-aware frequency objects
// (spec pos-dictionary-variants REQ-4).
//
// [{term, pos?, rank|frequency, total?, genres?}] — one object per (term,pos).
// Two streamed passes — count objects, then parse — peak memory bounded by
// one chunk + the largest entry.

import { BaseFrequencyStrategy } from './baseImportStrategy';
import type { StrategyOptions, RawFrequencyEntry } from './baseImportStrategy';
import { pickDataJsonPath } from '../logic/formatDetector';
import {
  readAllText,
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
import type { FrequencyEntry, FrequencyGenres } from '@/entities/dictionary';

export type JsonFrequencyStrategyOptions = ImportSourceInput;

const GENRE_KEYS = ['spoken', 'fiction', 'magazine', 'newspaper', 'academic'] as const;

function readGenres(raw: unknown): FrequencyGenres | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const src = raw as Record<string, unknown>;
  const out: Record<string, number> = {};
  for (const key of GENRE_KEYS) {
    const v = src[key];
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) out[key] = Math.floor(v);
  }
  return Object.keys(out).length ? (out as FrequencyGenres) : undefined;
}

export class JsonFrequencyStrategy extends BaseFrequencyStrategy {
  readonly format = 'json-frequency' as const;
  private readonly fileData: ImportSourceInput;

  constructor(options: StrategyOptions, fileData: JsonFrequencyStrategyOptions) {
    super(options);
    this.fileData = fileData;
  }

  protected async *parse(): AsyncGenerator<RawFrequencyEntry> {
    const { file, manifest } = await resolveImportSource(this.fileData);
    // Pass 1 counts top-level objects (exact total upfront, same as the old
    // range-collecting scan).
    let total = 0;
    try {
      for await (const el of this.elements(file, manifest)) {
        if (el.kind === 'object') total++;
      }
    } catch (e) {
      if (e instanceof MalformedJsonArrayError) {
        throw await this.classifyMalformed(file, manifest, e);
      }
      throw e;
    }
    this.reportTotal(total);

    const seen = new Set<string>();
    for await (const el of this.elements(file, manifest)) {
      if (el.kind !== 'object') continue;
      let row: Record<string, unknown>;
      try {
        row = JSON.parse(el.text) as Record<string, unknown>;
      } catch (e) {
        throw new ParseError('Failed to parse JSON frequency file.', e);
      }
      const term = typeof row.term === 'string' ? row.term : '';
      if (!term.trim()) continue;
      const rank = typeof row.rank === 'number' ? row.rank
        : typeof row.frequency === 'number' ? row.frequency
        : NaN;
      if (!Number.isFinite(rank) || rank < 0) continue;
      const pos = typeof row.pos === 'string' && row.pos.trim() ? row.pos.trim() : undefined;
      const key = term + '\x1f' + (pos ?? '');
      if (seen.has(key)) continue;
      seen.add(key);
      const total_ = typeof row.total === 'number' && Number.isFinite(row.total) ? row.total : undefined;
      const genres = readGenres(row.genres);
      yield {
        term,
        reading: term,
        frequency: rank,
        ...(pos ? { pos } : {}),
        ...(total_ != null ? { total: total_ } : {}),
        ...(genres ? { genres } : {}),
      };
    }
  }

  private byteSource(
    file: ReadableFile,
    manifest: Record<string, Uint8Array> | null,
  ): AsyncGenerator<Uint8Array> {
    return manifest === null
      ? streamByteSource(file)
      : zipEntryBytes(file, pickDataJsonPath(manifest, 'JSON frequency'));
  }

  private elements(
    file: ReadableFile,
    manifest: Record<string, Uint8Array> | null,
  ): AsyncGenerator<ScannedElement> {
    return iterJsonArrayElements(streamTextChunks(this.byteSource(file, manifest)));
  }

  /** Malformed input parity: valid-JSON-non-array → "expected array";
   *  anything else → "parse failed". Error path only — re-reads the source. */
  private async classifyMalformed(
    file: ReadableFile,
    manifest: Record<string, Uint8Array> | null,
    cause: MalformedJsonArrayError,
  ): Promise<ParseError> {
    if (!cause.message.startsWith("expected '['")) {
      return new ParseError('Failed to parse JSON frequency file.', cause);
    }
    try {
      JSON.parse(await readAllText(this.byteSource(file, manifest)));
    } catch (e) {
      return new ParseError('Failed to parse JSON frequency file.', e);
    }
    return new ParseError('Expected a JSON array of frequency objects.', cause);
  }

  protected async flushBatch(batch: ReadonlyArray<Omit<FrequencyEntry, 'id'>>): Promise<void> {
    await bulkInsertFrequencyEntries(this.options.langCode, batch);
  }
}
