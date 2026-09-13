# Technical Debt Audit — src/features + src/entrypoints + src/shared

> Date: 2026-09-13 · Branch: `audit/tech-debt-2026-09-13` (worktree `cell-audit`)
> Scope line: *Audit `src/features`, `src/entrypoints`, `src/shared` to find debt blocking velocity of the next 3 features.*
> Scope selection: top-3 code directories by 90-day churn (`git log --numstat`): `src/features` 252k, `src/entrypoints` 122k, `src/shared` 60k. `docs/` (254k) churn excluded as non-code.
> Method: `audit-technical-debt` pipeline — automatic + human-inferred + subagent cross-check signals, weighted scoring `0.30V + 0.35R + 0.20Reach + 0.15×(6−Cost)`, adversarial subagent review applied.

## Summary

- Items found: **14**
- High score (≥4.0): **4**
- Quick wins: **2** · Pay-down: **3** · Scheduled: **2** · Watch: **7**

## Evidence base (signals collected)

| Signal class | Result |
|---|---|
| Lint (`npm run lint`) | **FAIL** — 4 unused-var errors in `e2e/stage2/{split-view-edge,split-view-real}.spec.ts` (committed red) |
| Typecheck (`npm run typecheck`) | PASS |
| Build (`npm run build`) | PASS with warnings: `rollupOptions`+`rolldownOptions` conflict (crx plugin), node builtins externalized (opencv-js, espeak-phonemes), chunks >500kB |
| Unit tests (`npm run test:unit`) | 5637 pass / **7 fail** / 32 skipped — `phraseMatchBenchmark.test.ts` fails on fresh clone (untracked `/data/` fixture, no `existsSync` guard unlike 4 sibling fixture tests) |
| Dependency freshness (`npm outdated`) | 26 outdated; eslint 9.39.5 **deprecated/unsupported** (npm ci warning), typescript 6→7, vite 8.0.16→8.3.0, transitive `glob@10.5.0` security warning |
| TODO/FIXME/HACK markers | 1 (`Spinner.tsx:23`) — comment-free codebase rule makes marker scan a weak signal here |
| Files >500 lines | **38** source files |
| Human-inferred (git log) | 4+ `debt(subtitle)` extraction commits, `refactor(*)` cadence high, "Temporary — remove after split view" debug relay committed to production |
| Subagent cross-check | ~35 evidence items: inverted layer deps, import cycle, SW-state gaps, production debug seams, config drift — all sampled cites re-verified by adversarial pass |

## Inventory (all 14 items, ranked)

