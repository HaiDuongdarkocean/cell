# Spec: Refactor Architecture Debt (Phase 2) — 8 Findings from Architecture Review

> **Phase**: G1 Requirements/Spec (output spec-driven-development)
> **Status**: Draft — chờ anh review
> **Date**: 2026-07-01
> **Intent source**: `docs/intent/intent-refactor-system-architecture.md` (updated 2026-07-01)
> **Architecture review**: `docs/reviews/architecture-review-2026-07-01.md` (17/42 failures, 3 Critical + 5 High)
> **Related**: ADR-016 (FSD refactor phase 1, M0-M13 done), `docs/2-architechture-system.md` (current map)

## Objective

**Problem**: Refactor phase 1 (M0-M13) đã hoàn thành — FSD structure, 24 barrels, message passing healthy, no circular deps, features clean. Architecture review 2026-07-01 phát hiện **17/42 anti-pattern failures**, tập trung vào **Lifecycle (4/5 Critical)** + **Boundary (3/6 High)** + **Storage (3/5 High)** + **Injection (3/5 High)**. 3 Critical Lifecycle gây user-visible bug "stuck downloads after SW restart". 5 High block maintainability + testability.

**Chosen approach** (confirmed Q1:C, Q2:A, Q3:A): Refactor 8 findings (C1-C3 + H1-H5). Giữ FSD top-level structure (Q2:A), focus internal discipline. Commit nhỏ mỗi finding (Q3:A), 1-3 commits/finding, test pass sau mỗi commit.

**User**: Anh — solo developer (architect + developer role), muốn codebase maintainable, testable, không có user-visible bug từ MV3 lifecycle.

**Why now**: 3 Critical Lifecycle = user-visible bug. 5 High = debt tăng dần khi thêm feature. Refactor giờ rẻ hơn sau khi Orca platform features thêm vào.

**Success**:
- 3 Critical Lifecycle fixed — SW < 300 lines, fetch delegated to offscreen, onStartup/onInstalled rehydrate state. "Stuck downloads after SW restart" bug fixed.
- 5 High fixed — entrypoints route through adapter, barrel-only imports enforced, Strangler Fig finished (`src/types/` deleted), content script thinned, storage schema versioned.
- Behavior preservation — refactor, KHÔNG đổi behavior. `npm run test:unit` + `npx tsc --noEmit` + `npm run build` pass xuyên suốt.
- Anti-pattern checklist score: 17/42 → ≤ 5/42 (target: 0 in Critical/High categories).
- Browser verification pass — popup, content-script, sidepanel, offscreen work in real Chrome (MCP/Playwright).

## Assumptions (surface trước khi spec nội dung)

1. **Refactor = preserve behavior**. KHÔNG thêm feature, KHÔNG đổi logic, KHÔNG đổi UI. Chỉ extract/move/wrap. Nếu 1 module có root-cause bug → fix riêng commit khác, không trộn vào refactor.
2. **Giữ FSD top-level structure** (Q2:A). `entrypoints/ + features/ + entities/ + shared/ + stores/ + app/ + types/`. Focus internal discipline, không đổi top-level.
3. **Phạm vi = 8 findings** (Q1:C). C1-C3 (Critical Lifecycle) + H1-H5 (High Boundary/Storage/Injection). Medium/Low findings defer sang phase 3.
4. **Cadence = commit nhỏ mỗi finding** (Q3:A). 1-3 commits/finding. Test pass sau mỗi commit. Dễ rollback, dễ review.
5. **MV3 lifecycle**: SW có thể bị kill bất cứ lúc nào (idle eviction, browser restart, extension update). State phải persist vào `chrome.storage.session` (survives SW restart) hoặc `chrome.storage.local` (survives browser restart). In-flight state = session, settings = local.
6. **Offscreen document**: đã tồn tại cho ffmpeg (`src/entrypoints/offscreen/`). Pattern established — extend cho fetch delegation. Offscreen persists for task duration, không bị killed như SW.
7. **Adapter layer**: `shared/lib/chrome-apis/` đã có 4 APIs (storage, runtime, tabs, downloads). Extend thêm 4 (webRequest, offscreen, sidePanel, action) trước khi route entrypoints through it.
8. **Strangler Fig finish**: `src/types/{media,message,subtitle}.ts` đã re-export từ `@/entities/*`. Flip = mechanical (update 78 imports), tsc catch error. `muxjs.d.ts` giữ (ambient type, không có entity equivalent).
9. **No new dependencies** (ponytail rung 5). Dùng stdlib + installed deps. KHÔNG thêm ESLint plugin `import/no-internal-modules` (lint manual + tsc enforce trước; plugin defer sang phase 3).
10. **Storage schema versioning**: add `schemaVersion: number` to settings payload. Migration functions (`migrate_v1_to_v2`). Centralize in `shared/lib/storage/settingsStore.ts`.

