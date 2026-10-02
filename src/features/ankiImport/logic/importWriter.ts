import type {
  SrsCard,
  SrsCollection,
  SrsDeck,
  SrsFieldValue,
  SrsNote,
  SrsStudyConfig,
} from '@/entities/srs/types';
import { loadSettings } from '@/shared/lib/storage/settingsStore';
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
  getStudyConfig,
  putAudioAsset,
  putCardForImport,
  putCollection,
  putDeck,
  putImageAsset,
  putNotetype,
  putNoteForImport,
  putReviewEvent,
  putStudyConfig,
  recalcCard,
} from '@/features/srs';
import { flattenDeckName, resolveHomeDeckId, uniqueDeckNames } from './deckFlatten';
import { buildNoteFields, htmlToText } from './fieldMapping';
import { convertCardState } from './stateConvert';
import { mapRevlog } from './revlogMap';
import type {
  FieldMapping,
  ImportSelection,
  NormalizedAnkiCard,
  NormalizedAnkiData,
  NormalizedAnkiNote,
  NormalizedAnkiRevlog,
} from '../model/normalized';

const DEFAULT_DR = 0.9;

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

  let done = 0;
  for (const card of data.cards) {
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

    try {
      await importOneCard(card, note, nt.id, homeDeckId);
      report.importedCards += 1;
      importedIds.add(card.id);
    } catch (err) {
      if (err instanceof ImportError) throw err;
      report.failedCards += 1;
    }
  }

  return report;

  async function importOneCard(
    card: NormalizedAnkiCard,
    note: NormalizedAnkiNote,
    ntId: string,
    homeDeckId: string,
  ): Promise<void> {
    const tDeck = tDeckByAnkiId.get(homeDeckId)!;
    const config = await configOf(tDeck.id);
    const mapping = mappings[ntId] ?? {};
    const deck = decksById.get(homeDeckId);
    const dr = deck?.desiredRetention ?? DEFAULT_DR;

    const converted = convertCardState(card, {
      crtMs: data.crtMs,
      desiredRetention: dr,
      now,
      minExplores: config.learningPath.minExplores,
      revlog: revlogByCard.get(card.id) ?? [],
    });
    if (!converted) { report.skippedSuspended += 1; return; }

    const noteId = `anki-${collectionId}-n${card.id}`;
    const cardId = `anki-${collectionId}-c${card.id}`;
    const built = buildNoteFields(note, ntById.get(ntId)!, mapping);

    // media: resolve each request → store asset at its item index; misses drop only that item
    const fields: Record<string, SrsFieldValue> = { ...built.fields };
    if (!input.skipMedia) {
      const reqsByField = new Map<string, { fieldId: string; filename: string; kind: 'audio' | 'image' }[]>();
      for (const req of built.mediaRequests) {
        const list = reqsByField.get(req.fieldId) ?? [];
        list.push(req);
        reqsByField.set(req.fieldId, list);
      }
      for (const [fieldId, reqs] of reqsByField) {
        const hits: string[] = [];
        for (const req of reqs) {
          const media = await data.media.resolve(req.filename);
          if (!media) { report.mediaMisses += 1; continue; }
          report.mediaHits += 1;
          const index = hits.length;
          if (req.kind === 'audio') {
            await putAudioAsset({
              id: audioAssetId(noteId, fieldId, 'local', index),
              noteId, fieldId, index: index || undefined, source: 'local',
              mimeType: media.mimeType, bytes: media.bytes,
              size: media.bytes.byteLength, lastAccessed: now.getTime(), createdAt: now.getTime(),
            });
          } else {
            await putImageAsset({
              id: imageAssetId(noteId, fieldId, index),
              noteId, fieldId, index: index || undefined,
              mimeType: media.mimeType, bytes: media.bytes,
              size: media.bytes.byteLength, lastAccessed: now.getTime(), createdAt: now.getTime(),
            });
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

    const srsNote: SrsNote = {
      id: noteId,
      notetypeId: srsNt.id,
      deckId: tDeck.id,
      targetWord: targetWordOf(note, ntById.get(ntId)!, mapping),
      fields,
      tags: note.tags,
      createdAt: now.getTime(),
      importSource: { provider: 'anki', cardId: card.id, noteId: note.id },
    };
    const rawCard: SrsCard = {
      id: cardId,
      noteId,
      deckId: tDeck.id,
      components: converted.components,
      studyAgainDue: { meaning: null, sound: null, spelling: null },
      createdAt: now.getTime(),
      nextDue: '',
      maintenanceMode: false,
      importSource: { provider: 'anki', cardId: card.id, noteId: note.id },
    };
    const srsCard = recalcCard(rawCard, config, now.toISOString(), adapter);

    await putNoteForImport(srsNote);
    await putCardForImport(srsCard);
    for (const rev of revlogByCard.get(card.id) ?? []) {
      await putReviewEvent(mapRevlog(rev, cardId, noteId, srsNt.id, converted.fsrsState, converted.progress));
      report.reviewRecords += 1;
    }
  }
}

function targetWordOf(note: NormalizedAnkiNote, nt: { fields: readonly { name: string; ord: number }[] }, mapping: FieldMapping): string {
  const target = nt.fields.find((f) => mapping[f.name] === 'target') ?? nt.fields[0];
  const text = htmlToText(note.fields[target?.ord ?? 0] ?? '');
  return text || `#${note.id}`;
}
