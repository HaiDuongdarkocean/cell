/**
 * Per-key subtitle quota ledger — serialized mutations in background SW.
 *
 * Single owner: background. Content-scripts never read-modify-write here
 * (concurrent tabs would clobber). All mutations go through a promise chain
 * so async ops interleave safely even though the SW is single-threaded.
 *
 * Storage: `chrome.storage.session` (per-profile, not synced, survives SW
 * restart). Key: `STORAGE_KEYS.SUBTITLE_KEY_LEDGER`.
 *
 * Spec: docs/specs/subtitle-search.md (key ledger section).
 * Docs: https://developer.chrome.com/docs/extensions/reference/api/storage
 */
import { STORAGE_KEYS } from '@/shared/config/config';
import { getSessionStorage, setSessionStorage } from '@/shared/lib/chrome-apis';
import type { SubtitleApiKey } from '@/entities/settings/types';
import type { KeyQuotaInfo } from '@/features/subtitle/logic/subtitleSearchTypes';

// === Internal ledger entry ===

/** Internal shape persisted to session storage. */
export interface KeyLedgerEntry {
  readonly keyId: string;
  readonly provider: string;
  /** Downloads remaining in the current quota window. */
  remaining: number;
  /** Epoch ms when the window resets (quota refill). */
  resetAt: number;
  /** Epoch ms of the last download via this key (round-robin cursor). */
  lastDownloadAt: number;
}

// === Serialization ===

type LedgerRecord = Record<string, KeyLedgerEntry>;

function toRecord(ledger: Map<string, KeyLedgerEntry>): LedgerRecord {
  return Object.fromEntries(ledger);
}

function toMap(record: LedgerRecord | undefined): Map<string, KeyLedgerEntry> {
  if (!record) return new Map();
  return new Map(Object.entries(record));
}

// === Promise-chain serialization ===

// SW is single-threaded but async storage ops can interleave. A simple
// promise chain serializes all mutations so load-modify-save is atomic.
let chain: Promise<unknown> = Promise.resolve();

function runSerialized<T>(task: () => Promise<T>): Promise<T> {
  const result = chain.then(task);
  // Keep the chain alive even if a task rejects, so one failure doesn't
  // block subsequent mutations.
  chain = result.catch(() => undefined);
  return result;
}

// === Public API ===

/** Load the full ledger from session storage. */
export async function loadLedger(): Promise<Map<string, KeyLedgerEntry>> {
  const data = await getSessionStorage<Record<string, unknown>>(
    STORAGE_KEYS.SUBTITLE_KEY_LEDGER,
  );
  const record = data[STORAGE_KEYS.SUBTITLE_KEY_LEDGER] as
    | LedgerRecord
    | undefined;
  return toMap(record);
}

/** Save the full ledger to session storage. */
export async function saveLedger(
  ledger: Map<string, KeyLedgerEntry>,
): Promise<void> {
  await setSessionStorage({
    [STORAGE_KEYS.SUBTITLE_KEY_LEDGER]: toRecord(ledger),
  });
}

/**
 * Update a key's quota after an OpenSubtitles download response (which
 * returns `remaining` + `reset_time_utc`). Serialized.
 */
export function updateQuotaAfterDownload(
  keyId: string,
  remaining: number,
  resetAtUtc: number,
): Promise<void> {
  return runSerialized(async () => {
    const ledger = await loadLedger();
    const entry = ledger.get(keyId);
    if (!entry) return;
    ledger.set(keyId, {
      ...entry,
      remaining,
      resetAt: resetAtUtc,
      lastDownloadAt: Date.now(),
    });
    await saveLedger(ledger);
  });
}

/**
 * Decrement a key's remaining count after a SubDL download (SubDL returns
 * no quota info, so we decrement locally). Never below 0. Serialized.
 */
export function decrementDownload(keyId: string): Promise<void> {
  return runSerialized(async () => {
    const ledger = await loadLedger();
    const entry = ledger.get(keyId);
    if (!entry) return;
    ledger.set(keyId, {
      ...entry,
      remaining: Math.max(0, entry.remaining - 1),
      lastDownloadAt: Date.now(),
    });
    await saveLedger(ledger);
  });
}

/**
 * Read ledger entries as {@link KeyQuotaInfo} for UI. Optionally filter by
 * provider. Read-only, no serialization needed.
 */
export async function getQuotaInfo(
  provider?: string,
): Promise<KeyQuotaInfo[]> {
  const ledger = await loadLedger();
  const entries = [...ledger.values()];
  const filtered = provider
    ? entries.filter((e) => e.provider === provider)
    : entries;
  return filtered.map((e) => ({
    keyId: e.keyId,
    remaining: e.remaining,
    resetAt: e.resetAt,
  }));
}

/**
 * Add a new key to the ledger with a default quota. If the key already
 * exists, this is a no-op (preserves live quota state). Serialized.
 */
export function initKeyInLedger(
  key: SubtitleApiKey,
  defaultQuota: number,
): Promise<void> {
  return runSerialized(async () => {
    const ledger = await loadLedger();
    if (ledger.has(key.id)) return;
    const now = Date.now();
    ledger.set(key.id, {
      keyId: key.id,
      provider: key.provider,
      remaining: defaultQuota,
      resetAt: now,
      lastDownloadAt: 0,
    });
    await saveLedger(ledger);
  });
}
