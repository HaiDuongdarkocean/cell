# Chrome Extension MV3 Architecture Review — 2026-07-01

## Extension: Video Downloader v0.1.0

---

## 1. Snapshot

### Manifest
- **Manifest version**: 3
- **Permissions**: 7 — `webRequest`, `downloads`, `storage`, `offscreen`, `activeTab`, `tabs`, `sidePanel`
- **Host permissions**: `<all_urls>`
- **Entrypoints**: 5
  - Background SW: `src/entrypoints/background/index.ts` (type: module)
  - Content scripts: 2
    - `src/entrypoints/content/content-script.ts` (run_at: `document_idle`, all_frames, match_origin_as_fallback)
    - `src/entrypoints/content/fetchInterceptor.iife.ts` (run_at: `document_start`, world: `MAIN`, all_frames, match_origin_as_fallback)
  - Popup: `src/entrypoints/popup/index.html`
  - Side panel: `src/entrypoints/sidepanel/index.html`
  - Offscreen: `src/entrypoints/offscreen/ffmpeg.html`
- **CSP**: `script-src 'self' 'wasm-unsafe-eval'; object-src 'self'` (wasm-unsafe-eval justified for ffmpeg.wasm)

### Structure
```
src/
├── app/                  [empty — .gitkeep only]
├── entities/             10 files — 5 domain modules (media, message, settings, subtitle, video)
│   └── each has index.ts (barrel) + types.ts
├── entrypoints/          30 files — 5 entrypoints (background, content, offscreen, popup, sidepanel)
│   ├── background/       4 files (index.ts 2203 lines, messageBus, networkInterceptor, offscreenManager)
│   ├── content/          4 files (content-script.ts 774 lines, fetchInterceptor.iife, pageScanner, themeTokens)
│   ├── offscreen/        3 files (ffmpeg.html, ffmpegRunner 491, transmuxWorker)
│   ├── popup/            16 files (App.redesigned.tsx 393, 5 hooks, store, utils, 6 components)
│   └── sidepanel/        5 files (App.tsx, main, index.html, CueList, sidePanelStore)
├── features/             60 files — 6 features (detection, download, settings, subtitle, transmux, whitelist)
│   ├── detection/        5 files (4 detectors + index)
│   ├── download/         5 files (downloader.ts 1200 lines, autoDownload, downloadQueue, selectBestMedia, index)
│   ├── settings/         6 files (5 UI components + index)
│   ├── subtitle/         22 files (logic/ 8, service/ 2, ui/ 11, index)
│   ├── transmux/         20 files (execution/ 8, merging/ 7, planning/ 4, index)
│   └── whitelist/        2 files (whitelist + index)
├── shared/               23 files
│   ├── config/           3 files (config, messages, urls + index)
│   ├── lib/chrome-apis/  5 files (downloads, runtime, storage, tabs + index) — ADAPTER LAYER
│   ├── lib/parsers/      8 files (ass, assToSrt, m3u8, srtNormalizer, srt, vtt, vttToSrt + index)
│   ├── lib/storage/      2 files (opfsStorage + index)
│   └── utils/            4 files (file, time, url + index)
├── stores/               [empty — .gitkeep only]
└── types/                4 files (media, message, muxjs.d.ts, subtitle) — legacy barrels (Strangler Fig)
```

- **Top-level folders**: 7 (app, entities, entrypoints, features, shared, stores, types)
- **Total source files**: 127 (.ts/.tsx)
- **Largest folder**: `features/subtitle/` (22 files) — under god-folder threshold (30)
- **Barrel exports found**: 24 barrels across 19 modules — excellent coverage
- **Architecture style**: FSD (Feature-Sliced Design) with Strangler Fig migration in progress (`src/types/` → `src/entities/`)

### chrome.* Heatmap (real calls, comments excluded)

| API | Files | Real calls | Outside entrypoints+adapters |
|-----|-------|------------|------------------------------|
| chrome.storage | 9 | 60 | 0 (all in entrypoints or shared/lib/chrome-apis) |
| chrome.runtime | 11 | 51 | 0 |
| chrome.tabs | 7 | 49 | 0 |
| chrome.downloads | 4 | 12 | 0 (features use adapter) |
| chrome.webRequest | 1 | 7 | 0 (only in networkInterceptor) |
| chrome.offscreen | 1 | 5 | 0 |
| chrome.sidePanel | 1 | 1 | 0 |
| chrome.action | 1 | 4 | 0 |
| **Total** | **20 files** | **189** | **0 in features/entities** |

