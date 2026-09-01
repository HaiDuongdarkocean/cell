import 'fake-indexeddb/auto';
import type { SrsNotetype } from '@/entities/srs/types';
import { putNotetype, getNotetype, deleteNotetype, getNotetypesByCollection, getNotetypesByTargetField } from './notetypeRepository';
import { closeAllSrsDBs, clearAllSrsStores, getSrsDbName, deleteSrsDB } from './srsDatabase';
import { SrsError } from '@/features/srs/lib/srsError';

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
  closeAllSrsDBs();
});

beforeEach(async () => {
  await clearAllSrsStores();
});

afterEach(() => {
  closeAllSrsDBs();
});

afterAll(async () => {
  delete (global as { chrome?: unknown }).chrome;
  const dbName = await getSrsDbName();
  await deleteSrsDB(dbName);
});

const makeNotetype = (id: string, collectionId: string, targetFieldId: string, name = 'Default'): SrsNotetype => ({
  id,
  collectionId,
  name,
  targetFieldId,
  fields: [
    { id: 'f-text', name: 'Word', order: 0, type: 'text' },
    { id: 'f-trans', name: 'Translation', order: 1, type: 'translation' },
    { id: targetFieldId, name: 'Target', order: 2, type: 'text' },
  ],
  frontTemplates: [
    {
      id: 't1',
      componentType: 'meaning',
      stimulusType: 'definition',
      fieldIds: ['f-text', 'f-trans'],
      requiresInput: false,
    },
  ],
  backTemplate: { fieldIds: ['f-text', 'f-trans'], showAll: true },
});

describe('notetypeRepository', () => {
  it('stores and retrieves a notetype', async () => {
    const nt = makeNotetype('nt1', 'c1', 'f-target');
    await putNotetype(nt);
    const found = await getNotetype('nt1');
    expect(found).toEqual(nt);
  });

  it('throws NOT_FOUND for missing notetype', async () => {
    await expect(getNotetype('missing')).rejects.toThrow(SrsError);
  });

  it('throws INVALID_INPUT when targetFieldId does not point to a text field', async () => {
    const nt: SrsNotetype = {
      ...makeNotetype('nt2', 'c1', 'f-text'),
      targetFieldId: 'f-trans',
    };
    await expect(putNotetype(nt)).rejects.toThrow(SrsError);
  });

  it('throws INVALID_INPUT when targetFieldId is missing from fields', async () => {
    const nt = makeNotetype('nt3', 'c1', 'f-target-3');
    const ntMissing: SrsNotetype = {
      ...nt,
      targetFieldId: 'f-missing',
    };
    await expect(putNotetype(ntMissing)).rejects.toThrow(SrsError);
  });

  it('lists notetypes by collection', async () => {
    const nt1 = makeNotetype('nt1', 'c1', 'f-target-1');
    const nt2 = makeNotetype('nt2', 'c1', 'f-target-2');
    const nt3 = makeNotetype('nt3', 'c2', 'f-target-3');
    await putNotetype(nt1);
    await putNotetype(nt2);
    await putNotetype(nt3);
    const found = await getNotetypesByCollection('c1');
    expect(found.map((n) => n.id)).toEqual(expect.arrayContaining(['nt1', 'nt2']));
    expect(found.some((n) => n.id === 'nt3')).toBe(false);
  });

  it('finds notetypes by target field', async () => {
    const nt1 = makeNotetype('nt1', 'c1', 'f-target-1');
    const nt2 = makeNotetype('nt2', 'c1', 'f-target-1');
    const nt3 = makeNotetype('nt3', 'c1', 'f-target-2');
    await putNotetype(nt1);
    await putNotetype(nt2);
    await putNotetype(nt3);
    const found = await getNotetypesByTargetField('f-target-1');
    expect(found.map((n) => n.id)).toEqual(['nt1', 'nt2']);
  });

  it('deletes a notetype', async () => {
    const nt = makeNotetype('nt4', 'c1', 'f-target-4');
    await putNotetype(nt);
    await deleteNotetype('nt4');
    await expect(getNotetype('nt4')).rejects.toThrow(SrsError);
  });
});
