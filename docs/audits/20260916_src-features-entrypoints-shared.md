# Technical Debt Audit — src/features + src/entrypoints + src/shared

> Date: 2026-09-16 · Delta audit vs `20260913_src-features-entrypoints-shared.md`
> Scope line: *Audit `src/features`, `src/entrypoints`, `src/shared` to find debt blocking velocity of the next 3 features.*
> Scope selection: top-3 code directories by 90-day churn (`git log --numstat`): `src/features` 272k, `src/entrypoints` 124k, `src/shared` 61k. `docs/` and `.agents/skills` churn excluded as non-code.
> Method: `audit-technical-debt` pipeline — automatic + human-inferred + subagent cross-check signals, weighted scoring `0.30V + 0.35R + 0.20Reach + 0.15×(6−Cost)`, adversarial subagent review applied (14 flags: 12 accepted, 2 corrected-evidence).

## Delta vs 2026-09-13 audit

| Prior item | Status |
|---|---|
| 1. SW-state fragility (4.20) | **Partially fixed** — `mediaMap` repopulated on restore (`helpers.ts:430-433`), `OffscreenManager` consolidated to 1 instance, `closeOffscreenDocument` has a caller. Residual → item 6. |
| 2. Layer boundaries (4.05) | **Partially fixed** — feature↔feature cycles broken (0 mutual pairs remain), `shared/`→`features` and `entities/`→`features` inversions eliminated, 6 `no-restricted-imports` boundary blocks in eslint. Residual → item 2. |
| 3. Production debug seams (4.05) | **Partially fixed** — `__sendMessageDebug`, `__cellBg`, `__CELL_SPLIT_VIEW_LOG`, `__debugBroadcast`, `__CELL_OCR_DEBUG_INIT` now `__CELL_DEBUG__`-gated; `__CELL_OCR_TRACKS` posts to `window.location.origin` not `'*'`. Residual → item 3. |
| 4. God files (4.00) | **Mixed** — `contentScriptController` 1833→780, `SubtitlePanels` 1521→430 (decomposition worked). But the other god files *grew* → item 1. |
| 5. Message protocol (3.75) | **Mostly fixed** — `MESSAGE_REGISTRY` + bus-level zod validation landed (`entities/message/registry.ts`). Residual → item 10. |
| 6. Build pipeline (3.70) | **Open** — `patch-ocr-csp.mjs` still postbuild-patches artifacts; `FULL_INPUT` still ships test/mockup pages → item 7. |
| 7. Quality-gate hygiene (3.65) | **Regressed** — benchmark test now guarded, type-aware promise rules enabled, but lint is red again with new violations → item 4. |
| 8. dictionaryPopup domain layer (3.35) | **Fixed** — schemas moved to `entities/`, injected ports, `TtsEngine` extracted. |
| 9. Legacy flags + `@/types` (3.15) | **Partially fixed** — `USE_LEGACY_SUBTITLE` removed; `@/types` down to 6 files. Residual → item 11. |
| 10. State fragmentation (3.00) | **Open** → item 15. |
| 11. Dependency staleness (2.90) | **Open** → item 9. |
| 12. Duplicate infra (2.65) | **Partially fixed** — third `tokenizeSubtitleWords` gone. Residual: 2× `AudioPanel`, `BackgroundService` ~30 delegations (folded into items 2/11), `subtitleResponseCache` (item 14). |
| 13. Observability (2.55) | **Open** → item 13. |
| 14. Dev/mock pollution (2.50) | **Open** — folded into item 7 (`FULL_INPUT`). |

## Summary

- Items found: **16**
- High score (≥4.0): **1**
- Quick wins: **4** · Pay-down: **2** · Scheduled: **5** · Watch: **5**

## Evidence base

| Signal class | Result |
|---|---|
| Typecheck (`npm run typecheck`) | PASS |
| Lint (`npm run lint`) | **FAIL** — 4 errors (3 `no-undef` in `launch-cell-context.mjs`, 1 `prefer-const` `selectionTerms.ts:102`), 2 react-hooks warnings |
| Unit tests (`npm run test:unit`) | **PASS** — 5987 pass / 0 fail / 32 skipped (was 7 fail on 09-13) |
| `npm outdated` | 23 outdated: eslint 9→10 (EOL 2026-08), typescript 6→7, vite 8.0→8.3, lucide-react 1.34→1.46, onnxruntime-web 1.26→1.29 |
| TODO/FIXME/HACK | 1 (`Spinner.tsx:23`) — unchanged, weak signal by design |
| Files >500 lines | ~38 source files; god files regrew despite decomposition |
| Human-inferred (git log) | 8 refactor commits post-audit (cycle-breaking, SubtitlePanels split, `__CELL_DEBUG__` gating, MESSAGE_REGISTRY) — high paydown cadence |
| Subagent cross-check | 21 verified findings incl. `downloadQueue` pause bug, `autoDownloadedTabs` loss, ungated `'*'` postMessage, 7 eslint-disables in `main.tsx` |

