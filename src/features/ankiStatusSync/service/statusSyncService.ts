/** statusSyncService — orchestrates Anki ↔ wordStatus ↔ Tihoka SRS status
 *  sync per spec anki-known-seed (REQ-3/4/5/6/7). */

import { STORAGE_KEYS } from '@/shared/config/config';
import { DEFAULT_ANKI_STATUS_SYNC_SETTINGS } from '@/shared/config/config';
import type { Settings } from '@/entities/settings';
import type {
  AnkiCardLink,
  AnkiStatusSyncState,
  AnkiSyncTrigger,
} from '@/entities/ankiStatusSync';
import type { SrsCard, SrsNote } from '@/entities/srs/types';
import {
  createDirectInvoker,
  getStoredAnkiConnectUrl,
  htmlToText,
} from '@/features/ankiImport';
import type { AnkiConnectInvoker } from '@/features/ankiImport';
import { normalizeTerm, setWordStatusFromSync, setWordStatusesFromSync } from '@/features/dictionary';
import type { SyncStatusUpdate } from '@/features/dictionary';
import { getSrsDB, SRS_STORES } from '@/features/srs';
import { logger } from '@/shared/lib/logger';
import {
  ankiCardOutcome,
  mergeOutcomes,
  outcomeToStatus,
  srsCardOutcome,
} from '../lib/statusRules';
import { parseFeedBody } from '../lib/feedParser';
import {
  buildWriteBack,
  todayIndexFromProbe,
  TODAY_INDEX_PROBE_OFFSETS,
} from '../lib/writeBack';
import {
  appendWriteBackLog,
  dequeueWriteBack,
  enqueueWriteBack,
  getLinksByTerm,
  getSyncState,
  listWriteBackQueue,
  putLinks,
  putSyncState,
} from '../repositories/statusSyncStorage';
import { ANKI_QUEUE } from '../lib/statusRules';

export const ANKI_STATUS_SYNC_ALARM = 'cell.ankiStatusSync.tick';
export const ANKI_SYNC_PERIOD_MINUTES = 5;

interface CardsInfoRow {
  readonly cardId: number;
  readonly note: number;
  readonly queue: number;
  readonly due: number;
  readonly interval: number;
  readonly odid: number;
  readonly odue?: number;
  readonly mod?: number;
  readonly fields?: Record<string, { value: string; order: number }>;
}

export interface SyncRunResult {
  readonly ok: boolean;
  readonly offline: boolean;
  readonly addonOnline: boolean;
  readonly cardsSeen: number;
  readonly changed: number;
  readonly errors: number;
  readonly writeBacksFlushed: number;
}

interface RunDeps {
  readonly invoke?: AnkiConnectInvoker;
  readonly fetchFeed?: (url: string) => Promise<string>;
  readonly settings?: Settings;
  readonly now?: () => number;
}

const CLOCK_SKEW_MS = 5 * 60 * 1000;

async function loadSettings(): Promise<Settings | undefined> {
  try {
    const data = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
    return data?.[STORAGE_KEYS.SETTINGS] as Settings | undefined;
  } catch {
    return undefined;
  }
}

async function activeLangCode(settings: Settings | undefined): Promise<string | null> {
  const profiles = settings?.languageProfiles ?? [];
  const active = profiles.find((p) => p.id === settings?.activeProfileId) ?? profiles[0];
  return active?.target ?? null;
}

function getTermFromCard(card: CardsInfoRow): string | null {
  const fields = card.fields;
  if (fields) {
    const first = Object.values(fields).sort((a, b) => a.order - b.order)[0];
    const term = normalizeTerm(htmlToText(first?.value ?? ''));
    if (term) return term;
  }
  return null;
}

