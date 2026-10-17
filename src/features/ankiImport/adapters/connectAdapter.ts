import type {
  MediaResolver,
  NormalizedAnkiCard,
  NormalizedAnkiData,
  NormalizedAnkiDeck,
  NormalizedAnkiNote,
  NormalizedAnkiNotetype,
  NormalizedAnkiRevlog,
} from '../model/normalized';
import { decodeBase64ToArrayBuffer } from '@/shared/lib/base64';
import { extToMime } from '@/shared/lib/mime';

export type AnkiConnectInvoker = (action: string, params?: Record<string, unknown>) => Promise<unknown>;

const CHUNK = 500;
const CLOZE_MARKUP = /\{\{c\d+::/;

export interface CardsInfoRow {
  cardId: number;
  note: number;
  deckName: string;
  ord: number;
  type: number;
  queue: number;
  due: number;
  interval: number;
  factor: number;
  reps: number;
  lapses: number;
  left: number;
  odid: number;
  odue?: number;
  mod?: number;
  fields?: Record<string, { value: string; order: number }>;
  modelName: string;
}

interface NotesInfoRow {
  noteId: number;
  modelName: string;
  fields: Record<string, { value: string; order: number }>;
  tags: string[];
  cards: number[];
}

interface ReviewRow {
  id: number;
  ease: number;
  ivl?: number;
  interval?: number;
  time: number;
}

async function* chunked<T>(items: readonly T[], size: number): AsyncGenerator<T[]> {
  for (let i = 0; i < items.length; i += size) yield items.slice(i, i + size);
}

const MSG_SIZE_LIMIT = /maximum allowed size/i;

async function invokeRows<R>(
  invoke: AnkiConnectInvoker,
  action: string,
  paramKey: 'notes' | 'cards',
  ids: readonly number[],
): Promise<R[]> {
  try {
    return (await invoke(action, { [paramKey]: [...ids] })) as R[];
  } catch (err) {
    if (ids.length > 1 && err instanceof Error && MSG_SIZE_LIMIT.test(err.message)) {
      const mid = Math.ceil(ids.length / 2);
      const [a, b] = await Promise.all([
        invokeRows<R>(invoke, action, paramKey, ids.slice(0, mid)),
        invokeRows<R>(invoke, action, paramKey, ids.slice(mid)),
      ]);
      return [...a, ...b];
    }
    throw err;
  }
}

async function invokeCardMap(
  invoke: AnkiConnectInvoker,
  action: string,
  ids: readonly number[],
): Promise<Record<string, ReviewRow[]>> {
  try {
    return (await invoke(action, { cards: [...ids] })) as Record<string, ReviewRow[]>;
  } catch (err) {
    if (ids.length > 1 && err instanceof Error && MSG_SIZE_LIMIT.test(err.message)) {
      const mid = Math.ceil(ids.length / 2);
      const [a, b] = await Promise.all([
        invokeCardMap(invoke, action, ids.slice(0, mid)),
        invokeCardMap(invoke, action, ids.slice(mid)),
      ]);
      return { ...a, ...b };
    }
    throw err;
  }
}

export interface ConnectReadOptions {
  readonly signal?: AbortSignal;
  readonly onStage?: (stage: 'decks' | 'notetypes' | 'notes' | 'cards' | 'reviews', done: number, total: number) => void;
}

/** Read a live Anki collection through AnkiConnect into NormalizedAnkiData. */
export async function readViaAnkiConnect(
  invoke: AnkiConnectInvoker,
  opts: ConnectReadOptions = {},
): Promise<NormalizedAnkiData> {
  const throwIfAborted = (): void => { if (opts.signal?.aborted) throw new DOMException('Aborted', 'AbortError'); };

  // --- decks ---
  const deckIdsRaw = (await invoke('deckNamesAndIds')) as Record<string, number>;
  const decks: NormalizedAnkiDeck[] = Object.entries(deckIdsRaw).map(([name, id]) => ({
    id: String(id),
    name,
    filtered: false,
  }));
  for (const deck of decks) {
    throwIfAborted();
    try {
      const conf = (await invoke('getDeckConfig', { deck: deck.name })) as { dyn?: number } | null;
      if (conf && Number(conf.dyn) === 1) (deck as { filtered: boolean }).filtered = true;
    } catch {
      // heuristic fallback below (all cards have odid>0 → filtered)
    }
  }
  opts.onStage?.('decks', decks.length, decks.length);

  // --- notetypes ---
  const modelIdsRaw = (await invoke('modelNamesAndIds')) as Record<string, number> | undefined;
  let modelPairs: { id: string; name: string }[];
  if (modelIdsRaw && typeof modelIdsRaw === 'object') {
    modelPairs = Object.entries(modelIdsRaw).map(([name, id]) => ({ id: String(id), name }));
  } else {
    const names = (await invoke('modelNames')) as string[];
    modelPairs = names.map((name) => ({ id: name, name }));
  }
  const notetypes: NormalizedAnkiNotetype[] = [];
  for (const [i, m] of modelPairs.entries()) {
    throwIfAborted();
    const fieldNames = (await invoke('modelFieldNames', { modelName: m.name })) as string[];
    notetypes.push({
      id: m.id,
      name: m.name,
      isCloze: false, // refined after notes read (cloze markup detection)
      fields: fieldNames.map((name, ord) => ({ name, ord })),
    });
    opts.onStage?.('notetypes', i + 1, modelPairs.length);
  }
  const modelIdByName = new Map(modelPairs.map((m) => [m.name, m.id]));
  const fieldOrderByModel = new Map(notetypes.map((nt) => [nt.id, new Map(nt.fields.map((f) => [f.name, f.ord]))]));

  // --- notes ---
  const noteIds = (await invoke('findNotes', { query: '*' })) as number[];
  const notes: NormalizedAnkiNote[] = [];
  const noteCardIds: number[] = [];
  const clozeModels = new Set<string>();
  let noteDone = 0;
  for await (const chunk of chunked(noteIds, CHUNK)) {
    throwIfAborted();
    const infos = await invokeRows<NotesInfoRow>(invoke, 'notesInfo', 'notes', chunk);
    for (const info of infos) {
      const modelId = modelIdByName.get(info.modelName) ?? info.modelName;
      const order = fieldOrderByModel.get(modelId);
      const sorted = Object.entries(info.fields)
        .sort((a, b) => (order?.get(a[0]) ?? a[1].order) - (order?.get(b[0]) ?? b[1].order))
        .map(([, f]) => f.value);
      if (sorted.some((v) => CLOZE_MARKUP.test(v))) clozeModels.add(modelId);
      notes.push({ id: info.noteId, modelId, fields: sorted, tags: info.tags ?? [] });
      noteCardIds.push(...info.cards);
    }
    noteDone += chunk.length;
    opts.onStage?.('notes', noteDone, noteIds.length);
  }
  for (const nt of notetypes) {
    if (clozeModels.has(nt.id)) (nt as { isCloze: boolean }).isCloze = true;
  }

  // --- cards ---
  const cards: NormalizedAnkiCard[] = [];
  const deckIdByName = new Map(decks.map((d) => [d.name, d.id]));
  let cardDone = 0;
  for await (const chunk of chunked(noteCardIds, CHUNK)) {
    throwIfAborted();
    const infos = await invokeRows<CardsInfoRow>(invoke, 'cardsInfo', 'cards', chunk);
    for (const c of infos) {
      cards.push({
        id: c.cardId,
        noteId: c.note,
        deckId: deckIdByName.get(c.deckName) ?? c.deckName,
        ord: c.ord,
        type: c.type,
        queue: c.queue,
        due: c.due,
        ivl: c.interval ?? 0,
        factor: c.factor ?? 0,
        reps: c.reps ?? 0,
        lapses: c.lapses ?? 0,
        left: c.left ?? 0,
        odid: c.odid ?? 0,
      });
    }
    cardDone += chunk.length;
    opts.onStage?.('cards', cardDone, noteCardIds.length);
  }
  // Filtered-deck fallback: a deck whose cards ALL carry odid>0 is filtered.
  for (const deck of decks) {
    if (deck.filtered) continue;
    const inDeck = cards.filter((c) => c.deckId === deck.id);
    if (inDeck.length > 0 && inDeck.every((c) => c.odid !== 0)) {
      (deck as { filtered: boolean }).filtered = true;
    }
  }

  // --- reviews ---
  const revlog: NormalizedAnkiRevlog[] = [];
  let revDone = 0;
  for await (const chunk of chunked(noteCardIds, CHUNK)) {
    throwIfAborted();
    try {
      const reviews = await invokeCardMap(invoke, 'getReviewsOfCards', chunk);
      for (const [cardIdStr, list] of Object.entries(reviews)) {
        const cardId = Number(cardIdStr);
        for (const r of list) {
          revlog.push({ id: r.id, cardId, ease: r.ease, ivl: r.ivl ?? r.interval ?? 0, time: r.time });
        }
      }
    } catch {
      // action unsupported (e.g. AnkiconnectAndroid) — import continues without history
      break;
    }
    revDone += chunk.length;
    opts.onStage?.('reviews', revDone, noteCardIds.length);
  }

  const resolve: MediaResolver = async (filename) => {
    const b64 = (await invoke('retrieveMediaFile', { filename })) as string | false;
    if (!b64) return null;
    const bytes = decodeBase64ToArrayBuffer(b64);
    const ext = filename.slice(filename.lastIndexOf('.') + 1).toLowerCase();
    return { bytes, mimeType: extToMime(ext) };
  };

  const hasScheduling = cards.some((c) => c.ivl > 0 || c.reps > 0) || revlog.length > 0;

  return {
    source: 'ankiconnect',
    fidelity: 'estimated',
    hasScheduling,
    crtMs: null,
    decks,
    notetypes,
    notes,
    cards,
    revlog,
    media: {
      names: (await invoke('getMediaFilesNames', {}).catch(() => [])) as string[],
      resolve,
    },
  };
}
