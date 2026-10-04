import 'fake-indexeddb/auto';
import { SqliteStrategy } from '@/features/dictionary/strategies/sqliteStrategy';
import { DatabaseError, ParseError } from '@/features/dictionary/logic/importErrors';
import { gzipSync, strToU8 } from 'fflate';
import { findFrequencyByResource, findDictionaryByResource } from '@/features/dictionary/repositories/resourceEntryRepository';
import { addResource } from '@/features/dictionary/repositories/resourceRepository';

// Mock sql.js module — returns mock Database with configurable exec()
jest.mock('sql.js', () => {
  const mockDatabase = jest.fn();
  return {
    __esModule: true,
    default: jest.fn().mockResolvedValue({ Database: mockDatabase }),
    Database: mockDatabase,
  };
});

const LANG = 'en';

function makeSqliteHeader(): Uint8Array {
  // Real SQLite file header: "SQLite format 3\0" (16 bytes).
  const magic = [0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x20, 0x66, 0x6f, 0x72, 0x6d, 0x61, 0x74, 0x20, 0x33, 0x00];
  const bytes = new Uint8Array(1024);
  bytes.set(magic, 0);
  return bytes;
}

interface MockSchema {
  readonly tables: readonly string[];
  readonly freqRows?: readonly unknown[][];
  readonly dictRows?: readonly unknown[][];
}

/** Answer exec() per query like a real db: sqlite_master lists `tables`,
 *  SELECTs throw for tables not in the schema. */
function setupSqlJsMock({ tables, freqRows = [], dictRows = [] }: MockSchema): void {
  const exec = jest.fn().mockImplementation((sql: string) => {
    if (sql.includes('sqlite_master')) {
      return [{ columns: ['name'], values: tables.map((n) => [n]) }];
    }
    if (sql.startsWith('SELECT COUNT')) {
      return [{ columns: ['c'], values: [[freqRows.length + dictRows.length]] }];
    }
    const table = tables.find((t) => sql.includes(`FROM ${t}`));
    if (!table) throw new Error('no such table');
    if (table === 'langResourceEntry') {
      return [{ columns: ['term', 'reading', 'definition'], values: dictRows }];
    }
    return [{ columns: ['term', 'reading', 'frequency'], values: freqRows }];
  });
   
  const sqlJs = require('sql.js');
  sqlJs.default.mockResolvedValue({
    Database: jest.fn().mockImplementation(() => ({ exec, close: jest.fn() })),
  });
}

describe('sqliteStrategy — frequency (langFrequencyEntry)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('parses Migaku langFrequencyEntry table', async () => {
    setupSqlJsMock({
      tables: ['langFrequencyEntry'],
      freqRows: [
        ['hello', 'hello', 100],
        ['world', 'world', 50],
      ],
    });

    const resourceId = await addResource(LANG, {
      name: 'freq.db', langCode: LANG, type: 'FREQUENCY', format: 'sqlite',
      signature: 'sig-f1', wordCount: 0, installationFinished: false, importedAt: Date.now(),
    });
    const strategy = new SqliteStrategy(
      { resourceId, langCode: LANG },
      { data: makeSqliteHeader(), fileName: 'freq.db' },
    );
    const result = await strategy.execute();
    expect(result.wordCount).toBe(2);
    expect(result.format).toBe('sqlite');
    expect(result.components).toEqual(['frequency']);
    const stored = await findFrequencyByResource(LANG, resourceId);
    expect(stored.map((e) => e.term).sort()).toEqual(['hello', 'world']);
  });

  it('falls back to legacy entries table if langFrequencyEntry missing', async () => {
    setupSqlJsMock({
      tables: ['entries'],
      freqRows: [['hello', 'hello', 1]],
    });

    const resourceId = await addResource(LANG, {
      name: 'freq.db', langCode: LANG, type: 'FREQUENCY', format: 'sqlite',
      signature: 'sig-f2', wordCount: 0, installationFinished: false, importedAt: Date.now(),
    });
    const strategy = new SqliteStrategy(
      { resourceId, langCode: LANG },
      { data: makeSqliteHeader(), fileName: 'freq.db' },
    );
    const result = await strategy.execute();
    expect(result.wordCount).toBe(1);
    expect(await findFrequencyByResource(LANG, resourceId)).toHaveLength(1);
  });

  it('throws ParseError if not SQLite (no magic bytes)', async () => {
    const data = strToU8('not a sqlite file');
    const strategy = new SqliteStrategy(
      { resourceId: 1, langCode: LANG },
      { data, fileName: 'freq.db' },
    );
    await expect(strategy.execute()).rejects.toThrow(ParseError);
  });

  it('gunzips .db.gz before parsing', async () => {
    setupSqlJsMock({
      tables: ['langFrequencyEntry'],
      freqRows: [['hello', 'hello', 1]],
    });

    const gzipped = gzipSync(makeSqliteHeader());
    const strategy = new SqliteStrategy(
      { resourceId: 1, langCode: LANG },
      { data: gzipped, fileName: 'freq.db.gz' },
    );
    // Should not throw ParseError about missing SQLite magic (gunzip worked)
    try {
      await strategy.execute();
    } catch (e) {
      expect(e).not.toBeInstanceOf(ParseError);
    }
  });

  it('throws DatabaseError on corrupt gzip', async () => {
    const bad = new Uint8Array([0x1f, 0x8b, 0x08, 0x00, 0xff, 0xff]);
    const strategy = new SqliteStrategy(
      { resourceId: 1, langCode: LANG },
      { data: bad, fileName: 'freq.db.gz' },
    );
    await expect(strategy.execute()).rejects.toThrow(DatabaseError);
  });
});