## Inventory (all 16 items, ranked)

| # | Location | Type | Description | V | R | Reach | Cost | Score |
|---|---|---|---|---|---|---|---|---|
| 1 | `dictionaryPopup/controller/webTextDictionaryController.ts` (1816), `cardCreator/ui/useCardCreatorState.ts` (1425 + module-level `fieldMappingWriteQueue:98`), `content/content-script.ts` (1409, ~11 feature-internal imports), `local-player/main.tsx` (1134: 7 eslint-disable hooks, ~6 duplicated retry blocks, O(n·m) find :353), `download/downloader.ts` (1221) | Architectural | **God files regrowing.** Post-audit extractions worked for subtitle (`contentScriptController` −58%) but the remaining god files *grew* +25..+66 lines in 3 days — extraction without import boundaries doesn't hold. | 5 | 4 | 4 | 4 | **4.00** |
| 2 | `SubtitlePanel.tsx:16`, `SubtitlePractice.tsx:5`, `PlayerModeOverlay.tsx:13`, `mountSubtitle.tsx:14`, `subtitlePanelsTypes.ts:20` → `@/entrypoints/sidepanel/components/CueList`; `src/stores/*` → feature internals; `features/subtitle/index.ts` `export *`; `BackgroundService` ~30 delegations in 3 places | Architectural | **Boundary residual.** Cycles/inversions fixed, but: features→entrypoints inversion unguarded (5 files), `src/stores/` outside layering, ~845 deep `@/features/*/` imports vs 35 barrel, 7/21 barrels all `export *`, no `import/no-cycle`. | 4 | 4 | 5 | 4 | **3.90** |
| 3 | `contentScriptMessages.ts:154,168-173,250,266` (`data-cell-debug-autoload-arr` ungated + `__CELL_AUTOLOAD_HANDLED` posts subtitle URLs to `window.parent` `'*'`), `ocrContentScript.ts` (~20 `document.body.dataset.ocr*` writes + `__ocrLatencyLog`/`__ocrStepTimings`/`__ocrCtrlTimings` globals, `__ocrRegionResult` bypasses `STORAGE_KEYS`), `webTokenizeController.ts:369` (`__CELL_SCAN_INFO`), `content-script.ts:162-164,209-212` (`__YT_CS_INJECTED` etc.) | Code quality *(security-adjacent)* | **Debug-seam residual.** `__CELL_DEBUG__` gating landed for the 09-13 surfaces but a second layer of ungated writes remains; the `'*'` autoload post leaks iframe subtitle URLs cross-origin. | 3 | 4 | 4 | 2 | **3.70** |
| 4 | `eslint.config.ts` (`.mjs` not in node-globals block), `selectionTerms.ts:102`, `useDictionaryToolbar.ts:392`, `Popover.tsx:52` | Process | **Lint red on master again** — 4 errors / 2 warnings committed. Gate regression is recurring (also red on 09-13). | 3 | 3 | 4 | 1 | **3.50** |
| 5 | `download/downloadQueue.ts:54-74,219-252` | Code quality | **Pause is broken; concurrency cap exceeded.** `activeCount` double-decrements on cancel/pause; executor has no AbortSignal — `pause()`d items complete as `'done'` (only `'cancelled'` excluded :222), cancelled items keep consuming bandwidth. Functional bug surfaced as debt. | 3 | 4 | 2 | 1 | **3.45** |
| 6 | `background/context.ts:39`, `helpers.ts:691-707`, `downloadQueue.ts:125-127`, `index.ts:185-188`, `wireEvents.ts:325,343,355` | Architectural | **SW-state residual.** `autoDownloadedTabs`/`enqueuedIds` in-memory → restart re-enqueues duplicates; `restore()` never calls `processNext` → restored queued items stall; `clearSessionMedia` on navigation vs `clearSessionDownloads` on removal → retry dead-ends. | 3 | 4 | 3 | 3 | **3.35** |
| 7 | `scripts/patch-ocr-csp.mjs`, `vite.config.ts:145-157` (`FULL_INPUT` ships `cardCreatorTest` + 4 mockup pages), `package.json:^onnxruntime-web@1.26` (unpinned — `npm update` trips patch Gate A) | Infrastructure | **Build fragility.** Postbuild string-patches artifacts; fail-loud gates mean a dep bump fails the *build* rather than shipping broken — but prod dist still ships dev pages. | 3 | 3 | 3 | 3 | **3.00** |
| 8 | `tokenize/controller/webTokenizeController.ts:70-75,809-843` vs `subtitleTokenizeController.ts:19-24,194-227` | Code quality | **Duplicated controller infra** — near-verbatim `STATUS_BY_KEY`/`applyStatusKey`/`handleKeydown`; files already diverging (896 vs 309). | 3 | 3 | 2 | 2 | **2.95** |
| 9 | `package.json` | Infrastructure | **23 outdated deps.** eslint 9 EOL→10, typescript 6→7, vite 8.0→8.3, react 19.2→19.3, lucide-react 1.34→1.46, onnxruntime-web 1.26→1.29 (feeds item 7). | 2 | 3 | 4 | 3 | **2.90** |
| 10 | `messageBus.ts:47,138,153`, `handlers/detectionDispatch.ts:64,71,77` | Architectural | **Validation result discarded.** `on()` runs `schema.safeParse` but passes the *original* `request` to handlers — so handlers re-cast `payload.tracks as X`. Thread `parsed.data` through and the casts disappear. | 2 | 3 | 3 | 2 | **2.85** |
| 11 | `downloader.ts:655` (`fetchAllSegments` zero call sites), `:1101-1130` (`downloadM3u8Legacy` near-dead behind `!isOpfsAvailable()`, sequential, skips discontinuity filtering — behavioral divergence), `pendingFilename:204` single-slot race, `USE_LEGACY_SETTINGS`/`USE_LEGACY_UNIVERSAL_PANEL` hardcoded `false` + 2 legacy impls + ~18 tests, `@/types` (6 files, 35 import sites), `contentScriptMessages.ts:225-232` unreachable block, 2× `AudioPanel` | Code quality | **Dead & near-dead code.** Wide but shallow; the legacy download path can silently diverge if OPFS ever absent. | 2 | 3 | 3 | 2 | **2.85** |
| 12 | `fetchInterceptor.iife.ts:74-78,92-96,127-129` | Code quality | **No diagnostics channel from MAIN world.** Empty catches are eslint-blessed and XHR gap is documented — the residual is silent detection misses with no observability. | 2 | 2 | 3 | 1 | **2.65** |
| 13 | `src/**` | Code quality | **Observability gap.** 160 `console.*` calls (26 in `local-player/main.tsx` alone), no logger abstraction. | 2 | 2 | 4 | 3 | **2.55** |
| 14 | `subtitle/logic/subtitleResponseCache.ts` (unbounded `Map`, content-script lifetime), `local-player/main.tsx:174,180` (`pendingSubsRef`/`videoFileCacheRef` unbounded) | Code quality | **Unbounded in-memory caches.** Slow leaks on long-lived pages/sessions. | 1 | 3 | 2 | 1 | **2.50** |
| 15 | `src/stores/*` paradigm mix (import-time `document` listener in `cuesStore:90` never removed, `orbitalBadgeStore` plain functions), `dictionaryPopup/log/lookupLogStore.ts` (dev-gate on write only + bypasses `STORAGE_KEYS`) | Code quality | **State fragmentation residual.** | 2 | 2 | 3 | 3 | **2.35** |
| 16 | 7 fixture-gated suites (`chinesePlugin`, `phraseMatchBenchmark`, `phraseTemplateParser`, `phraseMatcher`, `phraseIndexCompiler`, `roundtrip.debug`, `roundtrip.idb.debug`, `srtNormalizer:265`) | Testing | **32 tests silently skip** without `/data` fixtures — coverage illusion on phrase-matching core. | 2 | 2 | 2 | 2 | **2.30** |

