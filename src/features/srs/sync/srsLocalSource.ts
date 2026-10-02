import type {
  ChangeRecord,
  LocalSource,
  LocalValue,
  RecordKey,
  Scope,
  SnapshotEntry,
} from '@/features/sync';
import {
  IdbLocalSource,
  allRowsAt,
  compareHlc,
  getMetaAt,
  getRowAt,
  idbRequest,
  rowsByIndexAt,
  scopeForTarget,
  targetOf,
  tombstoneMetaAt,
} from '@/features/sync';
import type {
  SrsAudioAsset,
  SrsCard,
  SrsCollection,
  SrsDeck,
  SrsFsrsAdapter,
  SrsImageAsset,
  SrsNote,
  SrsNotetype,
  SrsReviewRecord,
  SrsStudyConfig,
  SrsVariantPreset,
} from '@/entities/srs/types';
import {
  SrsAudioAssetSchema,
  SrsCardSchema,
  SrsCollectionSchema,
  SrsDeckSchema,
  SrsImageAssetSchema,
  SrsNotetypeSchema,
  SrsNoteSchema,
  SrsReviewRecordSchema,
  SrsStudyConfigSchema,
  SrsVariantPresetSchema,
} from '@/entities/srs/schemas';
import { getSrsDB, SRS_INDEXES, SRS_STORES } from '../repositories/srsDatabase';
import {
  scopeOfCollection,
  scopeOfDeck,
  scopeOfNote,
  scopeOfReviewEvent,
  studyConfigScopes,
} from '../repositories/srsSyncScope';
import { recalcCard } from '../logic/reviewEngine';
import { createDefaultVariants } from '../lib/defaultVariants';
import { servableVariantIds } from '../lib/variantFront';
import { createSrsFsrsAdapter } from '../services/srsFsrsAdapter';

export type SrsDataClass =
  | 'studyConfig'
  | 'srsCollection'
  | 'srsDeck'
  | 'srsNotetype'
  | 'srsNote'
  | 'srsCard'
  | 'srsReviewEvent'
  | 'srsAudioAsset'
  | 'srsImageAsset'
  | 'srsVariantPreset';

interface RowSchema {
  safeParse(value: unknown): { success: boolean };
}

interface SrsClassDef {
  readonly store: string;
  readonly prefix: string;
  readonly schema: RowSchema;
}

const CLASS_DEFS: Record<SrsDataClass, SrsClassDef> = {
  studyConfig: { store: SRS_STORES.STUDY_CONFIGS, prefix: 'studyConfigs:', schema: SrsStudyConfigSchema },
  srsCollection: { store: SRS_STORES.COLLECTIONS, prefix: 'collections:', schema: SrsCollectionSchema },
  srsDeck: { store: SRS_STORES.DECKS, prefix: 'decks:', schema: SrsDeckSchema },
  srsNotetype: { store: SRS_STORES.NOTETYPES, prefix: 'notetypes:', schema: SrsNotetypeSchema },
  srsNote: { store: SRS_STORES.NOTES, prefix: 'notes:', schema: SrsNoteSchema },
  srsCard: { store: SRS_STORES.CARDS, prefix: 'cards:', schema: SrsCardSchema },
  srsReviewEvent: { store: SRS_STORES.REVIEW_EVENTS, prefix: 'reviewEvents:', schema: SrsReviewRecordSchema },
  srsAudioAsset: { store: SRS_STORES.AUDIO_ASSETS, prefix: 'audioAssets:', schema: SrsAudioAssetSchema },
  srsImageAsset: { store: SRS_STORES.IMAGE_ASSETS, prefix: 'imageAssets:', schema: SrsImageAssetSchema },
  srsVariantPreset: { store: SRS_STORES.VARIANT_PRESETS, prefix: 'variantPresets:', schema: SrsVariantPresetSchema },
};

const SRS_SYNC_STORES: readonly string[] = [
  SRS_STORES.COLLECTIONS,
  SRS_STORES.DECKS,
  SRS_STORES.STUDY_CONFIGS,
  SRS_STORES.NOTETYPES,
  SRS_STORES.NOTES,
  SRS_STORES.CARDS,
  SRS_STORES.AUDIO_ASSETS,
  SRS_STORES.IMAGE_ASSETS,
  SRS_STORES.REVIEW_EVENTS,
  SRS_STORES.VARIANT_PRESETS,
  SRS_STORES.SYNC_META,
];

