# Technical Debt Audit — src/features + src/entrypoints + src/shared

> Date: 2026-09-30 · Delta audit vs `20260916_src-features-entrypoints-shared.md`
> Audited tree: worktree `Tihoka-worktrees/debt-audit` @ `bf3fa721` (clean committed HEAD; main tree dirty with foreign in-flight `anki-import` work was intentionally excluded)
> Scope line: *Audit `src/features`, `src/entrypoints`, `src/shared` to find debt blocking velocity of the next 3 features.*
> Scope selection: top-3 code directories by 90-day churn (`git log --numstat`): `src/entrypoints` 178k, `src/features` hotspots (`dictionaryPopup` 97k, `subtitle` 76k, `sync` 27k, `cardCreator` 25k), `src/shared` 67k. `docs/`, `tests/`, `.agents/` churn excluded as non-code.
> Method: `audit-technical-debt` pipeline — automatic + human-inferred signals, spot-check subagent (15 findings), adversarial review subagent (12 flags: 5 refuted, 3 corrected, rest confirmed). Weighted scoring `0.30V + 0.35R + 0.20Reach + 0.15×(6−Cost)`.

## Delta vs 2026-09-16 audit

| Prior item | Status now |
|---|---|
| 1. God files (4.00) | **Fixed on the named files** — `webTextDictionaryController` 1816→318, `useCardCreatorState` 1425→210, `content-script.ts` 1409→130, `local-player/main.tsx` 1134→264, `downloader.ts` 1221→450. **But the pattern regrew elsewhere** → item 4. |
| 2. Layer boundaries (3.90) | **Partially fixed** — `src/stores/` gone; features→entrypoints import claim re-verified as false-positive (all 3 candidates were comments/`getURL` strings/Vite worker specifiers). **Deep-import bypass persists** → item 3. |
| 3. Debug seams (3.70) | **Fixed** — re-verified: every `dataset.ocr*`/`__Tihoka_*`/`data-tihoka-debug-autoload-arr` write sits inside `TihokaDebug()`/`isTihokaDebug()` gates, compile-time stripped by `__Tihoka_DEBUG__` define. Tests cover the non-write path. |
| 4. Lint red (3.50) | **Regressed and worsened** — lint red again (2 errors) *and* typecheck red (2 errors) *and* a machine-dependent test; all on committed HEAD. `d5171098` (post-audit) cleared 2 of 4 sub-items but HEAD `68a7b746` still fails typecheck → item 1. |
| 5. downloadQueue pause bug (3.45) | **Fixed** — queue rewritten: AbortController per item, single-decrement settle, `restore()`→`processNext`. |
| 6. SW-state residual (3.35) | **Fixed** — `durable-job-registry` shipped; SW state now persisted/reconciled. |
| 7. Build fragility (3.00) | **Partially fixed** — `FULL_INPUT` no longer ships mock/test pages. `patch-ocr-csp.mjs` remains → item 14. |
| 8. Duplicate tokenize controller infra (2.95) | **Fixed** — both controllers consume `statusKeyControls.ts` SSOT + shared scheduler/renderer; remaining split is legitimate lifecycle difference. |
| 9. Dependency staleness (2.90) | **Improved** — down from 23 outdated to ~10; majors: `@crxjs/vite-plugin` 2→3 → item 13. |
| 10. Validation result discarded (2.85) | **Fixed in `bus.on()`** — `parsed.data` now threaded to handlers. **Asymmetry discovered** → item 6. |
| 11. Dead code (2.85) | **Mostly fixed** — `fetchAllSegments`, `USE_LEGACY_*`, `@/types` shims gone. Residual: `subtitleTokenWrap.ts` → item 15. |
| 12. MAIN-world diagnostics (2.65) | **Watch** — unchanged, low priority. |
| 13. Observability (2.55) | **Open** — 142 `console.*` calls in prod src (was ~160), no logger abstraction → folded into item 9 as test/log hygiene. |
| 14. Unbounded caches (2.50) | **Watch** — not re-verified this round; `pendingSubsRef`/`videoFileCacheRef` moved into `useFileCaches` hook. |
| 15. State fragmentation (2.35) | **Fixed** — `src/stores/` deleted. |
| 16. Fixture-gated silent skips (2.30) | **Reclassified** — skips are `Tihoka_FIXTURE_FULL`-gated *and* `console.warn`; default CI runs use committed fixtures. Residual: `tmpLdoce.test.ts` is the opposite failure mode (ungated absolute path) → item 1. |

