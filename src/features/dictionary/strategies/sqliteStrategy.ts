// sqliteStrategy — SQLite .db / .db.gz dictionary + frequency (ADR-023 D5, spec F9).
//
// Recognized tables (emitted in one pass — unified-resource-import):
// - Dictionary: langResourceEntry(term, backwardTerm, displayTerm, termAlt, reading, definition)
// - Frequency: langFrequencyEntry(term, reading, frequency) or legacy entries(...)
//
// A db containing both produces one resource with components
// {definitions, frequency}; the user's component subset can drop a table.
//
// gunzip → sql.js lazy-load → exec SQL → yield entries.
// sql.js wasm ~1MB lazy fetch from web_accessible_resources.
// wasm load fail → DatabaseError → orchestrator catch → rollback.

import { BaseImportStrategy, type RawFrequencyEntry, type RawDictionaryEntry, type StrategyOptions } from './baseImportStrategy';
import { gunzipFile, isGzip, isSqlite } from '../logic/fileDetector';
import { toCanonicalDefinition } from '../logic/normalize/canonical';
import { collectEntryComponents } from '../logic/dictionaryComponents';
import { DatabaseError, ParseError } from '../logic/importErrors';
import { bulkInsertDictionaryEntries, bulkInsertFrequencyEntries } from '../repositories/resourceEntryRepository';
import type { FrequencyEntry, DictionaryEntry } from '@/entities/dictionary';

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
}

type StoredRow = Omit<FrequencyEntry, 'id'> | Omit<DictionaryEntry, 'id'>;

const isFreqRow = (e: StoredRow): e is Omit<FrequencyEntry, 'id'> => 'frequency' in e;

/** SQLite strategy — emits every recognized table the schema contains. */
export class SqliteStrategy extends BaseImportStrategy<RawFrequencyEntry | RawDictionaryEntry, StoredRow> {
  readonly format = 'sqlite' as const;
  private readonly data: Uint8Array;

  constructor(options: StrategyOptions, fileData: SqliteStrategyOptions) {
    super(options);
    this.data = fileData.data;
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
      const tables = this.listTables(db);
      const emitDict = this.wants('definitions') && tables.has('langResourceEntry');
      const freqTable = tables.has('langFrequencyEntry') ? 'langFrequencyEntry' : tables.has('entries') ? 'entries' : undefined;
      const emitFreq = this.wants('frequency') && freqTable !== undefined;
      if (!emitDict && !emitFreq) {
        throw new ParseError('SQLite: no langResourceEntry or langFrequencyEntry/entries table found.');
      }

      this.reportTotal(this.countEntries(db, emitDict, freqTable, emitFreq));

      if (emitDict) yield* this.parseDictionaryTable(db);
      if (emitFreq && freqTable) yield* this.parseFrequencyTable(db, freqTable);
    } finally {
      db.close();
    }
  }

  /** Table names from sqlite_master. */
  private listTables(db: Database): Set<string> {
    const names = new Set<string>();
    try {
      const result = db.exec("SELECT name FROM sqlite_master WHERE type = 'table'");
      for (const row of result[0]?.values ?? []) {
        names.add(String(row[0]));
      }
    } catch {
      // leave empty — emit checks below produce the ParseError
    }
    return names;
  }

  /** Exact row count across emitted tables (0 = unknown). */
  private countEntries(db: Database, emitDict: boolean, freqTable: string | undefined, emitFreq: boolean): number {
    let total = 0;
    try {
      if (emitDict) total += toCount(db.exec('SELECT COUNT(*) AS c FROM langResourceEntry'));
      if (emitFreq && freqTable) total += toCount(db.exec(`SELECT COUNT(*) AS c FROM ${freqTable}`));
    } catch {
      return 0;
    }
    return total;
  }

  /** Parse langResourceEntry table → dictionary entries. */
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

  /** Parse a frequency table → frequency entries. */
  private async *parseFrequencyTable(db: Database, table: string): AsyncGenerator<RawFrequencyEntry> {
    let result: QueryExecResult[];
    try {
      result = db.exec(`SELECT term, reading, frequency FROM ${table}`);
    } catch (e) {
      throw new ParseError(`SQLite: no ${table} table with term/reading/frequency.`, e);
    }
    if (!result || result.length === 0) return;

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

  protected transformEntry(raw: RawFrequencyEntry | RawDictionaryEntry): StoredRow | null {
    if ('frequency' in raw) {
      return this.transformFrequencyEntry(raw);
    }
    return this.transformDictionaryEntry(raw);
  }

  protected collectComponents(stored: StoredRow): void {
    if (isFreqRow(stored)) {
      this.componentSet.add('frequency');
    } else {
      collectEntryComponents(this.componentSet, stored);
    }
  }

  private transformDictionaryEntry(raw: RawDictionaryEntry): Omit<DictionaryEntry, 'id'> | null {
    const term = raw.term.trim().normalize('NFC').toLowerCase();
    if (term.length === 0) return null;
    const canonical = toCanonicalDefinition(raw);
    return {
      resourceId: this.options.resourceId,
      term,
      reading: raw.reading ? raw.reading.trim().normalize('NFC').toLowerCase() : term,
      altterm: '',
      pronunciation: '',
      definition: canonical.definition,
      senses: canonical.senses,
      pos: canonical.pos,
      examples: canonical.examples,
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

  protected async flushBatch(batch: ReadonlyArray<StoredRow>): Promise<void> {
    const dict = batch.filter((e): e is Omit<DictionaryEntry, 'id'> => !isFreqRow(e));
    const freq = batch.filter(isFreqRow);
    if (dict.length > 0) await bulkInsertDictionaryEntries(this.options.langCode, dict);
    if (freq.length > 0) await bulkInsertFrequencyEntries(this.options.langCode, freq);
  }
}

function toCount(result: QueryExecResult[] | undefined): number {
  const n = Number(result?.[0]?.values[0]?.[0] ?? 0);
  return Number.isFinite(n) ? n : 0;
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