> **Note**: Adapter layer `shared/lib/chrome-apis/` exists (21 calls) but is used by only 5 consumers (all in features). Entrypoints call `chrome.*` directly (168 calls) — bypassing the adapter.

### Dependency Graph Summary
- **Total imports**: 226
- **Circular dependencies**: 0 (no file-level cycles detected)
- **Cross-feature imports**: 6
  - `features/download` → `features/transmux` (downloader.ts:5,6 — deep import)
  - `features/download` → `features/whitelist` (autoDownload.ts:31 — deep import)
  - `features/subtitle` → `features/detection` (subtitleImport.ts:2, subtitleNaming.ts:1 — deep import)
  - `features/settings` → `features/subtitle` (SubtitlePreview.tsx:3 — deep import)
  - `features/transmux/merging` → `features/transmux/planning` (intra-feature, OK)
- **Deep imports (bypass barrel)**: 36 — concentrated in:
  - `entrypoints/content/content-script.ts`: 12 deep imports into `features/subtitle/*`
  - `entrypoints/background/index.ts`: 7 deep imports into `features/*`
  - `entrypoints/popup/App.redesigned.tsx`: 3 deep imports
  - `entrypoints/offscreen/ffmpegRunner.ts`: 3 deep imports
- **Layer violations**: 1 (entities/settings/types.ts:4 imports from `@/types/subtitle` legacy barrel instead of `@/entities/subtitle` — should import from sibling entity directly)
- **Legacy `@/types/` usage**: 78 imports still go through `@/types/` barrels instead of `@/entities/<x>` — Strangler Fig migration incomplete

---

## 2. Findings

### Critical

- [C1] Background service worker is a god-file (2,203 lines) doing heavy orchestration
  - **Category**: Lifecycle
  - **Evidence**: `src/entrypoints/background/index.ts:1-2203`
  - **Impact**: Any change touches the same file; SW re-evaluation risk on idle eviction; hard to locate logic; untestable in isolation; merge conflicts on parallel work. File owns `BackgroundService` class with downloader instance, fetch calls (lines 808, 1645, 1743), message routing, download queue management, auto-download, settings sync — 7+ responsibilities.
  - **Recommendation**: Extract business logic into feature modules. Keep SW as thin orchestrator: lifecycle hooks + messageBus registration + delegating to `features/download`, `features/detection`, `features/subtitle`. Target < 300 lines for `index.ts`.

- [C2] Background SW performs `fetch()` directly — long-running task vulnerable to idle eviction
  - **Category**: Lifecycle
  - **Evidence**: `src/entrypoints/background/index.ts:808` (`await fetch(video.url, {...})`), `:1645` (`await fetch(sub.url)`), `:1743` (`await fetch(finalUrl)`)
  - **Impact**: Chrome can kill the SW mid-fetch when idle. Large video/subtitle fetches will be aborted silently, leaving downloads in inconsistent state. SW has 30s-5min lifecycle; fetches of large files exceed this.
  - **Recommendation**: Move long-running fetches to the offscreen document (already exists for ffmpeg). SW should delegate via message to offscreen, which persists for the fetch duration. Alternatively use `chrome.downloads.download` for direct URL downloads (already used at line 470) and reserve fetch for small payloads only.

- [C3] No `chrome.runtime.onStartup` / `onInstalled` restore logic for in-flight state
  - **Category**: Lifecycle
  - **Evidence**: grep `onStartup|onInstalled` in `src/entrypoints/background/*.ts` — 0 matches
  - **Impact**: When SW restarts (idle eviction, browser restart, extension update), in-flight download state is lost. `backgroundService: BackgroundService | null` (line 2160) is a global `let` that assumes SW persistence — violated by MV3 lifecycle. Users see "stuck" downloads after SW restart.
  - **Recommendation**: Add `onStartup` + `onInstalled` handlers that rehydrate state from `chrome.storage.session` (already used for `SESSION_MEDIA` / `SESSION_DOWNLOADS` — extend pattern). Reconstruct `BackgroundService` from persisted state, not from scratch.