## Evidence base

| Signal class | Result |
|---|---|
| Typecheck (`npm run typecheck`) | **FAIL on HEAD** — `youtube-main-world.iife.ts:344` (`prev.kind` unguarded after `prev?.` — compile error; runtime-safe only because `track.languageCode` is always `string` today), `CustomModeBuilder.tsx:54` (i18n key `studyModes.builder.previewFallback` absent from en.json + vi.json) |
| Lint (`npm run lint`) | **FAIL on HEAD** — `SrsReviewCardBack.tsx:201,212` ternary-as-statement (`no-unused-expressions`) |
| Unit tests (`npm run test:unit`) | **FAIL on HEAD / fresh checkout** — 7677 pass, 3 fail on clean worktree: `themeTokensNavCluster` ENOENT `tokens.css` (generated file, no pre-test hook), `webTokenizeController` ×2 + `check-design-system-css` perf budget — all 3 pass isolated → load-dependent flakes. `tmpLdoce.test.ts` unconditionally `readFileSync`s a hardcoded absolute path into the author's `data/` dir → fails on any other machine. |
| `npm outdated` | ~10 outdated: `@crxjs/vite-plugin` 2.7.1→**3.0.0** (major), `onnxruntime-web` 1.26→1.30, rest minor/patch |
| TODO/FIXME/HACK | 1 real FIXME (`Spinner.tsx:24`); other grep hits are false positives (test URLs, "no hack needed" comments); 1 `(ADR-xxx)` placeholder `popupLifecycle.ts:453` |
| `ponytail:` markers | **105 in-code** (deliberate deferrals w/ ceilings) — ledger in appendix; 38 carry no upgrade trigger (`no-trigger`) |
| Files >500 lines | 43 production files; test gods up to 2967 lines |
| Human-inferred (git log) | Very high paydown cadence (refactor/debt commits weekly); `dictionaryPopup`+`subtitle`+`sync` hottest features |
| Subagent cross-check | 15 verified findings; adversarial pass refuted 3 (debug-seam residual, features→entrypoints imports, OCR→dictPopup coupling — the latter is entrypoint DI, not erosion), corrected 4 |

## Inventory (16 items, ranked)