describe('sqliteStrategy — dictionary (langResourceEntry)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('parses Migaku langResourceEntry table', async () => {
    setupSqlJsMock({
      tables: ['langResourceEntry'],
      dictRows: [
        ['hello', 'hello', 'a greeting'],
        ['world', 'world', 'the earth'],
      ],
    });

    const resourceId = await addResource(LANG, {
      name: 'Wordset.db', langCode: LANG, type: 'DICTIONARY', format: 'sqlite',
      signature: 'sig-d1', wordCount: 0, installationFinished: false, importedAt: Date.now(),
    });
    const strategy = new SqliteStrategy(
      { resourceId, langCode: LANG },
      { data: makeSqliteHeader(), fileName: 'Wordset.db' },
    );
    const result = await strategy.execute();
    expect(result.wordCount).toBe(2);
    expect(result.format).toBe('sqlite');
    const stored = await findDictionaryByResource(LANG, resourceId);
    expect(stored.map((e) => e.term).sort()).toEqual(['hello', 'world']);
  });

  it('emits both tables from a mixed dictionary+frequency db', async () => {
    setupSqlJsMock({
      tables: ['langResourceEntry', 'langFrequencyEntry'],
      dictRows: [['hello', 'hello', 'a greeting']],
      freqRows: [['hello', 'hello', 100]],
    });

    const resourceId = await addResource(LANG, {
      name: 'mixed.db', langCode: LANG, type: 'DICTIONARY', format: 'sqlite',
      signature: 'sig-m1', wordCount: 0, installationFinished: false, importedAt: Date.now(),
    });
    const strategy = new SqliteStrategy(
      { resourceId, langCode: LANG },
      { data: makeSqliteHeader(), fileName: 'mixed.db' },
    );
    const result = await strategy.execute();
    expect(result.wordCount).toBe(2);
    expect(result.components).toEqual(['definitions', 'frequency']);
    expect(await findDictionaryByResource(LANG, resourceId)).toHaveLength(1);
    expect(await findFrequencyByResource(LANG, resourceId)).toHaveLength(1);
  });

  it('drops a table the user deselected', async () => {
    setupSqlJsMock({
      tables: ['langResourceEntry', 'langFrequencyEntry'],
      dictRows: [['hello', 'hello', 'a greeting']],
      freqRows: [['hello', 'hello', 100]],
    });

    const resourceId = await addResource(LANG, {
      name: 'mixed.db', langCode: LANG, type: 'DICTIONARY', format: 'sqlite',
      signature: 'sig-m2', wordCount: 0, installationFinished: false, importedAt: Date.now(),
    });
    const strategy = new SqliteStrategy(
      { resourceId, langCode: LANG, components: ['definitions'] },
      { data: makeSqliteHeader(), fileName: 'mixed.db' },
    );
    const result = await strategy.execute();
    expect(result.wordCount).toBe(1);
    expect(await findDictionaryByResource(LANG, resourceId)).toHaveLength(1);
    expect(await findFrequencyByResource(LANG, resourceId)).toHaveLength(0);
  });

  it('throws ParseError if no langResourceEntry table', async () => {
    setupSqlJsMock({ tables: [] });

    const strategy = new SqliteStrategy(
      { resourceId: 1, langCode: LANG },
      { data: makeSqliteHeader(), fileName: 'Wordset.db' },
    );
    await expect(strategy.execute()).rejects.toThrow(ParseError);
  });
});
