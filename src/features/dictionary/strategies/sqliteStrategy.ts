// sqliteStrategy — Migaku SQLite .db / .db.gz (ADR-023 D5, spec F9).
//
// Migaku schema:
// - Dictionary: langResourceEntry(term, backwardTerm, displayTerm, termAlt, reading, definition)
// - Frequency: langFrequencyEntry(term, reading, frequency)
//
// gunzip → sql.js lazy-load → exec SQL → yield entries.
// sql.js wasm ~1MB lazy fetch from web_accessible_resources.
// wasm load fail → DatabaseError → orchestrator catch → rollback.

import { BaseImportStrategy, type RawFrequencyEntry, type RawDictionaryEntry, type StrategyOptions } from './baseImportStrategy';
import { gunzipFile, isGzip, isSqlite } from '../logic/fileDetector';
import { DatabaseError, ParseError } from '../logic/importErrors';
import type { FrequencyEntry, DictionaryEntry, ResourceType } from '@/entities/dictionary';

// Local type stubs for sql.js (avoid `import type from 'sql.js'` — ts-jest
// doesn't erase it, causing ESM parse error in jest CJS context).
interface SqlJsStatic {
  Database: new (data?: Uint8Array) => Database;
}
interface Database {
  exec(sql: string): QueryExecResult[];
  close(): void;
}
interface QueryExecResult {
  columns: string[];
  values: unknown[][];
}

/** Options for sqliteStrategy. */
export interface SqliteStrategyOptions {
  readonly data: Uint8Array;
  readonly fileName: string;
  readonly resourceType: ResourceType;
}

/** SQLite strategy — gunzip + sql.js lazy-load + Migaku schema. */
export class SqliteStrategy extends BaseImportStrategy<RawFrequencyEntry | RawDictionaryEntry, Omit<FrequencyEntry, 'id'> | Omit<DictionaryEntry, 'id'>> {
  readonly format = 'sqlite' as const;
  private readonly data: Uint8Array;
  private readonly resourceType: ResourceType;

  constructor(options: StrategyOptions, fileData: SqliteStrategyOptions) {
    super(options);
    this.data = fileData.data;
    this.resourceType = fileData.resourceType;
  }

  protected async *parse(): AsyncGenerator<RawFrequencyEntry | RawDictionaryEntry> {
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

    // 4. Open database
    let db: Database;
    try {
      db = new SQL.Database(dbData);
    } catch (e) {
      throw new DatabaseError('Failed to open SQLite database.', e);
    }

    try {
      if (this.resourceType === 'DICTIONARY') {
        yield* this.parseDictionaryTable(db);
      } else {
        yield* this.parseFrequencyTable(db);
      }
    } finally {
      db.close();
    }
  }

  /** Parse Migaku langResourceEntry table → dictionary entries. */
  private async *parseDictionaryTable(db: Database): AsyncGenerator<RawDictionaryEntry> {
    let result: QueryExecResult[];
    try {
      result = db.exec('SELECT term, reading, definition FROM langResourceEntry');
    } catch (e) {
      throw new ParseError('SQLite: no langResourceEntry table with term/reading/definition columns.', e);
    }
    if (result.length === 0) return;

    const { columns, values } = result[0]!;
    const termIdx = columns.indexOf('term');
    const readingIdx = columns.indexOf('reading');
    const defIdx = columns.indexOf('definition');

    for (const row of values) {
      const term = String(row[termIdx] ?? '');
      const reading = String(row[readingIdx] ?? term);
      const definition = String(row[defIdx] ?? '');
      if (term) yield { term, reading, definition };
    }
  }

  /** Parse Migaku langFrequencyEntry table → frequency entries. */
  private async *parseFrequencyTable(db: Database): AsyncGenerator<RawFrequencyEntry> {
    let result: QueryExecResult[];
    try {
      result = db.exec('SELECT term, reading, frequency FROM langFrequencyEntry');
    } catch {
      // Fallback: try legacy entries table
      try {
        result = db.exec('SELECT term, reading, frequency FROM entries');
      } catch (e) {
        throw new ParseError('SQLite: no langFrequencyEntry or entries table with term/reading/frequency.', e);
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
  }

  protected transformEntry(raw: RawFrequencyEntry | RawDictionaryEntry): Omit<FrequencyEntry, 'id'> | Omit<DictionaryEntry, 'id'> | null {
    if (this.resourceType === 'DICTIONARY') {
      return this.transformDictionaryEntry(raw as RawDictionaryEntry);
    }
    return this.transformFrequencyEntry(raw as RawFrequencyEntry);
  }

  private transformDictionaryEntry(raw: RawDictionaryEntry): Omit<DictionaryEntry, 'id'> | null {
    const term = raw.term.trim().normalize('NFC').toLowerCase();
    if (term.length === 0) return null;
    return {
      resourceId: this.options.resourceId,
      term,
      reading: raw.reading ? raw.reading.trim().normalize('NFC').toLowerCase() : term,
      altterm: '',
      pronunciation: '',
      definition: (raw.definition ?? '').trim().normalize('NFC').replace(/\s+/g, ' '),
      pos: '',
      examples: '',
      audio: '',
    };
  }

  private transformFrequencyEntry(raw: RawFrequencyEntry): Omit<FrequencyEntry, 'id'> | null {
    const term = raw.term.trim().normalize('NFC').toLowerCase();
    if (term.length === 0) return null;
    const reading = raw.reading ? raw.reading.trim().normalize('NFC') : term;
    return {
      resourceId: this.options.resourceId,
      term,
      reading,
      frequency: Math.max(0, Math.floor(raw.frequency)),
    };
  }

  protected async flushBatch(batch: ReadonlyArray<Omit<FrequencyEntry, 'id'> | Omit<DictionaryEntry, 'id'>>): Promise<void> {
    // Dynamic imports — avoid static import of repositories to prevent
    // jest CJS transform issues with transitive ESM deps (ADR-023 D3).
    if (this.resourceType === 'DICTIONARY') {
      const { bulkInsertDictionaryEntries } = await import('../repositories/dictionaryRepository');
      await bulkInsertDictionaryEntries(
        this.options.langCode,
        batch as ReadonlyArray<Omit<DictionaryEntry, 'id'>>,
      );
    } else {
      const { bulkInsertFrequencyEntries } = await import('../repositories/frequencyRepository');
      await bulkInsertFrequencyEntries(
        this.options.langCode,
        batch as ReadonlyArray<Omit<FrequencyEntry, 'id'>>,
      );
    }
  }
}

/** Lazy-load sql.js — returns the SQL static with Database constructor. */
async function importSqlJs(): Promise<SqlJsStatic> {
  const initSqlJs = (await import('sql.js')).default;
  return initSqlJs({
    locateFile: (file: string) => {
      // sql.js browser build requests "sql-wasm-browser.wasm" but our
      // web_accessible_resource is named "sql-wasm.wasm" — map the name.
      const mapped = file.replace('sql-wasm-browser.wasm', 'sql-wasm.wasm');
      if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
        return chrome.runtime.getURL(mapped);
      }
      return mapped;
    },
  });
}
