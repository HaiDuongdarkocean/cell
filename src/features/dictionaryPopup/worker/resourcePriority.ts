// resourcePriority — deterministic multi-resource ordering (ADR-037, Task 1.4).
//
// When the same phrase matches in multiple dictionary resources, the lookup
// orchestrator must pick a deterministic winner. Default priority: newest
// import wins (highest resourceId first). An explicit priority map can
// override this when the user configures resource priority in settings.
//
// Pure functions — no IndexedDB, no worker deps.

import type { ResidentPhraseIndex } from './phraseIndexLoader';

/**
 * Sort resident indexes by priority. Default: resourceId descending (newest
 * import first). An optional `priorityMap` (resourceId → priority rank, lower
 * = higher priority) overrides the default.
 *
 * Returns a new array; does not mutate the input.
 */
export function sortResidentIndexesByPriority(
  indexes: Iterable<ResidentPhraseIndex>,
  priorityMap?: ReadonlyMap<number, number>,
): ResidentPhraseIndex[] {
  const arr = [...indexes];
  arr.sort((a, b) => {
    if (priorityMap) {
      const pa = priorityMap.get(a.resourceId);
      const pb = priorityMap.get(b.resourceId);
      if (pa !== undefined && pb !== undefined && pa !== pb) return pa - pb;
      if (pa !== undefined && pb === undefined) return -1;
      if (pa === undefined && pb !== undefined) return 1;
    }
    // Default: highest resourceId first (newest import wins).
    return b.resourceId - a.resourceId;
  });
  return arr;
}

/**
 * Pick the winning resident index + match when the same phrase matches in
 * multiple resources. Resources are tried in priority order; the first
 * resource that produces a match is the winner. Ties within the same priority
 * are broken by the matcher's ranking tuple (comparePhraseMatches).
 */
export function pickWinnerByPriority<T>(
  candidates: ReadonlyArray<{ readonly resident: ResidentPhraseIndex; readonly match: T }>,
  priorityMap?: ReadonlyMap<number, number>,
): { readonly resident: ResidentPhraseIndex; readonly match: T } | undefined {
  if (candidates.length === 0) return undefined;
  const sorted = [...candidates].sort((a, b) => {
    if (priorityMap) {
      const pa = priorityMap.get(a.resident.resourceId);
      const pb = priorityMap.get(b.resident.resourceId);
      if (pa !== undefined && pb !== undefined && pa !== pb) return pa - pb;
      if (pa !== undefined && pb === undefined) return -1;
      if (pa === undefined && pb !== undefined) return 1;
    }
    return b.resident.resourceId - a.resident.resourceId;
  });
  return sorted[0];
}
