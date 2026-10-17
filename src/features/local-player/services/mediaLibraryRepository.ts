// mediaLibraryRepository — IndexedDB persistence for local video player library
// + watch history + subtitle library.
//
// DB name: orca-local-player, version 4. Stores: videos (keyPath id),
// history (keyPath id, indexes: by_videoId, by_watchedAt), subtitles (keyPath id),
// condensedAudio (keyPath id), sessionEvents (keyPath id, index: by_at).
//
// IndexedDB stores any object supported by the structured clone algorithm
// (source: https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API).
// FileSystemFileHandle is serializable via structured clone (File System Access
// API), so it can be stored directly in a video/subtitle record.
// source: https://developer.mozilla.org/en-US/docs/Web/API/structuredClone

import type { ComprehensionBand } from '@/entities/comprehension';
import { idbRequest, txDone } from '@/shared/lib/storage/idb';

// ─── Schema constants ────────────────────────────────────────────────────────

export const DB_NAME = 'orca-local-player';
export const DB_VERSION = 4;

export const STORES = {
  VIDEOS: 'videos',
  HISTORY: 'history',
  SUBTITLES: 'subtitles',
  CONDENSED_AUDIO: 'condensedAudio',
  SESSION_EVENTS: 'sessionEvents',
} as const;

export const INDEXES = {
  by_videoId: 'by_videoId',
  by_watchedAt: 'by_watchedAt',
  by_at: 'by_at',
} as const;

// ─── Types ───────────────────────────────────────────────────────────────────

export type VideoComprehension = {
  coverage: number;
  band: ComprehensionBand;
  newTerms: number;
  subtitleFilename: string;
  computedAt: string;
};

export type VideoRecord = {
  id: string;
  filename: string;
  title: string;
  durationMs: number;
  addedAt: string;
  lastWatchedAt: string | null;
  resumePositionMs: number;
  fileSizeBytes?: number;
  width?: number;
  height?: number;
  codec?: string;
  fileHandle?: FileSystemFileHandle;
  /** Parent directory handle — enables subtitle auto-match by scanning the
   *  video's folder when the video is reopened from the library.
   *  FileSystemDirectoryHandle is structured-cloneable → persists in IndexedDB. */
  dirHandle?: FileSystemDirectoryHandle;
  /** Whether a matching subtitle was found during folder scan. */
  hasSubtitle?: boolean;
  /** Cached comprehension score of the matched target subtitle (i1-content-queue).
   *  Optional — old records lack it; statuses are the source of truth. */
  comprehension?: VideoComprehension;
};

export type HistoryRecord = {
  id: string;
  videoId: string;
  watchedAt: string;
  watchDurationMs: number;
  positionMs: number;
};

export type SubtitleRecord = {
  id: string;
  filename: string;
  languageCode: string | null;
  addedAt: string;
  fileHandle?: FileSystemFileHandle;
};

export type SessionEventSurface = 'stream' | 'local-player' | 'other';

export type SessionEvent = {
  id: string;
  at: number;
  tabId: number;
  surface: SessionEventSurface;
  kind: 'lookup' | 'status';
  term: string;
  langCode?: string;
  status?: string;
  pos?: string;
};

// ─── DB connection (singleton) ───────────────────────────────────────────────

let dbInstance: IDBDatabase | null = null;

/** Create all object stores + indexes (v1 create-all, idempotent). */
function createStores(db: IDBDatabase): void {
  if (!db.objectStoreNames.contains(STORES.VIDEOS)) {
    db.createObjectStore(STORES.VIDEOS, { keyPath: 'id' });
  }
  if (!db.objectStoreNames.contains(STORES.HISTORY)) {
    const history = db.createObjectStore(STORES.HISTORY, { keyPath: 'id' });
    history.createIndex(INDEXES.by_videoId, 'videoId', { unique: false });
    history.createIndex(INDEXES.by_watchedAt, 'watchedAt', { unique: false });
  }
  if (!db.objectStoreNames.contains(STORES.SUBTITLES)) {
    db.createObjectStore(STORES.SUBTITLES, { keyPath: 'id' });
  }
  if (!db.objectStoreNames.contains(STORES.CONDENSED_AUDIO)) {
    db.createObjectStore(STORES.CONDENSED_AUDIO, { keyPath: 'id' });
  }
  if (!db.objectStoreNames.contains(STORES.SESSION_EVENTS)) {
    const events = db.createObjectStore(STORES.SESSION_EVENTS, { keyPath: 'id' });
    events.createIndex(INDEXES.by_at, 'at', { unique: false });
  }
}

