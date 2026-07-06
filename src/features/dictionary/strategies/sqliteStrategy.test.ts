import 'fake-indexeddb/auto';
import { SqliteStrategy } from '@/features/dictionary/strategies/sqliteStrategy';
import { DatabaseError, ParseError } from '@/features/dictionary/logic/importErrors';
import { gzipSync, strToU8 } from 'fflate';

// Mock sql.js module — returns mock Database with configurable exec()
jest.mock('sql.js', () => {
  const mockExec = jest.fn();
  const mockClose = jest.fn();
  const mockDatabase = jest.fn().mockImplementation(() => ({
    exec: mockExec,
    close: mockClose,
  }));
  return {
    __esModule: true,
    default: jest.fn().mockResolvedValue({ Database: mockDatabase }),
    Database: mockDatabase,
  };
});

function makeSqliteHeader(): Uint8Array {
  // Real SQLite file header: "SQLite format 3\0" (16 bytes).
  const magic = [0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x20, 0x66, 0x6f, 0x72, 0x6d, 0x61, 0x74, 0x20, 0x33, 0x00];
  const bytes = new Uint8Array(1024);
  bytes.set(magic, 0);
  return bytes;
}

function setupSqlJsMock(execReturnValue: unknown[]): void {
   
  const sqlJs = require('sql.js');
  sqlJs.default.mockResolvedValue({
    Database: jest.fn().mockImplementation(() => ({
      exec: jest.fn().mockReturnValue(execReturnValue),
      close: jest.fn(),
    })),
  });
}

describe('sqliteStrategy — frequency (langFrequencyEntry)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('parses Migaku langFrequencyEntry table', async () => {
    setupSqlJsMock([
      {
        columns: ['term', 'reading', 'frequency'],
        values: [
          ['hello', 'hello', 100],
          ['world', 'world', 50],
        ],
      },
    ]);

    const data = makeSqliteHeader();
    const strategy = new SqliteStrategy(
      { resourceId: 1, langCode: 'en' },
      { data, fileName: 'freq.db', resourceType: 'FREQUENCY' },
    );
    const result = await strategy.execute();
    expect(result.wordCount).toBe(2);
    expect(result.format).toBe('sqlite');
  });

  it('falls back to legacy entries table if langFrequencyEntry missing', async () => {
    // First exec (langFrequencyEntry) throws, second (entries) returns data
    const exec = jest.fn()
      .mockImplementationOnce(() => { throw new Error('no such table'); })
      .mockReturnValueOnce([{
        columns: ['term', 'reading', 'frequency'],
        values: [['hello', 'hello', 1]],
      }]);
     
    const sqlJs = require('sql.js');
    sqlJs.default.mockResolvedValue({
      Database: jest.fn().mockImplementation(() => ({
        exec,
        close: jest.fn(),
      })),
    });

    const data = makeSqliteHeader();
    const strategy = new SqliteStrategy(
      { resourceId: 1, langCode: 'en' },
      { data, fileName: 'freq.db', resourceType: 'FREQUENCY' },
    );
    const result = await strategy.execute();
    expect(result.wordCount).toBe(1);
  });

  it('throws ParseError if not SQLite (no magic bytes)', async () => {
    const data = strToU8('not a sqlite file');
    const strategy = new SqliteStrategy(
      { resourceId: 1, langCode: 'en' },
      { data, fileName: 'freq.db', resourceType: 'FREQUENCY' },
    );
    await expect(strategy.execute()).rejects.toThrow(ParseError);
  });

  it('gunzips .db.gz before parsing', async () => {
    setupSqlJsMock([
      { columns: ['term', 'reading', 'frequency'], values: [['hello', 'hello', 1]] },
    ]);

    const sqliteData = makeSqliteHeader();
    const gzipped = gzipSync(sqliteData);
    const strategy = new SqliteStrategy(
      { resourceId: 1, langCode: 'en' },
      { data: gzipped, fileName: 'freq.db.gz', resourceType: 'FREQUENCY' },
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
      { resourceId: 1, langCode: 'en' },
      { data: bad, fileName: 'freq.db.gz', resourceType: 'FREQUENCY' },
    );
    await expect(strategy.execute()).rejects.toThrow(DatabaseError);
  });
});

describe('sqliteStrategy — dictionary (langResourceEntry)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('parses Migaku langResourceEntry table', async () => {
    setupSqlJsMock([
      {
        columns: ['term', 'reading', 'definition'],
        values: [
          ['hello', 'hello', 'a greeting'],
          ['world', 'world', 'the earth'],
        ],
      },
    ]);

    const data = makeSqliteHeader();
    const strategy = new SqliteStrategy(
      { resourceId: 1, langCode: 'en' },
      { data, fileName: 'Wordset.db', resourceType: 'DICTIONARY' },
    );
    const result = await strategy.execute();
    expect(result.wordCount).toBe(2);
    expect(result.format).toBe('sqlite');
  });

  it('throws ParseError if no langResourceEntry table', async () => {
    const exec = jest.fn().mockImplementation(() => {
      throw new Error('no such table: langResourceEntry');
    });
     
    const sqlJs = require('sql.js');
    sqlJs.default.mockResolvedValue({
      Database: jest.fn().mockImplementation(() => ({
        exec,
        close: jest.fn(),
      })),
    });

    const data = makeSqliteHeader();
    const strategy = new SqliteStrategy(
      { resourceId: 1, langCode: 'en' },
      { data, fileName: 'Wordset.db', resourceType: 'DICTIONARY' },
    );
    await expect(strategy.execute()).rejects.toThrow(ParseError);
  });
});
