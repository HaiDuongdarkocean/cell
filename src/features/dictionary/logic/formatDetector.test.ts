import { detectFormat } from '@/features/dictionary/logic/formatDetector';
import { gzipSync, zipSync, strToU8 } from 'fflate';

function makeSqliteHead(): Uint8Array {
  const magic = [0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x46, 0x6f, 0x72, 0x6d, 0x61, 0x74, 0x20, 0x31, 0x20, 0x00];
  const bytes = new Uint8Array(1024);
  bytes.set(magic, 0);
  return bytes;
}

describe('formatDetector', () => {
  it('detects sqlite from .db.gz (gzip + sqlite magic)', async () => {
    const head = gzipSync(makeSqliteHead());
    await expect(detectFormat('freq.db.gz', head)).resolves.toBe('sqlite');
  });

  it('detects sqlite from raw .db', async () => {
    await expect(detectFormat('freq.db', makeSqliteHead())).resolves.toBe('sqlite');
  });

  it('detects yomitan from zip with index.json + term_meta_bank', async () => {
    const zipped = zipSync({
      'index.json': strToU8('{"title":"test","format":3}'),
      'term_meta_bank_1.json': strToU8('[]'),
    });
    await expect(detectFormat('dict.zip', zipped)).resolves.toBe('yomitan');
  });

  it('detects txt from zip containing .txt', async () => {
    const zipped = zipSync({ 'words.txt': strToU8('hello\nworld\n') });
    await expect(detectFormat('words.zip', zipped)).resolves.toBe('txt');
  });

  it('detects cambridge-json from zip with JSON array of {term, definition}', async () => {
    const cambridge = JSON.stringify([{ term: 'hello', definition: 'greeting' }]);
    const zipped = zipSync({ 'cambridge.json': strToU8(cambridge) });
    await expect(detectFormat('cambridge.zip', zipped)).resolves.toBe('cambridge-json');
  });

  it('detects json-array from zip with JSON array of strings', async () => {
    const arr = JSON.stringify(['hello', 'world']);
    const zipped = zipSync({ 'freq.json': strToU8(arr) });
    await expect(detectFormat('freq.zip', zipped)).resolves.toBe('json-array');
  });

  it('detects txt from .txt extension', async () => {
    const head = strToU8('hello\nworld\n');
    await expect(detectFormat('words.txt', head)).resolves.toBe('txt');
  });

  it('detects json-array from .json with array of strings', async () => {
    const head = strToU8('["hello", "world"]');
    await expect(detectFormat('freq.json', head)).resolves.toBe('json-array');
  });

  it('detects cambridge-json from .json with array of {term, definition}', async () => {
    const head = strToU8(JSON.stringify([{ term: 'hello', definition: 'greeting' }]));
    await expect(detectFormat('cambridge.json', head)).resolves.toBe('cambridge-json');
  });

  it('detects json-array for empty JSON array', async () => {
    const head = strToU8('[]');
    await expect(detectFormat('empty.json', head)).resolves.toBe('json-array');
  });

  it('throws for undetectable format', async () => {
    const head = strToU8('random binary data \x00\x01\x02');
    await expect(detectFormat('file.xyz', head)).rejects.toThrow(/Could not detect/);
  });

  it('falls back to yomitan for zip with no recognizable content', async () => {
    const zipped = zipSync({ 'unknown.dat': strToU8('binary') });
    await expect(detectFormat('unknown.zip', zipped)).resolves.toBe('yomitan');
  });
});