### High

- [H1] Entrypoints bypass chrome.* adapter layer (168 direct calls vs 21 adapter calls)
  - **Category**: Boundary / Testability
  - **Evidence**: `entrypoints/background/index.ts` (60 real chrome.* calls), `entrypoints/content/content-script.ts` (20), `entrypoints/sidepanel/App.tsx` (14), `entrypoints/popup/App.redesigned.tsx` (9), `entrypoints/popup/utils/getActiveContentTab.ts` (5), `entrypoints/popup/store/popupStore.ts` (4), `entrypoints/popup/hooks/*` (10 across 4 files), `entrypoints/content/themeTokens.ts` (4), `entrypoints/offscreen/ffmpegRunner.ts` (5), `entrypoints/background/messageBus.ts` (7), `entrypoints/background/networkInterceptor.ts` (7), `entrypoints/background/offscreenManager.ts` (5)
  - **Impact**: Cannot unit test entrypoints without `chrome` global mock. Adapter layer (`shared/lib/chrome-apis/`) exists but is bypassed. Inconsistent: features use adapters (5 consumers), entrypoints don't (12 files bypass). Test coverage of entrypoints requires heavy mocking.
  - **Recommendation**: Route all `chrome.*` calls in entrypoints through `shared/lib/chrome-apis/` adapters. Extend adapter layer with any missing APIs (e.g. `webRequest`, `offscreen`, `sidePanel`, `action`). Enables unit testing entrypoints with mocked adapters.

- [H2] 36 deep imports bypass barrel `index.ts` — consumers reach into internal files
  - **Category**: Boundary / Discoverability
  - **Evidence**: `entrypoints/content/content-script.ts` imports 12 internal files from `features/subtitle/ui/*` and `features/subtitle/logic/*` directly (lines 2-13, 20). `entrypoints/background/index.ts` imports 7 internal feature files (lines 18-28). `features/download/downloader.ts` imports `@/features/transmux/merging/conversionTimer` + `@/features/transmux/planning/parallelPlanner` (lines 5-6).
  - **Impact**: Barrel exports exist (24 barrels) but are not used by entrypoints. Refactoring internal file names breaks consumers. Public API of each feature is not enforced — any internal symbol can be imported. Makes feature boundaries leaky.
  - **Recommendation**: Entryoints should import from feature barrels only (`@/features/subtitle`, not `@/features/subtitle/ui/subtitleOverlay`). Expand barrel exports to include what entrypoints need. Enforce via ESLint rule `no-restricted-paths` or `import/no-internal-modules`.

- [H3] Strangler Fig migration stalled — 78 imports still use legacy `@/types/` barrels
  - **Category**: Discoverability / Boundary
  - **Evidence**: 78 `from '@/types/...'` imports across `src/` (vs 0 `from '@/entities/...'` imports outside entities themselves). `src/types/media.ts` header says "New code SHOULD import from the specific entity barrel" but no enforcement. `entities/settings/types.ts:4` imports from `@/types/subtitle` (legacy) instead of `@/entities/subtitle` (sibling).
  - **Impact**: Two parallel type systems (`@/types/` + `@/entities/`) confuse new contributors and AI agents about where types live. `SubtitleFormat` defined differently in `@/types/media` ('ass'|'vtt'|'srt') vs `@/types/subtitle` (adds 'ssa'|'unknown') — known divergence noted in `src/types/media.ts:14-16` but unresolved. Migration has been "in progress" long enough to become permanent debt.
  - **Recommendation**: Finish the migration — flip `@/types/*` to re-export from `@/entities/*` (already done for message/subtitle) and add ESLint `no-restricted-paths` to forbid new `@/types/` imports. Resolve `SubtitleFormat` divergence (consolidate to one definition). Then delete `src/types/` or keep only `muxjs.d.ts` (ambient).

- [H4] Content script is heavy (774 lines) with 12 deep imports into `features/subtitle`
  - **Category**: Injection / Boundary
  - **Evidence**: `src/entrypoints/content/content-script.ts:1-774`, imports lines 2-13, 20
  - **Impact**: Content script runs in page context (ISOLATED world) — heavy logic increases parse time on every page load (`matches: <all_urls>` + `all_frames: true` = injected into every frame). 12 deep imports = tight coupling to subtitle feature internals. Hard to test, hard to scope down to pages that actually need it.
  - **Recommendation**: Move subtitle UI orchestration into a feature module (`features/subtitle/ui/contentScriptController.ts`) that exports a single `init()` function. Content script becomes thin: detect page → call `init()` → wire message listeners. Consider `chrome.scripting.executeScript` with dynamic injection for pages with video only, instead of static `<all_urls>`.