| # | Location | Type | Description | V | R | Reach | Cost | Score |
|---|---|---|---|---|---|---|---|---|
| 1 | `background/{index,helpers,messageBus,offscreenManager,handlers/*}`, `offscreen/*` | Architectural | **MV3 SW-state fragility.** `mediaMap` never repopulated on SW restart → restored/queued downloads fail `"No media found for download"` (`wireEvents.ts:281`); all detected-media maps die on suspension; `offscreenManager.isReady` cached forever; **3 rogue `OffscreenManager` instances** (`ttsDownload`, `pronunciation`, `localTts` handlers) skip `ensureOffscreenReady()` handshake; `closeOffscreenDocument()` has **zero callers** — offscreen doc permanently resident hosting transmux+OCR+TTS+eSpeak under an ffmpeg-only justification. | 4 | 5 | 4 | 3 | **4.20** |
| 2 | `shared/lib/{tokens,themeTokens}.ts`, `shared/lib/shadowRoot/ShadowThemeProvider.tsx`, `entities/message/types.ts`, `stores/*`, `features/*/index.ts` | Architectural | **Inverted/missing layer boundaries.** `shared/` imports `features/theme` + a subtitle CSS module; `entities/message` imports a feature file; `stores/` couples to feature internals; confirmed cycle `dictionaryPopup↔universalPanel↔cardCreator↔subtitle`; **502 deep cross-feature imports vs ~6 root**; only ~9/20 features have barrels and they `export *` internals; ~224 deep `@/features` imports from entrypoints. | 5 | 4 | 5 | 5 | **4.05** |
| 3 | `background/index.ts:174-189,350`, `offscreen/ffmpegRunner.ts:336-344,537-555`, `shared/lib/chrome-apis/runtime.ts:16-29`, `entrypoints/content/content-script.ts:~1243-1402`, `entrypoints/content/ocrContentScript.ts:855-907`, `scripts/patch-ocr-csp.mjs` | Code quality *(security-adjacent)* | **Production debug seams.** Every `_OFFSCREEN_` message writes `__sendMessageDebug`/`__offscreenListenerMsg` to `chrome.storage.local`; `__cellBg` exposes `BackgroundService` on `globalThis`; `__CELL_SPLIT_VIEW_LOG` relay marked "Temporary"; content script polls `GET_DETECTED_MEDIA` 5s×12 + writes page-readable `data-cell-debug-media` attrs; page-reachable `__CELL_OCR_DEBUG_INIT` postMessage handler; `__CELL_OCR_TRACKS` posts cue data with `'*'`; `patch-ocr-csp.mjs` injects `self.__debugBroadcast` into shipped bundles. | 3 | 5 | 4 | 2 | **4.05** |
| 4 | `subtitle/ui/contentScriptController.ts` (1833), `dictionaryPopup/controller/webTextDictionaryController.ts` (1750), `subtitle/ui/SubtitlePanels.tsx` (1521), `entrypoints/content/content-script.ts` (1402), `cardCreator/ui/useCardCreatorState.ts` (1388), `download/downloader.ts` (1221), `local-player/main.tsx` (1131), `entities/message/types.ts` (896) | Architectural | **God files.** 38 files >500 lines; `SubtitlePanels.tsx` regrew past its post-decomposition size (1344→1521) proving extraction doesn't hold without boundaries; `contentScriptController` sits under `ui/` while importing 12+ features — worst coupling node; 896-line protocol god-file. | 5 | 4 | 4 | 4 | **4.00** |
| 5 | `entities/message/{types,schema,index}.ts`, `shared/config/messages.ts`, `dictionaryPopup/schema.ts`, `background/messageBus.ts`, `subtitle/events.ts`, `subtitle/logic/{youtubeSplitView,iframeManagerBridge*}.ts` | Architectural | **Message protocol fragmentation + trust drift.** Protocol spread across 4 files/3 layers; string-ly typed CustomEvent/postMessage names (`__YT_*`, `__CELL_*`, `cell:cues:*`) with no schema/registry; ~15 of ~100 message types skip zod validation (`ocr`, `localPlayer` handlers cast `request.payload as …`; `screenshot` ignores the payload); content scripts can spoof `signal.tabId/frameId` (comment admits skipped sender check); `Map.set` silently overwrites duplicate handlers; shared `sendMessage` resolves `undefined` when `chrome` absent — dead background indistinguishable from empty response. | 3 | 5 | 4 | 4 | **3.75** |
| 6 | `scripts/patch-ocr-csp.mjs`, `vite.config.ts` vs `vite.{pages,showcase,test}.config.ts`, `dist/` | Infrastructure | **Build pipeline fragility.** postbuild string-patches (includes+split/join) **6 bundled artifacts** — opencv/ort/worker-entry; `opencv` chunk **10.3 MB** (3.4 MB gz), `mountCardCreatorDialog` **1.27 MB**, `ui` 431 kB, `ort` 395 kB; node builtins externalized; `rollupOptions` vs `rolldownOptions` drift + `cssMinify`/interop differences across 4 configs; `FULL_INPUT` ships `cardCreatorTest.html` + 4 mockup pages into production `dist/`. | 3 | 5 | 3 | 3 | **3.70** |
| 7 | `dictionary/logic/phraseMatchBenchmark.test.ts`, `e2e/stage2/*`, `eslint.config.ts`, `playwright.{config,stream.config}.ts` | Testing / Process | **Quality-gate hygiene.** Benchmark test fails on fresh clone (`/data/` gitignored, missing `existsSync` guard its 4 siblings have); lint committed red (4 unused vars); eslint uses `recommended` not `recommendedTypeChecked` — no `no-floating-promises`/`no-misused-promises` in an async-heavy MV3 codebase; playwright configs duplicate ~25 lines + overlapping `testMatch` (`extension*.spec.ts` runs under both). | 4 | 3 | 4 | 2 | **3.65** |
| 8 | `dictionaryPopup/{types.ts,schema.ts,services/ttsEngineService.ts,logic/lruCache.ts}` | Architectural | **dictionaryPopup is the accidental domain layer.** `TtsEngine` interface + `createTtsEngine()` live here but are consumed by `features/tts`, `reader`, `background/handlers/tts`; `types.ts` is the de-facto domain model for 5+ features; `schema.ts` (339 lines) hosts TTS/pronunciation/images/frequency/translate/media-url zod schemas for 11 background handlers. (Cycle evidence counted under item 2 — no double-charge.) | 4 | 3 | 4 | 4 | **3.35** |
| 9 | `shared/config/config.ts:23-30`, `types/*` vs `entities/*`, `app/.gitkeep` | Architectural | **Legacy branches + dual type system.** 3 `USE_LEGACY_*` flags in different residual states — `USE_LEGACY_SUBTITLE`'s implementation was deleted: enabling it warns and yields *no overlay*; `@/types/*` deprecated shims vs `@/entities/*` (~39 files reference `@/types`, mostly tests); `Settings` resolves via 3 import paths; `@deprecated` leftovers; empty `src/app/` held by `.gitkeep`. | 3 | 3 | 3 | 2 | **3.15** |
| 10 | `stores/*`, `tokenize/services/tokenizeStateStore.ts`, `studyModes/studyModeStore.ts`, `useCardCreatorState.ts:92` | Code quality | **State-management fragmentation.** 5 paradigms: hand-rolled subscribe-store, zustand+chrome.storage+messaging fused module, zustand globals, module-level `fieldMappingWriteQueue`; `cuesStore` self-registers a `document` listener at import time never removed; `orbitalBadgeStore` is plain async functions, not a store. | 3 | 3 | 3 | 3 | **3.00** |
| 11 | `package.json` deps | Infrastructure | **Dependency staleness.** Mostly devDependencies: eslint 9.39.5 EOL→10, typescript 6→7, react-hooks plugin 5→7, jest-dom 6→7, vite 8.0.16→8.3.0, playwright 1.61→1.63; runtime-facing: `lucide-react` 1.34→1.45; transitive `glob@10.5.0` security warning. *(Adversarial: R lowered 4→3 — exposure is dev tooling, not runtime.)* | 2 | 3 | 4 | 3 | **2.90** |
| 12 | `subtitle/logic/subtitleResponseCache.ts`, `subtitle/actions/cardActions.ts:49`, `audio/ui/AudioPanel.tsx` vs `dictionaryPopup/ui/AudioPanel.tsx`, `background/helpers.ts:310` | Code quality | **Duplicate parallel infra.** Unbounded `Map` subtitle cache coexists with `lruCache`; third Latin-only `tokenizeSubtitleWords` alongside `tokenize/logic` + `phraseMatcher`; two same-named `AudioPanel` components with different purposes; OCR content logic split between `entrypoints/` and `features/ocr`; `BackgroundService` ~30 delegations re-declared in 3 places (class + `helpers.ts` + `BackgroundContext` interface). | 3 | 2 | 3 | 3 | **2.65** |
| 13 | `src/**` | Code quality | **Observability gap.** ~170 `console.*` calls across 49 files, no logger abstraction/level gating; test output noisy. | 2 | 2 | 4 | 3 | **2.55** |
| 14 | `src/entrypoints/{mock-*,mockup-*,design-system-showcase,test}` | Architectural | **Dev/mock pollution.** ~15-16 of 24 `entrypoints/` dirs are non-production; several ship into production `dist/` via `FULL_INPUT` (see item 6); two colocated showcase conventions. | 2 | 2 | 3 | 2 | **2.50** |