async function srsOutcomesByTerm(
  langCode: string,
): Promise<Map<string, 'learning' | 'known'>> {
  const map = new Map<string, 'learning' | 'known'>();
  try {
    const db = await getSrsDB();
    const tx = db.transaction(
      [SRS_STORES.COLLECTIONS, SRS_STORES.DECKS, SRS_STORES.NOTES, SRS_STORES.CARDS],
      'readonly',
    );
    const collections = await idbAll<{ id: string; targetLanguage: string }>(
      tx.objectStore(SRS_STORES.COLLECTIONS),
    );
    const decks = await idbAll<{ id: string; collectionId: string }>(
      tx.objectStore(SRS_STORES.DECKS),
    );
    const notes = await idbAll<SrsNote>(tx.objectStore(SRS_STORES.NOTES));
    const cards = await idbAll<SrsCard>(tx.objectStore(SRS_STORES.CARDS));
    const langByCollection = new Map(collections.map((c) => [c.id, c.targetLanguage]));
    const collectionByDeck = new Map(decks.map((d) => [d.id, d.collectionId]));
    const termByNote = new Map<string, string>();
    for (const note of notes) {
      const collectionId = collectionByDeck.get(note.deckId);
      const target = collectionId ? langByCollection.get(collectionId) : undefined;
      if (target !== undefined && target !== langCode) continue;
      if (note.targetWord) termByNote.set(note.id, normalizeTerm(note.targetWord));
    }
    for (const card of cards) {
      const term = termByNote.get(card.noteId);
      if (!term) continue;
      const maxDays = Math.max(
        0,
        ...Object.values(card.components ?? {}).map((c) => c.fsrsState?.scheduledDays ?? 0),
      );
      const outcome = srsCardOutcome({ scheduledDays: maxDays });
      if (outcome === 'skip') continue;
      const prev = map.get(term);
      if (prev !== 'known') map.set(term, outcome);
    }
  } catch (err) {
    logger.warn('anki-status-sync: srs scan failed', { error: errMessage(err) });
  }
  return map;
}

function idbGet<T>(store: IDBObjectStore, key: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const r = store.get(key);
    r.onsuccess = () => resolve(r.result as T | undefined);
    r.onerror = () => reject(r.error ?? new Error('idb get failed'));
  });
}

