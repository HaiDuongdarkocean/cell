import 'fake-indexeddb/auto';
import {
  bulkInsertDictionaryEntries,
  bulkInsertFrequencyEntries,
  findDictionaryByResource,
  findDictionaryByTerm,
  findDictionaryByTerms,
  findDictionaryByPrefix,
  findDictionaryBySuffix,
  findDictionaryTermsByResource,
  findDictionaryEntry,
  findFrequencyByTerms,
  findFrequencyByPrefix,
  findFrequencyBySuffix,
  findFrequencyByResource,
  findFrequencyEntry,
  sampleDictionaryEntries,
  sampleFrequencyEntries,
  countDictionaryByResource,
  countFrequencyByResource,
  countEntriesByResource,
  deleteEntriesByResource,
} from '@/features/dictionary/repositories/resourceEntryRepository';
import {
  compileEntryBlob,
  clearEntryChunkCache,
  getEntryBlobMetas,
} from '@/features/dictionary/repositories/entryBlobStore';
import { closeAllDBs, clearAllStores } from '@/features/dictionary/repositories/baseRepository';

const storageLocalGetMock = jest.fn<Promise<Record<string, unknown>>, [string | string[] | null]>();

beforeAll(() => {
  global.chrome = {
    storage: {
      local: {
        get: storageLocalGetMock as unknown as typeof chrome.storage.local.get,
        set: jest.fn(),
      },
    },
  } as unknown as typeof chrome;
});

beforeEach(() => {
  storageLocalGetMock.mockReset();
  storageLocalGetMock.mockResolvedValue({});
  closeAllDBs();
  clearEntryChunkCache();
});

beforeEach(async () => {
  await clearAllStores(LANG);
});

afterEach(() => {
  closeAllDBs();
  clearEntryChunkCache();
});

afterAll(() => {
  delete (global as { chrome?: unknown }).chrome;
});

const LANG = 'en';
const RID = 1;
const RID2 = 2;

function makeDictEntry(term: string, resourceId = RID) {
  return {
    resourceId,
    term,
    reading: term,
    altterm: '',
    pronunciation: '',
    definition: `meaning of ${term}`,
    pos: 'noun',
    examples: '',
    audio: '',
  };
}

function makeFreqEntry(term: string, frequency: number, resourceId = RID) {
  return { resourceId, term, reading: term, frequency };
}

/** Wire equality ignoring the `id` field — blob entries carry no id. */
const stripId = <T extends { id?: number }>(e: T): Omit<T, 'id'> => {
  const { id: _id, ...rest } = e;
  return rest;
};
const stripIds = <T extends { id?: number }>(list: T[]) => list.map(stripId);

async function seedRows() {
  const dicts = ['apple', 'apply', 'banana', 'band', 'present', 'at present'].map((t) => makeDictEntry(t));
  dicts.push(makeDictEntry('apple', RID2), makeDictEntry('zebra', RID2));
  await bulkInsertDictionaryEntries(LANG, dicts);
  await bulkInsertFrequencyEntries(LANG, [
    makeFreqEntry('apple', 10),
    makeFreqEntry('banana', 20),
    makeFreqEntry('apple', 5, RID2),
  ]);
}

