// phraseIndexLoader — ADR-037 §7: validate + hydrate compact phrase blobs.
//
// The worker receives compiled phrase blobs as transferable ArrayBuffers
// (HYDRATE_CHUNK). This loader validates the blob header (magic, compiler
// version, term count, anchor bounds) and builds an in-memory anchor index
// for warm lookup — anchor postings, never a full scan of all templates.
//
// Pure functions, no IndexedDB. The worker owns the deserialized index + the
// ArrayBuffer after transfer; the host's copy is detached.

import {
  deserializePhraseIndex,
  type PhraseIndex,
  type CompiledTemplate,
} from '@/features/dictionary/logic/phraseIndexCompiler';

/** Expected compiler version (must match phraseIndexCompiler.COMPILER_VERSION). */
export const EXPECTED_COMPILER_VERSION = 2;

/** Resident phrase index for one resource, held in worker memory. */
export interface ResidentPhraseIndex {
  readonly resourceId: number;
  readonly index: PhraseIndex;
  /** Anchor token → template IDs. Warm lookup path. */
  readonly anchorMap: ReadonlyMap<string, readonly number[]>;
  readonly byteSize: number;
}

/** Loader result — fail closed with a machine-readable error. */
export type PhraseIndexLoadResult =
  | { readonly ok: true; readonly resident: ResidentPhraseIndex }
  | { readonly ok: false; readonly error: string };

/**
 * Validate + deserialize a phrase blob and build the anchor index.
 *
 * Returns `{ ok: false, error }` on bad magic, version mismatch, negative
 * counts, or anchor-bound violations. Never throws — the worker must not
 * crash on a malformed blob; it reports the error and skips the resource.
 */
export function loadPhraseIndexBlob(
  resourceId: number,
  blob: ArrayBuffer,
): PhraseIndexLoadResult {
  if (blob.byteLength < 16) {
    return { ok: false, error: 'blob-too-small' };
  }

  let index: PhraseIndex;
  try {
    index = deserializePhraseIndex(blob);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `deserialize-failed: ${msg}` };
  }

  if (index.compilerVersion !== EXPECTED_COMPILER_VERSION) {
    return {
      ok: false,
      error: `version-mismatch: expected ${EXPECTED_COMPILER_VERSION}, got ${index.compilerVersion}`,
    };
  }

  if (index.termCount < 0) {
    return { ok: false, error: `bad-term-count: ${index.termCount}` };
  }

  if (index.anchorCount < 0) {
    return { ok: false, error: `bad-anchor-count: ${index.anchorCount}` };
  }

  // Anchor-bound check: every anchor key must resolve to ≥1 template ID.
  // This catches a truncated/corrupt anchor table.
  for (const key of index.anchorKeys) {
    const ids = index.lookupByAnchor(key);
    if (ids.length === 0) {
      return { ok: false, error: `anchor-empty: "${key}"` };
    }
  }

  // Template-bound check: every template must have ≥1 anchor (the compiler
  // guarantees this, but a corrupt blob could violate it).
  for (const t of index.templates) {
    if (t.anchors.length === 0 && t.fixedTokenCount > 0) {
      return { ok: false, error: `template-no-anchors: templateId=${t.templateId}` };
    }
  }

  const anchorMap = buildAnchorMap(index);
  return {
    ok: true,
    resident: {
      resourceId,
      index,
      anchorMap,
      byteSize: blob.byteLength,
    },
  };
}

/**
 * Build the anchor → template IDs map for warm lookup.
 *
 * The worker uses this to retrieve candidate templates for a hovered token
 * without scanning all templates. O(1) per anchor lookup.
 */
export function buildAnchorMap(index: PhraseIndex): ReadonlyMap<string, readonly number[]> {
  const map = new Map<string, number[]>();
  for (const key of index.anchorKeys) {
    map.set(key, [...index.lookupByAnchor(key)]);
  }
  return map;
}

/**
 * Resolve candidate templates for a set of sentence tokens via the anchor map.
 *
 * Returns template IDs whose any anchor appears in the token set. This is the
 * warm lookup path — it never scans all templates. Dedup is preserved.
 */
export function resolveCandidatesByAnchors(
  tokens: readonly string[],
  anchorMap: ReadonlyMap<string, readonly number[]>,
): readonly number[] {
  const seen = new Set<number>();
  const result: number[] = [];
  for (const token of tokens) {
    const ids = anchorMap.get(token);
    if (!ids) continue;
    for (const id of ids) {
      if (!seen.has(id)) {
        seen.add(id);
        result.push(id);
      }
    }
  }
  return result;
}

/** Total resident memory across all hydrated resources (bytes). */
export function totalResidentBytes(resident: Iterable<ResidentPhraseIndex>): number {
  let sum = 0;
  for (const r of resident) sum += r.byteSize;
  return sum;
}

/** Find a template by ID within a resident index. */
export function findTemplate(
  resident: ResidentPhraseIndex,
  templateId: number,
): CompiledTemplate | undefined {
  return resident.index.templates.find((t) => t.templateId === templateId);
}