- [H5] No storage schema versioning — settings shape changes have no migration path
  - **Category**: Storage
  - **Evidence**: grep `schemaVersion|migration|migrate` in `src/` — 0 matches (only comment in `src/types/media.ts:2`). `STORAGE_KEYS.SETTINGS = 'settings'` stored via `chrome.storage.local` with no version field.
  - **Impact**: When `Settings` interface adds/removes fields (happens every feature release), existing users have stale settings — code reads `undefined` for new fields, may crash or silently use defaults. No way to detect "this user is on schema v1, migrate to v2". `Settings` interface in `entities/settings/types.ts` has 20+ fields — high churn surface.
  - **Recommendation**: Add `schemaVersion: number` to settings payload. On load, compare version → run migration functions (`migrate_v1_to_v2(settings)`) → persist updated. Centralize in `shared/lib/storage/settingsStore.ts`.

### Medium

- [M1] Inline storage string literals bypass `STORAGE_KEYS` constant (5 occurrences)
  - **Category**: Storage
  - **Evidence**: `content-script.ts:86,103,569,643,649` use `chrome.storage.local.get('settings')` / `.set({ settings: {...} })` with inline `'settings'` string. `themeTokens.ts:127`, `sidepanel/App.tsx:152` same pattern. `background/index.ts:964,996,1033,1049,1064,1099` use inline strings for session storage.
  - **Impact**: `STORAGE_KEYS` constant exists (`shared/config/config.ts:174`) but is bypassed. Typo in inline string = silent data loss (writes to wrong key, reads return undefined). Refactoring key names requires finding all inline strings.
  - **Recommendation**: Route all storage access through `shared/lib/chrome-apis/storage.ts` adapter + require `STORAGE_KEYS` constant. Add ESLint rule to forbid string literal as first arg to `chrome.storage.*.get/set`.

- [M2] Empty FSD layers `src/app/` and `src/stores/` (only `.gitkeep`)
  - **Category**: Discoverability
  - **Evidence**: `src/app/.gitkeep` + `src/stores/.gitkeep` — 0 source files in either
  - **Impact**: FSD structure declared but `app/` (where global app config, providers, router belong) and `stores/` (where cross-feature Zustand stores belong) are unused. New contributors see empty folders and don't know if they're planned or abandoned. `popupStore` and `sidePanelStore` live inside entrypoints instead of `stores/`.
  - **Recommendation**: Either (a) move `popupStore.ts` + `sidePanelStore.ts` to `src/stores/` and populate `src/app/` with global config, or (b) delete the empty folders to reduce confusion. Pick one — don't leave empty placeholders.

- [M3] Cross-feature imports without going through app/entrypoint orchestration
  - **Category**: Boundary
  - **Evidence**: `features/download/downloader.ts:5,6` → `features/transmux/*`; `features/download/autoDownload.ts:31` → `features/whitelist`; `features/subtitle/logic/subtitleImport.ts:2` + `subtitleNaming.ts:1` → `features/detection`; `features/settings/ui/SubtitlePreview.tsx:3` → `features/subtitle`
  - **Impact**: Features depend on each other directly — cannot swap or remove one feature without breaking others. FSD principle: features should not import each other; orchestration belongs in `app/` or `entrypoints/`. `download` → `transmux` coupling is especially tight (downloader drives conversion).
  - **Recommendation**: For tight couplings (download→transmux), consider merging into one feature or extracting a shared interface in `shared/`. For loose couplings (subtitle→detection for language labeling), invert dependency: pass `detectLanguage` as a parameter from the entrypoint, don't import it from `features/detection`.