function idbAll<T>(store: IDBObjectStore): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const r = store.getAll();
    r.onsuccess = () => resolve(r.result as T[]);
    r.onerror = () => reject(r.error ?? new Error('idb getAll failed'));
  });
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function fetchAddonFeed(port: number, cursor: number): Promise<string> {
  const url = `http://127.0.0.1:${port}/events?since=${cursor}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
  if (!res.ok) throw new Error(`addon feed ${res.status}`);
  return res.text();
}

/** SRS → wordStatus: call after a review write completes (REQ-4). */
export async function syncSrsReviewToStatus(
  note: SrsNote,
  card: SrsCard,
): Promise<void> {
  try {
    const settings = await loadSettings();
    if (settings?.ankiStatusSync?.enabled === false) return;
    const db = await getSrsDB();
    const tx = db.transaction([SRS_STORES.DECKS, SRS_STORES.COLLECTIONS], 'readonly');
    const deck = await idbGet<{ collectionId: string }>(tx.objectStore(SRS_STORES.DECKS), note.deckId);
    const collection = deck
      ? await idbGet<{ targetLanguage: string }>(tx.objectStore(SRS_STORES.COLLECTIONS), deck.collectionId)
      : undefined;
    const langCode = collection?.targetLanguage ?? (await activeLangCode(settings));
    const term = normalizeTerm(note.targetWord ?? '');
    if (!langCode || !term) return;
    const maxDays = Math.max(
      0,
      ...Object.values(card.components ?? {}).map((c) => c.fsrsState?.scheduledDays ?? 0),
    );
    const status = outcomeToStatus(srsCardOutcome({ scheduledDays: maxDays }));
    if (!status) return;
    await setWordStatusFromSync(langCode, term, status, {
      source: 'srs',
      sourceAt: Date.now(),
    });
  } catch (err) {
    logger.warn('anki-status-sync: srs review hook failed', { error: errMessage(err) });
  }
}

/** Enqueue Anki write-back for a user-originated `known` write (REQ-5).
 *  No-op unless sync + write-back are both enabled; never throws — the
 *  user-facing status write must never be blocked by Anki availability. */
export async function notifyUserMarkedKnown(langCode: string, term: string): Promise<void> {
  try {
    const settings = await loadSettings();
    const cfg = settings?.ankiStatusSync ?? DEFAULT_ANKI_STATUS_SYNC_SETTINGS;
    if (!cfg.enabled || !cfg.writeBackEnabled) return;
    const links = await getLinksByTerm(normalizeTerm(term));
    for (const link of links) {
      if (link.queue === ANKI_QUEUE.suspended) continue;
      await enqueueWriteBack({
        cardId: link.cardId,
        term: link.term,
        langCode,
        enqueuedAt: Date.now(),
        attempts: 0,
      });
    }
  } catch (err) {
    logger.warn('anki-status-sync: enqueue write-back failed', { error: errMessage(err) });
  }
}

async function resolveTodayIndex(invoke: AnkiConnectInvoker): Promise<number> {
  for (const offset of TODAY_INDEX_PROBE_OFFSETS) {
    try {
      const ids = (await invoke('findCards', {
        query: `is:review prop:due=${offset}`,
      })) as number[];
      if (!Array.isArray(ids) || ids.length === 0) continue;
      const infos = (await invoke('cardsInfo', { cards: [ids[0]] })) as CardsInfoRow[];
      const due = infos?.[0]?.due;
      if (typeof due === 'number' && Number.isFinite(due)) {
        return todayIndexFromProbe(due, offset);
      }
    } catch {
      continue;
    }
  }
  return 1;
}

async function flushWriteBackQueue(
  invoke: AnkiConnectInvoker,
  cfg: { writeBackEnabled: boolean },
): Promise<number> {
  if (!cfg.writeBackEnabled) return 0;
  const now = Date.now();
  const tasks = await listWriteBackQueue(now);
  if (tasks.length === 0) return 0;
  let flushed = 0;
  const todayIndex = await resolveTodayIndex(invoke);
  let cardsById: Map<number, CardsInfoRow> | null;
  try {
    const infos = (await invoke('cardsInfo', {
      cards: tasks.map((task) => task.cardId),
    })) as CardsInfoRow[];
    cardsById = new Map((infos ?? []).map((info) => [info.cardId, info]));
  } catch {
    cardsById = null;
  }
  for (const task of tasks) {
    try {
      const card = cardsById
        ? cardsById.get(task.cardId)
        : ((await invoke('cardsInfo', { cards: [task.cardId] })) as CardsInfoRow[])?.[0];
      if (!card) {
        await dequeueWriteBack(task.cardId);
        await appendWriteBackLog({
          cardId: task.cardId,
          term: task.term,
          ok: false,
          reason: 'card-missing',
          at: now,
        });
        continue;
      }
      const plan = buildWriteBack(
        {
          id: card.cardId,
          queue: card.queue,
          ivl: card.interval ?? 0,
          due: card.due,
          odid: card.odid ?? 0,
          odue: card.odue,
        },
        todayIndex,
      );
      if (!plan) {
        await dequeueWriteBack(task.cardId);
        await appendWriteBackLog({
          cardId: task.cardId,
          term: task.term,
          ok: false,
          reason: 'suspended',
          at: now,
        });
        continue;
      }
      if (plan.reason === 'already-mature') {
        await dequeueWriteBack(task.cardId);
        await appendWriteBackLog({
          cardId: task.cardId,
          term: task.term,
          ok: true,
          reason: 'already-mature',
          at: now,
        });
        flushed += 1;
        continue;
      }
      await invoke('setSpecificValueOfCard', {
        card: plan.params.card,
        keys: [...plan.params.keys],
        values: [...plan.params.values],
      });
      await dequeueWriteBack(task.cardId);
      await appendWriteBackLog({
        cardId: task.cardId,
        term: task.term,
        ok: true,
        reason: plan.reason,
        at: now,
      });
      flushed += 1;
    } catch (err) {
      const message = errMessage(err);
      if (/unknown action|unsupported|no such/i.test(message)) {
        const state = await getSyncState();
        await putSyncState({ ...state, writeBackUnsupportedNotified: true });
        await dequeueWriteBack(task.cardId);
        await appendWriteBackLog({
          cardId: task.cardId,
          term: task.term,
          ok: false,
          reason: 'unsupported',
          at: now,
        });
        continue;
      }
      await enqueueWriteBack({ ...task, attempts: task.attempts + 1 });
      await appendWriteBackLog({
        cardId: task.cardId,
        term: task.term,
        ok: false,
        reason: message.slice(0, 120),
        at: now,
      });
    }
  }
  return flushed;
}

interface ChangedCard extends CardsInfoRow {
  readonly term: string | null;
}

async function changedCardsViaAddon(
  port: number,
  state: AnkiStatusSyncState,
  invoke: AnkiConnectInvoker,
): Promise<{ cards: ChangedCard[]; nextCursor: number } | null> {
  try {
    const body = await fetchAddonFeed(port, state.addonCursor);
    const parsed = parseFeedBody(body);
    if (!parsed) return { cards: [], nextCursor: state.addonCursor };
    if (parsed.events.length === 0) {
      return { cards: [], nextCursor: Math.max(state.addonCursor, parsed.cursor) };
    }
    const ids = [...new Set(parsed.events.map((e) => e.cardId))];
    const infos = (await invoke('cardsInfo', { cards: ids })) as CardsInfoRow[];
    const cards: ChangedCard[] = [];
    for (const info of infos ?? []) {
      cards.push({ ...info, term: getTermFromCard(info) });
    }
    return { cards, nextCursor: Math.max(state.addonCursor, parsed.cursor) };
  } catch {
    return null;
  }
}

async function changedCardsViaPoll(
  invoke: AnkiConnectInvoker,
  lastSyncAt: number | null,
): Promise<ChangedCard[]> {
  const days = lastSyncAt === null ? 7 : Math.max(1, Math.ceil((Date.now() - lastSyncAt) / 86400000) + 1);
  const ids = (await invoke('findCards', { query: `edited:${days}` })) as number[];
  if (!Array.isArray(ids) || ids.length === 0) return [];
  const lastSyncSec = lastSyncAt === null ? 0 : Math.floor(lastSyncAt / 1000);
  const changed: ChangedCard[] = [];
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500);
    const infos = (await invoke('cardsInfo', { cards: chunk })) as CardsInfoRow[];
    for (const info of infos ?? []) {
      if (typeof info.mod === 'number' && info.mod <= lastSyncSec) continue;
      changed.push({ ...info, term: getTermFromCard(info) });
    }
  }
  return changed;
}

/** Run one sync pass (REQ-3/6 + write-back flush). Never throws. */
export async function runAnkiStatusSync(
  trigger: AnkiSyncTrigger,
  deps: RunDeps = {},
): Promise<SyncRunResult> {
  const settings = deps.settings ?? (await loadSettings());
  const cfg = settings?.ankiStatusSync ?? DEFAULT_ANKI_STATUS_SYNC_SETTINGS;
  const now = deps.now?.() ?? Date.now();
  const empty: SyncRunResult = {
    ok: false,
    offline: false,
    addonOnline: false,
    cardsSeen: 0,
    changed: 0,
    errors: 0,
    writeBacksFlushed: 0,
  };
  if (!cfg.enabled) return { ...empty, ok: true };
  const langCode = await activeLangCode(settings);
  if (!langCode) return { ...empty, ok: true };

  const invoke =
    deps.invoke ?? createDirectInvoker(await getStoredAnkiConnectUrl());
  const state = await getSyncState();

  try {
    await invoke('version');
  } catch (err) {
    await putSyncState({
      ...state,
      lastSyncAt: now,
      lastTrigger: trigger,
      consecutiveFailures: state.consecutiveFailures + 1,
      errors: state.errors + 1,
    });
    if (trigger === 'manual') throw err;
    return { ...empty, ok: true, offline: true };
  }

  let addonOnline = false;
  let nextCursor = state.addonCursor;
  const feed = await changedCardsViaAddon(cfg.addonPort, state, invoke);
  let cards: ChangedCard[];
  if (feed !== null) {
    addonOnline = true;
    cards = feed.cards;
    nextCursor = feed.nextCursor;
  } else {
    cards = await changedCardsViaPoll(invoke, state.lastSyncAt);
  }

  const srsMap = await srsOutcomesByTerm(langCode);
  const byTerm = new Map<string, { sourceAt: number; outcomes: ('known' | 'learning' | 'skip')[] }>();
  const links: AnkiCardLink[] = [];
  let errors = 0;
  for (const card of cards) {
    try {
      if (!card.term) continue;
      links.push({
        cardId: card.cardId,
        term: card.term,
        langCode,
        queue: card.queue,
        ivl: card.interval ?? 0,
        mod: card.mod ?? 0,
      });
      const entry = byTerm.get(card.term) ?? { sourceAt: 0, outcomes: [] };
      entry.outcomes.push(ankiCardOutcome({ queue: card.queue, ivl: card.interval ?? 0 }));
      const sourceAt = (card.mod ?? 0) * 1000 - 1;
      if (sourceAt > entry.sourceAt) entry.sourceAt = sourceAt;
      byTerm.set(card.term, entry);
    } catch (err) {
      errors += 1;
      logger.warn('anki-status-sync: malformed card row', { error: errMessage(err) });
    }
  }
  if (links.length > 0) await putLinks(links);

  let changed = 0;
  const statusUpdates: SyncStatusUpdate[] = [];
  for (const [term, agg] of byTerm) {
    const merged = mergeOutcomes([...agg.outcomes, srsMap.get(term) ?? 'skip']);
    const status = outcomeToStatus(merged);
    if (!status) continue;
    let sourceAt = agg.sourceAt;
    if (sourceAt > now + CLOCK_SKEW_MS) {
      logger.warn('anki-status-sync: clock skew clamped', { term });
      sourceAt = now;
    }
    statusUpdates.push({ term, status, sourceAt });
  }
  try {
    changed = (await setWordStatusesFromSync(langCode, statusUpdates, { source: 'anki' })).written;
  } catch (err) {
    errors += 1;
    logger.warn('anki-status-sync: status write failed', {
      terms: statusUpdates.length,
      error: errMessage(err),
    });
  }

  let writeBacksFlushed = 0;
  try {
    writeBacksFlushed = await flushWriteBackQueue(invoke, cfg);
  } catch (err) {
    errors += 1;
    logger.warn('anki-status-sync: write-back flush failed', { error: errMessage(err) });
  }

  await putSyncState({
    ...state,
    lastSyncAt: now,
    lastTrigger: trigger,
    cardsSeen: cards.length,
    changed,
    errors: state.errors + errors,
    consecutiveFailures: errors > 0 ? state.consecutiveFailures + 1 : 0,
    addonOnline,
    addonCursor: nextCursor,
  });

  return {
    ok: errors === 0,
    offline: false,
    addonOnline,
    cardsSeen: cards.length,
    changed,
    errors,
    writeBacksFlushed,
  };
}

export { getSyncState };

/** Post-import seed: map every Tihoka SRS card's maturity to wordStatus
 *  (REQ-4 alt flow). Runs after an Anki import completes; never throws. */
export async function seedStatusesFromSrs(): Promise<void> {
  try {
    const settings = await loadSettings();
    if (settings?.ankiStatusSync?.enabled === false) return;
    const langCode = await activeLangCode(settings);
    if (!langCode) return;
    const map = await srsOutcomesByTerm(langCode);
    const now = Date.now();
    const updates: SyncStatusUpdate[] = [...map.entries()].map(([term, outcome]) => ({
      term,
      status: outcome,
      sourceAt: now,
    }));
    try {
      await setWordStatusesFromSync(langCode, updates, { source: 'srs' });
    } catch (err) {
      logger.warn('anki-status-sync: srs seed write failed', {
        terms: updates.length,
        error: errMessage(err),
      });
    }
  } catch (err) {
    logger.warn('anki-status-sync: srs seed failed', { error: errMessage(err) });
  }
}