/** Open the orca-local-player IndexedDB with v1 create-all migration. */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => createStores(request.result);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('IndexedDB open blocked'));
  });
}

/** Get cached DB connection (or open on first call). Exported so sibling
 *  repositories persisting in the same DB (condensedAudio) share the
 *  connection + migration path. */
export async function getDB(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance;
  const db = await openDB();
  db.onversionchange = () => {
    db.close();
    if (dbInstance === db) dbInstance = null;
  };
  dbInstance = db;
  return dbInstance;
}

/** Close + clear cached DB connection (test cleanup). */
export function closeDB(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

/** Delete the entire database (test cleanup). */
export async function deleteDB(): Promise<void> {
  closeDB();
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('IndexedDB delete blocked'));
  });
}

// ─── IDB request helpers ─────────────────────────────────────────────────────

const reqToPromise = idbRequest;

// ─── Video CRUD ──────────────────────────────────────────────────────────────

/** Upsert a video record (put by keyPath id). */
export async function saveVideo(video: VideoRecord): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(STORES.VIDEOS, 'readwrite');
  tx.objectStore(STORES.VIDEOS).put(video);
  await txDone(tx);
}

/** Get a single video by id, or undefined if not found. */
export async function getVideo(id: string): Promise<VideoRecord | undefined> {
  const db = await getDB();
  const tx = db.transaction(STORES.VIDEOS, 'readonly');
  return reqToPromise(tx.objectStore(STORES.VIDEOS).get(id)) as Promise<
    VideoRecord | undefined
  >;
}

/** Get all video records (unsorted — use librarySort for display ordering). */
export async function getAllVideos(): Promise<VideoRecord[]> {
  const db = await getDB();
  const tx = db.transaction(STORES.VIDEOS, 'readonly');
  return reqToPromise(tx.objectStore(STORES.VIDEOS).getAll()) as Promise<
    VideoRecord[]
  >;
}

/** Delete a video by id. No-op if the id does not exist. */
export async function deleteVideo(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(STORES.VIDEOS, 'readwrite');
  tx.objectStore(STORES.VIDEOS).delete(id);
  await txDone(tx);
}

/** Update only resumePositionMs + lastWatchedAt on an existing video record. */
export async function updateResumePosition(
  id: string,
  resumePositionMs: number,
  lastWatchedAt: string,
): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(STORES.VIDEOS, 'readwrite');
  const store = tx.objectStore(STORES.VIDEOS);
  const existing = (await reqToPromise(store.get(id))) as
    | VideoRecord
    | undefined;
  if (!existing) throw new Error(`Video not found: ${id}`);
  store.put({ ...existing, resumePositionMs, lastWatchedAt });
  await txDone(tx);
}

/** Merge a fresh comprehension score onto the current record in one tx.
 *  No-op when the video no longer exists (deleted mid-scoring-run). */
export async function updateVideoComprehension(
  id: string,
  comprehension: VideoComprehension,
): Promise<boolean> {
  const db = await getDB();
  const tx = db.transaction(STORES.VIDEOS, 'readwrite');
  const store = tx.objectStore(STORES.VIDEOS);
  const existing = (await reqToPromise(store.get(id))) as
    | VideoRecord
    | undefined;
  if (!existing) {
    await txDone(tx).catch(() => {});
    return false;
  }
  store.put({ ...existing, comprehension });
  await txDone(tx);
  return true;
}

// ─── History ─────────────────────────────────────────────────────────────────

/** Upsert a history entry (put by keyPath id). */
export async function addHistoryEntry(entry: HistoryRecord): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(STORES.HISTORY, 'readwrite');
  tx.objectStore(STORES.HISTORY).put(entry);
  await txDone(tx);
}

