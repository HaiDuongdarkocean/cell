import type { SrsDeck, SrsNote } from '@/entities/srs/types';
import {
  getAllCollections,
  getAudioAssetsByNote,
  getCardIdsByDeckDueBefore,
  getCardsByIds,
  getDeck,
  getDecksByCollection,
  getNotesByIds,
  getNotetypesByIds,
  getSubDecks,
  mediaFieldValues,
} from '@/features/srs';
import { getQueueItem, listQueueRows } from '@/features/miningQueue';
import { getActiveProfileSettings } from '@/entities/settings';
import { loadSettings } from '@/shared/lib/storage/settingsStore';
import { buildPumpSession, PUMP_SESSION_CAP } from '../logic/sessionBuilder';
import { detectPumpFields, pumpFieldText } from '../logic/pumpFields';
import type { PumpItem } from '../types';

export interface PumpDeckOption {
  readonly id: string;
  readonly label: string;
  readonly langCode: string;
}

async function resolveDeckIds(deckId: string | null, includeSubdecks: boolean): Promise<readonly { deck: SrsDeck; langCode: string }[]> {
  const collections = await getAllCollections();
  const langByCollection = new Map(collections.map((c) => [c.id, c.targetLanguage]));

  if (!deckId) {
    const nested = await Promise.all(collections.map((c) => getDecksByCollection(c.id)));
    return nested.flat().map((deck) => ({ deck, langCode: langByCollection.get(deck.collectionId) ?? '' }));
  }

  const root = await getDeck(deckId);
  const result: { deck: SrsDeck; langCode: string }[] = [
    { deck: root, langCode: langByCollection.get(root.collectionId) ?? '' },
  ];
  if (includeSubdecks) {
    const queue = [root.id];
    while (queue.length > 0) {
      const parentId = queue.shift()!;
      for (const sub of await getSubDecks(parentId)) {
        result.push({ deck: sub, langCode: langByCollection.get(sub.collectionId) ?? '' });
        queue.push(sub.id);
      }
    }
  }
  return result;
}

export async function listPumpDecks(): Promise<readonly PumpDeckOption[]> {
  const collections = await getAllCollections();
  const nested = await Promise.all(collections.map((c) => getDecksByCollection(c.id)));
  const multi = collections.length > 1;
  const nameById = new Map(collections.map((c) => [c.id, c.name]));
  return nested.flat().map((deck) => ({
    id: deck.id,
    label: multi ? `${deck.name} · ${nameById.get(deck.collectionId) ?? ''}` : deck.name,
    langCode: collections.find((c) => c.id === deck.collectionId)?.targetLanguage ?? '',
  }));
}

async function profileLangCode(): Promise<string> {
  const settings = await loadSettings();
  return getActiveProfileSettings(settings)?.resourceLangCode ?? '';
}

function resolveAudioUrl(note: SrsNote, audioFieldId: string | null, audioByKey: Map<string, { bytes: ArrayBuffer; mimeType: string }>): string | undefined {
  if (!audioFieldId) return undefined;
  const value = note.fields[audioFieldId];
  if (!value || value.kind !== 'audio') return undefined;
  const urls = mediaFieldValues(value);
  const first = urls[0];
  if (!first) return undefined;
  const asset = audioByKey.get(`${note.id}:${audioFieldId}:0`);
  if (asset) {
    return URL.createObjectURL(new Blob([asset.bytes], { type: asset.mimeType }));
  }
  if (first.startsWith('data:') || first.startsWith('https:')) return first;
  return undefined;
}

export async function buildPumpItems(opts: {
  deckId: string | null;
  includeSubdecks: boolean;
  includeQueue: boolean;
  now?: string;
}): Promise<PumpItem[]> {
  const now = opts.now ?? new Date().toISOString();
  const fallbackLang = await profileLangCode();
  const items: PumpItem[] = [];

  const decks = await resolveDeckIds(opts.deckId, opts.includeSubdecks);
  if (decks.length > 0) {
    const idLists = await Promise.all(
      decks.map(({ deck }) => getCardIdsByDeckDueBefore(deck.id, now, PUMP_SESSION_CAP)),
    );
    const cards = await getCardsByIds(idLists.flat());
    const notes = await getNotesByIds(Array.from(new Set(cards.map((c) => c.noteId))));
    const notetypeIds = Array.from(new Set(notes.map((n) => n.notetypeId)));
    const notetypes = await getNotetypesByIds(notetypeIds);

    const noteById = new Map(notes.map((n) => [n.id, n]));
    const notetypeById = new Map(notetypes.map((nt) => [nt.id, nt]));
    const fieldsByNotetype = new Map<string, ReturnType<typeof detectPumpFields>>();
    const langByDeck = new Map(decks.map(({ deck, langCode }) => [deck.id, langCode]));

    const audioMaps = await Promise.all(
      notes.map(async (note) => {
        const assets = await getAudioAssetsByNote(note.id);
        return new Map(assets.map((a) => [`${a.noteId}:${a.fieldId}:${a.index ?? 0}`, a]));
      }),
    );
    const audioByNote = new Map(notes.map((n, i) => [n.id, audioMaps[i]]));

    const kept = new Set<string>();
    for (const card of cards) {
      if (kept.has(card.noteId)) continue;
      kept.add(card.noteId);
      const note = noteById.get(card.noteId);
      const notetype = note ? notetypeById.get(note.notetypeId) : undefined;
      if (!note || !notetype) continue;
      let fields = fieldsByNotetype.get(notetype.id);
      if (!fields) {
        fields = detectPumpFields(notetype);
        fieldsByNotetype.set(notetype.id, fields);
      }
      const sentence = pumpFieldText(note, fields.sentenceFieldId);
      if (!sentence) continue;
      items.push({
        id: `srs:${card.id}`,
        source: 'srs',
        refId: card.id,
        term: pumpFieldText(note, fields.termFieldId) ?? undefined,
        sentence,
        langCode: langByDeck.get(card.deckId) || fallbackLang,
        audioUrl: resolveAudioUrl(note, fields.audioFieldId, audioByNote.get(note.id) ?? new Map()),
        dueAt: card.nextDue,
      });
    }
  }

  if (opts.includeQueue) {
    const rows = await listQueueRows();
    const details = await Promise.all(rows.map((row) => getQueueItem(row.id)));
    for (const item of details) {
      if (!item || !item.sentence?.trim()) continue;
      items.push({
        id: `queue:${item.id}`,
        source: 'queue',
        refId: item.id,
        term: item.term,
        sentence: item.sentence,
        langCode: item.langCode || fallbackLang,
        audioUrl: item.snapshot?.audioItems?.find((a) => a.url)?.url,
        createdAt: item.createdAt,
      });
    }
  }

  return buildPumpSession(items);
}