## Business impact (top 3)

1. **God files (4.00):** `dictionaryPopup`/`cardCreator` are the highest-churn features and their controllers grew ~2%/day this week — every subtitle/card change touches 1.4–1.8k-line files importing 10+ feature internals. Effectively **doubles change time** in the hottest area and guarantees regression surface; the `SubtitlePanels` regrowth pattern is repeating.
2. **Debug seams (3.70):** `__CELL_AUTOLOAD_HANDLED` posts subtitle URLs to `window.parent` with `'*'` on every autoload — any embedding page can read which videos/subs the user loads. **Privacy + Web Store review risk**; ~25 ungated DOM dataset writes per OCR session fingerprint the extension to host pages.
3. **Download queue bug (3.45):** `pause()` doesn't pause — items complete anyway; cancel keeps pulling bandwidth; concurrent downloads can exceed `maxConcurrent`. **Direct user-facing defect** on the download path, one of the extension's two core features.

## Recommended roadmap

### Quick wins (cost ≤2 and score ≥3.4, or confirmed defect / cheap hygiene) — next sprint, owner TBD
1. **Un-red the lint gate** (item 4): add `.mjs` scripts to the node-globals eslint block, `prefer-const` fix, resolve or suppress the 2 hook warnings. <1h.
2. **Gate the debug-seam residual** (item 3): wrap `data-cell-debug-autoload-arr`, `dataset.ocr*`, `__ocr*` globals, `__CELL_SCAN_INFO`, `__YT_CS_INJECTED*` in `__CELL_DEBUG__`; scope `__CELL_AUTOLOAD_HANDLED` post to `window.location.origin`; move `__ocrRegionResult` under `STORAGE_KEYS`. <1 day.
3. **Fix downloadQueue** (item 5): single-decrement `activeCount`, wire an AbortSignal into the executor so pause/cancel actually stop work, `restore()` → `processNext`. 1 day.
4. **Delete dead code** (item 11): `fetchAllSegments`, `USE_LEGACY_*` flags + 2 legacy mounts + their tests, unreachable block at `contentScriptMessages.ts:225-232`, merge `downloadM3u8Legacy` decision (delete or fix divergence), `@/types` shims (35 sites). 1-2 days.

