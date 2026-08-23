// mediaLibraryRepository — IndexedDB persistence for local video player library
// + watch history + subtitle library.
//
// DB name: orca-local-player, version 2. Three object stores: videos (keyPath id),
// history (keyPath id, indexes: by_videoId, by_watchedAt), subtitles (keyPath id).
//
// IndexedDB stores any object supported by the structured clone algorithm
// (source: https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API).
// FileSystemFileHandle is serializable via structured clone (File System Access
// API), so it can be stored directly in a video/subtitle record.
// source: https://developer.mozilla.org/en-US/docs/Web/API/structuredClone

// ─── Schema constants ────────────────────────────────────────────────────────

export const DB_NAME = 'orca-local-player';
export const DB_VERSION = 2;

export const STORES = {
  VIDEOS: 'videos',
  HISTORY: 'history',
  SUBTITLES: 'subtitles',
} as const;

export const INDEXES = {
  by_videoId: 'by_videoId',
  by_watchedAt: 'by_watchedAt',
} as const;

// ─── Types ───────────────────────────────────────────────────────────────────

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
  /** Whether a matching subtitle was found during folder scan. */
  hasSubtitle?: boolean;
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

/** Get cached DB connection (or open on first call). */
async function getDB(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance;
  dbInstance = await openDB();
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

function reqToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

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
