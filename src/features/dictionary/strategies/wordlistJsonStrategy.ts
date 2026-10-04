// wordlistJsonStrategy — tagged word-list .json ({index, list} tag lists).
//
// Shape: {name, index: {tag: description}, list: [[term, reading, [tags]]]}.
// Stored as DICTIONARY entries with definition = comma-joined tags so lookups
// surface e.g. "N5" / "HSK 3" for a hovered word.

import { BaseDictionaryStrategy } from './baseImportStrategy';
import type { StrategyOptions, RawDictionaryEntry } from './baseImportStrategy';
import { decodeText, isGzip, gunzipFile, isZip, unzipAll } from '../logic/fileDetector';
import { selectZipDataJson } from '../logic/formatDetector';
import { ParseError } from '../logic/importErrors';
import { bulkInsertDictionaryEntries } from '../repositories/resourceEntryRepository';
import type { DictionaryEntry } from '@/entities/dictionary';

interface WordlistJson {
  readonly index?: Record<string, string>;
  readonly list?: ReadonlyArray<readonly [string, string?, string[]?]>;
}

export class WordlistJsonStrategy extends BaseDictionaryStrategy {
  readonly format = 'wordlist-json' as const;
  private readonly data: Uint8Array;

  constructor(options: StrategyOptions, fileData: { data: Uint8Array; fileName: string }) {
    super(options);
    this.data = fileData.data;
  }

  protected async *parse(): AsyncGenerator<RawDictionaryEntry> {
    let data = this.data;
    if (isGzip(data)) data = gunzipFile(data);
    if (isZip(data)) {
      const files = unzipAll(data);
      const entry = selectZipDataJson(files);
      if (!entry) throw new ParseError('wordlist zip: no .json entry found.');
      data = entry.bytes;
    }

    let parsed: WordlistJson;
    try {
      parsed = JSON.parse(decodeText(data));
    } catch (e) {
      throw new ParseError('wordlist: invalid JSON.', e);
    }
    if (!parsed || !Array.isArray(parsed.list)) {
      throw new ParseError('wordlist: expected {index, list} object.');
    }

    this.reportTotal(parsed.list.length);

    for (const row of parsed.list) {
      const [term, reading, tags] = row;
      if (!term) continue;
      yield {
        term,
        reading: reading || term,
        definition: Array.isArray(tags) ? tags.join(', ') : '',
      };
    }
  }

  protected async flushBatch(batch: ReadonlyArray<Omit<DictionaryEntry, 'id'>>): Promise<void> {
    await bulkInsertDictionaryEntries(this.options.langCode, batch);
  }
}
