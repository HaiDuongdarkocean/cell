import 'fake-indexeddb/auto';
import type { SrsAudioAsset } from '@/entities/srs/types';
import {
  getAudioAsset,
  putAudioAsset,
  deleteAudioAsset,
  getAudioAssetsByNote,
  getAllAudioAssets,
} from './audioAssetRepository';
import { closeAllSrsDBs, clearAllSrsStores } from './srsDatabase';
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

const asset = (over: Partial<SrsAudioAsset> = {}): SrsAudioAsset => ({
  id: 'a1',
  noteId: 'n1',
  fieldId: 'f1',
  source: 'local',
  mimeType: 'audio/mpeg',
  bytes: new Uint8Array([1, 2, 3]).buffer,
  size: 3,
  lastAccessed: 1,
  createdAt: 1,
  ...over,
});

test('put + get round-trip', async () => {
  const saved = await putAudioAsset(asset());
  expect(Object.isFrozen(saved)).toBe(true);
  const loaded = await getAudioAsset('a1');
  expect(loaded.id).toBe('a1');
  expect(loaded.mimeType).toBe('audio/mpeg');
  expect(new Uint8Array(loaded.bytes)).toEqual(new Uint8Array([1, 2, 3]));
});

test('get throws NOT_FOUND for missing id', async () => {
  await expect(getAudioAsset('nope')).rejects.toMatchObject({ code: 'NOT_FOUND' });
});

test('put validates required fields before schema', async () => {
  await expect(putAudioAsset(asset({ noteId: '' }))).rejects.toMatchObject({ code: 'INVALID_INPUT' });
});

test('put surfaces schema errors as INVALID_INPUT', async () => {
  const bad = { ...asset(), source: 'bogus' } as unknown as SrsAudioAsset;
  await expect(putAudioAsset(bad)).rejects.toBeInstanceOf(SrsError);
});

test('getByNote + getAll + del', async () => {
  await putAudioAsset(asset({ id: 'a1', noteId: 'n1' }));
  await putAudioAsset(asset({ id: 'a2', noteId: 'n1' }));
  await putAudioAsset(asset({ id: 'a3', noteId: 'n2' }));
  expect((await getAudioAssetsByNote('n1')).map((a) => a.id).sort()).toEqual(['a1', 'a2']);
  expect(await getAllAudioAssets()).toHaveLength(3);
  await deleteAudioAsset('a1');
  expect(await getAudioAssetsByNote('n1')).toHaveLength(1);
});
