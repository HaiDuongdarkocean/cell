import 'fake-indexeddb/auto';
import type { ResourceInfo } from '@/entities/dictionary';
import type { ChangeRecord, Hlc } from '@/features/sync';
import {
  clearOpaqueRecords,
  configureSyncRuntime,
  deleteSyncDB,
  getAllOpaqueRecords,
  resetSyncRuntime,
} from '@/features/sync';
import {
  addResource,
  deleteResource,
  findResourceBySignature,
  getResource,
  updateResource,
} from '../repositories/resourceRepository';
import {
  STORES,
  clearAllStores,
  closeAllDBs,
  getDB,
  getDbName,
} from '../repositories/baseRepository';
import { findDictionaryByResource } from '../repositories/dictionaryRepository';
import { getWordStatus, setWordStatus } from '../services/wordStatusStore';
import { createDictLocalSource } from './dictLocalSource';
import { serializeResourcePortable } from './resourceIdentity';

const LANG = 'en';
const SCOPE = 'profile:en' as const;

const storageLocalGetMock = jest.fn<Promise<Record<string, unknown>>, [string | string[] | null]>();

interface OutboxRow {
  scope: string;
  dataClass: string;
  key: string;
  op: string;
}

function reqToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function allOutbox(): Promise<OutboxRow[]> {
  const db = await getDB(LANG);
  const tx = db.transaction(STORES.SYNC_OUTBOX, 'readonly');
  return (await reqToPromise(tx.objectStore(STORES.SYNC_OUTBOX).getAll())) as OutboxRow[];
}

const farFuture = (): Hlc => ({ wall: Date.now() + 1_000_000, counter: 0, node: 'devB' });
const farPast = (): Hlc => ({ wall: 1, counter: 0, node: 'devB' });

const makeResource = (signature: string): Omit<ResourceInfo, 'id'> => ({
  name: `Resource ${signature}`,
  langCode: LANG,
  type: 'DICTIONARY',
  format: 'json-entries',
  signature,
  wordCount: 10,
  installationFinished: true,
  importedAt: 1,
  enabled: true,
  priority: 5,
});

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

beforeEach(async () => {
  storageLocalGetMock.mockReset();
  storageLocalGetMock.mockResolvedValue({});
  resetSyncRuntime();
  closeAllDBs();
  await clearAllStores(LANG);
  await clearOpaqueRecords();
  configureSyncRuntime({ enabled: true, deviceId: 'devA', lastWall: 1 });
});

afterEach(() => {
  resetSyncRuntime();
  closeAllDBs();
});

