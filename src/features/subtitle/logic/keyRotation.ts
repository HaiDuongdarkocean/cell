/**
 * Pure key rotation functions — no side effects, no fetch, no storage.
 *
 * Used by background handlers to pick which API key to use for search vs
 * download. Round-robin by oldest `addedAt` (O(n) scan, never sort —
 * AGENTS.md forbids O(n log n)).
 *
 * @see docs/specs/subtitle-search.md (key rotation section)
 */

import type {
  SubtitleApiKey,
  SubtitleApiKeyProvider,
  SubtitleApiKeyStatus,
} from '@/entities/settings/types';

/**
 * True if a key is usable right now: either already active, or rate-limited
 * but its cooldown has expired (`rateLimitedUntil < Date.now()`).
 */
export function shouldKeyBeActive(key: SubtitleApiKey): boolean {
  if (key.status === 'active') return true;
  if (
    key.status === 'rate-limited' &&
    key.rateLimitedUntil !== undefined &&
    key.rateLimitedUntil < Date.now()
  ) {
    return true;
  }
  return false;
}

/**
 * Pick a key for SEARCH. Allows 'active' or 'unverified' (search is cheap,
 * an unverified key can prove itself). A rate-limited key whose cooldown
 * expired is treated as active. Oldest `addedAt` wins (round-robin by age).
 * Returns undefined if no eligible key.
 */
export function pickSearchKey(
  keys: readonly SubtitleApiKey[],
  provider: SubtitleApiKeyProvider,
): SubtitleApiKey | undefined {
  let best: SubtitleApiKey | undefined;
  for (const key of keys) {
    if (key.provider !== provider) continue;
    const eligible =
      key.status === 'active' ||
      key.status === 'unverified' ||
      (key.status === 'rate-limited' &&
        key.rateLimitedUntil !== undefined &&
        key.rateLimitedUntil < Date.now());
    if (!eligible) continue;
    if (best === undefined || key.addedAt < best.addedAt) {
      best = key;
    }
  }
  return best;
}

/**
 * Pick a key for DOWNLOAD. Stricter than search: status must be 'active'
 * (download needs a verified key — 'unverified' is not trusted for the
 * quota-burning download step). A rate-limited key whose cooldown expired
 * is treated as active. Oldest `addedAt` wins. Returns undefined if none.
 */
export function pickDownloadKey(
  keys: readonly SubtitleApiKey[],
  provider: SubtitleApiKeyProvider,
): SubtitleApiKey | undefined {
  let best: SubtitleApiKey | undefined;
  for (const key of keys) {
    if (key.provider !== provider) continue;
    const eligible =
      key.status === 'active' ||
      (key.status === 'rate-limited' &&
        key.rateLimitedUntil !== undefined &&
        key.rateLimitedUntil < Date.now());
    if (!eligible) continue;
    if (best === undefined || key.addedAt < best.addedAt) {
      best = key;
    }
  }
  return best;
}

/**
 * Return a NEW key object with updated status (immutable — caller persists).
 * - If status === 'rate-limited' and `retryAfterMs` provided, sets
 *   `rateLimitedUntil = Date.now() + retryAfterMs`.
 * - If status === 'active', clears `rateLimitedUntil` (cooldown done).
 */
export function markKeyStatus(
  key: SubtitleApiKey,
  status: SubtitleApiKeyStatus,
  retryAfterMs?: number,
): SubtitleApiKey {
  if (status === 'rate-limited' && retryAfterMs !== undefined) {
    return { ...key, status, rateLimitedUntil: Date.now() + retryAfterMs };
  }
  if (status === 'active') {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { rateLimitedUntil: _omit, ...rest } = key;
    return { ...rest, status };
  }
  return { ...key, status };
}
