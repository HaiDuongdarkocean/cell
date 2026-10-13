# Perf Campaign — Round 2 findings (post-R1 integration, 2026-10-11)

3 explore subagents on `perf/round-1-integration` (93ebcae0). Verified at file:line.

## Lane A — perf/r2-import-loop (worktree: perf-streaming-parse)

| # | Finding | Evidence | Win | Effort |
|---|---|---|---|---|
| A1 | SW stall 3.5s = event-loop starvation, not one slow fn — insert `scheduler.yield()` (setTimeout fallback) in `baseImportStrategy` batch loop, `jsonEntriesStrategy` count-scan, `phraseIndexBuilder` passes | baseImportStrategy.ts:99-108, jsonEntriesStrategy.ts:87, phraseIndexBuilder.ts:92-123 | probe max 3.5s → <100ms, ~0-3% wall cost | S |
| A2 | IMP-3 scoped in R1 but UNSHIPPED: `buildPhraseIndexForResource` still calls `findDictionaryByResource` → `index.getAll` (~300k rich rows, 300-600MB) + 2 normalize passes. Fix: collect multiword `stored.term` during parse → `StrategyResult.phraseTerms?` → optional `terms` param (keeps `dictLocalSource.ts:342` compiling) | phraseIndexBuilder.ts:71, resourceEntryRepository.ts:94, importOrchestrator.ts:114 | removes biggest stall block + ~300-600MB transient | M |
| A3 | `serializePhraseIndex` `chunks: number[]` per-byte push (~8B/elem → 40MB for 5MB blob) + `new TextEncoder()` per token (phraseIndexCompiler.ts:541) → growable Uint8Array + module encoder | phraseIndexCompiler.ts:228-267,541 | ~0.5-2s + ~8× blob memory | S |
| A4 | Two-pass scan (count then parse) doubles scan cost — scanner yields `{source, end}` → converging `setTotal(done/(end/len))` estimate (BatchProcessor.setTotal already mid-stream capable). Only callers: jsonEntriesStrategy + tests | jsonEntriesStrategy.ts:85-94, batchProcessor.ts:26, ImportProgress.tsx:73-80 (total=0 → indeterminate exists) | ~0.5-1.5s of the 122MB scan | S-M |
| A5 | Delete residual: redundant `countEntriesByResource` O(n) scan — `deleteEntriesByResource` already materializes keys; it can report `onProgress(0, keys.length)` itself | importOrchestrator.ts:168-171, resourceEntryRepository.ts | ~1-2.5s of the 8s residual | S |

Correction from R2: `strFromU8` is already native TextDecoder inside fflate 0.8.3 — R1 finding stale, drop. `deletePhraseIndex` is O(1); no vocab cascade — delete floor is native index maintenance.

## Lane B — perf/r2-gzip-transport (worktree: perf-import-transport)

| # | Finding | Evidence | Win | Effort |
|---|---|---|---|---|
| B1 | Sender `readAsDataUrl` builds whole ~163MB base64 then slices → per-chunk `file.slice().arrayBuffer()` + `Uint8Array.toBase64`/btoa fallback | resourceClient.ts:201-203 | halves sender peak on 1GB phone | S |
| B2 | JSON dicts gzip ~70-80% → 122MB→~30MB → ~8-11 chunks → ~2.5-4s. Schema `encoding: z.enum(['gzip']).optional()` (backward compat); sender `file.stream().pipeThrough(CompressionStream)` (fallback: send raw, encoding omitted); receiver gunzip BEFORE constructing File (signature computed on raw bytes must match client) | resourceSchemas.ts:75-91, resources.ts:422-424, importOrchestrator.ts:55, resourceClient.ts:186, fileDetector.ts:6 (fflate already bundled) | upload 11.7s → ~2.5-4s | M |
| B3 | Update senders: `seed-dicts.mjs:84-98`, `mockDictionary.ts:529-551` + handler tests | — | test coverage | S |

Dead end verified: Port.postMessage uses same JSON serializer — extension messaging can't carry ArrayBuffer.

## Lane C — perf/r2-ui-motion (worktree: perf-ui-motion, NEW)