| # | Location | Type | Description | V | R | Reach | Cost | Score |
|---|---|---|---|---|---|---|---|---|
| 1 | `youtube-main-world.iife.ts:344`, `CustomModeBuilder.tsx:54` + missing i18n key in `en/vi.json`, `SrsReviewCardBack.tsx:201,212`, `dictionary/logic/tmpLdoce.test.ts` | **Process** | **Red gates on committed HEAD.** typecheck 2 errors + lint 2 errors + a test that reads `C:/Users/The0cean/.../data/...` unconditionally (fails on every other machine). Pipeline gates record "pass" from dirty working trees — HEAD is red while the ledger says green. *Post-audit:* `d5171098` fixed `prev.kind` + the two ternaries, but at `68a7b746` HEAD **still fails typecheck** (`previewFallback` key absent from en/vi) and `tmpLdoce.test.ts` persists — the fix commit itself proves the pattern (gate-fix that doesn't re-run the gate on committed state). | 5 | 4 | 5 | 1 | **4.65** |
| 2 | `dictionary/sync/dictLocalSource.ts` (`importResourceBlob:298`, `deleteResourceCascade:339`, `writeRemote:239-276`) + `dictionaryPopup/logic/lookupOrchestrator.ts` (module `probeCache`/`phraseIndexCache`) | Architectural | **Sync mutations skip cache invalidation.** A remote *content replacement* that keeps the same `resourceId` swaps all dict rows + rebuilds the phrase index while both caches keep serving stale terms/indexes until SW restart. Only `handlers/resources.ts` invalidates. Correct fix lives in `syncRuntime` applied-path (Feature DAG forbids dictionary→dictionaryPopup). | 4 | 5 | 3 | 2 | **4.15** |
| 3 | `cardCreatorBridge.ts` (708 lines, deep imports across 5 features); ~914 `@/features/x/` specifiers (538 intra-repo); barrels decorative — subtitle barrel *exports* `showToast` yet consumers import the deep path; cardCreator barrel exports only `sendAction` forcing deep imports | Architectural | **Boundary erosion by deep imports.** Feature `index.ts` facades don't carry the real API surface, so refactors inside any feature ripple across the codebase. (09-16 residual — cycles fixed, depth remains.) | 4 | 3 | 5 | 4 | **3.55** |
| 4 | `sync/app/SyncEngine.ts` (1099), `sync/adapters/google-drive/googleDriveStorageProvider.ts` (1376), `subtitle/ui/contentScriptController.ts` (regrew 780→959), `lookupOrchestrator.ts` (961), `webTokenizeController.ts` (951), `cardCreatorBridge.ts` (708) | Architectural | **God-file regrowth, new generation.** Prior extractions held; the new hot features (sync, tokenize, subtitle) are growing the same shape. `entities/message/types.ts` excluded — pure type catalog. | 4 | 3 | 4 | 4 | **3.35** |
| 5 | `popup/store/popupStore.ts:215-229` | Code quality | **Settings load failure marks loaded.** `getStorage` catch sets `isSettingsLoaded: true` without `settings` → all migrations skipped; a later settings write can persist defaults over the real blob. User-data-loss, no self-heal. | 2 | 4 | 3 | 2 | **3.20** |
| 6 | `subtitle/ui/mountSubtitle.tsx:216-257` | Code quality | **26 imperative setters are silent no-ops** when `controllerRef` unpopulated — correctness rests entirely on a documented `flushSync` hack; regression fails silently (e.g. manager panel never opens). | 3 | 3 | 3 | 2 | **3.15** |
| 7 | `entities/message/registry.ts` (11 contracts `schema: undefined`); receive-side casts in `contentScriptMessages.ts:163`, `ffmpegRunner.ts:356+`, sidepanel `App.tsx:86-114` (string literals + `as`, bypasses registry entirely); `wordStatusCrossTab.ts` the lone manual-validator | Architectural | **Validation asymmetry.** Background `bus.on()` validates via registry; content-script/offscreen/sidepanel receive paths don't consult it. The 11 missing schemas are the symptom; missing schema *consumers* are the disease. All 11 are bg-originated → robustness gap, not hostile-boundary. | 2 | 3 | 5 | 3 | **3.10** |
| 8 | `jobs/logic/jobRegistry.ts:84,192-196,322-326` | Architectural | **Persistence failures swallowed.** `restore()` sets `restored=true` *before* the awaited `loadPersisted().catch(()=>[])` — a transient IDB failure disables restore for the SW lifetime. `dismiss`/`flushNow` warn-only then report success. Partially self-healing via `sweep()`/`reconcileOne`. | 2 | 3 | 3 | 2 | **2.85** |
| 9 | `package.json` scripts, `themeTokensNavCluster.test.ts`, `webTokenizeController.test.ts`, `check-design-system-css.test.ts`; 522 test files colocated in `src/` vs 128 in `tests/`; 142 `console.*` in prod src | Testing | **Test-infra hygiene.** `test:unit` lacks the `generate-tokens` pre-step → fresh checkout ENOENTs; ≥3 suites flaky under parallel load (pass isolated); split test locations; no logger abstraction. | 3 | 2 | 3 | 2 | **2.80** |
| 10 | `subtitle/ui/subtitleUI.ts:194-299` vs `subtitle/ui/subtitleToasts.ts` + `SubtitleToast.tsx` | Code quality | **Two parallel toast subsystems** — imperative DOM `showToast`/`showProgressToast` (nested uncancellable `setTimeout` firing on detached nodes) vs React `useToasts`. `ToastVariant` defined twice. | 2 | 3 | 2 | 2 | **2.65** |
| 11 | `ankiImport/services/mappingPresets.ts`, `connectTransport.ts` | Code quality | **Storage-wrapper bypass.** Raw `chrome.storage.local`, ad-hoc keys outside `STORAGE_KEYS`, raw SETTINGS blob read skipping migrations — invisible to storage audits. | 2 | 2 | 2 | 1 | **2.45** |
| 12 | `ocr/persistence/ocrStateStore.ts:21-51` | Code quality | **Origin ≠ hostname.** `extractOriginFromUrl` keys per-"origin" state on hostname only (scheme+port conflated); `mergeWithDefaults` shallow-validates stored shapes — corrupted entries flow through. | 2 | 3 | 1 | 2 | **2.45** |
| 13 | `dictionary/sync/dictLocalSource.ts:293` (`if (!blob) continue`) | Code quality | **Silent eventual-consistency.** Skipped blob leaves `installationFinished:false` — resource excluded from lookups with no surfaced state until a later cycle retries. | 2 | 2 | 2 | 2 | **2.30** |
| 14 | `package.json` / lockfile | Infrastructure | **Dependency staleness (small).** `@crxjs/vite-plugin` 2→3 is a major behind on the build toolchain; `onnxruntime-web` 4 minors; rest patch. | 1 | 2 | 3 | 2 | **2.20** |
| 15 | `scripts/patch-ocr-csp.mjs` | Infrastructure | **Postbuild string-patcher** on minified dist (identifier-coupled patterns). Mitigated: required-patch gate fails the build + residual `new Function(` scan + idempotent closeBundle plugin. Acknowledged-fragile with tripwires. | 2 | 2 | 2 | 3 | **2.15** |
| 16 | `dictionaryPopup/trigger/subtitleTokenWrap.ts` (134 lines, imported only by its own test); `entities/dictionary/popupTypes.ts:332` (references deleted `popupDictionaryController`); `popupLifecycle.ts:453` `(ADR-xxx)`; `subtitleTriggerController.ts:36` duplicate `modifierMatches` (entity version exists) | Code quality | **Dead & stale residue.** Dead module still compiled + maintained by a ~22-assertion test; stale doc comments point at deleted code. | 1 | 1 | 2 | 1 | **1.80** |

### Rejected / corrected during adversarial review

- ~~Ungated `data-tihoka-debug-autoload-arr` DOM writes leak subtitle URLs~~ — **refuted**: all writes sit inside `TihokaDebug()`/`isTihokaDebug()` gates; `__Tihoka_DEBUG__` compiles to literal `"false"` in prod builds; non-write path has test coverage.
- ~~features→entrypoints imports (`settings/index`, `workerFactory`, `localPlayerLink`)~~ — **refuted**: doc comment, `chrome.runtime.getURL` string, Vite worker specifier respectively. No lint rule should fire on these.
- ~~OCR→dictionaryPopup hidden coupling~~ — **refuted**: `featureInit.ts` composition-root DI; `OcrLookupTrigger` is a structural port. Correct pattern.
- ~~`entities/message/types.ts` god file~~ — type-only catalog; splitting is cosmetic.
- ~~Dual tokenize controllers diverging~~ — **refuted**: both share `statusKeyControls` SSOT + scheduler + renderer; split is legitimate lifecycle difference.
- Fixture-gated "silent skips" — **corrected**: env-gated with warnings; the real defect is `tmpLdoce.test.ts` (item 1).
- Item 2 scope narrowed: `probeCache` keying self-heals add/delete/enable; the live hole is same-`resourceId` content replacement.
- Item 4 risk R4→R3: all schema-less messages originate inside the extension — robustness gap, not security boundary.

## Business impact (top 3)

1. **Red gates on committed HEAD (4.65):** every pipeline item is landing on a broken base while `pipeline-state.json` records green gates — gate evidence is currently unverifiable. Any regression introduced in the last few commits is invisible to the same tooling that certified it. Cheap to fix (<1 day), expensive to leave: it normalizes "red is fine" and blocks the next 3 sprints' verify step.
2. **Sync cache invalidation hole (4.15):** after a sync pull replaces a dictionary resource in place, lookups silently serve the *old* term set until the service worker restarts — users get wrong/missing dictionary results with zero signal. This undermines the `sync-drive-folders` feature that just shipped. ~10 lines + one test.
3. **Boundary erosion + god-file regrowth (3.55/3.35):** the hottest features (subtitle, dictionaryPopup, sync) are where deep imports and 950–1400-line files concentrate; every refactor there ripples across features — consistent with the 09-16 estimate of **~2× change time** in hot paths. The decomposition playbook already worked once; applying it to the new generation is a known cost.

## Recommended roadmap

### Quick wins — this sprint (score ≥3.5, cost ≤2), owner TBD
1. **Un-red all gates on HEAD** (item 1): ✅ `d5171098` already cleared `prev?.kind` + the `SrsReviewCardBack` ternaries; **remaining:** add `studyModes.builder.previewFallback` to en+vi or remove the call, and gate `tmpLdoce.test.ts` behind the existing `Tihoka_FIXTURE_FULL` pattern or delete it. **Plus process fix:** run gates on a clean `git stash`-verified tree (or CI) so "pass" can't be recorded over uncommitted fixes. <1 day.
2. **Sync → cache invalidation** (item 2 + item 13): call `clearDictionaryProbeCache()` + drop the per-resource `phraseIndexCache` entry from `syncRuntime`'s applied path when `appliedDataClasses` includes `dictResource`; surface the `!blob` skip as a retryable status instead of `continue`. ~1 day incl. test.

### Pay-down — schedule across next 2–3 sprints (score ≥3.3, cost ≥3)
3. **Boundary enforcement** (item 3): extend the eslint Feature DAG to forbid `@/features/x/<deep>` imports from other features (allow `index.ts` only); expand barrels to carry the real API; split `cardCreatorBridge.ts` along its 5 seams.
4. **New-generation god files** (item 4): replay the 09-16 decomposition playbook on `googleDriveStorageProvider` → `SyncEngine` → `contentScriptController`/`webTokenizeController`, with boundary lint rules from (3) holding the result.

### Surgical fixes — ride along with related feature work (cost ≤2)
5. `popupStore` load failure (item 5): don't set `isSettingsLoaded` on failure; retry/backoff or error state. 
6. `mountSubtitle` setters (item 6): make the contract loud — throw/log on unset ref in dev, or queue setters until mount.
7. `jobRegistry` (item 8): move `restored=true` after the await; propagate dismiss/flush failures to callers.

### Watch — stable, rarely touched, revisit if churn lands
8. Dual toast subsystems (item 10), `ankiImport` storage bypass (item 11 — fold into anki-import follow-ups), `ocrStateStore` (item 12), dep majors (item 14 — evaluate crxjs 3 before next vite bump), postbuild patcher (item 15 — tripwires adequate), dead-code residue sweep (item 16 — fold into next housekeeping commit).

### Stop-loss
- **Message validation asymmetry (item 7):** deliberate robustness gap today (all bg-originated). Pay back *before* any new cross-context message type ships or before content-script-originated handlers gain trust-sensitive payloads — the schema-less `any`-direction contracts are the template for the fix (`wordStatusCrossTab.ts` pattern).

## Appendix — `ponytail:` ledger (105 in-code markers)

Convention: `ponytail: <ceiling>, <upgrade path>`. `no-trigger` = marker names no ceiling/upgrade trigger — those rot silently. Count excludes prose mentions in docs/skills (~17) that discuss the convention itself.

### src/entrypoints

| Location | Deferral | Flag |
|---|---|---|
| `background/helpers.ts:153` | matchMedia absent on ServiceWorkerGlobalScope — manual prefers-color-scheme | no-trigger |
| `content/content-script.ts:36` | lazy-import dep preloads resolve against host page | no-trigger |
| `content/episodeWatcher.ts:31` | element-replacement heuristic for episode change | ceiling named |
| `content/episodeWatcher.ts:45` | blob: URLs change on every capture — compare `src` instead | no-trigger |
| `content/iqiyi-main-world.iife.ts:23` | self-contained IIFE, no imports | ceiling named |
| `content/iqiyi-main-world.iife.ts:215` | 15s poll timeout for slow player init | ceiling named |
| `content/iqiyi-main-world.iife.ts:238` | iQIYI may re-override history.pushState → hook lost | ceiling named |
| `content/mediaScan.ts:8` | no chrome.tabs in content script — message without tabId | no-trigger |
| `content/mediaScan.ts:65` | guard intentionally removed for vidnest/videasy players | no-trigger |
| `content/netflix-main-world.iife.ts:18` | self-contained IIFE | no-trigger |
| `content/netflix-main-world.iife.ts:354` | reuse getPlayer() helper (ADR-029) | ceiling named |
| `content/videoOverlay.ts:93` | naive 100ms poll bounded by 10s findVideoObserver timeout | ceiling named |
| `content/videoOverlay.ts:121` | disconnect observer as soon as video found | no-trigger |
| `content/videoOverlay.ts:176` | 500ms poll fallback for lazy autoplay players | ceiling named |
| `content/youtube-main-world.iife.ts:21` | self-contained IIFE | no-trigger |
| `content/youtube-main-world.iife.ts:440` | storedSize restores on close | ceiling named |
| `local-player/components/PlayerView.tsx:84` | O(n) merge by index — bilingual SRT cues aligned 1:1 | ceiling named |
| `local-player/hooks/useSubtitleActions.ts:160` | console toast — local-player has no toast host | no-trigger |
| `mock-hardsub-page/hardSubMockMain.ts:152` | rVFC debug counter — remove after testing | upgrade named |
| `mock-streaming-page/streamFlixData.ts:63` | hardcoded port must match iframe parent | no-trigger |
| `sidepanel/App.tsx:117` | only onActivated tracked | ceiling named |

### src/features

| Location | Deferral | Flag |
|---|---|---|
| `cardCreator/media/mediaFile.ts:100` | best-effort — caller try/catch skips on failure | ceiling named |
| `detection/logic/iqiyiSubtitleDetector.ts:41` | unknown `lid` → track skipped | ceiling named |
| `detection/logic/netflixSubtitleDetector.ts:16` | DOMParser deferred until download task | upgrade named |
| `detection/logic/subtitleDetector.ts:144` | keyword-based metadata exclusion | ceiling named |
| `detection/logic/subtitleDetector.ts:164` | `/api/v<N>/<type>/subtitles/` pattern site-specific | ceiling named |
| `dictionary/logic/chineseSegmenter.ts:11` | FMM no ambiguity handling (研究生命) | ceiling named |
| `dictionary/logic/chineseSegmenter.ts:62` | same — ceiling: ambiguity | ceiling named |
| `dictionary/logic/englishLemma.ts:24` | no lexicon lookup, pure fn | no-trigger |
| `dictionary/logic/englishLemma.ts:31` | forms also base verbs (lay/found/saw) | ceiling named |
| `dictionary/logic/phraseIndexBuilder.ts:89` | non-verbs marked inflectable is safe | ceiling named |
| `dictionary/logic/phraseMatcher.ts:123` | pure fn, O(1) | no-trigger |
| `dictionary/logic/phraseMatcher.ts:167` | no POS tagging — "tell the man" won't match "tell sb" | ceiling named |
| `dictionary/logic/phraseMatcher.ts:341` | 2-token allowance → false positives | ceiling named |
| `dictionary/logic/phraseMatcher.ts:604` | duplicated matching logic to avoid refactor | ceiling named |
| `dictionary/logic/phraseTemplateParser.ts:66` | heuristic w/o POS tagging; full fix needs POS | upgrade named |
| `dictionary/logic/phraseTemplateParser.ts:299` | no 3+ independent slash groups | ceiling named |
| `dictionary/repositories/baseRepository.ts:5` | fresh DB, skip v1–v8 migration chain | ceiling named |
| `dictionary/services/resourceClient.ts:193` | uniqueness only disambiguates in-flight | ceiling named |
| `dictionaryPopup/logic/lookupOrchestratorBenchmark.test.ts:142` | ADR-037 <10ms budget | ceiling named |
| `dictionaryPopup/plugins/chinesePlugin.ts:17` | FMM no ambiguity (mirrors segmenter) | ceiling named |
| `dictionaryPopup/sentence/sentenceModule.ts:309` | O(n) per text node bounded by line length | ceiling named |
| `dictionaryPopup/ui/CandidateView.tsx:43` | Firefox lacks ShadowRoot.getSelection — window fallback | ceiling named |
| `local-player/logic/folderScan.ts:54` | no recursion — avoids whole-drive scan | ceiling named |
| `ocr/engine/paddleOcrEngine.test.ts:54` | browser-native APIs stubbed in tests | no-trigger |
| `ocr/engine/paddleOcrEngine.ts:133` | re-bundle PP-OCRv6_small offline after verify | upgrade named |
| `ocr/engine/paddleOcrEngine.ts:168` | createImageData+copy for TS overload mismatch | no-trigger |
| `ocr/pipeline/frameCapture.ts:50` | 'in' narrows to never — cast to record | no-trigger |
| `pronunciation/repositories/lingvoDslIndexRepository.ts:7` | one record per term; large dicts | ceiling named |
| `pronunciation/services/lingvoDslParser.ts:15` | whole .dsl in memory (~38MB) | ceiling named |
| `reader/logic/bookParser.ts:8` | UTF-8 only (no Windows-1252/Shift_JIS) | ceiling named |
| `srs/services/getSrsHomeStats.ts:179` | no per-day due counts → "completed all" heuristic | ceiling named |
| `studyModes/studyModeStore.ts:195` | cross-tab storage sync, registered once per context | ceiling named |
| `subtitle/cuesStore.ts:74` | guard is the single fix for status flicker | ceiling named |
| `subtitle/logic/providers/subdlAdapter.ts:273` | minimal ZIP parser — first local file entry only | ceiling named |
| `subtitle/logic/subtitleAutoLoad.ts:143` | SRT fallback — most URLs are SRT | ceiling named |
| `subtitle/logic/subtitleBilingualParser.ts:2` | reuse parseSrt + text-split only | no-trigger |
| `subtitle/logic/subtitleImport.ts:92` | label-wraps-input native file picker | no-trigger |
| `subtitle/logic/subtitleImport.ts:163` | display:none blocks picker in some CS contexts | ceiling named |
| `subtitle/logic/subtitleImport.ts:200` | parallel parse+detect via Promise.all | no-trigger |
| `subtitle/logic/subtitleMerge.ts:50` | linear scan ~1000 cues, once per render | ceiling named |
| `subtitle/logic/subtitleParser.ts:2` | thin adapter to ParseResult | no-trigger |
| `subtitle/logic/youtubeSplitView.ts:10` | 3 thin wrappers, no-op off YouTube | ceiling named |
| `subtitle/ui/contentScriptController.ts:387` | no tokenize settings → plain subtitle | no-trigger |
| `subtitle/ui/contentScriptController.ts:637` | match overlay initial display:none | no-trigger |
| `subtitle/ui/contentScriptController.ts:857` | throttle ~4fps vs 60fps timeupdate | ceiling named |
| `subtitle/ui/contentScriptController.ts:938` | keydown+onMessage listener leak — memory | ceiling named |
| `subtitle/ui/contentScriptKeyboard.ts:60` | fixed parallel offset shortcuts (ADR-019) | no-trigger |
| `subtitle/ui/contentScriptLifecycle.ts:23` | visibilitychange native event | no-trigger |
| `subtitle/ui/contentScriptLifecycle.ts:37` | proactive SPA-nav clear | ceiling named |
| `subtitle/ui/contentScriptSelection.ts:127` | storage unavailable in test → ignore | no-trigger |
| `subtitle/ui/contentScriptShared.ts:29` | storage unavailable → fallback | no-trigger |
| `subtitle/ui/contentScriptShared.ts:48` | storage unavailable → fallback | no-trigger |
| `subtitle/ui/CueList.tsx:234` | hasHours inferred from last cue end−offset, O(1) | ceiling named |
| `subtitle/ui/navClusterActions.ts:2` | pure fns, only side effect is seek | no-trigger |
| `subtitle/ui/subtitleShortcuts.ts:2` | pure fn, fully testable | no-trigger |
| `subtitle/ui/subtitleUI.ts:194` | counter-based drag flicker guard | no-trigger |
| `subtitle/ui/subtitleUI.ts:261` | position absolute in video parent | no-trigger |
| `tokenize/controller/webTokenizeController.ts:31` | cache tiered by device RAM | ceiling named |
| `tokenize/controller/webTokenizeController.ts:63` | hard caps prevent starvation on heavy SPAs | ceiling named |
| `tokenize/controller/webTokenizeController.ts:119` | DOM mutation not handled in this slice | ceiling named |
| `tokenize/controller/webTokenizeController.ts:402` | one malformed block must not abort scan | no-trigger |
| `tokenize/logic/textTokenizer.ts:17` | ASCII-only heuristic | ceiling named |
| `tokenize/logic/tokenizeBlock.ts:164` | no merge of adjacent text nodes | ceiling named |
| `tokenize/logic/tokenizeScheduler.ts:137` | one failing task must not hang scheduler | no-trigger |
| `tokenize/utils/frequencyBand.ts:26` | band changes apply on next init | ceiling named |
| `tts/services/supertonicInference.ts:4` | sync-ish I/O once cached | ceiling named |
| `tts/services/supertonicTtsEngine.ts:54` | stub beep for tests/no-storage | upgrade named |
| `tts/services/ttsDownloadManager.ts:65` | language-specific cleanup deferred | ceiling named |
| `universalPanel/mountUniversalPanel.ts:238` | naive hasMedia via querySelector('video') | ceiling named |

### src/shared, tests, config

| Location | Deferral | Flag |
|---|---|---|
| `entities/message/types.ts:525` | element-replacement heuristic | ceiling named |
| `entities/message/types.ts:546` | only `fetch` patched | ceiling named |
| `shared/lib/chrome-apis/declarativeNetRequest.ts:39` | Date.now() overflows DNR int32 id | ceiling named |
| `shared/lib/colorGenerator.ts:42` | linear lerp white/base/black; V2 could do better | upgrade named |
| `shared/lib/dom/isEditable.ts:20` | jsdom doesn't reflect isContentEditable | no-trigger |
| `shared/lib/dom/netflixPlayback.ts:13` | 3 thin wrappers, direct fallback elsewhere | no-trigger |
| `shared/lib/parsers/subtitleFormat.ts:5` | first 40 chars sniff only | ceiling named |
| `shared/lib/shadowRoot/allModuleCss.ts:8` | superset of styles into any shadow root | ceiling named |
| `shared/lib/storage/localFileHandleStorage.ts:8` | one DB + one store for all handles | ceiling named |
| `shared/ui/Pagination.tsx:9` | unicode labels pending dedicated icons | upgrade named |
| `shared/ui/Select.tsx:152` | composedPath() inside shadow DOM | no-trigger |
| `shared/ui/useMenuPlacement.ts:99` | recompute on open+resize only, not nested scroll | ceiling named |
| `tests/unit/.../subtitleAutoLoad.test.ts:131` | SRT fallback in test | no-trigger |
| `tests/unit/.../subtitleBilingualParser.test.ts:57` | ADR-005 D2 last-line-native | no-trigger |
| `tests/unit/.../subtitleShortcuts.test.ts:69` | lowercase normalization by caller | no-trigger |
| `vite.config.ts:236` | dep preload resolves against document.baseURI | ceiling named |

**Ledger: 105 markers, 38 with no explicit trigger.** The `no-trigger` rows are mostly "why-simple-is-fine" rationales (self-documenting, harmless) — the ones to watch are ceiling-bearing deferrals whose trigger got truncated to a second comment line (`helpers.ts:153`, `mediaScan.ts:8/65`, `useSubtitleActions.ts:160`).
