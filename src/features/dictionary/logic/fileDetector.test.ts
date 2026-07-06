import {
  validateFile,
  formatBytes,
  readMagicBytes,
  isGzip,
  isZip,
  isSqlite,
  gunzipFile,
  unzipAll,
  listZipEntries,
  extractZipFile,
  decodeText,
  getExtension,
  stripExtension,
  CorruptedFileError,
  MAX_FILE_SIZE,
  detectByExtension,
} from '@/features/dictionary/logic/fileDetector';
import { gzipSync, zipSync, strToU8 } from 'fflate';

function makeBytes(...bytes: number[]): Uint8Array {
  return new Uint8Array(bytes);
}

describe('fileDetector', () => {
  describe('validateFile', () => {
    it('passes when size ≤ 500MB', () => {
      expect(() => validateFile({ size: 100, name: 'a.txt' })).not.toThrow();
      expect(() => validateFile({ size: MAX_FILE_SIZE, name: 'a.txt' })).not.toThrow();
    });
    it('throws RangeError when size > 500MB', () => {
      expect(() => validateFile({ size: MAX_FILE_SIZE + 1, name: 'big.txt' })).toThrow(RangeError);
      expect(() => validateFile({ size: MAX_FILE_SIZE + 1, name: 'big.txt' })).toThrow(/500MB/);
    });
  });

  describe('formatBytes', () => {
    it('formats B', () => expect(formatBytes(500)).toBe('500B'));
    it('formats KB', () => expect(formatBytes(2048)).toBe('2.0KB'));
    it('formats MB', () => expect(formatBytes(5 * 1024 * 1024)).toBe('5.0MB'));
    it('formats GB', () => expect(formatBytes(2 * 1024 * 1024 * 1024)).toBe('2.0GB'));
  });

  describe('readMagicBytes', () => {
    it('reads first N bytes', () => {
      expect(readMagicBytes(makeBytes(0x1f, 0x8b, 0x08, 0x00), 2)).toEqual([0x1f, 0x8b]);
    });
    it('reads fewer if data shorter than count', () => {
      expect(readMagicBytes(makeBytes(0x1f), 4)).toEqual([0x1f]);
    });
    it('returns empty for empty data', () => {
      expect(readMagicBytes(new Uint8Array(0), 4)).toEqual([]);
    });
  });

  describe('isGzip', () => {
    it('detects gzip magic 1F 8B', () => {
      expect(isGzip(makeBytes(0x1f, 0x8b, 0x08))).toBe(true);
    });
    it('rejects non-gzip', () => {
      expect(isGzip(makeBytes(0x50, 0x4b))).toBe(false);
      expect(isGzip(makeBytes(0x00, 0x00))).toBe(false);
    });
    it('rejects too-short data', () => {
      expect(isGzip(makeBytes(0x1f))).toBe(false);
    });
  });

  describe('isZip', () => {
    it('detects zip magic PK\x03\x04', () => {
      expect(isZip(makeBytes(0x50, 0x4b, 0x03, 0x04))).toBe(true);
    });
    it('detects empty zip PK\x05\x06', () => {
      expect(isZip(makeBytes(0x50, 0x4b, 0x05, 0x06))).toBe(true);
    });
    it('detects spanned zip PK\x07\x08', () => {
      expect(isZip(makeBytes(0x50, 0x4b, 0x07, 0x08))).toBe(true);
    });
    it('rejects non-zip', () => {
      expect(isZip(makeBytes(0x1f, 0x8b))).toBe(false);
    });
  });

  describe('isSqlite', () => {
    it('detects SQLite magic "SQLite format 3\\0"', () => {
      // Real SQLite file header: "SQLite format 3\0" (16 bytes).
      const magic = [0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x20, 0x66, 0x6f, 0x72, 0x6d, 0x61, 0x74, 0x20, 0x33, 0x00];
      expect(isSqlite(makeBytes(...magic))).toBe(true);
    });
    it('rejects non-sqlite', () => {
      expect(isSqlite(makeBytes(0x50, 0x4b))).toBe(false);
    });
  });

  describe('gunzipFile', () => {
    it('gunzips valid gzip data', () => {
      const original = strToU8('hello world');
      const compressed = gzipSync(original);
      const result = gunzipFile(compressed);
      expect(decodeText(result)).toBe('hello world');
    });
    it('throws if not gzip', () => {
      expect(() => gunzipFile(makeBytes(0x50, 0x4b))).toThrow(/Not a gzip/);
    });
    it('throws CorruptedFileError on corrupt gzip', () => {
      const bad = makeBytes(0x1f, 0x8b, 0x08, 0x00, 0xff, 0xff);
      expect(() => gunzipFile(bad)).toThrow(CorruptedFileError);
    });
  });

  describe('unzipAll', () => {
    it('unzips valid zip', () => {
      const files = { 'a.txt': strToU8('hello'), 'b.txt': strToU8('world') };
      const zipped = zipSync(files);
      const result = unzipAll(zipped);
      expect(Object.keys(result).sort()).toEqual(['a.txt', 'b.txt']);
      expect(decodeText(result['a.txt']!)).toBe('hello');
    });
    it('throws if not zip', () => {
      expect(() => unzipAll(makeBytes(0x1f, 0x8b))).toThrow(/Not a zip/);
    });
    it('throws CorruptedFileError on corrupt zip', () => {
      const bad = makeBytes(0x50, 0x4b, 0x03, 0x04, 0xff, 0xff);
      expect(() => unzipAll(bad)).toThrow(CorruptedFileError);
    });
  });

  describe('listZipEntries', () => {
    it('lists entry paths', () => {
      const zipped = zipSync({ 'index.json': strToU8('{}'), 'data.txt': strToU8('x') });
      expect(listZipEntries(zipped).sort()).toEqual(['data.txt', 'index.json']);
    });
  });

  describe('extractZipFile', () => {
    it('extracts a single file by path', () => {
      const zipped = zipSync({ 'a.txt': strToU8('hello') });
      const file = extractZipFile(zipped, 'a.txt');
      expect(decodeText(file)).toBe('hello');
    });
    it('throws if path not found', () => {
      const zipped = zipSync({ 'a.txt': strToU8('hello') });
      expect(() => extractZipFile(zipped, 'missing.txt')).toThrow(/not found/);
    });
  });

  describe('decodeText', () => {
    it('decodes UTF-8', () => {
      expect(decodeText(strToU8('héllo wörld'))).toBe('héllo wörld');
    });
  });

  describe('getExtension', () => {
    it('returns lowercase extension', () => {
      expect(getExtension('file.TXT')).toBe('txt');
      expect(getExtension('archive.db.gz')).toBe('gz');
      expect(getExtension('noext')).toBe('');
      expect(getExtension('trailing.')).toBe('');
    });
  });

  describe('stripExtension', () => {
    it('removes last extension', () => {
      expect(stripExtension('file.txt')).toBe('file');
      expect(stripExtension('archive.db.gz')).toBe('archive.db');
      expect(stripExtension('noext')).toBe('noext');
    });
  });

  describe('detectByExtension', () => {
    it('detects .txt', () => expect(detectByExtension('list.txt')).toBe('txt'));
    it('detects .json', () => expect(detectByExtension('data.json')).toBe('json-array'));
    it('detects .zip as yomitan (fallback)', () => expect(detectByExtension('dict.zip')).toBe('yomitan'));
    it('detects .db as sqlite', () => expect(detectByExtension('freq.db')).toBe('sqlite'));
    it('detects .db.gz as sqlite', () => expect(detectByExtension('freq.db.gz')).toBe('sqlite'));
    it('returns null for unknown', () => expect(detectByExtension('file.xyz')).toBeNull());
  });

  describe('CorruptedFileError', () => {
    it('has correct name + cause', () => {
      const cause = new Error('inner');
      const err = new CorruptedFileError('outer', cause);
      expect(err.name).toBe('CorruptedFileError');
      expect(err.message).toBe('outer');
      expect(err.cause).toBe(cause);
    });
  });
});
