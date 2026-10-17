import type { ZodTypeAny } from 'zod';
import type {
  SrsAudioAsset,
  SrsCard,
  SrsCollection,
  SrsDeck,
  SrsFieldValue,
  SrsImageAsset,
  SrsNote,
  SrsReviewRecord,
  SrsStudyConfig,
  SrsVariant,
} from '@/entities/srs/types';
import {
  SrsAudioAssetSchema,
  SrsCardSchema,
  SrsImageAssetSchema,
  SrsNoteSchema,
  SrsReviewRecordSchema,
} from '@/entities/srs/schemas';
import { loadSettings } from '@/shared/lib/storage/settingsStore';
import { txDone } from '@/shared/lib/storage/idb';
import {
  audioAssetId,
  createDefaultNotetype,
  createDefaultStudyConfig,
  createSrsFsrsAdapter,
  generateId,
  imageAssetId,
  getCardsByDeck,
  getCollectionByLanguageProfileId,
  getDeckByCollectionAndName,
  getDecksByCollection,
  getNotetype,
  getSrsDB,
  getStudyConfig,
  putCollection,
  putDeck,
  putNotetype,
  putStudyConfig,
  recalcCard,
  getVariantPresetForDeck,
  servableVariantIds,
  SrsError,
  SRS_STORES,
} from '@/features/srs';
import {
  captureChange,
  ensureSyncRuntime,
  isCaptureEnabled,
  scopeForTarget,
  targetOf,
} from '@/features/sync';
import { flattenDeckName, resolveHomeDeckId, uniqueDeckNames } from './deckFlatten';
import { buildNoteFields, htmlToText, type BuiltNoteFields } from './fieldMapping';
import { convertCardState } from './stateConvert';
import { mapRevlog } from './revlogMap';
import type {
  FieldMapping,
  ImportSelection,
  NormalizedAnkiCard,
  NormalizedAnkiData,
  NormalizedAnkiNote,
  NormalizedAnkiNotetype,
  NormalizedAnkiRevlog,
} from '../model/normalized';

const DEFAULT_DR = 0.9;
const IMPORT_CHUNK_CARDS = 120;
const MEDIA_FETCH_CONCURRENCY = 8;
const MEDIA_CACHE_CAP_BYTES = 128 * 1024 * 1024;
const IMPORT_WRITE_STORES = [
  SRS_STORES.NOTES,
  SRS_STORES.CARDS,
  SRS_STORES.AUDIO_ASSETS,
  SRS_STORES.IMAGE_ASSETS,
  SRS_STORES.REVIEW_EVENTS,
  SRS_STORES.SYNC_OUTBOX,
  SRS_STORES.SYNC_META,
];

type ResolvedMedia = { bytes: ArrayBuffer; mimeType: string } | null;

function validated<T>(schema: ZodTypeAny, value: T): T {
  const r = schema.safeParse(value);
  if (!r.success) {
    throw new SrsError('INVALID_INPUT', r.error.issues.map((e) => e.message).join('; '));
  }
  return value;
}

export interface ImportRunInput {
  readonly data: NormalizedAnkiData;
  readonly selection: ImportSelection;
  /** Confirmed field mappings keyed by NormalizedAnkiNotetype.id. */
  readonly mappings: Readonly<Record<string, FieldMapping>>;
  readonly targetLanguage: string;
  readonly now: Date;
  readonly signal?: AbortSignal;
  readonly skipMedia?: boolean;
  readonly onProgress?: (done: number, total: number) => void;
}

export interface ImportReport {
  readonly collectionId: string;
  readonly fidelity: 'full' | 'estimated';
  readonly importedCards: number;
  readonly duplicates: number;
  readonly skippedSuspended: number;
  readonly skippedCloze: number;
  readonly skippedUnselected: number;
  readonly skippedUnrouted: number;
  readonly failedCards: number;
  readonly reviewRecords: number;
  readonly mediaHits: number;
  readonly mediaMisses: number;
  readonly decksCreated: number;
}

export class ImportError extends Error {
  constructor(
    public readonly code: 'NO_LANGUAGE_PROFILE' | 'EMPTY_SELECTION' | 'ABORTED',
    message: string,
  ) {
    super(message);
    this.name = 'ImportError';
  }
}

/** Sum of bytes for media referenced by selected notes; null when the source can't size files. */
export function estimateMediaBytes(
  data: NormalizedAnkiData,
  selection: ImportSelection,
  mappings: Readonly<Record<string, FieldMapping>>,
): number | null {
  if (!data.media.size) return null;
  const filenames = collectMediaFilenames(data, selection, mappings);
  let total = 0;
  for (const name of filenames) {
    const s = data.media.size(name);
    if (s === null) return null;
    total += s;
  }
  return total;
}

