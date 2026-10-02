import 'fake-indexeddb/auto';
import type { SrsVariantPreset } from '@/entities/srs/types';
import { putCollection, getCollection } from '@/features/srs/repositories/collectionRepository';
import { putDeck, getDeck } from '@/features/srs/repositories/deckRepository';
import { closeAllSrsDBs, clearAllSrsStores, getSrsDbName, deleteSrsDB } from '@/features/srs/repositories/srsDatabase';
import { createCustomVariant } from '@/features/srs/lib/defaultVariants';
import {
  deleteVariantPreset,
  ensureDefaultVariantPreset,
  getVariantPreset,
  getVariantPresetForDeck,
  getVariantPresetsByCollection,
  putVariantPreset,
} from './variantPresetRepository';

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

beforeEach(async () => {
  storageLocalGetMock.mockReset();
  storageLocalGetMock.mockResolvedValue({});
  closeAllSrsDBs();
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

async function seed(): Promise<void> {
  await putCollection({ id: 'c1', languageProfileId: 'lp1', targetLanguage: 'en', name: 'C', defaultStudyConfigId: 'sc1', defaultDeckId: 'd1', defaultNotetypeId: 'nt1', createdAt: 1 });
  await putDeck({ id: 'd1', collectionId: 'c1', parentId: null, name: 'D', order: 0, studyConfigId: 'sc1' });
  await putDeck({ id: 'd2', collectionId: 'c1', parentId: null, name: 'D2', order: 1, studyConfigId: 'sc1' });
}

const customPreset = (id: string, collectionId = 'c1'): SrsVariantPreset => ({
  id,
  collectionId,
  name: 'Custom',
  variants: [createCustomVariant(0)],
  isDefault: false,
  createdAt: 2,
});

describe('variantPresetRepository', () => {
  it('lazy-seeds the default preset for an existing collection', async () => {
    await seed();
    const preset = await ensureDefaultVariantPreset('c1');
    expect(preset.isDefault).toBe(true);
    expect(preset.variants.map((v) => v.id)).toEqual(['sound', 'meaning', 'spelling']);

    const collection = await getCollection('c1');
    expect(collection?.defaultVariantPresetId).toBe(preset.id);

    const again = await ensureDefaultVariantPreset('c1');
    expect(again.id).toBe(preset.id);
  });

  it('rejects put without required fields or with an empty-fieldIds variant', async () => {
    await seed();
    await expect(putVariantPreset({ ...customPreset('p1'), name: '' })).rejects.toThrow();
    await expect(
      putVariantPreset({ ...customPreset('p2'), variants: [{ ...createCustomVariant(0), fieldIds: [] }] }),
    ).rejects.toThrow();
  });

  it('lists presets of a collection sorted by createdAt', async () => {
    await seed();
    await ensureDefaultVariantPreset('c1');
    await putVariantPreset(customPreset('p2'));
    const list = await getVariantPresetsByCollection('c1');
    expect(list.length).toBe(2);
    expect(list.some((p) => p.isDefault)).toBe(true);
  });

  it('resolves the deck override first, then the collection default', async () => {
    await seed();
    const fallback = await ensureDefaultVariantPreset('c1');
    await putVariantPreset(customPreset('p9'));

    expect((await getVariantPresetForDeck('d1')).id).toBe(fallback.id);

    const deck = await getDeck('d1');
    await putDeck({ ...deck!, variantPresetId: 'p9' });
    expect((await getVariantPresetForDeck('d1')).id).toBe('p9');
    expect((await getVariantPresetForDeck('d2')).id).toBe(fallback.id);
  });

  it('falls back to the collection default when the deck override dangles', async () => {
    await seed();
    const fallback = await ensureDefaultVariantPreset('c1');
    const deck = await getDeck('d1');
    await putDeck({ ...deck!, variantPresetId: 'missing-preset' });
    expect((await getVariantPresetForDeck('d1')).id).toBe(fallback.id);
  });

  it('refuses to delete the default preset', async () => {
    await seed();
    const fallback = await ensureDefaultVariantPreset('c1');
    await expect(deleteVariantPreset(fallback.id)).rejects.toThrow();
    expect(await getVariantPreset(fallback.id)).toBeDefined();
  });

  it('deleting a custom preset clears deck references', async () => {
    await seed();
    await ensureDefaultVariantPreset('c1');
    await putVariantPreset(customPreset('p9'));
    const deck = await getDeck('d1');
    await putDeck({ ...deck!, variantPresetId: 'p9' });

    await deleteVariantPreset('p9');
    expect(await getVariantPreset('p9')).toBeUndefined();
    expect((await getDeck('d1'))?.variantPresetId ?? null).toBeNull();
    expect((await getVariantPresetForDeck('d1')).isDefault).toBe(true);
  });
});