| # | Finding | Evidence | Win | Effort |
|---|---|---|---|---|
| C1 | Per-mount `<style>`: `injectShadowCss` textContent = tokens(:root→:host) + components + scrollbars + `allModuleCss` (~250 .module.css eager glob) — joined + parsed EVERY mount (toasts re-mount per show!) → `adoptedStyleSheets` with Map<cssString, CSSStyleSheet> cache, `<style>` fallback (jsdom/FF-old) | injectShadowCss.ts:32-40, allModuleCss.ts:11-23, mountToast.ts:42-46 | kill ~250-file join+parse per popup/toast mount | M |
| C2 | Popup drag/resize animates `left/top/width/maxHeight` per rAF + `will-change: left,top,width,height` (useless — non-compositable). Sheet drag already uses translateY precedent (same file :390) → transform-delta during drag, commit left/top on pointerup; whole DictionaryPanelView re-renders per frame today | usePopupPosition.ts:318-373,510-512,610-632, Dictionary.tsx:56-70 | drag jank → compositor-only | S-M |
| C3 | Progress fills transition `height`/`width` per progress event during 30-40s imports: ImportProgress.module.css:27-35 + AnkiImportJobRow.module.css:27 → `transform: scaleY/scaleX` (origin bottom/left), visual identical | ImportProgress.tsx:179-185, AnkiImportJobRow.tsx:110 | compositor-only progress during hot path | S |
| C4 | QueueTab renders ALL rows, `.row` no containment; `content-visibility:auto` + `contain-intrinsic-size` (zero usage anywhere in shipped CSS) | QueueTab.tsx:209-221, QueueTab.module.css:28-35 | skip layout/paint offscreen rows | S |

## NEEDS ANH'S CONFIRM (shared/ui — do not touch without approval)

- `useDismissOnScroll.ts:34-37` — non-passive capture scroll listeners while any dropdown open → `{passive:true}` one-liner. Consumers: Menu, Select, HintIcon, Pagination, SpeedPill, ImportWizard.
- `src/shared/ui/Progress.tsx` fill — same width→transform treatment (JobRow + DownloadCard consumers).

## OWNER-BLOCKED (report, do not implement)

- `src/features/sync/` + `dictionary/sync/`: export `getAll` corpus + sortKeys per row + `lines.sort()` O(n log n) + giant join + sync gzip (dictBlobReader.ts:22-40, resourceIdentity.ts:23-32) → 3-5× payload memory; `ensureResourceContentHash` reserializes identical bytes readResourceBlob later re-serializes; `uploadAndVerifyBlobs` 2× full listings; apply-side decode-all + per-key deletes + phrase-index getAll.
- **CORRECTNESS BUG (flag to sync-on-use owner + Anh):** SRS media `bytes: ArrayBuffer` inline in ChangeRecords → `JSON.stringify(ArrayBuffer)` = `{}` → bytes die on wire; `stableHash` sees `{}` → all assets hash-identical; receiver marks opaque forever. Fix path exists: `referencedBlobHashes`/BlobReader (pushCycle.ts:288-321). Files: entities/srs/types.ts:284-297, wireCodec.ts:76, srsLocalSource.ts:180-189.
- MOT-3/4/6 (subtitle split-view layout anims, 4Hz re-render), TOK-2/4/5 (tokenize controller sweeps) — all still present, owner-held.
- `useSectionDrag.ts` per-pointermove DOM query + N forced-layout reads — likely in player-mode-mobile-layout dirty list.

## Deferred to R3+

- XFR-3 cue-delta messages (M-L, med-high risk protocol change: sender, schema, bg cache, sidepanel reducer, epoch).
- F8 offscreen import executor (L — Worker unavailable in SW; needs byte handoff design).
- MOT-5 single-render wrapper (mountReactShadow decorate option; mountSubtitle.tsx owner-held).
- Tx-merge of 4 sequential delete txs (M — needs tx-scoped repo variants + ensureSyncRuntime hoist).
- Byte-level scan (kills ~244MB UTF-16 string — M).
- jsonArrayStrategy 3-pass regex → same scanner treatment (bounded format, lower value).