function collectMediaFilenames(
  data: NormalizedAnkiData,
  selection: ImportSelection,
  mappings: Readonly<Record<string, FieldMapping>>,
): Set<string> {
  const out = new Set<string>();
  const ntById = new Map(data.notetypes.map((n) => [n.id, n]));
  const notesById = new Map(data.notes.map((n) => [n.id, n]));
  const decksById = new Map(data.decks.map((d) => [d.id, d]));
  for (const card of data.cards) {
    if (card.queue === -1) continue;
    const home = resolveHomeDeckId(card, decksById);
    if (home === null || !selection.deckIds.has(home)) continue;
    const note = notesById.get(card.noteId);
    const nt = note && ntById.get(note.modelId);
    if (!note || !nt || nt.isCloze || !selection.notetypeIds.has(nt.id)) continue;
    const mapping = mappings[nt.id] ?? {};
    for (const f of nt.fields) {
      if ((mapping[f.name] ?? 'skip') === 'skip') continue;
      const raw = note.fields[f.ord] ?? '';
      for (const m of raw.matchAll(/\[sound:([^\]]+)\]/g)) out.add(m[1]!);
      for (const m of raw.matchAll(/<img[^>]+src=["']?([^"'\s>]+)["']?/gi)) out.add(m[1]!);
    }
  }
  return out;
}

async function resolveDestinationCollection(targetLanguage: string): Promise<{ collection: SrsCollection; isNew: boolean }> {
  const settings = await loadSettings();
  const profile =
    settings.languageProfiles.find((p) => p.target === targetLanguage) ??
    settings.languageProfiles.find((p) => p.id === settings.activeProfileId) ??
    settings.languageProfiles[0];
  if (!profile) throw new ImportError('NO_LANGUAGE_PROFILE', 'No language profile available');

  const existing = await getCollectionByLanguageProfileId(profile.id);
  if (existing) return { collection: existing, isNew: false };

  const id = generateId();
  const collection: SrsCollection = {
    id,
    languageProfileId: profile.id,
    targetLanguage: profile.target,
    name: profile.name || profile.target,
    defaultStudyConfigId: `sc-${id}`,
    defaultDeckId: `deck-${id}`,
    defaultNotetypeId: `nt-${id}`,
    createdAt: Date.now(),
  };
  return { collection, isNew: true };
}

/** Scan imported-card markers across the collection once → dedup set keyed by Anki card id. */
async function scanImportedCardIds(collectionId: string): Promise<Set<number>> {
  const decks = await getDecksByCollection(collectionId);
  const seen = new Set<number>();
  for (const deck of decks) {
    const cards = await getCardsByDeck(deck.id);
    for (const c of cards) {
      if (c.importSource?.provider === 'anki') seen.add(c.importSource.cardId);
    }
  }
  return seen;
}