- [M4] Content scripts match `<all_urls>` with no runtime host filter
  - **Category**: Injection
  - **Evidence**: `public/manifest.json:22,29` — both content scripts use `"matches": ["<all_urls>"]`
  - **Impact**: Extension injects 774-line content script + fetch interceptor into every page on every site — including sites with no video. Performance overhead on non-video pages. Privacy: fetch interceptor runs on every page. Whitelist feature exists (`features/whitelist`) but is for auto-download, not for content script injection scoping.
  - **Recommendation**: Either (a) narrow `matches` to known video sites (loses flexibility), or (b) keep `<all_urls>` but add early-exit in content script: check `document.querySelector('video')` on `document_idle` → if none, skip subtitle UI injection. Fetch interceptor is harder to scope (needs to catch m3u8 before video element exists) — consider `webRequest` API in background instead of MAIN-world injection.

- [M5] `entities/settings/types.ts` imports from legacy `@/types/subtitle` instead of sibling entity
  - **Category**: Boundary / Layer violation
  - **Evidence**: `src/entities/settings/types.ts:4` — `import type { OverlayStyleConfig } from '@/types/subtitle';`
  - **Impact**: Entities layer should be self-contained — importing from `@/types/` (which re-exports from `@/entities/subtitle`) is an indirect circular-ish dependency. Breaks FSD layering: entities should import from sibling entities directly, not through legacy barrels.
  - **Recommendation**: Change to `import type { OverlayStyleConfig } from '@/entities/subtitle/types';` (sibling direct import).

### Low

- [L1] `App.redesigned.tsx` naming — leftover "redesigned" suffix suggests old `App.tsx` exists
  - **Category**: Discoverability
  - **Evidence**: `src/entrypoints/popup/App.redesigned.tsx` (393 lines)
  - **Impact**: Filename implies a migration in progress — confusing for new contributors. Is `App.tsx` still around? Which is active? `main.tsx` imports one of them.
  - **Recommendation**: Rename to `App.tsx` once the old one is deleted. Remove migration suffix from active file names.

- [L2] `activeTab` permission appears unused in code
  - **Category**: Build/Config
  - **Evidence**: grep `chrome.activeTab` or `activeTab` usage — 0 real calls. Permission listed in `manifest.json:11`.
  - **Impact**: Over-granted permission — store review friction, security review question. `activeTab` is granted on user gesture (clicking the action icon); if not used, remove it. (Note: `tabs` permission already covers tab access.)
  - **Recommendation**: Verify whether `activeTab` is needed for popup tab access (it may be implicit). If not, remove from `manifest.json`. Test popup functionality after removal.

- [L3] Inconsistent folder/file naming — mix of camelCase and kebab-case
  - **Category**: Discoverability
  - **Evidence**: `fetchInterceptor.iife.ts` (kebab+dot), `themeTokens.ts` (camelCase), `subtitleOverlay.ts` (camelCase), `getActiveContentTab.ts` (camelCase), `popupStore.ts` (camelCase). Folders: `chrome-apis/` (kebab), `content/` (lowercase), `App.tsx` (PascalCase for component).
  - **Impact**: Minor — AI agents and new devs must check each file. Not a blocker but adds friction.
  - **Recommendation**: Standardize: PascalCase for React components (`.tsx`), camelCase for logic files (`.ts`), kebab-case for folders. Document in AGENTS.md.

---

## 3. Recommendations

Improvement directions ranked by priority. Each item: direction (not detailed plan), impact, effort.