describe('entryBlobStore — compile + parity with row path', () => {
  it('produces a meta record and removes staged rows', async () => {
    await seedRows();
    await compileEntryBlob(LANG, RID);
    const metas = await getEntryBlobMetas(LANG);
    expect(metas.has(RID)).toBe(true);
    expect(metas.get(RID)!.dictCount).toBe(6);
    expect(metas.get(RID)!.freqCount).toBe(2);
    // Staged rows for RID are gone; RID2 rows remain row-backed
    const dictRows = await findDictionaryByResource(LANG, RID);
    expect(dictRows.length).toBe(6);
  });

  it('findDictionaryByTerm matches row results after compile', async () => {
    await seedRows();
    const before = await findDictionaryByTerm(LANG, 'apple');
    await compileEntryBlob(LANG, RID);
    await compileEntryBlob(LANG, RID2);
    const after = await findDictionaryByTerm(LANG, 'apple');
    expect(stripIds(after)).toEqual(expect.arrayContaining(stripIds(before)));
    expect(after.length).toBe(before.length);
  });

  it('findDictionaryByResource returns identical entries', async () => {
    await seedRows();
    const before = await findDictionaryByResource(LANG, RID);
    await compileEntryBlob(LANG, RID);
    const after = await findDictionaryByResource(LANG, RID);
    const byTerm = (a: { term: string }, b: { term: string }) => a.term.localeCompare(b.term);
    expect(stripIds(after).sort(byTerm)).toEqual(stripIds(before).sort(byTerm));
  });

  it('findDictionaryTermsByResource returns the same term set', async () => {
    await seedRows();
    const before = await findDictionaryTermsByResource(LANG, RID);
    await compileEntryBlob(LANG, RID);
    const after = await findDictionaryTermsByResource(LANG, RID);
    expect(after.sort()).toEqual(before.sort());
  });

  it('prefix and suffix search match row results', async () => {
    await seedRows();
    const preBefore = await findDictionaryByPrefix(LANG, 'app');
    const sufBefore = await findDictionaryBySuffix(LANG, 'ing'.length ? 'and' : 'x');
    await compileEntryBlob(LANG, RID);
    const preAfter = await findDictionaryByPrefix(LANG, 'app');
    const sufAfter = await findDictionaryBySuffix(LANG, 'and');
    const byRid = (a: { resourceId: number; term: string }, b: { resourceId: number; term: string }) =>
      a.term.localeCompare(b.term) || a.resourceId - b.resourceId;
    expect(stripIds(preAfter).sort(byRid)).toEqual(stripIds(preBefore).sort(byRid));
    expect(sufAfter.map((e) => e.term).sort()).toEqual(sufBefore.map((e) => e.term).sort());
  });

  it('findDictionaryByTerms / findFrequencyByTerms merge blob + row', async () => {
    await seedRows();
    await compileEntryBlob(LANG, RID); // RID blobbed, RID2 row-backed
    const dictMap = await findDictionaryByTerms(LANG, ['apple', 'zebra']);
    expect(dictMap.get('apple')!.length).toBe(2); // one blob, one row
    expect(dictMap.get('zebra')!.length).toBe(1);
    const freqMap = await findFrequencyByTerms(LANG, ['apple']);
    expect(freqMap.get('apple')!.length).toBe(2);
    // resourceIds filter applies to blob path too
    const filtered = await findDictionaryByTerms(LANG, ['apple', 'zebra'], new Set([RID2]));
    expect(filtered.get('apple')!.length).toBe(1);
    expect(filtered.get('apple')![0]!.resourceId).toBe(RID2);
  });

  it('single-resource lookups: findEntry + counts + samples', async () => {
    await seedRows();
    await compileEntryBlob(LANG, RID);
    const e = await findDictionaryEntry(LANG, RID, 'banana');
    expect(e?.term).toBe('banana');
    const f = await findFrequencyEntry(LANG, RID, 'apple');
    expect(f?.frequency).toBe(10);
    expect(await countDictionaryByResource(LANG, RID)).toBe(6);
    expect(await countFrequencyByResource(LANG, RID)).toBe(2);
    expect(await countEntriesByResource(LANG, RID)).toBe(8);
    const s = await sampleDictionaryEntries(LANG, RID, 2);
    expect(s.length).toBe(2);
    const fs = await sampleFrequencyEntries(LANG, RID, 1);
    expect(fs.length).toBe(1);
    expect((await findFrequencyByResource(LANG, RID)).length).toBe(2);
    // 'app' prefix → blob 'apple' (RID) + row 'apple' (RID2)
    expect((await findFrequencyByPrefix(LANG, 'app')).length).toBe(2);
    // suffix 'e' → same two rows
    expect((await findFrequencyBySuffix(LANG, 'e')).length).toBe(2);
  });

  it('deleteEntriesByResource clears blob artifacts and restores row-only state', async () => {
    await seedRows();
    await compileEntryBlob(LANG, RID);
    await deleteEntriesByResource(LANG, RID);
    const metas = await getEntryBlobMetas(LANG);
    expect(metas.has(RID)).toBe(false);
    expect((await findDictionaryByTerm(LANG, 'apple')).map((e) => e.resourceId)).toEqual([RID2]);
    expect(await countEntriesByResource(LANG, RID)).toBe(0);
  });

  it('mixed state: blob resource + legacy row resource coexist', async () => {
    await seedRows();
    await compileEntryBlob(LANG, RID);
    const terms = await findDictionaryByTerm(LANG, 'zebra'); // only RID2 has it
    expect(terms.length).toBe(1);
    expect(terms[0]!.resourceId).toBe(RID2);
  });

  it('duplicate terms straddling a chunk boundary are all returned', async () => {
    const dicts = [makeDictEntry('aaa')];
    for (let i = 0; i < 300; i++) dicts.push(makeDictEntry('same'));
    dicts.push(makeDictEntry('zzz'));
    await bulkInsertDictionaryEntries(LANG, dicts);
    await compileEntryBlob(LANG, RID);
    const same = await findDictionaryByTerm(LANG, 'same');
    expect(same.length).toBe(300);
    expect((await findDictionaryEntry(LANG, RID, 'same'))?.term).toBe('same');
    const map = await findDictionaryByTerms(LANG, ['same', 'aaa', 'zzz']);
    expect(map.get('same')!.length).toBe(300);
    expect(map.get('aaa')!.length).toBe(1);
    expect(map.get('zzz')!.length).toBe(1);
    expect((await findDictionaryByPrefix(LANG, 'sam')).length).toBe(300);
    expect((await findDictionaryBySuffix(LANG, 'same')).length).toBe(300);
  }, 30000);

  it('compile crosses the read page boundary without skipping or duplicating', async () => {
    const dicts = [];
    const seedTerms = [];
    for (let i = 0; i < 5000; i++) {
      const t = `term${String(i).padStart(5, '0')}`;
      dicts.push(makeDictEntry(t));
      seedTerms.push(t);
    }
    await bulkInsertDictionaryEntries(LANG, dicts);
    await compileEntryBlob(LANG, RID);
    const after = await findDictionaryTermsByResource(LANG, RID);
    expect(after.sort()).toEqual(seedTerms.slice().sort());
    expect(await countDictionaryByResource(LANG, RID)).toBe(5000);
    const hit = await findDictionaryByTerm(LANG, 'term04096');
    expect(hit.length).toBe(1);
  }, 240000);
});