function keyId(key: RecordKey, prefix: string): string {
  return key.slice(prefix.length);
}

class SrsLocalSource extends IdbLocalSource {
  private fsrs: SrsFsrsAdapter | null = null;

  protected readonly keyPrefix: string;

  constructor(
    readonly dataClass: SrsDataClass,
    private readonly def: SrsClassDef,
  ) {
    super();
    this.keyPrefix = def.prefix;
  }

  protected openDb(): Promise<IDBDatabase> {
    return getSrsDB();
  }

  protected readStores(): readonly string[] {
    return SRS_SYNC_STORES;
  }

  protected applyStores(): readonly string[] {
    return SRS_SYNC_STORES;
  }

  protected snapshotStores(): readonly string[] {
    return SRS_SYNC_STORES;
  }

  protected knownKey(key: RecordKey): boolean {
    if (!key.startsWith(this.def.prefix)) return false;
    const id = keyId(key, this.def.prefix);
    return id.length > 0 && !id.includes('/');
  }

  protected parentKeys(record: ChangeRecord): RecordKey[] {
    if (record.op !== 'put') return [];
    const value = record.value;
    if (typeof value !== 'object' || value === null) return [];
    const row = value as Record<string, unknown>;
    switch (this.dataClass) {
      case 'srsDeck':
      case 'srsNotetype':
      case 'srsVariantPreset':
        return typeof row.collectionId === 'string' ? [`collections:${row.collectionId}`] : [];
      case 'srsNote':
        return [
          ...(typeof row.deckId === 'string' ? [`decks:${row.deckId}`] : []),
          ...(typeof row.notetypeId === 'string' ? [`notetypes:${row.notetypeId}`] : []),
        ];
      case 'srsCard':
        return [
          ...(typeof row.deckId === 'string' ? [`decks:${row.deckId}`] : []),
          ...(typeof row.noteId === 'string' ? [`notes:${row.noteId}`] : []),
        ];
      case 'srsReviewEvent':
        return [
          ...(typeof row.cardId === 'string' ? [`cards:${row.cardId}`] : []),
          ...(typeof row.noteId === 'string' ? [`notes:${row.noteId}`] : []),
        ];
      case 'srsAudioAsset':
      case 'srsImageAsset':
        return typeof row.noteId === 'string' ? [`notes:${row.noteId}`] : [];
      default:
        return [];
    }
  }

  protected putMaterializable(record: ChangeRecord): boolean {
    if (!this.def.schema.safeParse(record.value).success) return false;
    return (record.value as { id?: unknown }).id === keyId(record.key, this.def.prefix);
  }

  protected async readLocalValue(tx: IDBTransaction, key: RecordKey): Promise<LocalValue> {
    const id = keyId(key, this.def.prefix);
    const row = await getRowAt<Record<string, unknown>>(tx, this.def.store, id);
    return row === undefined ? { found: false } : { found: true, value: row };
  }

  protected async scopeOfLocalValue(
    tx: IDBTransaction,
    key: RecordKey,
    value: unknown,
  ): Promise<Scope | null> {
    const row = value as Record<string, unknown>;
    switch (this.dataClass) {
      case 'srsCollection': {
        const language = row.targetLanguage;
        return typeof language === 'string' ? scopeForTarget(targetOf(language)) : null;
      }
      case 'srsDeck':
      case 'srsNotetype':
      case 'srsVariantPreset':
        return typeof row.collectionId === 'string'
          ? scopeOfCollection(tx, row.collectionId)
          : null;
      case 'srsNote':
      case 'srsAudioAsset':
      case 'srsImageAsset':
        if (typeof row.deckId === 'string') return scopeOfDeck(tx, row.deckId);
        return typeof row.noteId === 'string' ? scopeOfNote(tx, row.noteId) : null;
      case 'srsCard':
        return typeof row.deckId === 'string' ? scopeOfDeck(tx, row.deckId) : null;
      case 'srsReviewEvent':
        return scopeOfReviewEvent(tx, row as unknown as SrsReviewRecord);
      case 'studyConfig': {
        const scopes = await studyConfigScopes(tx, keyId(key, this.def.prefix));
        return scopes[0] ?? null;
      }
      default:
        return null;
    }
  }