### Pay-down plan (score ≥3.9, cost ≥4) — schedule across sprints, owner TBD
5. **God-file decomposition behind barrels** (item 1, rolling): extract `webTextDictionaryController` orchestration concerns (card-creator calls, SRS, popup stacking) into per-concern modules; move `useCardCreatorState` domain logic to a service + kill module-level queue; split `content-script.ts` into relay/scan/init modules; extract `main.tsx` retry helper + `autoMatch` logging.
6. **Close the boundary gaps** (item 2, multi-sprint): move `CueList`/`CueListTokenize` to `shared/` or a feature barrel (fixes features→entrypoints inversion), relocate or dissolve `src/stores/`, convert `export *` barrels to named public APIs, add `import/no-cycle` + deep-import rule.

### Scheduled (score 2.8–3.4, cost ≥2) — next 2-3 sprints
7. **SW-state residual** (item 6): persist `autoDownloadedTabs`/`enqueuedIds` to `chrome.storage.session`; align `clearSessionMedia`/`clearSessionDownloads` lifecycle so restored items stay retryable.
8. **Build pipeline** (item 7): remove dev pages from `FULL_INPUT`, pin `onnxruntime-web`, plan patch-script replacement.
9. **Tokenize controller dedup** (item 8): shared status-key/rebind module.
10. **Dependency refresh** (item 9): quarterly bump; eslint 10 + typescript 7 deserve a dedicated pass.
11. **Message protocol** (item 10): thread `parsed.data` into handlers, drop the 5 residual casts.

### Watch list (score <2.8)
- Items 12-16: opportunistic cleanup per ponytail rule when touching the area.

### Stop-loss
- `downloadM3u8Legacy` + `saveBlob`/`pendingFilename` — decide delete-vs-fix before the next download-path change (folded into quick win 4).

## Tooling gaps
- `tooling gap: coverage` — no thresholds; not assessed.
- No `import/no-cycle` lint — item 2's cycles were found manually again.

## Verification trail
- Scope: concrete (3 dirs, churn-derived). ✓
- Signals: automatic (typecheck/lint/test/outdated/grep) + human-inferred (git log) + subagent cross-check (21 verified findings). ✓
- Every item classified into the six types, weighted score computed. ✓
- Top 3 have business-language impact. ✓
- Adversarial review: 14 flags → accepted 12 (re-scored items 3/5/7/9, corrected evidence on items 1/3/6/7/8/13/16/17, added unreachable block + restore-stall + pause-broken findings, merged item 8→11, split debug-surface vs console noise). Rejected/notes: `content-script.ts:195` `__YT_CS_READY` is a functional handshake not debug (cite removed); onnxruntime latest is 1.29 not 1.30 (corrected).
