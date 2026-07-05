// sqliteStrategy — Migaku SQLite .db.gz (ADR-023 D5, spec F9).
//
// gunzip → sql.js lazy-load → exec SQL → yield {term, reading, frequency}.
// sql.js wasm ~1MB lazy fetch from web_accessible_resources.
// wasm load fail → DatabaseError → orchestrator catch → rollback.

import { BaseFrequencyStrategy } from './baseImportStrategy';
import type { StrategyOptions, RawFrequencyEntry } from './baseImportStrategy';
import { gunzipFile, isGzip, isSqlite } from '../logic/fileDetector';
import { DatabaseError, ParseError } from '../logic/importErrors';
import { bulkInsertFrequencyEntries } from '../repositories/frequencyRepository';
import type { FrequencyEntry } from '@/entities/dictionary';
import type { Database, QueryExecResult, SqlJsStatic } from 'sql.js';

/** Options for sqliteStrategy. */
export interface SqliteStrategyOptions {
  readonly data: Uint8Array;
  readonly fileName: string;
}

/** SQLite strategy — gunzip + sql.js lazy-load. */
export class SqliteStrategy extends BaseFrequencyStrategy {
  readonly format = 'sqlite' as const;
  private readonly data: Uint8Array;

  constructor(options: StrategyOptions, fileData: SqliteStrategyOptions) {
    super(options);
    this.data = fileData.data;
  }

  protected async *parse(): AsyncGenerator<RawFrequencyEntry> {
    // 1. Gunzip if needed
    let dbData: Uint8Array;
    if (isGzip(this.data)) {
      try {
        dbData = gunzipFile(this.data);
      } catch (e) {
        throw new DatabaseError('Failed to gunzip SQLite file.', e);
      }
    } else {
      dbData = this.data;
    }

    // 2. Validate SQLite magic
    if (!isSqlite(dbData)) {
      throw new ParseError('SQLite file: missing SQLite magic bytes.');
    }

    // 3. Lazy-load sql.js
    let SQL: SqlJsStatic;
    try {
      SQL = await importSqlJs();
    } catch (e) {
      throw new DatabaseError('Failed to load sql.js wasm.', e);
    }

    // 4. Open database + exec query
    let db: Database;
    try {
      db = new SQL.Database(dbData);
    } catch (e) {
      throw new DatabaseError('Failed to open SQLite database.', e);
    }

    try {
      // Try common Migaku schema: entries(term, reading, frequency)
      let result: QueryExecResult[];
      try {
        result = db.exec('SELECT term, reading, frequency FROM entries');
      } catch {
        // Fallback: try word column
        try {
          result = db.exec('SELECT word as term, word as reading, 0 as frequency FROM entries');
        } catch (e) {
          throw new ParseError('SQLite: no entries table with term/reading/frequency columns.', e);
        }
      }

      if (result.length === 0) return;

      const { columns, values } = result[0]!;
      const termIdx = columns.indexOf('term');
      const readingIdx = columns.indexOf('reading');
      const freqIdx = columns.indexOf('frequency');

      for (const row of values) {
        const term = String(row[termIdx] ?? '');
        const reading = String(row[readingIdx] ?? term);
        const frequency = Number(row[freqIdx] ?? 0);
        if (term) yield { term, reading, frequency };
      }
    } finally {
      db.close();
    }
  }

  protected async flushBatch(batch: ReadonlyArray<Omit<FrequencyEntry, 'id'>>): Promise<void> {
    await bulkInsertFrequencyEntries(this.options.langCode, batch);
  }
}

/** Lazy-load sql.js — isolated for mockability. Returns the SQL static with Database constructor. */
async function importSqlJs(): Promise<SqlJsStatic> {
  const initSqlJs = (await import('sql.js')).default;
  return initSqlJs({
    locateFile: (file: string) => {
      // In extension: chrome.runtime.getURL('sql-wasm.wasm')
      // In test: mock provides the wasm
      if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
        return chrome.runtime.getURL(file);
      }
      return file;
    },
  });
}