  protected async collectSnapshotEntries(
    tx: IDBTransaction,
    scope: Scope,
  ): Promise<SnapshotEntry[]> {
    const rows = await allRowsAt<Record<string, unknown> & { id: string }>(tx, this.def.store);
    const entries: SnapshotEntry[] = [];
    for (const row of rows) {
      const key = `${this.def.prefix}${row.id}`;
      const rowScope = await this.scopeOfLocalValue(tx, key, row);
      if (rowScope === null || rowScope !== scope) continue;
      entries.push({ key, metaKey: key, value: row });
    }
    return entries;
  }

  protected async writeRemote(
    tx: IDBTransaction,
    winner: ChangeRecord,
    _remote: ChangeRecord,
  ): Promise<void> {
    const id = keyId(winner.key, this.def.prefix);
    if (winner.op === 'delete') {
      await this.cascadeDelete(tx, id, winner);
      return;
    }
    let row = winner.value;
    if (this.dataClass === 'srsCard' && row && typeof row === 'object') {
      row = await this.recalcMergedCard(tx, row as SrsCard);
    }
    await idbRequest(tx.objectStore(this.def.store).put(row));
  }

  private async recalcMergedCard(tx: IDBTransaction, card: SrsCard): Promise<SrsCard> {
    const deck = await getRowAt<SrsDeck>(tx, SRS_STORES.DECKS, card.deckId);
    const collection = deck
      ? await getRowAt<SrsCollection>(tx, SRS_STORES.COLLECTIONS, deck.collectionId)
      : undefined;
    const configId = deck?.studyConfigId ?? collection?.defaultStudyConfigId;
    const config = configId
      ? await getRowAt<SrsStudyConfig>(tx, SRS_STORES.STUDY_CONFIGS, configId)
      : undefined;
    if (!config) return card;

    const presetId = deck?.variantPresetId ?? collection?.defaultVariantPresetId;
    const preset = presetId
      ? await getRowAt<SrsVariantPreset>(tx, SRS_STORES.VARIANT_PRESETS, presetId)
      : undefined;
    const variants = preset?.variants ?? createDefaultVariants();

    const note = await getRowAt<SrsNote>(tx, SRS_STORES.NOTES, card.noteId);
    const notetype = note
      ? await getRowAt<SrsNotetype>(tx, SRS_STORES.NOTETYPES, note.notetypeId)
      : undefined;
    const servable = note
      ? servableVariantIds(variants, note, notetype)
      : new Set(variants.map((v) => v.id));

    this.fsrs ??= createSrsFsrsAdapter();
    return recalcCard(card, variants, servable, config, new Date().toISOString(), this.fsrs);
  }

  private async cascadeDelete(
    tx: IDBTransaction,
    id: string,
    winner: ChangeRecord,
  ): Promise<void> {
    switch (this.dataClass) {
      case 'srsCollection':
        await this.cascadeCollection(tx, id, winner);
        return;
      case 'srsDeck':
        await this.cascadeDeck(tx, id, winner);
        return;
      case 'srsNote':
        await this.cascadeNote(tx, id, winner);
        return;
      case 'srsCard':
        await this.cascadeCard(tx, id, winner);
        return;
      default:
        await this.removeAndTombstone(
          tx,
          this.def.store,
          `${this.def.prefix}${id}`,
          id,
          winner.hlc,
          winner.scope,
        );
    }
  }

  private async removeAndTombstone(
    tx: IDBTransaction,
    store: string,
    key: RecordKey,
    id: string,
    hlc: ChangeRecord['hlc'],
    scope: Scope,
  ): Promise<void> {
    const meta = await getMetaAt(tx, key, scope);
    if (meta) {
      const order = compareHlc(meta.hlc, hlc);
      if (order > 0 || (order === 0 && meta.op === 'put')) return;
    }
    await idbRequest(tx.objectStore(store).delete(id));
    await tombstoneMetaAt(tx, key, scope, hlc);
  }