afterAll(async () => {
  delete (global as { chrome?: unknown }).chrome;
  const dbName = await getDbName(LANG);
  closeAllDBs();
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(dbName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
  await deleteSyncDB();
});

describe('dictLocalSource — dictResource', () => {
  it('expands an entity pending key into entity + leaf records', async () => {
    const source = createDictLocalSource(LANG, 'dictResource');
    await addResource(LANG, makeResource('sig-1'));

    const pending = await source.pending(10);
    expect(pending).toEqual([
      { scope: SCOPE, dataClass: 'dictResource', key: 'resource:sig-1', op: 'put' },
      {
        scope: SCOPE,
        dataClass: 'dictResource',
        key: 'resource:sig-1/disabledComponents',
        op: 'delete',
      },
      { scope: SCOPE, dataClass: 'dictResource', key: 'resource:sig-1/enabled', op: 'put' },
      { scope: SCOPE, dataClass: 'dictResource', key: 'resource:sig-1/name', op: 'put' },
      { scope: SCOPE, dataClass: 'dictResource', key: 'resource:sig-1/priority', op: 'put' },
    ]);

    const records = await source.resolve(pending);
    const ch = (await findResourceBySignature(LANG, 'sig-1'))!.contentHash!;
    expect(typeof ch).toBe('string');
    const keys = records.map((record) => record.key).sort();
    expect(keys).toEqual([
      `resource:${ch}`,
      `resource:${ch}/disabledComponents`,
      `resource:${ch}/enabled`,
      `resource:${ch}/name`,
      `resource:${ch}/priority`,
    ]);
    const entity = records.find((record) => record.key === `resource:${ch}`);
    expect(entity?.op).toBe('put');
    expect((entity?.value as Record<string, unknown>).id).toBeUndefined();
    expect(records.find((r) => r.key === `resource:${ch}/name`)?.value).toBe('Resource sig-1');

    await source.ack(pending);
    expect((await allOutbox()).filter((row) => row.key.startsWith('resource:'))).toEqual([]);
  });

  it('materializes a field-key pending into a field record', async () => {
    const source = createDictLocalSource(LANG, 'dictResource');
    const id = await addResource(LANG, makeResource('sig-2'));
    const stored = await getResource(LANG, id);
    await updateResource(LANG, { ...stored!, name: 'Renamed' });

    const pending = await source.pending(10);
    const fieldPending = pending.filter((key) => key.key === 'resource:sig-2/name');
    expect(fieldPending).toHaveLength(1);

    const records = await source.resolve(fieldPending);
    const ch = (await findResourceBySignature(LANG, 'sig-2'))!.contentHash!;
    expect(records).toEqual([
      expect.objectContaining({
        key: `resource:${ch}/name`,
        op: 'put',
        value: 'Renamed',
      }),
    ]);
  });

  it('resolves a resource delete as a tombstone', async () => {
    const source = createDictLocalSource(LANG, 'dictResource');
    const id = await addResource(LANG, makeResource('sig-3'));
    await deleteResource(LANG, id);

    const pending = await source.pending(10);
    const tombstone = pending.find((key) => key.key === 'resource:sig-3' && key.op === 'delete');
    expect(tombstone).toBeDefined();
    const records = await source.resolve([tombstone!]);
    expect(records).toEqual([expect.objectContaining({ key: 'resource:sig-3', op: 'delete' })]);
  });

  it('applies a newer remote field put, preserving unrelated fields', async () => {
    const source = createDictLocalSource(LANG, 'dictResource');
    const id = await addResource(LANG, makeResource('sig-4'));
    const before = (await allOutbox()).length;

    const remote: ChangeRecord = {
      scope: SCOPE,
      dataClass: 'dictResource',
      key: 'resource:sig-4/name',
      op: 'put',
      value: 'Remote Name',
      hlc: farFuture(),
    };
    const result = await source.applyRemote([remote]);
    expect(result.applied).toHaveLength(1);

    const stored = await getResource(LANG, id);
    expect(stored?.name).toBe('Remote Name');
    expect(stored?.priority).toBe(5);
    expect(stored?.id).toBe(id);
    expect((await allOutbox()).length).toBe(before);
  });

  it('reports localWon when local field meta is newer', async () => {
    const source = createDictLocalSource(LANG, 'dictResource');
    const id = await addResource(LANG, makeResource('sig-5'));
    const stored = await getResource(LANG, id);
    await updateResource(LANG, { ...stored!, name: 'Local Name' });

    const remote: ChangeRecord = {
      scope: SCOPE,
      dataClass: 'dictResource',
      key: 'resource:sig-5/name',
      op: 'put',
      value: 'Remote Name',
      hlc: farPast(),
    };
    const result = await source.applyRemote([remote]);
    expect(result.localWon).toHaveLength(1);
    expect((await getResource(LANG, id))?.name).toBe('Local Name');
  });

  it('applies a remote entity put preserving the local id', async () => {
    const source = createDictLocalSource(LANG, 'dictResource');
    const id = await addResource(LANG, makeResource('sig-6'));

    const remote: ChangeRecord = {
      scope: SCOPE,
      dataClass: 'dictResource',
      key: 'resource:sig-6',
      op: 'put',
      value: { ...makeResource('sig-6'), name: 'Remote Entity' },
      hlc: farFuture(),
    };
    const result = await source.applyRemote([remote]);
    expect(result.applied).toHaveLength(1);
    const stored = await findResourceBySignature(LANG, 'sig-6');
    expect(stored?.id).toBe(id);
    expect(stored?.name).toBe('Remote Entity');
  });

  it('creates the resource row for a remote entity put with no local row', async () => {
    const source = createDictLocalSource(LANG, 'dictResource');
    const remote: ChangeRecord = {
      scope: SCOPE,
      dataClass: 'dictResource',
      key: 'resource:sig-7',
      op: 'put',
      value: makeResource('sig-7'),
      hlc: farFuture(),
    };
    const result = await source.applyRemote([remote]);
    expect(result.applied).toHaveLength(1);
    const stored = await findResourceBySignature(LANG, 'sig-7');
    expect(stored?.signature).toBe('sig-7');
  });

  it('imports blob content for a remote resource put when the blob is available', async () => {
    const source = createDictLocalSource(LANG, 'dictResource');
    const hash = 'ch-import-1';
    const bytes = serializeResourcePortable(
      [
        { term: 'hola mundo', reading: 'hola mundo', defs: [{ text: 'hello world' }] },
        { term: 'gato', reading: 'gato', defs: [{ text: 'cat' }] },
      ],
      [{ term: 'hola mundo', freq: 42 }],
    );
    const remote: ChangeRecord = {
      scope: SCOPE,
      dataClass: 'dictResource',
      key: `resource:${hash}`,
      op: 'put',
      value: {
        name: 'Remote Dict',
        langCode: LANG,
        type: 'DICTIONARY',
        format: 'json-entries',
        enabled: true,
        priority: 1,
        contentHash: hash,
      },
      hlc: farFuture(),
    };
    const fetchBlob = jest.fn(async () => new Blob([bytes]));
    const result = await source.applyRemote([remote], { fetchBlob });
    expect(result.applied).toHaveLength(1);
    expect(fetchBlob).toHaveBeenCalledWith(hash);

    const stored = await findResourceBySignature(LANG, hash);
    expect(stored).toBeDefined();
    expect(stored?.contentHash).toBe(hash);
    expect(stored?.installationFinished).toBe(true);
    expect(stored?.wordCount).toBe(2);
    const entries = await findDictionaryByResource(LANG, stored!.id!);
    expect(entries.map((entry) => entry.term).sort()).toEqual(['gato', 'hola mundo']);
  });

  it('keeps the resource incomplete when the blob is absent and retries on a later apply', async () => {
    const source = createDictLocalSource(LANG, 'dictResource');
    const hash = 'ch-import-2';
    const remote: ChangeRecord = {
      scope: SCOPE,
      dataClass: 'dictResource',
      key: `resource:${hash}`,
      op: 'put',
      value: {
        name: 'Pending Dict',
        langCode: LANG,
        type: 'DICTIONARY',
        format: 'json-entries',
        contentHash: hash,
      },
      hlc: farFuture(),
    };
    const missing = jest.fn(async () => null);
    const first = await source.applyRemote([remote], { fetchBlob: missing });
    expect(first.applied).toHaveLength(1);
    let stored = await findResourceBySignature(LANG, hash);
    expect(stored?.installationFinished).toBe(false);

    const bytes = serializeResourcePortable(
      [{ term: 'perro', reading: 'perro', defs: [{ text: 'dog' }] }],
      [],
    );
    const retry = await source.applyRemote([remote], {
      fetchBlob: async () => new Blob([bytes]),
    });
    expect(retry.applied.length + retry.localWon.length).toBe(1);
    stored = await findResourceBySignature(LANG, hash);
    expect(stored?.installationFinished).toBe(true);
    expect(await findDictionaryByResource(LANG, stored!.id!)).toHaveLength(1);
  });

  it('does not duplicate rows when the same resource applies twice', async () => {
    const source = createDictLocalSource(LANG, 'dictResource');
    const hash = 'ch-import-3';
    const bytes = serializeResourcePortable(
      [{ term: 'uno', reading: 'uno', defs: [{ text: 'one' }] }],
      [],
    );
    const remote: ChangeRecord = {
      scope: SCOPE,
      dataClass: 'dictResource',
      key: `resource:${hash}`,
      op: 'put',
      value: {
        name: 'Dict',
        langCode: LANG,
        type: 'DICTIONARY',
        format: 'json-entries',
        contentHash: hash,
      },
      hlc: farFuture(),
    };
    const ctx = { fetchBlob: async () => new Blob([bytes]) };
    await source.applyRemote([remote], ctx);
    await source.applyRemote([remote], ctx);
    const stored = await findResourceBySignature(LANG, hash);
    expect(await findDictionaryByResource(LANG, stored!.id!)).toHaveLength(1);
  });

  it('deletes the resource row on a remote tombstone', async () => {
    const source = createDictLocalSource(LANG, 'dictResource');
    const id = await addResource(LANG, makeResource('sig-8'));

    const remote: ChangeRecord = {
      scope: SCOPE,
      dataClass: 'dictResource',
      key: 'resource:sig-8',
      op: 'delete',
      hlc: farFuture(),
    };
    const result = await source.applyRemote([remote]);
    expect(result.applied).toHaveLength(1);
    expect(await findResourceBySignature(LANG, 'sig-8')).toBeUndefined();
    expect(await getResource(LANG, id)).toBeUndefined();
  });

  it('stashes unknown field keys and field puts for missing resources as opaque', async () => {
    const source = createDictLocalSource(LANG, 'dictResource');
    const unknownField: ChangeRecord = {
      scope: SCOPE,
      dataClass: 'dictResource',
      key: 'resource:sig-9/wordCount',
      op: 'put',
      value: 99,
      hlc: farFuture(),
    };
    const missingRow: ChangeRecord = {
      scope: SCOPE,
      dataClass: 'dictResource',
      key: 'resource:sig-absent/name',
      op: 'put',
      value: 'Nope',
      hlc: farFuture(),
    };
    const result = await source.applyRemote([unknownField, missingRow]);
    expect(result.opaque).toHaveLength(2);
    const stashed = await getAllOpaqueRecords(SCOPE);
    expect(stashed.map((row) => row.recordKey).sort()).toEqual([
      'resource:sig-9/wordCount',
      'resource:sig-absent/name',
    ]);
  });
});

describe('dictLocalSource — wordStatus', () => {
  it('round-trips a captured status through pending/resolve/ack', async () => {
    const source = createDictLocalSource(LANG, 'wordStatus');
    await setWordStatus(LANG, 'hola', 'known');

    const pending = await source.pending(10);
    expect(pending).toEqual([
      { scope: SCOPE, dataClass: 'wordStatus', key: 'word:hola', op: 'put' },
    ]);
    const records = await source.resolve(pending);
    expect(records).toEqual([
      expect.objectContaining({
        key: 'word:hola',
        op: 'put',
        value: expect.objectContaining({ term: 'hola', status: 'known' }),
      }),
    ]);
    await source.ack(pending);
    expect((await allOutbox()).filter((row) => row.key === 'word:hola')).toEqual([]);
  });

  it('resolves unknown status writes as tombstones', async () => {
    const source = createDictLocalSource(LANG, 'wordStatus');
    await setWordStatus(LANG, 'adios', 'known');
    await setWordStatus(LANG, 'adios', 'unknown');
    const pending = await source.pending(10);
    expect(pending).toEqual([
      { scope: SCOPE, dataClass: 'wordStatus', key: 'word:adios', op: 'delete' },
    ]);
    const records = await source.resolve(pending);
    expect(records[0].op).toBe('delete');
  });

  it('applies a newer remote status and drops the row on unknown', async () => {
    const source = createDictLocalSource(LANG, 'wordStatus');
    await setWordStatus(LANG, 'gato', 'tracking');
    const before = (await allOutbox()).length;

    const result = await source.applyRemote([
      {
        scope: SCOPE,
        dataClass: 'wordStatus',
        key: 'word:gato',
        op: 'put',
        value: { term: 'gato', status: 'ignore', updatedAt: 5 },
        hlc: farFuture(),
      },
      {
        scope: SCOPE,
        dataClass: 'wordStatus',
        key: 'word:nuevo',
        op: 'put',
        value: { term: 'nuevo', status: 'known', updatedAt: 5 },
        hlc: farFuture(),
      },
    ]);
    expect(result.applied).toHaveLength(2);
    expect(await getWordStatus(LANG, 'gato')).toBe('ignore');
    expect(await getWordStatus(LANG, 'nuevo')).toBe('known');
    expect((await allOutbox()).length).toBe(before);

    const drop = await source.applyRemote([
      {
        scope: SCOPE,
        dataClass: 'wordStatus',
        key: 'word:nuevo',
        op: 'put',
        value: { term: 'nuevo', status: 'unknown', updatedAt: 9 },
        hlc: { wall: Date.now() + 2_000_000, counter: 0, node: 'devB' },
      },
    ]);
    expect(drop.applied).toHaveLength(1);
    expect(await getWordStatus(LANG, 'nuevo')).toBe('unknown');
  });

  it('keeps local state for an older remote status', async () => {
    const source = createDictLocalSource(LANG, 'wordStatus');
    await setWordStatus(LANG, 'perro', 'ignore');
    const result = await source.applyRemote([
      {
        scope: SCOPE,
        dataClass: 'wordStatus',
        key: 'word:perro',
        op: 'put',
        value: { term: 'perro', status: 'tracking', updatedAt: 1 },
        hlc: farPast(),
      },
    ]);
    expect(result.localWon).toHaveLength(1);
    expect(await getWordStatus(LANG, 'perro')).toBe('ignore');
  });

  it('snapshot emits only live statuses within the lang scope', async () => {
    const source = createDictLocalSource(LANG, 'wordStatus');
    await setWordStatus(LANG, 'a', 'known');
    await setWordStatus(LANG, 'b', 'tracking');

    const out: ChangeRecord[] = [];
    for await (const record of source.snapshot(SCOPE)) out.push(record);
    expect(out.map((r) => r.key).sort()).toEqual(['word:a', 'word:b']);

    const other: ChangeRecord[] = [];
    for await (const record of source.snapshot('profile:fr')) other.push(record);
    expect(other).toEqual([]);
  });
});