→ Correct me now or I'll proceed with these.

## Tech Stack

- **Runtime**: Chrome Extension MV3 (service worker, content script, offscreen, popup, sidepanel)
- **UI**: React 19, Zustand 5, TypeScript 6
- **Build**: Vite 8 + @crxjs/vite-plugin (giữ nguyên)
- **Transmuxing**: mux.js 6 (TS → fMP4)
- **Testing**: Jest 30 (unit + integration), Playwright (E2E)
- **Linting**: ESLint 9 + Prettier 3
- **Platform**: Windows (PowerShell) — no bash heredoc, use temp file + `git commit -F`
- **No new dependency** — ponytail rung 5.

## Commands

```
Build:            npm run build
Typecheck:        npm run typecheck
Test unit only:   npm run test:unit         # ~3s, alias test:fast
Test integration: npm run test:integration
Test watch:       npm run test:watch
Coverage:         npm run test:coverage
Lint:             npm run lint
Lint fix:         npm run lint:fix
E2E:              npm run test:e2e
```

## Scope — 8 Findings

### Critical (3 — Lifecycle, systemic)

#### C1. Split background SW god-file (2,203 lines → < 300 lines)

**Current**: `src/entrypoints/background/index.ts` = 2,203 lines, `BackgroundService` class with 7+ responsibilities:
- Downloader instance management (lines 173, 199-202, 352, 384, 435, 510, 526, 1251-1293, 1334-1346)
- `fetch()` calls (lines 808, 1645, 1743) — should be in offscreen (C2)
- Message routing (messageBus wiring)
- Download queue management
- Auto-download orchestration (lines 1212-1239)
- Settings sync (lines 1333-1346)
- `chrome.downloads.download` (line 470)

**Target**: SW = thin orchestrator (< 300 lines):
- `index.ts` — SW entry: init messageBus, register handlers, onStartup/onInstalled (C3)
- `handlers/download.ts` — DOWNLOAD_VIDEO, CANCEL, PAUSE, RESUME, RETRY handlers
- `handlers/media-detection.ts` — GET_DETECTED_MEDIA, PAGE_SCAN_RESULT handlers
- `handlers/subtitle.ts` — SUBTITLE_CUES, VIDEO_TIME_UPDATE handlers
- `handlers/settings.ts` — SETTINGS_UPDATE, SETTINGS_GET handlers
- `handlers/offscreen.ts` — CONVERT_TS_TO_MP4_V2, CREATE_OPFS_BLOB_URL handlers
- Business logic stays in `features/download/`, `features/detection/`, `features/subtitle/` — handlers delegate to features.

**Acceptance criteria**:
- [ ] AC1.1: `src/entrypoints/background/index.ts` ≤ 300 lines
- [ ] AC1.2: No business logic in `index.ts` — only init + handler registration
- [ ] AC1.3: Each handler file < 200 lines, single responsibility
- [ ] AC1.4: `npm run test:unit` pass — existing tests updated to new structure
- [ ] AC1.5: `npx tsc --noEmit` pass
- [ ] AC1.6: `npm run build` pass — manifest SW path unchanged (`src/entrypoints/background/index.ts`)
- [ ] AC1.7: Browser verify — popup → download → cancel → resume works in real Chrome

#### C2. Move `fetch()` from SW to offscreen document

**Current**: SW performs `fetch()` at 3 places:
- `index.ts:808` — `await fetch(video.url, {...})` (video download)
- `index.ts:1645` — `await fetch(sub.url)` (subtitle fetch)
- `index.ts:1743` — `await fetch(finalUrl)` (final URL fetch)

SW can be killed mid-fetch (idle eviction, 30s-5min lifecycle). Large video/subtitle fetches exceed this → silent abort, inconsistent state.