## Business impact (top 3)

1. **SW-state fragility (4.20):** every install keeps a permanently-resident offscreen document (transmux + OCR + TTS + eSpeak) — on the ≥1GB-RAM persona floor this is standing memory pressure; and every user who queues a download then idles hits `"No media found for download"` on resume — **deterministic user-facing defect, not theoretical**.
2. **Layer boundaries + domain placement (4.05 + 3.35):** `dictionaryPopup` is the highest-churn area (85k lines changed/90d) and sits inside a confirmed 4-feature import cycle — refactors there break `universalPanel`/`cardCreator` silently; FSD migration is structurally stalled, roughly **doubling change time** in the hottest code.
3. **Production debug seams (4.05):** cue data + internals reachable by host pages (`data-cell-debug-media`, `__CELL_OCR_TRACKS` `'*'`, `__CELL_OCR_DEBUG_INIT`) — privacy + Chrome Web Store review risk, plus a `chrome.storage.local` write **per offscreen message** on the hot path.

## Recommended roadmap

### Quick wins (score ≥3.5, cost ≤2) — next sprint, owner TBD
1. **Gate/remove debug seams** (item 3): strip `__sendMessageDebug`/`__offscreenListenerMsg` storage writes, `__cellBg`, `__CELL_SPLIT_VIEW_LOG`, `__debugBroadcast` injection, `data-cell-debug-media` writes, `__CELL_OCR_DEBUG_INIT`/`__CELL_OCR_TRACKS '*'` — or gate all behind `__CELL_DEBUG__`. Est. <1 day for the mechanical pass.
2. **Un-red the gates** (item 7): add `existsSync` skip to `phraseMatchBenchmark.test.ts` (match sibling pattern), fix 4 e2e unused vars, switch eslint to `recommendedTypeChecked` + fix the fallout it surfaces. Est. 1-2 days.

