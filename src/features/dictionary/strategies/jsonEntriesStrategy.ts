// jsonEntriesStrategy — entry-object JSON dictionary (ADR-023 D3, spec F9).
//
// JSON array [{term, altterm, pronunciation, definition, pos, examples, audio}, ...].
// Parse + yield dictionary entries with rich fields.

import { BaseDictionaryStrategy } from './baseImportStrategy';
import type { StrategyOptions, RawDictionaryEntry } from './baseImportStrategy';
import { decodeText, isGzip, gunzipFile, isZip, unzipAll } from '../logic/fileDetector';
import { selectZipDataJson } from '../logic/formatDetector';
import { ParseError } from '../logic/importErrors';
import { bulkInsertDictionaryEntries } from '../repositories/resourceEntryRepository';
import type { DictionaryEntry, SenseBlock, RelatedEntry, InflectionGroup, EtymologyBlock, WordFamily, WordNetInfo, PronunciationAccent } from '@/entities/dictionary';

/** Options for jsonEntriesStrategy. */
export interface JsonEntriesStrategyOptions {
  readonly data: Uint8Array;
  readonly fileName: string;
  /** Pre-unzipped entries from the orchestrator's format sniff. */
  readonly unzipped?: Record<string, Uint8Array>;
}

/** Entry-object JSON shape. `senses` is present on pre-normalized files
 *  (tihoka-convert-dictionary script output) and passes through verbatim —
 *  same for the canonical entry-level fields below. */
interface JsonEntry {
  readonly term: string;
  readonly altterm?: string;
  readonly pronunciation?: string;
  readonly definition?: string;
  readonly senses?: SenseBlock[];
  readonly pos?: string;
  readonly prons?: PronunciationAccent[];
  readonly examples?: string;
  readonly audio?: string;
  readonly related?: RelatedEntry[];
  readonly inflections?: InflectionGroup[];
  readonly level?: string;
  readonly frequencyStars?: number;
  readonly etymology?: EtymologyBlock;
  readonly wordFamily?: WordFamily;
  readonly wordNet?: WordNetInfo;
  readonly derivedTerms?: string[];
  readonly anagrams?: string[];
}

/** entry-object JSON dictionary strategy. */
export class JsonEntriesStrategy extends BaseDictionaryStrategy {
  readonly format = 'json-entries' as const;
  private readonly data: Uint8Array;
  private readonly unzipped?: Record<string, Uint8Array>;

  constructor(options: StrategyOptions, fileData: JsonEntriesStrategyOptions) {
    super(options);
    this.data = fileData.data;
    this.unzipped = fileData.unzipped;
  }

  protected async *parse(): AsyncGenerator<RawDictionaryEntry> {
    let data = this.data;
    if (isGzip(data)) data = gunzipFile(data);
    if (isZip(data) || this.unzipped) {
      const files = this.unzipped ?? unzipAll(data);
      const entry = selectZipDataJson(files);
      if (!entry) throw new ParseError('entry-object JSON zip: no .json entry found.');
      data = entry.bytes;
    }

    let text: string;
    try {
      text = decodeText(data);
    } catch (e) {
      throw new ParseError('Failed to decode entry-object JSON file.', e);
    }

    let entries: JsonEntry[];
    try {
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) {
        throw new ParseError('entry-object JSON: expected array of entries.');
      }
      entries = parsed;
    } catch (e) {
      if (e instanceof ParseError) throw e;
      throw new ParseError('entry-object JSON: invalid JSON.', e);
    }

    this.reportTotal(entries.length);

    for (const entry of entries) {
      if (!entry || typeof entry !== 'object' || !entry.term) continue;
      yield {
        term: entry.term,
        altterm: entry.altterm ?? '',
        pronunciation: entry.pronunciation ?? '',
        definition: entry.definition ?? '',
        senses: Array.isArray(entry.senses) ? entry.senses : undefined,
        pos: entry.pos ?? '',
        prons: Array.isArray(entry.prons) ? entry.prons : undefined,
        examples: entry.examples ?? '',
        audio: entry.audio ?? '',
        related: Array.isArray(entry.related) ? entry.related : undefined,
        inflections: Array.isArray(entry.inflections) ? entry.inflections : undefined,
        level: entry.level,
        frequencyStars: entry.frequencyStars,
        etymology: entry.etymology,
        wordFamily: entry.wordFamily,
        wordNet: entry.wordNet,
        derivedTerms: Array.isArray(entry.derivedTerms) ? entry.derivedTerms : undefined,
        anagrams: Array.isArray(entry.anagrams) ? entry.anagrams : undefined,
      };
    }
  }

  protected async flushBatch(batch: ReadonlyArray<Omit<DictionaryEntry, 'id'>>): Promise<void> {
    await bulkInsertDictionaryEntries(this.options.langCode, batch);
  }
}