export async function importNormalized(input: ImportRunInput): Promise<ImportReport> {
  const { data, selection, mappings, now, signal } = input;
  const adapter = createSrsFsrsAdapter();
  const abort = (): void => {
    if (signal?.aborted) throw new ImportError('ABORTED', 'Import cancelled');
  };

  const resolved = await resolveDestinationCollection(input.targetLanguage);
  let collection = resolved.collection;
  const { isNew } = resolved;
  const collectionId = collection.id;

  // --- decks: flatten selected, reuse same-name deck, one study config each ---
  const decksById = new Map(data.decks.map((d) => [d.id, d]));
  const selectedDecks = data.decks.filter((d) => !d.filtered && selection.deckIds.has(d.id));
  const flatNames = uniqueDeckNames(selectedDecks.map((d) => flattenDeckName(d.name)));
  const tDeckByAnkiId = new Map<string, SrsDeck>();
  let decksCreated = 0;
  for (const [i, deck] of selectedDecks.entries()) {
    abort();
    const existing = await getDeckByCollectionAndName(collectionId, flatNames[i]!);
    if (existing) {
      tDeckByAnkiId.set(deck.id, existing);
      continue;
    }
    const studyConfigId = `anki-sc-${collectionId}-${deck.id}`;
    const threshold = deck.desiredRetention
      ? Math.round(deck.desiredRetention * 100)
      : 90;
    await putStudyConfig({ ...createDefaultStudyConfig(studyConfigId), targetThreshold: threshold });
    const tDeck: SrsDeck = {
      id: `anki-deck-${collectionId}-${deck.id}`,
      collectionId,
      parentId: null,
      name: flatNames[i]!,
      order: i,
      studyConfigId,
    };
    await putDeck(tDeck);
    tDeckByAnkiId.set(deck.id, tDeck);
    decksCreated += 1;
  }
  const configByDeckId = new Map<string, string>();
  for (const deck of tDeckByAnkiId.values()) configByDeckId.set(deck.id, deck.studyConfigId);
  const configCache = new Map<string, SrsStudyConfig>();
  const configOf = async (deckId: string) => {
    const id = configByDeckId.get(deckId)!;
    if (!configCache.has(id)) configCache.set(id, await getStudyConfig(id));
    return configCache.get(id)!;
  };
  const variantsCache = new Map<string, readonly SrsVariant[]>();
  const variantsOf = async (deckId: string) => {
    if (!variantsCache.has(deckId)) {
      variantsCache.set(deckId, (await getVariantPresetForDeck(deckId)).variants);
    }
    return variantsCache.get(deckId)!;
  };

  // --- notetypes: never imported — all notes normalize onto the system notetype ---
  const ntById = new Map(data.notetypes.map((n) => [n.id, n]));
  const notesById = new Map(data.notes.map((n) => [n.id, n]));
  const existingNt = await getNotetype(`default-word-${collectionId}`).catch(() => null);
  const srsNt = existingNt ?? createDefaultNotetype(collectionId);
  if (!existingNt) await putNotetype(srsNt);
  if (collection.defaultNotetypeId !== srsNt.id) {
    collection = { ...collection, defaultNotetypeId: srsNt.id };
    if (!isNew) await putCollection(collection);
  }

  // New collection needs defaults pointing at real rows (spec REQ-7.1).
  if (isNew) {
    const firstDeck = tDeckByAnkiId.values().next().value;
    if (!firstDeck) {
      // Selection produced nothing — seed a usable default stack instead.
      await putStudyConfig(createDefaultStudyConfig(collection.defaultStudyConfigId));
      await putDeck({
        id: collection.defaultDeckId, collectionId, parentId: null,
        name: 'Default', order: 0, studyConfigId: collection.defaultStudyConfigId,
      });
    } else {
      collection = {
        ...collection,
        defaultStudyConfigId: firstDeck.studyConfigId,
        defaultDeckId: firstDeck.id,
        defaultNotetypeId: srsNt.id,
      };
    }
    await putCollection(collection);
  }

  // --- dedup scan + per-card bundles ---
  const importedIds = await scanImportedCardIds(collectionId);
  const revlogByCard = new Map<number, NormalizedAnkiRevlog[]>();
  for (const r of data.revlog) {
    const list = revlogByCard.get(r.cardId) ?? [];
    list.push(r);
    revlogByCard.set(r.cardId, list);
  }

  const report = {
    collectionId,
    fidelity: data.fidelity,
    importedCards: 0,
    duplicates: 0,
    skippedSuspended: 0,
    skippedCloze: 0,
    skippedUnselected: 0,
    skippedUnrouted: 0,
    failedCards: 0,
    reviewRecords: 0,
    mediaHits: 0,
    mediaMisses: 0,
    decksCreated,
  };

  // Everything written by this import shares the destination collection's sync scope.
  await ensureSyncRuntime();
  const captured = isCaptureEnabled();
  const scope = captured ? scopeForTarget(targetOf(collection.targetLanguage)) : null;
  const db = await getSrsDB();

  // filename → resolved bytes|null. Misses always cached; hits cached under a byte
  // cap so a large AnkiConnect import doesn't hold the whole deck in memory.
  const mediaCache = new Map<string, ResolvedMedia>();
  let mediaCacheBytes = 0;

  interface PendingCard {
    readonly card: NormalizedAnkiCard;
    readonly note: NormalizedAnkiNote;
    readonly nt: NormalizedAnkiNotetype;
    readonly homeDeckId: string;
    readonly built: BuiltNoteFields;
  }
  interface Bundle {
    readonly notes: SrsNote[];
    readonly cards: SrsCard[];
    readonly audio: SrsAudioAsset[];
    readonly images: SrsImageAsset[];
    readonly events: SrsReviewRecord[];
    readonly cardIds: number[];
  }

  let done = 0;
  for (let start = 0; start < data.cards.length; start += IMPORT_CHUNK_CARDS) {
    abort();
    const pending: PendingCard[] = [];
    for (const card of data.cards.slice(start, start + IMPORT_CHUNK_CARDS)) {
      abort();
      done += 1;
      input.onProgress?.(done, data.cards.length);
      if (card.queue === -1) { report.skippedSuspended += 1; continue; }
      const note = notesById.get(card.noteId);
      const nt = note && ntById.get(note.modelId);
      if (!note || !nt) { report.skippedUnselected += 1; continue; }
      if (nt.isCloze) { report.skippedCloze += 1; continue; }
      if (!selection.notetypeIds.has(nt.id)) { report.skippedUnselected += 1; continue; }
      const homeDeckId = resolveHomeDeckId(card, decksById);
      if (homeDeckId === null) { report.skippedUnrouted += 1; continue; }
      if (!selection.deckIds.has(homeDeckId)) { report.skippedUnselected += 1; continue; }
      if (importedIds.has(card.id)) { report.duplicates += 1; continue; }
      pending.push({ card, note, nt, homeDeckId, built: buildNoteFields(note, nt, mappings[nt.id] ?? {}) });
    }
    if (pending.length === 0) continue;

    // media: resolve each unique filename once, pooled; resolve errors count as misses
    const chunkMedia = new Map<string, ResolvedMedia>();
    if (!input.skipMedia) {
      const missing = new Set<string>();
      for (const p of pending) {
        for (const req of p.built.mediaRequests) {
          if (!mediaCache.has(req.filename)) missing.add(req.filename);
        }
      }
      const queue = [...missing];
      let cursor = 0;
      const worker = async (): Promise<void> => {
        while (cursor < queue.length) {
          abort();
          const name = queue[cursor++]!;
          chunkMedia.set(name, await data.media.resolve(name).catch(() => null));
        }
      };
      await Promise.all(Array.from({ length: Math.min(MEDIA_FETCH_CONCURRENCY, queue.length) }, worker));
      for (const [name, media] of chunkMedia) {
        if (media === null) mediaCache.set(name, null);
        else if (mediaCacheBytes + media.bytes.byteLength <= MEDIA_CACHE_CAP_BYTES) {
          mediaCache.set(name, media);
          mediaCacheBytes += media.bytes.byteLength;
        }
      }
    }

    const bundle: Bundle = { notes: [], cards: [], audio: [], images: [], events: [], cardIds: [] };
    for (const p of pending) {
      try {
        if ((await buildCardRecords(p, bundle, chunkMedia)) === null) report.skippedSuspended += 1;
      } catch (err) {
        if (err instanceof ImportError) throw err;
        report.failedCards += 1;
      }
    }

    try {
      await commitBundle(bundle);
      report.importedCards += bundle.cardIds.length;
      report.reviewRecords += bundle.events.length;
      for (const id of bundle.cardIds) importedIds.add(id);
    } catch (err) {
      if (err instanceof ImportError) throw err;
      report.failedCards += bundle.cardIds.length;
    }
  }

  return report;

  async function buildCardRecords(p: PendingCard, out: Bundle, chunkMedia: Map<string, ResolvedMedia>): Promise<null | void> {
    const tDeck = tDeckByAnkiId.get(p.homeDeckId)!;
    const config = await configOf(tDeck.id);
    const mapping = mappings[p.nt.id] ?? {};
    const dr = decksById.get(p.homeDeckId)?.desiredRetention ?? DEFAULT_DR;

    const converted = convertCardState(p.card, {
      crtMs: data.crtMs,
      desiredRetention: dr,
      now,
      minExplores: config.learningPath.minExplores,
      revlog: revlogByCard.get(p.card.id) ?? [],
    });
    if (!converted) return null;

    const noteId = `anki-${collectionId}-n${p.card.id}`;
    const cardId = `anki-${collectionId}-c${p.card.id}`;

    // media: hits store an asset at its item index; misses drop only that item
    const fields: Record<string, SrsFieldValue> = { ...p.built.fields };
    if (!input.skipMedia) {
      const reqsByField = new Map<string, { fieldId: string; filename: string; kind: 'audio' | 'image' }[]>();
      for (const req of p.built.mediaRequests) {
        const list = reqsByField.get(req.fieldId) ?? [];
        list.push(req);
        reqsByField.set(req.fieldId, list);
      }
      for (const [fieldId, reqs] of reqsByField) {
        const hits: string[] = [];
        for (const req of reqs) {
          const media = chunkMedia.get(req.filename) ?? mediaCache.get(req.filename) ?? null;
          if (!media) { report.mediaMisses += 1; continue; }
          report.mediaHits += 1;
          const index = hits.length;
          if (req.kind === 'audio') {
            out.audio.push(validated(SrsAudioAssetSchema, {
              id: audioAssetId(noteId, fieldId, 'local', index),
              noteId, fieldId, index: index || undefined, source: 'local',
              mimeType: media.mimeType, bytes: media.bytes,
              size: media.bytes.byteLength, lastAccessed: now.getTime(), createdAt: now.getTime(),
            }));
          } else {
            out.images.push(validated(SrsImageAssetSchema, {
              id: imageAssetId(noteId, fieldId, index),
              noteId, fieldId, index: index || undefined,
              mimeType: media.mimeType, bytes: media.bytes,
              size: media.bytes.byteLength, lastAccessed: now.getTime(), createdAt: now.getTime(),
            }));
          }
          hits.push(req.filename);
        }
        const prev = fields[fieldId];
        if (hits.length === 0) {
          delete fields[fieldId];
        } else if (prev && (prev.kind === 'audio' || prev.kind === 'image')) {
          fields[fieldId] = { ...prev, value: hits };
        }
      }
    }

    const srsNote = validated<SrsNote>(SrsNoteSchema, {
      id: noteId,
      notetypeId: srsNt.id,
      deckId: tDeck.id,
      targetWord: targetWordOf(p.note, p.nt, mapping),
      fields,
      tags: p.note.tags,
      createdAt: now.getTime(),
      importSource: { provider: 'anki', cardId: p.card.id, noteId: p.note.id },
    });
    const rawCard: SrsCard = {
      id: cardId,
      noteId,
      deckId: tDeck.id,
      components: converted.components,
      studyAgainDue: { meaning: null, sound: null, spelling: null },
      createdAt: now.getTime(),
      nextDue: '',
      maintenanceMode: false,
      importSource: { provider: 'anki', cardId: p.card.id, noteId: p.note.id },
    };
    const variants = await variantsOf(tDeck.id);
    const srsCard = validated(SrsCardSchema, recalcCard(rawCard, variants, servableVariantIds(variants, srsNote, srsNt), config, now.toISOString(), adapter));

    out.notes.push(srsNote);
    out.cards.push(srsCard);
    for (const rev of revlogByCard.get(p.card.id) ?? []) {
      out.events.push(validated(SrsReviewRecordSchema, mapRevlog(rev, cardId, noteId, srsNt.id, converted.fsrsState, converted.progress)));
    }
    out.cardIds.push(p.card.id);
  }

  async function commitBundle(bundle: Bundle): Promise<void> {
    if (bundle.cardIds.length === 0) return;
    const tx = db.transaction(IMPORT_WRITE_STORES, 'readwrite');
    const done = txDone(tx);
    void done.catch(() => undefined);
    const notesStore = tx.objectStore(SRS_STORES.NOTES);
    for (const n of bundle.notes) notesStore.put(n);
    const cardsStore = tx.objectStore(SRS_STORES.CARDS);
    for (const c of bundle.cards) cardsStore.put(c);
    const audioStore = tx.objectStore(SRS_STORES.AUDIO_ASSETS);
    for (const a of bundle.audio) audioStore.put(a);
    const imageStore = tx.objectStore(SRS_STORES.IMAGE_ASSETS);
    for (const i of bundle.images) imageStore.put(i);
    const eventsStore = tx.objectStore(SRS_STORES.REVIEW_EVENTS);
    for (const e of bundle.events) eventsStore.put(e);
    if (captured) {
      await Promise.all([
        ...bundle.notes.map((n) => captureChange(notesStore, { scope, dataClass: 'srsNote', key: `notes:${n.id}`, op: 'put' })),
        ...bundle.cards.map((c) => captureChange(notesStore, { scope, dataClass: 'srsCard', key: `cards:${c.id}`, op: 'put' })),
        ...bundle.audio.map((a) => captureChange(notesStore, { scope, dataClass: 'srsAudioAsset', key: `audioAssets:${a.id}`, op: 'put' })),
        ...bundle.images.map((i) => captureChange(notesStore, { scope, dataClass: 'srsImageAsset', key: `imageAssets:${i.id}`, op: 'put' })),
        ...bundle.events.map((e) => captureChange(notesStore, { scope, dataClass: 'srsReviewEvent', key: `reviewEvents:${e.id}`, op: 'put' })),
      ]);
    }
    await done;
  }
}

function targetWordOf(note: NormalizedAnkiNote, nt: { fields: readonly { name: string; ord: number }[] }, mapping: FieldMapping): string {
  const target = nt.fields.find((f) => mapping[f.name] === 'target') ?? nt.fields[0];
  const text = htmlToText(note.fields[target?.ord ?? 0] ?? '');
  return text || `#${note.id}`;
}