### Pay-down plan (score ≥4.0, cost ≥3) — schedule across sprints, owner TBD
3. **SW-state hardening** (item 1, ~1 sprint): repopulate `mediaMap` in `performSessionRestore` (or persist detected media to `chrome.storage.session`), consolidate to a single `OffscreenManager`, always `ensureOffscreenReady()`, add idle TTL/`closeOffscreenDocument` caller, re-validate `isReady` on send failure.
4. **God-file decomposition with boundaries** (item 4, rolling): continue the `debt(subtitle)` extractions — but land each behind a real barrel (item 2), else regrowth repeats (`SubtitlePanels` precedent).
5. **Feature boundary enforcement** (item 2, multi-sprint): give all features real `index.ts` public APIs, move `features/theme` deps out of `shared/`, extract `entities/message`'s feature import, break the `dictionaryPopup↔universalPanel↔cardCreator↔subtitle` cycle, then make deep `@/features/*/…` imports an eslint `no-restricted-imports` error.

### Scheduled (score ≥3.5, cost 3-4) — next 2-3 sprints, after quick wins
6. **Message protocol SSOT** (item 5): single registry (type + payload schema + direction + owner), zod-validate the ~15 uncovered message types, enforce sender `tabId/frameId` over payload-supplied, reject duplicate handler registration, make `sendMessage` distinguish "no chrome" from "empty response".
7. **Build pipeline de-fragilize** (item 6): replace string-patching with upstream fixes/wrapper modules where feasible, split or lazy-load opencv (10.3MB chunk), unify rollup/rolldown options via a shared config factory, remove `cardCreatorTest`/`mockup-*` from `FULL_INPUT`.

### Watch list (score <3.5)
- **Item 8** — extract `dictionaryPopup` domain assets (`TtsEngine`, `schema.ts`, `types.ts`) to `entities/`/`shared/` — do *with* item 2.
- **Item 9** — reconcile `USE_LEGACY_*` flags and collapse `@/types` shims; cheap, bundle with quick-win sprint.
- **Item 10** — state-management convention doc + `cuesStore` listener cleanup.
- **Item 11** — dependency refresh quarterly; note `patch-ocr-csp.mjs` will break on opencv/ort bumps (tightened by item 6).
- **Items 12-14** — opportunistic cleanup when touching the area (per ponytail rule).

### Stop-loss
- None declared — no deliberate deadline-debt found carrying an expiry; the `"Temporary"` split-view relay is effectively stop-loss and is covered by quick win 1.

## Tooling gaps
- `tooling gap: coverage` — `test:coverage` exists but no thresholds; coverage health not assessed.
- No circular-dependency lint (e.g. `import/no-cycle`) — item 2's cycle was found manually; enforcement recommended as part of pay-down 5.

## Verification trail
- Scope: concrete (3 dirs, churn-derived). ✓
- Signals: automatic + human-inferred + subagent cross-check collected. ✓
- Every item classified into the six types, weighted score computed. ✓
- Top 3 have business-language impact. ✓
- Adversarial subagent review: 12 flags received → accepted 10 (re-scored items 1/3/11, re-typed 3/4, de-duplicated cycle evidence into item 2, corrected wording: "string-patch", "warns not silent", "~15-16 dirs", "4 sibling tests", "~15/100 message types"), rejected 2 (lucide-react 1.45 — confirmed by `npm outdated` registry output; `502 deep imports` — measured directly via grep).
