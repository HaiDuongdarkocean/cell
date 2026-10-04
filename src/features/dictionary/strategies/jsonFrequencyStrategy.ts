// jsonFrequencyStrategy — JSON array of pos-aware frequency objects
// (spec pos-dictionary-variants REQ-4).
//
// [{term, pos?, rank|frequency, total?, genres?}] — one object per (term,pos).
// Full-file JSON.parse: the format is produced by our own converter
// (bounded, well-formed) — streaming token parse adds nothing here.

import { BaseFrequencyStrategy } from './baseImportStrategy';
import type { StrategyOptions, RawFrequencyEntry } from './baseImportStrategy';
import { decodeText, isGzip, gunzipFile } from '../logic/fileDetector';
import { ParseError } from '../logic/importErrors';
import { bulkInsertFrequencyEntries } from '../repositories/resourceEntryRepository';
import type { FrequencyEntry, FrequencyGenres } from '@/entities/dictionary';

export interface JsonFrequencyStrategyOptions {
  readonly data: Uint8Array;
  readonly fileName: string;
}

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
  private readonly data: Uint8Array;

  constructor(options: StrategyOptions, fileData: JsonFrequencyStrategyOptions) {
    super(options);
    this.data = fileData.data;
  }

  protected async *parse(): AsyncGenerator<RawFrequencyEntry> {
    let data = this.data;
    if (isGzip(data)) data = gunzipFile(data);

    let parsed: unknown;
    try {
      parsed = JSON.parse(decodeText(data));
    } catch (e) {
      throw new ParseError('Failed to parse JSON frequency file.', e);
    }
    if (!Array.isArray(parsed)) {
      throw new ParseError('Expected a JSON array of frequency objects.');
    }
    this.reportTotal(parsed.length);

    const seen = new Set<string>();
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;
      const row = item as Record<string, unknown>;
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
      yield {
        term,
        reading: term,
        frequency: rank,
        ...(pos ? { pos } : {}),
        ...(total != null ? { total } : {}),
        ...(readGenres(row.genres) ? { genres: readGenres(row.genres) } : {}),
      };
    }
  }

  protected async flushBatch(batch: ReadonlyArray<Omit<FrequencyEntry, 'id'>>): Promise<void> {
    await bulkInsertFrequencyEntries(this.options.langCode, batch);
  }
}
