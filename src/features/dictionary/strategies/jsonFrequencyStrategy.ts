// jsonFrequencyStrategy — JSON array of pos-aware frequency objects
// (spec pos-dictionary-variants REQ-4).
//
// [{term, pos?, rank|frequency, total?, genres?}] — one object per (term,pos).
// Per-object parse via jsonObjectScanner (same streaming contract as
// jsonEntriesStrategy) — peak memory bounded by the largest entry.

import { BaseFrequencyStrategy } from './baseImportStrategy';
import type { StrategyOptions, RawFrequencyEntry } from './baseImportStrategy';
import { decodeText, isGzip, gunzipFile, isZip, unzipAll } from '../logic/fileDetector';
import { selectZipDataJson } from '../logic/formatDetector';
import { scanTopLevelJsonObjectRanges, MalformedJsonArrayError } from '../logic/jsonObjectScanner';
import type { JsonObjectRange } from '../logic/jsonObjectScanner';
import { yieldToEventLoop } from '../logic/yieldToEventLoop';
import { ParseError } from '../logic/importErrors';
import { bulkInsertFrequencyEntries } from '../repositories/resourceEntryRepository';
import type { FrequencyEntry, FrequencyGenres } from '@/entities/dictionary';

export interface JsonFrequencyStrategyOptions {
  readonly data: Uint8Array;
  readonly fileName: string;
}

const GENRE_KEYS = ['spoken', 'fiction', 'magazine', 'newspaper', 'academic'] as const;

/** Objects scanned/parsed between cooperative yields. */
const YIELD_EVERY_OBJECTS = 2000;

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
  private readonly data: Uint8Array;

  constructor(options: StrategyOptions, fileData: JsonFrequencyStrategyOptions) {
    super(options);
    this.data = fileData.data;
  }

  protected async *parse(): AsyncGenerator<RawFrequencyEntry> {
    let data = this.data;
    if (isGzip(data)) data = gunzipFile(data);
    if (isZip(data)) {
      const files = unzipAll(data);
      const entry = selectZipDataJson(files);
      if (!entry) throw new ParseError('JSON frequency zip: no .json entry found.');
      data = entry.bytes;
    }

    let text: string;
    try {
      text = decodeText(data);
    } catch (e) {
      throw new ParseError('Failed to parse JSON frequency file.', e);
    }

    const trimmed = text.trim();
    if (!trimmed.startsWith('[')) {
      try {
        JSON.parse(trimmed);
      } catch (e) {
        throw new ParseError('Failed to parse JSON frequency file.', e);
      }
      throw new ParseError('Expected a JSON array of frequency objects.');
    }
    if (!trimmed.endsWith(']')) {
      throw new ParseError('Failed to parse JSON frequency file.');
    }

    // One envelope-validating scan collects exact ranges — the count is
    // known upfront (exact total) without a second charCodeAt pass.
    const ranges: JsonObjectRange[] = [];
    try {
      for (const range of scanTopLevelJsonObjectRanges(trimmed)) {
        ranges.push(range);
        if (ranges.length % YIELD_EVERY_OBJECTS === 0) await yieldToEventLoop();
      }
    } catch (e) {
      if (e instanceof MalformedJsonArrayError) {
        throw new ParseError('Failed to parse JSON frequency file.', e);
      }
      throw e;
    }
    this.reportTotal(ranges.length);

    const seen = new Set<string>();
    let parsed = 0;
    for (const { start, end } of ranges) {
      if (++parsed % YIELD_EVERY_OBJECTS === 0) await yieldToEventLoop();
      let row: Record<string, unknown>;
      try {
        row = JSON.parse(trimmed.slice(start, end)) as Record<string, unknown>;
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
      const total = typeof row.total === 'number' && Number.isFinite(row.total) ? row.total : undefined;
      const genres = readGenres(row.genres);
      yield {
        term,
        reading: term,
        frequency: rank,
        ...(pos ? { pos } : {}),
        ...(total != null ? { total } : {}),
        ...(genres ? { genres } : {}),
      };
    }
  }

  protected async flushBatch(batch: ReadonlyArray<Omit<FrequencyEntry, 'id'>>): Promise<void> {
    await bulkInsertFrequencyEntries(this.options.langCode, batch);
  }
}