/** Get all history entries sorted by watchedAt descending (most recent first). */
export async function getHistory(): Promise<HistoryRecord[]> {
  const db = await getDB();
  const tx = db.transaction(STORES.HISTORY, 'readonly');
  const all = (await reqToPromise(
    tx.objectStore(STORES.HISTORY).getAll(),
  )) as HistoryRecord[];
  // ISO 8601 strings sort chronologically via localeCompare.
  return all.sort((a, b) => b.watchedAt.localeCompare(a.watchedAt));
}

/** Remove all history entries. */
export async function clearHistory(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(STORES.HISTORY, 'readwrite');
  tx.objectStore(STORES.HISTORY).clear();
  await txDone(tx);
}

/** Delete all video records (library bulk clear). */
export async function clearAllVideos(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(STORES.VIDEOS, 'readwrite');
  tx.objectStore(STORES.VIDEOS).clear();
  await txDone(tx);
}

// ─── Subtitle CRUD ───────────────────────────────────────────────────────────

/** Upsert a subtitle record (put by keyPath id). */
export async function saveSubtitle(subtitle: SubtitleRecord): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(STORES.SUBTITLES, 'readwrite');
  tx.objectStore(STORES.SUBTITLES).put(subtitle);
  await txDone(tx);
}

/** Get all subtitle records (unsorted). */
export async function getAllSubtitles(): Promise<SubtitleRecord[]> {
  const db = await getDB();
  const tx = db.transaction(STORES.SUBTITLES, 'readonly');
  return reqToPromise(tx.objectStore(STORES.SUBTITLES).getAll()) as Promise<
    SubtitleRecord[]
  >;
}

/** Get a single subtitle by id, or undefined if not found. */
export async function getSubtitle(id: string): Promise<SubtitleRecord | undefined> {
  const db = await getDB();
  const tx = db.transaction(STORES.SUBTITLES, 'readonly');
  return reqToPromise(tx.objectStore(STORES.SUBTITLES).get(id)) as Promise<
    SubtitleRecord | undefined
  >;
}

/** Delete a subtitle by id. No-op if the id does not exist. */
export async function deleteSubtitle(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(STORES.SUBTITLES, 'readwrite');
  tx.objectStore(STORES.SUBTITLES).delete(id);
  await txDone(tx);
}

/** Delete all subtitle records (library bulk clear). */
export async function clearAllSubtitles(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(STORES.SUBTITLES, 'readwrite');
  tx.objectStore(STORES.SUBTITLES).clear();
  await txDone(tx);
}

// ─── Session events ──────────────────────────────────────────────────────────

/** Append a session event. Best-effort: the caller treats persistence failure
 *  as a dropped event (fail-closed), never as a request error. */
export async function addSessionEvent(event: SessionEvent): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(STORES.SESSION_EVENTS, 'readwrite');
  tx.objectStore(STORES.SESSION_EVENTS).put(event);
  await txDone(tx);
}

/** Get session events with `at` in [sinceMs, untilMs], ascending. */
export async function getSessionEventsInRange(
  sinceMs: number,
  untilMs: number,
): Promise<SessionEvent[]> {
  const db = await getDB();
  const tx = db.transaction(STORES.SESSION_EVENTS, 'readonly');
  const range = IDBKeyRange.bound(sinceMs, untilMs);
  const all = (await reqToPromise(
    tx.objectStore(STORES.SESSION_EVENTS).index(INDEXES.by_at).getAll(range),
  )) as SessionEvent[];
  return all.sort((a, b) => a.at - b.at);
}

/** Delete events older than `olderThanMs`. Guarded so repeated calls within
 *  one process lifetime only sweep once. */
let sessionEventsPruned = false;
export async function pruneSessionEventsOnce(olderThanMs: number): Promise<void> {
  if (sessionEventsPruned) return;
  sessionEventsPruned = true;
  const db = await getDB();
  const range = IDBKeyRange.upperBound(olderThanMs);
  for (;;) {
    const tx = db.transaction(STORES.SESSION_EVENTS, 'readwrite', { durability: 'relaxed' });
    const keys = (await reqToPromise(
      tx.objectStore(STORES.SESSION_EVENTS).index(INDEXES.by_at).getAllKeys(range, 128),
    )) as IDBValidKey[];
    const store = tx.objectStore(STORES.SESSION_EVENTS);
    for (const key of keys) store.delete(key);
    await txDone(tx);
    if (keys.length < 128) break;
    await new Promise((r) => setTimeout(r, 16));
  }
}
