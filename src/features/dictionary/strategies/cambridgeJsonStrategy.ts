// cambridgeJsonStrategy — Cambridge JSON dictionary (ADR-023 D3, spec F9).
//
// JSON array [{term, altterm, pronunciation, definition, pos, examples, audio}, ...].
// Parse + yield dictionary entries with rich fields.

import { BaseDictionaryStrategy, RawDictionaryEntry } from './baseImportStrategy';
import { decodeText } from '../logic/fileDetector';
import { ParseError } from '../logic/importErrors';
import type { StrategyOptions } from './baseImportStrategy';

/** Options for cambridgeJsonStrategy. */
export interface CambridgeJsonStrategyOptions {
  readonly data: Uint8Array;
  readonly fileName: string;
}

/** Cambridge JSON entry shape. */
interface CambridgeEntry {
  readonly term: string;
  readonly altterm?: string;
  readonly pronunciation?: string;
  readonly definition?: string;
  readonly pos?: string;
  readonly examples?: string;
  readonly audio?: string;
}

/** Cambridge JSON dictionary strategy. */
export class CambridgeJsonStrategy extends BaseDictionaryStrategy {
  readonly format = 'cambridge-json' as const;
  private readonly data: Uint8Array;

  constructor(options: StrategyOptions, fileData: CambridgeJsonStrategyOptions) {
    super(options);
    this.data = fileData.data;
  }

  protected async *parse(): AsyncGenerator<RawDictionaryEntry> {
    let text: string;
    try {
      text = decodeText(this.data);
    } catch (e) {
      throw new ParseError('Failed to decode Cambridge JSON file.', e);
    }

    let entries: CambridgeEntry[];
    try {
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) {
        throw new ParseError('Cambridge JSON: expected array of entries.');
      }
      entries = parsed;
    } catch (e) {
      if (e instanceof ParseError) throw e;
      throw new ParseError('Cambridge JSON: invalid JSON.', e);
    }

    for (const entry of entries) {
      if (!entry || typeof entry !== 'object' || !entry.term) continue;
      yield {
        term: entry.term,
        altterm: entry.altterm ?? '',
        pronunciation: entry.pronunciation ?? '',
        definition: entry.definition ?? '',
        pos: entry.pos ?? '',
        examples: entry.examples ?? '',
        audio: entry.audio ?? '',
      };
    }
  }

  protected async flushBatch(batch: ReadonlyArray<Omit<import('@/entities/dictionary').DictionaryEntry, 'id'>>): Promise<void> {
    const { bulkInsertDictionaryEntries } = await import('../repositories/dictionaryRepository');
    await bulkInsertDictionaryEntries(this.options.langCode, batch);
  }
}