  private async cascadeCard(
    tx: IDBTransaction,
    cardId: string,
    winner: ChangeRecord,
  ): Promise<void> {
    const events = await rowsByIndexAt<SrsReviewRecord>(
      tx,
      SRS_STORES.REVIEW_EVENTS,
      SRS_INDEXES.by_card,
      cardId,
    );
    for (const event of events) {
      await this.removeAndTombstone(
        tx,
        SRS_STORES.REVIEW_EVENTS,
        `reviewEvents:${event.id}`,
        event.id,
        winner.hlc,
        winner.scope,
      );
    }
    await this.removeAndTombstone(
      tx,
      SRS_STORES.CARDS,
      `cards:${cardId}`,
      cardId,
      winner.hlc,
      winner.scope,
    );
  }

  private async cascadeNote(
    tx: IDBTransaction,
    noteId: string,
    winner: ChangeRecord,
  ): Promise<void> {
    const cards = await rowsByIndexAt<SrsCard>(tx, SRS_STORES.CARDS, SRS_INDEXES.by_note, noteId);
    for (const card of cards) {
      await this.cascadeCard(tx, card.id, winner);
    }
    const audio = await rowsByIndexAt<SrsAudioAsset>(
      tx,
      SRS_STORES.AUDIO_ASSETS,
      SRS_INDEXES.by_note,
      noteId,
    );
    for (const asset of audio) {
      await this.removeAndTombstone(
        tx,
        SRS_STORES.AUDIO_ASSETS,
        `audioAssets:${asset.id}`,
        asset.id,
        winner.hlc,
        winner.scope,
      );
    }
    const images = await rowsByIndexAt<SrsImageAsset>(
      tx,
      SRS_STORES.IMAGE_ASSETS,
      SRS_INDEXES.by_note,
      noteId,
    );
    for (const asset of images) {
      await this.removeAndTombstone(
        tx,
        SRS_STORES.IMAGE_ASSETS,
        `imageAssets:${asset.id}`,
        asset.id,
        winner.hlc,
        winner.scope,
      );
    }
    await this.removeAndTombstone(
      tx,
      SRS_STORES.NOTES,
      `notes:${noteId}`,
      noteId,
      winner.hlc,
      winner.scope,
    );
  }

  private async cascadeDeck(
    tx: IDBTransaction,
    deckId: string,
    winner: ChangeRecord,
  ): Promise<void> {
    const children = await rowsByIndexAt<SrsDeck>(
      tx,
      SRS_STORES.DECKS,
      SRS_INDEXES.by_parent,
      deckId,
    );
    for (const child of children) {
      await this.cascadeDeck(tx, child.id, winner);
    }
    const notes = await rowsByIndexAt<SrsNote>(
      tx,
      SRS_STORES.NOTES,
      SRS_INDEXES.by_deck,
      deckId,
    );
    for (const note of notes) {
      await this.cascadeNote(tx, note.id, winner);
    }
    await this.removeAndTombstone(
      tx,
      SRS_STORES.DECKS,
      `decks:${deckId}`,
      deckId,
      winner.hlc,
      winner.scope,
    );
  }

  private async cascadeCollection(
    tx: IDBTransaction,
    collectionId: string,
    winner: ChangeRecord,
  ): Promise<void> {
    const decks = await rowsByIndexAt<SrsDeck>(
      tx,
      SRS_STORES.DECKS,
      SRS_INDEXES.by_collection,
      collectionId,
    );
    for (const deck of decks) {
      if (deck.parentId === null) await this.cascadeDeck(tx, deck.id, winner);
    }
    const presets = await rowsByIndexAt<SrsVariantPreset>(
      tx,
      SRS_STORES.VARIANT_PRESETS,
      SRS_INDEXES.by_collection,
      collectionId,
    );
    for (const preset of presets) {
      await this.removeAndTombstone(
        tx,
        SRS_STORES.VARIANT_PRESETS,
        `variantPresets:${preset.id}`,
        preset.id,
        winner.hlc,
        winner.scope,
      );
    }
    await this.removeAndTombstone(
      tx,
      SRS_STORES.COLLECTIONS,
      `collections:${collectionId}`,
      collectionId,
      winner.hlc,
      winner.scope,
    );
  }
}

export function createSrsLocalSource(dataClass: SrsDataClass): LocalSource {
  const def = CLASS_DEFS[dataClass];
  if (!def) throw new Error(`Unknown SRS data class: ${dataClass}`);
  return new SrsLocalSource(dataClass, def);
}