| # | Direction | Priority | Impact | Effort |
|---|-----------|----------|--------|--------|
| R1 | Split `background/index.ts` (2203 lines) into thin SW + feature modules | P0 | Unblocks parallel work, enables unit testing, reduces merge conflicts | L |
| R2 | Move `fetch()` calls out of SW into offscreen document | P0 | Prevents silent download abort on SW eviction | M |
| R3 | Add `onStartup`/`onInstalled` state rehydration from `storage.session` | P0 | Fixes "stuck downloads after restart" — user-visible bug | M |
| R4 | Route entrypoint chrome.* calls through `shared/lib/chrome-apis/` adapters | P1 | Enables unit testing entrypoints, centralizes chrome.* surface | M |
| R5 | Enforce barrel-only imports via ESLint `no-restricted-paths` | P1 | Seals feature boundaries, prevents deep import creep | S |
| R6 | Finish Strangler Fig: delete `src/types/` after migrating 78 imports to `@/entities/*` | P1 | Eliminates dual type system, resolves `SubtitleFormat` divergence | M |
| R7 | Add storage schema versioning + migration functions | P1 | Prevents silent settings breakage on schema changes | S |
| R8 | Thin out content-script.ts (774 lines) — move logic to feature module | P2 | Reduces per-page parse cost, improves testability | M |
| R9 | Resolve empty `src/app/` and `src/stores/` — populate or delete | P2 | Reduces confusion about FSD structure | S |
| R10 | Add early-exit in content script for pages without `<video>` | P2 | Reduces injection overhead on non-video pages | S |
| R11 | Invert cross-feature dependencies (pass deps as params, don't import) | P2 | Decouples features, enables swapping | M |
| R12 | Remove unused `activeTab` permission after verification | P2 | Cleaner manifest, easier store review | S |

### Notes
- **Codebase already uses FSD** — structure is sound, the debt is in discipline (deep imports, adapter bypass, stalled migration). Focus on enforcement over restructuring.
- **Adapter layer exists but is underused** — `shared/lib/chrome-apis/` has 4 APIs covered (storage, runtime, tabs, downloads). Missing: `webRequest`, `offscreen`, `sidePanel`, `action`. Extend before routing entrypoints through it.
- **Offscreen document already exists** for ffmpeg — pattern for delegating long-running work is established. R2 (move fetch to offscreen) follows the same pattern.
- **`storage.session` already used** for `SESSION_MEDIA` / `SESSION_DOWNLOADS` (survives SW restart) — R3 extends this pattern to full state rehydration.
- **No circular dependencies detected** — dependency graph is acyclic. Good foundation for refactor.
- **Test structure mirrors src** (`tests/unit/features/subtitle/logic/` etc.) — T2 passes. E2E tests exist (4 specs) — T5 passes.
- **Deferred**: MV2→MV3 migration (already MV3), manifest type-safety (C2 — low value vs effort).

---

## 4. Appendix

### Anti-Pattern Checklist Results

| Category | Items | Failed | Severity |
|----------|-------|--------|----------|
| Lifecycle (L1-L5) | 5 | 4 (L1,L2,L3,L4) | Critical — systemic |
| Boundary (B1-B6) | 6 | 3 (B2,B3,B6-partial) | High — significant debt |
| Message (M1-M5) | 5 | 0 | Pass — healthy |
| Storage (S1-S5) | 5 | 3 (S1,S3,S5-partial) | High — significant debt |
| Injection (I1-I5) | 5 | 3 (I1,I2,I4-partial) | High — significant debt |
| Discoverability (D1-D6) | 6 | 2 (D2-partial,D4) | Medium — addressable |
| Testability (T1-T5) | 5 | 1 (T1) | Medium — addressable |
| Build/Config (C1-C5) | 5 | 1 (C3) | Medium — addressable |
| **Total** | **42** | **17** | |

**Item-by-item results**:

| ID | Item | Result | Evidence |
|----|------|--------|---------|
| L1 | God-file background SW > 500 lines | **FAIL** | `background/index.ts` = 2203 lines |
| L2 | Business logic in SW | **FAIL** | SW owns Downloader instance, does fetch, queue mgmt, settings sync |
| L3 | Persistent mutable state in SW | **FAIL** | `let backgroundService: BackgroundService \| null = null` (line 2160) |
| L4 | SW re-init not handled | **FAIL** | 0 `onStartup`/`onInstalled` handlers |
| L5 | Long-running task in SW | **FAIL** | `fetch()` at lines 808, 1645, 1743 |
| B1 | chrome.* scatter outside entrypoints+adapters | **PASS** | 0 real calls in features/entities |
| B2 | Cross-feature import | **FAIL** | 6 cross-feature imports (download→transmux, download→whitelist, subtitle→detection, settings→subtitle) |
| B3 | Deep import bypassing barrel | **FAIL** | 36 deep imports, concentrated in entrypoints |
| B4 | Layer violation (lower imports higher) | **PASS** | No shared/entities → features/app imports |
| B5 | Circular dependency | **PASS** | 0 cycles detected |
| B6 | No adapter for chrome.* | **PARTIAL** | Adapter exists but entrypoints bypass it (168 direct calls) |
| M1 | Untyped messages | **PASS** | `MessageType` union type in `entities/message/types.ts:22`, `TypedMessageRequest<T>` at :389 |
| M2 | Missing tabId in payload | **PASS** | `tabId` present in 20 message payloads (types.ts:84-383) |
| M3 | No message handler registry | **PASS** | `messageBus.ts:15` — `handlers: Map<MessageType, MessageHandler>` |
| M4 | Async response not awaited | **PASS** | messageBus uses `return true` + async handler pattern (line 112) |
| M5 | Content ↔ background tight coupling | **PASS** | Content imports from `features/subtitle` + `entities/*`, not from background |
| S1 | Magic string storage keys | **FAIL** | 5+ inline `'settings'` strings in content-script, themeTokens, App.tsx |
| S2 | Large data in chrome.storage | **PASS** | OPFS used for blobs (`shared/lib/storage/opfsStorage.ts`), storage.local for settings only |
| S3 | No storage schema versioning | **FAIL** | 0 `schemaVersion`/`migration` matches |
| S4 | session vs local confusion | **PASS** | `SESSION_MEDIA`/`SESSION_DOWNLOADS` correctly in `storage.session` (config.ts:180-182) |
| S5 | No storage onChanged listener | **PARTIAL** | Listeners exist in content-script:152, themeTokens:142 — but not in popup/sidepanel for settings sync |
| I1 | Unscoped content script | **FAIL** | `<all_urls>` with no runtime filter |
| I2 | Heavy logic in content script | **FAIL** | 774 lines, 12 deep imports into features/subtitle |
| I3 | Content script imports entrypoint code | **PASS** | No imports from background/popup/sidepanel |
| I4 | No world specification | **PARTIAL** | fetchInterceptor specifies `MAIN` (manifest:32), content-script uses default ISOLATED — correct, but not explicit |
| I5 | Multiple content scripts overlapping | **PASS** | 2 scripts but different worlds (MAIN vs ISOLATED) — coordinated |
| D1 | Technical-prefix folders at root | **PASS** | FSD folders (app, entities, features, shared) — no `lib/`/`utils/`/`helpers/` at root |
| D2 | No barrel exports | **PARTIAL** | 24 barrels exist but 36 deep imports bypass them |
| D3 | No architecture map doc | **PASS** | `docs/2-architechture-system.md` exists |
| D4 | Inconsistent naming | **FAIL** | Mix of camelCase/kebab/PascalCase (see L3) |
| D5 | No glossary doc | **PASS** | `docs/1-share-language.md` exists |
| D6 | God-folder > 30 files | **PASS** | Largest folder: `features/subtitle/` = 22 files |
| T1 | chrome.* not mockable | **FAIL** | Entrypoints call chrome.* directly (168 calls) — cannot unit test without chrome global |
| T2 | Test structure does not mirror src | **PASS** | `tests/unit/features/subtitle/logic/` mirrors `src/features/subtitle/logic/` |
| T3 | No characterization tests | **PASS** | 4 E2E specs + unit tests exist (recent commits show regression testing) |
| T4 | Integration tests touch real chrome.* | **PASS** | Integration tests use cached m3u8 (`.cache/`), mock chrome where needed |
| T5 | No E2E for critical flows | **PASS** | 4 Playwright specs: auto-select, media-persistence, subtitle-filename, subtitle-overlay |
| C1 | Manifest paths hardcoded in multiple places | **PASS** | `@crxjs/vite-plugin` handles popup/background; only offscreen+sidepanel in vite.config.ts:16-17 |
| C2 | No type-safe manifest | **PASS** (deferred) | Not checked — low value vs effort |
| C3 | Permissions over-granted | **FAIL** | `activeTab` appears unused (0 `chrome.activeTab` calls) |
| C4 | web_accessible_resources too broad | **PASS** | `assets/*` only — needed for subtitle overlay injection |
| C5 | CSP too permissive | **PASS** | `wasm-unsafe-eval` justified for ffmpeg.wasm, no `unsafe-eval`/`unsafe-inline` |

### Detailed chrome.* Usage (top files, real calls only)

| File | API | Calls | Notes |
|------|-----|-------|-------|
| `entrypoints/background/index.ts` | storage, tabs, downloads, runtime, action, sidePanel, webRequest | 60 | God-file — all APIs here |
| `entrypoints/content/content-script.ts` | runtime, storage, tabs | 20 | Heavy for a content script |
| `entrypoints/sidepanel/App.tsx` | tabs, runtime, storage | 14 | UI component calling chrome.* directly |
| `entrypoints/background/networkInterceptor.ts` | webRequest | 7 | Correct location for webRequest |
| `entrypoints/background/messageBus.ts` | runtime | 7 | Message routing — correct |
| `entrypoints/popup/App.redesigned.tsx` | runtime | 9 | UI component calling chrome.* directly |
| `entrypoints/offscreen/ffmpegRunner.ts` | runtime, downloads | 5 | Offscreen — correct location |
| `entrypoints/background/offscreenManager.ts` | offscreen, runtime | 5 | Correct location |
| `entrypoints/popup/utils/getActiveContentTab.ts` | tabs | 5 | Adapter candidate — already abstracted |
| `shared/lib/chrome-apis/storage.ts` | storage | 5 | Adapter — underused |
| `shared/lib/chrome-apis/tabs.ts` | tabs | 6 | Adapter — underused |
| `shared/lib/chrome-apis/runtime.ts` | runtime | 5 | Adapter — underused |
| `shared/lib/chrome-apis/downloads.ts` | downloads | 5 | Adapter — underused |
| `entrypoints/content/themeTokens.ts` | storage | 4 | Should use adapter |
| `entrypoints/popup/store/popupStore.ts` | storage | 4 | Should use adapter |
| `entrypoints/popup/hooks/useDetectedMedia.ts` | runtime | 4 | Should use adapter |
| `entrypoints/popup/hooks/useDownloadProgress.ts` | runtime | 4 | Should use adapter |

### Dependency Graph (cross-feature + layer violations only)

```
entrypoints/background/index.ts
  ├──@/features/download/downloadQueue       (deep)
  ├──@/features/download/autoDownload        (deep)
  ├──@/features/download/downloader          (deep)
  ├──@/features/subtitle/service/subtitleService (deep)
  ├──@/features/detection/logic/videoDetector   (deep)
  ├──@/features/detection/logic/subtitleDetector(deep)
  └──@/features/detection/logic/languageDetector(deep)

entrypoints/content/content-script.ts
  ├──@/features/subtitle/ui/subtitleOverlay        (deep)
  ├──@/features/subtitle/logic/subtitleImport      (deep)
  ├──@/features/subtitle/ui/subtitleUI             (deep)
  ├──@/features/subtitle/logic/subtitleAutoLoad    (deep)
  ├──@/features/subtitle/logic/subtitleMerge       (deep)
  ├──@/features/subtitle/ui/subtitlePanel          (deep)
  ├──@/features/subtitle/ui/subtitleShortcuts      (deep)
  ├──@/features/subtitle/ui/subtitleSelector       (deep)
  ├──@/features/subtitle/ui/subtitleManagerPanel   (deep)
  ├──@/features/subtitle/ui/subtitleToast          (deep)
  ├──@/features/subtitle/logic/subtitleNaming      (deep)
  └──@/features/subtitle/ui/subtitleManagerPanel   (deep, type)

features/download/downloader.ts
  ├──@/features/transmux/merging/conversionTimer   (deep, cross-feature)
  └──@/features/transmux/planning/parallelPlanner  (deep, cross-feature)

features/download/autoDownload.ts
  └──@/features/whitelist/whitelist                (deep, cross-feature)

features/subtitle/logic/subtitleImport.ts
  └──@/features/detection/logic/languageDetector   (deep, cross-feature)

features/subtitle/logic/subtitleNaming.ts
  └──@/features/detection/logic/languageDetector   (deep, cross-feature)

features/settings/ui/SubtitlePreview.tsx
  └──@/features/subtitle/ui/subtitleUI             (deep, cross-feature)

entities/settings/types.ts
  └──@/types/subtitle  (legacy barrel — should be @/entities/subtitle/types)
```

### Files Reviewed
- Manifest: `public/manifest.json`
- Source files scanned: 127 (.ts/.tsx) across 7 top-level folders
- Test files scanned: tests/unit/ (mirrors src), tests/integration/, e2e/ (4 specs)
- Docs scanned: `docs/2-architechture-system.md`, `docs/1-share-language.md`, `AGENTS.md`

---

*Generated by `chrome-extension-mv3-architecture-review` skill on 2026-07-01. Read-only review — no code was modified, no refactor plan generated.*
