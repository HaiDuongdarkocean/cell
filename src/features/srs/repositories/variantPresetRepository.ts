import type { SrsCollection, SrsDeck, SrsVariantPreset } from '@/entities/srs/types';
import { SrsError } from '@/features/srs/lib/srsError';
import { createDefaultVariantPreset } from '@/features/srs/lib/defaultVariants';
import { captureChange, ensureSyncRuntime, isCaptureEnabled, readRecordMeta } from '@/features/sync';
import { SRS_STORES, SRS_INDEXES } from './srsDatabase';
import { withReadonlyStore, withStore, getById, putRecord, deleteRecord, getAllByIndex } from './srsRepositoryHelpers';
import { scopeOfCollection } from './srsSyncScope';

const WRITE_STORES = [
  SRS_STORES.VARIANT_PRESETS,
  SRS_STORES.COLLECTIONS,
  SRS_STORES.DECKS,
  SRS_STORES.SYNC_OUTBOX,
  SRS_STORES.SYNC_META,
];

export async function getVariantPreset(id: string): Promise<SrsVariantPreset | undefined> {
  return withReadonlyStore(SRS_STORES.VARIANT_PRESETS, async (store) => getById<SrsVariantPreset>(store, id));
}

export async function getVariantPresetsByCollection(collectionId: string): Promise<readonly SrsVariantPreset[]> {
  return withReadonlyStore(SRS_STORES.VARIANT_PRESETS, async (store) => {
    const records = await getAllByIndex<SrsVariantPreset>(store, SRS_INDEXES.by_collection, collectionId);
    return records.slice().sort((a, b) => a.createdAt - b.createdAt);
  });
}

export async function putVariantPreset(preset: SrsVariantPreset): Promise<SrsVariantPreset> {
  if (!preset.id || !preset.collectionId || !preset.name) {
    throw new SrsError('INVALID_INPUT', 'Variant preset id, collectionId and name are required');
  }
  if (preset.variants.some((v) => v.fieldIds.length === 0)) {
    throw new SrsError('INVALID_INPUT', 'Every variant needs at least one front field');
  }
  await ensureSyncRuntime();
  return withStore(WRITE_STORES, async (store, tx) => {
    const captured = isCaptureEnabled();
    const scope = captured
      ? ((await scopeOfCollection(tx, preset.collectionId)) ??
        (await readRecordMeta(store, `variantPresets:${preset.id}`))?.scope ??
        null)
      : null;
    await putRecord(store, preset);
    if (captured) {
      await captureChange(store, { scope, dataClass: 'srsVariantPreset', key: `variantPresets:${preset.id}`, op: 'put' });
    }
    return preset;
  });
}

export async function deleteVariantPreset(id: string): Promise<void> {
  await ensureSyncRuntime();
  return withStore(WRITE_STORES, async (store, tx) => {
    const captured = isCaptureEnabled();
    const row = await getById<SrsVariantPreset>(store, id);
    if (!row) return;
    if (row.isDefault) {
      throw new SrsError('INVALID_INPUT', 'The default variant preset cannot be deleted');
    }
    const scope = captured ? await scopeOfCollection(tx, row.collectionId) : null;

    const decks = tx.objectStore(SRS_STORES.DECKS);
    const deckRows = await getAllByIndex<SrsDeck>(decks, SRS_INDEXES.by_collection, row.collectionId);
    for (const deck of deckRows) {
      if (deck.variantPresetId !== id) continue;
      const next = { ...deck, variantPresetId: null };
      await putRecord(decks, next);
      if (captured) {
        await captureChange(store, { scope, dataClass: 'srsDeck', key: `decks:${deck.id}`, op: 'put' });
      }
    }

    await deleteRecord(store, id);
    if (captured) {
      await captureChange(store, { scope, dataClass: 'srsVariantPreset', key: `variantPresets:${id}`, op: 'delete' });
    }
  });
}

/** Resolve the preset governing a collection, lazy-seeding the default when absent. */
export async function ensureDefaultVariantPreset(collectionId: string): Promise<SrsVariantPreset> {
  const collection = await withReadonlyStore(SRS_STORES.COLLECTIONS, async (store) =>
    getById<SrsCollection>(store, collectionId),
  );
  if (!collection) throw new SrsError('NOT_FOUND', `Collection ${collectionId} not found`);

  if (collection.defaultVariantPresetId) {
    const preset = await getVariantPreset(collection.defaultVariantPresetId);
    if (preset) return preset;
  }

  const existing = await getVariantPresetsByCollection(collectionId);
  const fallback = existing.find((p) => p.isDefault) ?? existing[0];
  if (fallback) {
    if (collection.defaultVariantPresetId !== fallback.id) {
      await withStore(WRITE_STORES, async (_store, tx) => {
        await putRecord(tx.objectStore(SRS_STORES.COLLECTIONS), {
          ...collection,
          defaultVariantPresetId: fallback.id,
        });
      });
    }
    return fallback;
  }

  const seeded = createDefaultVariantPreset(collectionId);
  await withStore(WRITE_STORES, async (store, tx) => {
    const captured = isCaptureEnabled();
    const scope = captured ? await scopeOfCollection(tx, collectionId) : null;
    await putRecord(store, seeded);
    await putRecord(tx.objectStore(SRS_STORES.COLLECTIONS), {
      ...collection,
      defaultVariantPresetId: seeded.id,
    });
    if (captured) {
      await captureChange(store, { scope, dataClass: 'srsVariantPreset', key: `variantPresets:${seeded.id}`, op: 'put' });
      await captureChange(store, { scope, dataClass: 'srsCollection', key: `collections:${collectionId}`, op: 'put' });
    }
  });
  return seeded;
}

/** Resolve the effective preset for a deck — deck override, else collection default (lazy-seeded). */
export async function getVariantPresetForDeck(deckId: string): Promise<SrsVariantPreset> {
  const deck = await withReadonlyStore(SRS_STORES.DECKS, async (store) => getById<SrsDeck>(store, deckId));
  if (!deck) throw new SrsError('NOT_FOUND', `Deck ${deckId} not found`);
  if (deck.variantPresetId) {
    const preset = await getVariantPreset(deck.variantPresetId);
    if (preset) return preset;
  }
  return ensureDefaultVariantPreset(deck.collectionId);
}
