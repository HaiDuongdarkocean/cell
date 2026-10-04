import 'fake-indexeddb/auto';
import type { ResourceInfo } from '@/entities/dictionary';
import {
  STORES,
  clearAllStores,
  closeAllDBs,
  getDB,
  getDbName,
} from '../repositories/baseRepository';
import { addResource } from '../repositories/resourceRepository';
import { bulkInsertDictionaryEntries } from '../repositories/resourceEntryRepository';
import { createDictBlobReader } from './dictBlobReader';
import { blobToBytes } from '@/features/sync';
import { gunzipFile, isGzip } from '../logic/fileDetector';
import {
  deserializeResourcePortable,
  ensureResourceContentHash,
  serializeResourcePortable,
  sha256Hex,
} from './resourceIdentity';

const LANG = 'en';

const makeResource = (signature: string, contentHash: string): Omit<ResourceInfo, 'id'> => ({
  name: `Resource ${signature}`,
  langCode: LANG,
  type: 'DICTIONARY',
  format: 'json-entries',
  signature,
  contentHash,
  wordCount: 0,
  installationFinished: true,
  importedAt: 1,
  enabled: true,
  priority: 5,
});

const makeEntry = (resourceId: number, term: string) => ({
  resourceId,
  term,
  reading: term,
  altterm: '',
  pronunciation: '',
  definition: `def ${term}`,
  pos: '',
  examples: '',
  audio: '',
});

beforeEach(async () => {
  closeAllDBs();
  await clearAllStores(LANG);
});

afterEach(() => {
  closeAllDBs();
});

afterAll(async () => {
  const dbName = await getDbName(LANG);
  closeAllDBs();
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(dbName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
});

describe('dictBlobReader', () => {
  it('returns null when no resource matches the content hash', async () => {
    const reader = createDictBlobReader(async () => [LANG]);
    expect(await reader.read('missing-hash')).toBeNull();
  });

  it('returns null when the lang code list is empty', async () => {
    const reader = createDictBlobReader(async () => []);
    expect(await reader.read('h1')).toBeNull();
  });

  it('serializes the resource content as a gzipped portable blob', async () => {
    const resourceId = await addResource(LANG, makeResource('sig-a', 'hash-a'));
    await bulkInsertDictionaryEntries(LANG, [
      makeEntry(resourceId, 'apple'),
      makeEntry(resourceId, 'berry'),
    ]);
    const reader = createDictBlobReader(async () => [LANG]);
    const blob = await reader.read('hash-a');
    expect(blob).not.toBeNull();
    const bytes = await blobToBytes(blob!);
    expect(isGzip(bytes)).toBe(true);
    const raw = gunzipFile(bytes);
    const { dictRows, freqRows } = deserializeResourcePortable(raw);
    expect(freqRows).toEqual([]);
    expect(dictRows.map((r) => r['term']).sort()).toEqual(['apple', 'berry']);
    const db = await getDB(LANG);
    const tx = db.transaction([STORES.ENTRY], 'readonly');
    const stored = (await new Promise<Record<string, unknown>[]>((resolve, reject) => {
      const req = tx.objectStore(STORES.ENTRY).getAll();
      req.onsuccess = () => resolve(req.result as Record<string, unknown>[]);
      req.onerror = () => reject(req.error);
    }));
    const expected = serializeResourcePortable(stored, []);
    expect([...raw]).toEqual([...expected]);
  });

  it('is byte-deterministic across reads of the same resource', async () => {
    const resourceId = await addResource(LANG, makeResource('sig-det', 'hash-det'));
    await bulkInsertDictionaryEntries(LANG, [
      makeEntry(resourceId, 'one'),
      makeEntry(resourceId, 'two'),
    ]);
    const reader = createDictBlobReader(async () => [LANG]);
    const first = await blobToBytes((await reader.read('hash-det'))!);
    const second = await blobToBytes((await reader.read('hash-det'))!);
    expect([...first]).toEqual([...second]);
  });

  it('compresses repeated-key content well below raw size', async () => {
    const resourceId = await addResource(LANG, makeResource('sig-c', 'hash-c'));
    const entries = Array.from({ length: 200 }, (_, i) => ({
      ...makeEntry(resourceId, `term-${i}`),
      definition: `definition text for term ${i} with common shared vocabulary words`,
    }));
    await bulkInsertDictionaryEntries(LANG, entries);
    const reader = createDictBlobReader(async () => [LANG]);
    const bytes = await blobToBytes((await reader.read('hash-c'))!);
    const raw = gunzipFile(bytes);
    expect(bytes.byteLength).toBeLessThan(raw.byteLength * 0.5);
  });

  it('keeps contentHash as sha256 of the raw portable bytes', async () => {
    const resourceId = await addResource(LANG, {
      ...makeResource('sig-pin', 'sig-pin'),
      contentHash: undefined,
    });
    await bulkInsertDictionaryEntries(LANG, [makeEntry(resourceId, 'pinned')]);
    const db = await getDB(LANG);
    const resource = (await ensureResourceContentHash(db, {
      ...(makeResource('sig-pin', 'sig-pin') as ResourceInfo),
      id: resourceId,
      contentHash: undefined,
    })) as ResourceInfo;
    expect(resource.contentHash).toBeDefined();
    const reader = createDictBlobReader(async () => [LANG]);
    const bytes = await blobToBytes((await reader.read(resource.contentHash!))!);
    expect(await sha256Hex(gunzipFile(bytes))).toBe(resource.contentHash);
  });

  it('skips languages without a match and reads later ones', async () => {
    const resourceId = await addResource(LANG, makeResource('sig-b', 'hash-b'));
    await bulkInsertDictionaryEntries(LANG, [makeEntry(resourceId, 'cat')]);
    const reader = createDictBlobReader(async () => ['ja', LANG]);
    const blob = await reader.read('hash-b');
    expect(blob).not.toBeNull();
  });
});