**Target**: Delegate fetch to offscreen document via message:
- SW sends `FETCH_REQUEST { url, options }` to offscreen
- Offscreen performs `fetch()`, returns `FETCH_RESPONSE { data, error }`
- Offscreen persists for fetch duration (not killed like SW)
- Small payloads (< 1MB, e.g. subtitle) can stay in SW if < 5s timeout
- Large payloads (> 1MB, e.g. video segments) MUST go to offscreen

**Acceptance criteria**:
- [ ] AC2.1: 0 `fetch()` calls in `src/entrypoints/background/index.ts` (grep verify)
- [ ] AC2.2: Offscreen handles `FETCH_REQUEST` message type
- [ ] AC2.3: `shared/lib/chrome-apis/` has `offscreenFetch()` adapter
- [ ] AC2.4: Download flow works — video download completes even if SW restarts mid-fetch
- [ ] AC2.5: `npm run test:unit` + `npx tsc --noEmit` + `npm run build` pass
- [ ] AC2.6: Browser verify — download large video, SW restarts (chrome://extensions → reload), download continues from offscreen

#### C3. Add `onStartup`/`onInstalled` state rehydration

**Current**: 0 `onStartup`/`onInstalled` handlers in background. `let backgroundService: BackgroundService | null = null` (line 2160) assumes SW persistence. When SW restarts, in-flight state lost → "stuck downloads" bug.

**Target**:
- `chrome.runtime.onStartup` — fires on browser startup
- `chrome.runtime.onInstalled` — fires on extension install/update
- Both handlers: rehydrate `BackgroundService` from `chrome.storage.session` (already used for `SESSION_MEDIA`/`SESSION_DOWNLOADS`)
- Reconstruct in-flight downloads, queue state, auto-download whitelist
- If no persisted state → fresh init

**Acceptance criteria**:
- [ ] AC3.1: `onStartup` + `onInstalled` handlers exist in `index.ts`
- [ ] AC3.2: State rehydrated from `chrome.storage.session` on SW restart
- [ ] AC3.3: In-flight downloads resume after SW restart (not stuck)
- [ ] AC3.4: `npm run test:unit` + `npx tsc --noEmit` + `npm run build` pass
- [ ] AC3.5: Browser verify — start download, reload extension (chrome://extensions), download state preserved

### High (5 — Boundary/Storage/Injection)

#### H1. Route entrypoints through chrome.* adapter (168 direct → 0 direct)

**Current**: 12 entrypoint files call `chrome.*` directly (168 real calls), bypassing `shared/lib/chrome-apis/` adapter (21 calls). Cannot unit test entrypoints without chrome global mock.

**Target**:
- Extend `shared/lib/chrome-apis/` with missing APIs: `webRequest`, `offscreen`, `sidePanel`, `action`
- Route all entrypoint `chrome.*` calls through adapters
- 0 direct `chrome.*` calls in entrypoints (grep verify)

**Acceptance criteria**:
- [ ] AC1.1: `shared/lib/chrome-apis/` has 8 adapters (storage, runtime, tabs, downloads, webRequest, offscreen, sidePanel, action)
- [ ] AC1.2: 0 direct `chrome.*` calls in `src/entrypoints/` (grep verify, comments excluded)
- [ ] AC1.3: Entrypoints unit-testable with mocked adapters (no chrome global needed)
- [ ] AC1.4: `npm run test:unit` + `npx tsc --noEmit` + `npm run build` pass
- [ ] AC1.5: Browser verify — all entrypoints work in real Chrome

#### H2. Enforce barrel-only imports (36 deep imports → 0)

**Current**: 36 deep imports bypass barrel `index.ts`. `content-script.ts` has 12 deep imports into `features/subtitle/*`. `background/index.ts` has 7 deep imports.

**Target**:
- Expand barrel exports to include what entrypoints need
- Entryoints import from feature barrels only (`@/features/subtitle`, not `@/features/subtitle/ui/subtitleOverlay`)
- 0 deep imports (grep verify — no import path with > 2 segments after `@/features/<name>/`)

**Acceptance criteria**:
- [ ] AC2.1: 0 deep imports in `src/entrypoints/` (grep `from '@/features/[^/]+/` → 0 matches)
- [ ] AC2.2: Feature barrels export all symbols entrypoints need
- [ ] AC2.3: `npm run test:unit` + `npx tsc --noEmit` + `npm run build` pass
- [ ] AC2.4: Browser verify — all entrypoints work

#### H3. Finish Strangler Fig — migrate 78 `@/types/` imports to `@/entities/*`

**Current**: 78 imports still use `@/types/` legacy barrels. `SubtitleFormat` diverged between `@/types/media` ('ass'|'vtt'|'srt') and `@/types/subtitle` (adds 'ssa'|'unknown'). `entities/settings/types.ts:4` imports from `@/types/subtitle` instead of sibling entity.

**Target**:
- Update 78 imports: `@/types/media` → `@/entities/media` (or specific entity), `@/types/message` → `@/entities/message`, `@/types/subtitle` → `@/entities/subtitle`
- Resolve `SubtitleFormat` divergence — consolidate to one definition
- Fix `entities/settings/types.ts:4` → import from `@/entities/subtitle/types` (sibling direct)
- Delete `src/types/{media,message,subtitle}.ts` (keep `muxjs.d.ts` — ambient)
- `src/types/` folder removed or contains only `muxjs.d.ts`

**Acceptance criteria**:
- [ ] AC3.1: 0 imports from `@/types/media`, `@/types/message`, `@/types/subtitle` (grep verify)
- [ ] AC3.2: `SubtitleFormat` has 1 definition (no divergence)
- [ ] AC3.3: `entities/settings/types.ts` imports from `@/entities/subtitle/types` (sibling)
- [ ] AC3.4: `src/types/{media,message,subtitle}.ts` deleted (only `muxjs.d.ts` remains if needed)
- [ ] AC3.5: `npm run test:unit` + `npx tsc --noEmit` + `npm run build` pass

#### H4. Thin content script (774 lines → < 200 lines)

**Current**: `src/entrypoints/content/content-script.ts` = 774 lines, 12 deep imports into `features/subtitle/*`. Runs on every page via `<all_urls>` + `all_frames: true`.

**Target**:
- Move subtitle UI orchestration into `features/subtitle/ui/contentScriptController.ts` (exports `init()`)
- Content script becomes thin: detect page → call `init()` → wire message listeners
- < 200 lines for `content-script.ts`
- Early-exit: `document.querySelector('video')` on `document_idle` → if none, skip subtitle UI injection

**Acceptance criteria**:
- [ ] AC4.1: `src/entrypoints/content/content-script.ts` ≤ 200 lines
- [ ] AC4.2: 0 deep imports from `content-script.ts` (import from `@/features/subtitle` barrel)
- [ ] AC4.3: `features/subtitle/ui/contentScriptController.ts` exists, exports `init()`
- [ ] AC4.4: Early-exit on pages without `<video>` (skip subtitle UI injection)
- [ ] AC4.5: `npm run test:unit` + `npx tsc --noEmit` + `npm run build` pass
- [ ] AC4.6: Browser verify — subtitle overlay works on video page, no injection on non-video page

#### H5. Add storage schema versioning

**Current**: 0 `schemaVersion`/`migration` in `src/`. `STORAGE_KEYS.SETTINGS = 'settings'` stored via `chrome.storage.local` with no version field. Settings shape changes break existing users.

**Target**:
- Add `schemaVersion: number` to settings payload
- Centralize in `shared/lib/storage/settingsStore.ts` — `loadSettings()` + `saveSettings()` with version check
- Migration functions: `migrate_v1_to_v2(settings)` etc.
- On load: compare version → run migrations → persist updated
- All settings access goes through `settingsStore.ts` (not direct `chrome.storage.local.get('settings')`)

**Acceptance criteria**:
- [ ] AC5.1: `shared/lib/storage/settingsStore.ts` exists with `loadSettings()` + `saveSettings()`
- [ ] AC5.2: Settings payload has `schemaVersion: number` field
- [ ] AC5.3: Migration function exists for current schema version
- [ ] AC5.4: 0 direct `chrome.storage.local.get('settings')` outside `settingsStore.ts` (grep verify)
- [ ] AC5.5: `npm run test:unit` + `npx tsc --noEmit` + `npm run build` pass
- [ ] AC5.6: Browser verify — settings persist across extension reload, migration runs on version bump

## Non-Functional Requirements

### NFR1. Behavior preservation
- Refactor = preserve behavior. No feature added, no logic changed, no UI changed.
- `npm run test:unit` + `npx tsc --noEmit` + `npm run build` pass after every commit.
- E2E tests (4 specs) pass after all 8 findings done.

### NFR2. MV3 lifecycle safety
- SW can be killed any time. State persists in `chrome.storage.session` (in-flight) or `chrome.storage.local` (settings).
- Long-running tasks (fetch > 5s) delegate to offscreen.
- `onStartup`/`onInstalled` rehydrate state.

### NFR3. Testability
- 0 direct `chrome.*` calls in entrypoints — all through adapters.
- Entrypoints unit-testable with mocked adapters (no chrome global needed).
- Test structure mirrors src (already done in phase 1).

### NFR4. Maintainability
- 0 deep imports — barrel-only.
- SW < 300 lines — thin orchestrator.
- Content script < 200 lines — thin entry.
- 1 type system (delete `src/types/` legacy barrels).

### NFR5. No new dependencies
- Ponytail rung 5: use stdlib + installed deps. No FSD framework, no ESLint plugin (defer), no migration library.

### NFR6. Performance
- Content script early-exit on non-video pages — reduce injection overhead.
- Offscreen fetch — no SW idle eviction abort.

## Error Cases

| Error | Handling |
|---|---|
| SW killed mid-fetch | Offscreen continues fetch, SW rehydrates state on restart |
| Offscreen not available | SW creates offscreen via `chrome.offscreen.createDocument()` (existing pattern) |
| Storage migration fails | Log error, fall back to default settings, persist with new schemaVersion |
| Adapter mock missing in test | Test fails fast — add mock to test setup |
| Barrel export missing symbol | tsc catch — expand barrel, retry |
| Deep import ESLint not enforced | Manual grep verify (ESLint plugin defer sang phase 3) |

## Data Flow (after refactor)

```
Popup/Sidepanel
    ↓ chrome.runtime.sendMessage (typed, tabId in payload)
Background SW (thin orchestrator)
    ↓ messageBus routes to handler
Handler (download.ts / subtitle.ts / ...)
    ↓ delegates to
Feature module (features/download/ / features/subtitle/)
    ↓ calls adapter
shared/lib/chrome-apis/ (storage, runtime, tabs, downloads, offscreen)
    ↓ chrome.* API
Chrome runtime

Long-running fetch:
Background SW
    ↓ FETCH_REQUEST message
Offscreen document
    ↓ fetch()
    ↓ FETCH_RESPONSE
Background SW (rehydrated if restarted)
```

State persistence:
```
In-flight state (downloads, queue, auto-download whitelist)
    ↔ chrome.storage.session (survives SW restart, not browser restart)

Settings (user preferences, schema version)
    ↔ chrome.storage.local (survives browser restart)
    ↔ settingsStore.ts (load/save with migration)
```

## Out of Scope

- ❌ Medium findings (M1-M5): inline storage strings, empty app/stores folders, cross-feature imports, unscoped content scripts, layer violation. Defer sang phase 3.
- ❌ Low findings (L1-L3): App.redesigned naming, unused activeTab, inconsistent naming. Defer sang phase 3.
- ❌ ESLint plugin `import/no-internal-modules` — manual grep verify cho H2, plugin defer sang phase 3.
- ❌ New features (Orca platform) — refactor only, no feature added.
- ❌ UI changes — no UI change, only internal structure.
- ❌ Build framework migration (WXT) — keep @crxjs/vite-plugin.
- ❌ Zustand slice pattern refactor — defer sang phase 3 (stores work, not blocking).
- ❌ Populate `src/app/` + `src/stores/` — defer sang phase 3 (Q2:A — giữ FSD hiện tại).

## Dependencies (cite intent)

- **Intent**: `docs/intent/intent-refactor-system-architecture.md` (updated 2026-07-01, section 0 + 10 + 11)
- **Architecture review**: `docs/reviews/architecture-review-2026-07-01.md` (17/42 failures, 3 Critical + 5 High)
- **Research**: 53 nguồn architecture/refactor (intent Phụ lục A) — P1-P12 nguyên lý
- **Existing ADRs**: ADR-016 (FSD refactor phase 1), ADR-001-015 (existing decisions)
- **Architecture map**: `docs/2-architechture-system.md` (current structure)
- **AGENTS.md**: ponytail, baseline TDD, browser verification rules
