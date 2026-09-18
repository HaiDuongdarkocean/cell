# Intent — local-player-hygiene

Backlog #12 · Source: internal-audit (`docs/audits/20260916_src-features-entrypoints-shared.md`) · ui_surface: no

## Business Case

- **Need**: Long local-player sessions should not leak memory or spam the console — claimed pain: three unbounded `Map` caches (`pendingSubsRef`, `videoFileCacheRef`, `subtitleResponseCache`) grow forever and ~26 `console.*` calls add noise.
- **Change (as found)**: The claimed unbounded caches were already migrated to `LruCache` in prior work, and console noise was already reduced to a single legitimate production error. The residual delta is tiny.
- **Solution direction**: Verify the audit claims against current code; fix only what is still broken.
- **Value**: Avoid a pipeline-sized effort for work that is already done; keep a long-session memory profile flat.
- **Stakeholder**: end users on long sessions (persona ≥1GB RAM); maintainer reading the code.
- **Context**: local-player entrypoint (`src/entrypoints/local-player/`), extension page context — single-page session, reload clears everything anyway.

## Evidence audit — claims vs code

| Claim (backlog row) | Verified state | Evidence |
|---|---|---|
| `pendingSubsRef` unbounded | **Already bounded** — `LruCache<string, File>` cap `FILE_CACHE_CAP = 500` | `src/entrypoints/local-player/logic/fileCache.ts:5,11-18`; created in `hooks/useFileCaches.ts:15-16` |
| `videoFileCacheRef` unbounded | **Already bounded** — same `createFileCache()` → `LruCache(500)` | `fileCache.ts:11-18`; `useFileCaches.ts:16`; `useVideoLibrary.ts:296` clears on dir change |
| `subtitleResponseCache` unbounded | **Already bounded** — `LruCache` `MAX_ENTRIES = 50` + `MAX_BODY_CHARS = 500_000` + `clearSubtitleBodyCache()` on re-inject | `src/features/subtitle/logic/subtitleResponseCache.ts:5-8,17,54` |
| 26 `console.*` in local-player | **Already cleaned** — exactly **1** remains: `console.error('[local-player] Cannot load settings — storage unavailable.')` — a production-visible error that *should* stay (all `logger.*` methods are `__CELL_DEBUG__`-gated noops in production after `debug-seam-hardening`) | `useSubtitleActions.ts:145`; `src/shared/lib/logger.ts:3-20` |

LruCache migration shipped in `0d45d6e1` (god-file split) / `5b8934b0` (response cache); `LruCache` itself is a tested shared primitive (`src/shared/lib/lruCache.ts`).

## Residual found during verification

- `tokenCache` in `libraryScoreService` (`Map<videoId, TokenCacheEntry>` passed in from `useLibraryScores.ts:40`) keeps entries for videos **removed from the library** — keys are never pruned. Each stale entry holds a tokenized term list (~KBs each). Bounded by lifetime-of-page × deleted-video count — real but small; fixable directly (chore, not a pipeline item).
- All other `new Map`/`new Set`/`push` sites in local-player are transient per-render/per-scan locals (`LibraryView.tsx:76,85`, `useVideoLibrary.ts:160-161,223`, `libraryScoreService.ts:72,113-114,135,140`).

## Stakeholders

- **End user**: long watch sessions — memory should stay flat. Already satisfied by LruCache caps.
- **Team**: no new abstraction needed; `LruCache` primitive already exists and is tested.
- **Regulator/compliance**: none — no data leaves the machine.

## Risks

- Doing the full pipeline anyway → spends S→M effort for ~5 lines of residual fix. Higher risk than the leak itself.
- Ignoring the residual `tokenCache` stale-key growth → unbounded-across-deletes in one edge case; mitigated by the direct chore fix committed alongside this analysis.

## Journey

AS-IS: user opens local player → library scan populates `FileCache`s (LRU-capped at 500) → scoring run fills `tokenCache` (per-video entries) → long session: caches stay under caps; stale `tokenCache` keys for deleted videos linger until page reload.

TO-BE: same as AS-IS — the named pain is already resolved; `tokenCache` additionally drops keys for videos no longer in the library each scoring pass (direct chore fix).

## Stories

- As a user on a long session, memory stays flat — done: LruCache caps on every long-lived cache.
- As a maintainer, console output stays meaningful — done: 1 production error remains by design; debug noise routes through `logger` (gated).

## Decision

**no-go** — the backlog row's stated pain is already satisfied in code: every named cache is `LruCache`-bounded (500 file entries / 50 response bodies / 500KB body cap), and console noise is one intentional production `console.error`. The only live residual (`tokenCache` stale keys for removed videos) is a chore-sized fix applied directly, not worth an S★2 pipeline slot.

## Acceptance criteria (for the residual chore)

- `runLibraryScoring` prunes `tokenCache` keys not present in the current video set.
- Existing scoring behavior unchanged; unit test covers the prune.
