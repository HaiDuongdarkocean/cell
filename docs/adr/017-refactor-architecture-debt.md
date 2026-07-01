# ADR-017: Refactor Architecture Debt Phase 2 (8 Findings from Architecture Review)

## Status

Accepted (G3 — architecture debt refactor decisions. Implementation G4 milestone M14-M21, spec `docs/specs/spec-refactor-architecture-debt.md`, plan `docs/plan/plan-refactor-architecture-debt.md`)

## Context

Refactor phase 1 (M0-M13, ADR-016) đã hoàn thành — FSD structure, 24 barrels, message passing healthy, no circular deps, features clean. Architecture review 2026-07-01 (`docs/reviews/architecture-review-2026-07-01.md`) phát hiện **17/42 anti-pattern failures**, tập trung vào:

- **Lifecycle (4/5 Critical)**: SW god-file 2,203 lines, fetch in SW, no onStartup/onInstalled, persistent mutable state
- **Boundary (3/6 High)**: entrypoints bypass adapter, 36 deep imports, Strangler Fig stalled
- **Storage (3/5 High)**: no schema versioning, inline storage strings, partial onChanged
- **Injection (3/5 High)**: content script heavy, unscoped, no world spec

3 Critical Lifecycle gây user-visible bug "stuck downloads after SW restart". 5 High block maintainability + testability.

**Forces (từ spec + architecture review + intent research P1-P12)**:
- MV3 lifecycle: SW can be killed any time (idle eviction, browser restart, extension update). State must persist. (P5: dependency inversion, P7: data architecture hard part)
- Testability: entrypoints call chrome.* directly (168 calls) — cannot unit test without chrome global. (P1: test coverage prerequisite, P5: seams)
- Maintainability: 36 deep imports bypass barrels — feature boundaries leaky. (P2: respect boundaries, P6: align architecture with domain)
- Strangler Fig stalled: 78 imports still use `@/types/` legacy barrels — 2 parallel type systems, `SubtitleFormat` diverged. (P3: incremental change, Strangler Fig pattern)
- Behavior preservation: refactor = preserve behavior, no feature added. (P1, P3, Spolsky: no rewrite)

**Constraints (codebase)**:
- `public/manifest.json` reference SW path `src/entrypoints/background/index.ts` — keep path, change internals.
- Offscreen document exists for ffmpeg (`src/entrypoints/offscreen/`) — pattern established, extend for fetch.
- `shared/lib/chrome-apis/` has 4 adapters (storage, runtime, tabs, downloads) — extend with 4 more.
- `chrome.storage.session` already used for `SESSION_MEDIA`/`SESSION_DOWNLOADS` — extend for state rehydration.
- No new dependencies (ponytail rung 5) — stdlib + installed deps only.

## Decision

### D1: Split SW god-file into thin orchestrator + handlers/ (M14, cite spec §C1)

**Decision**: `src/entrypoints/background/index.ts` (2,203 lines) → thin orchestrator (< 300 lines) + `handlers/<feature>.ts` (each < 200 lines).

```
src/entrypoints/background/
├── index.ts              # SW entry: init messageBus, register handlers, onStartup/onInstalled (M16)
├── messageBus.ts         # Existing — typed handler registry (keep)
├── networkInterceptor.ts # Existing — webRequest listener (keep)
├── offscreenManager.ts   # Existing — offscreen document lifecycle (keep)
└── handlers/             # NEW — one file per feature
    ├── download.ts       # DOWNLOAD_VIDEO, CANCEL, PAUSE, RESUME, RETRY
    ├── media-detection.ts # GET_DETECTED_MEDIA, PAGE_SCAN_RESULT
    ├── subtitle.ts       # SUBTITLE_CUES, VIDEO_TIME_UPDATE
    ├── settings.ts       # SETTINGS_UPDATE, SETTINGS_GET
    └── offscreen.ts      # CONVERT_TS_TO_MP4_V2, CREATE_OPFS_BLOB_URL
```

**Rationale**: Extract Class pattern (Fowler). Business logic stays in `features/*` — handlers only delegate. messageBus already typed + Map-based — extract handlers, keep wiring. SW = thin orchestrator per MV3 best practice (Chrome docs: "keep service workers ephemeral").

**Alternatives considered**:
- ❌ Keep god-file, add comments — doesn't fix testability, merge conflicts, SW re-evaluation risk
- ❌ Split into multiple SWs — MV3 allows only 1 SW per extension
- ❌ Move all logic to offscreen — offscreen is for long-running tasks, not message routing

### D2: Delegate fetch to offscreen document (M15, cite spec §C2)

**Decision**: SW sends `FETCH_REQUEST` to offscreen, offscreen performs `fetch()`, returns `FETCH_RESPONSE`. 0 `fetch()` in SW.

**Rationale**: Offscreen persists for task duration (not killed like SW). Pattern established for ffmpeg — extend. Large payloads (> 1MB) MUST go to offscreen; small payloads (< 1MB, subtitle) can stay in SW with 5s timeout (ponytail rung 6).

**Alternatives considered**:
- ❌ Keep fetch in SW — SW can be killed mid-fetch, silent abort
- ❌ Use `chrome.downloads.download` for all — doesn't support custom headers, auth, response body access
- ❌ Move all fetch to content script — content script runs in page context, CORS issues

### D3: Rehydrate state on SW restart (M16, cite spec §C3)

**Decision**: `chrome.runtime.onStartup` + `onInstalled` handlers rehydrate `BackgroundService` from `chrome.storage.session`. In-flight state persists in session, settings in local.

**Rationale**: `chrome.storage.session` survives SW restart (not browser restart). Already used for `SESSION_MEDIA`/`SESSION_DOWNLOADS` — extend pattern. `onStartup` fires on browser startup, `onInstalled` on extension install/update — both need rehydration.

**Alternatives considered**:
- ❌ No rehydration — "stuck downloads" bug persists
- ❌ Rehydrate from `chrome.storage.local` — local persists across browser restart, but in-flight state should be session-scoped (cleared on browser close)
- ❌ Use IndexedDB — overkill for in-flight state, session storage is simpler

### D4: Route all entrypoint chrome.* through adapters (M17, cite spec §H1)

**Decision**: Extend `shared/lib/chrome-apis/` with 4 missing APIs (webRequest, offscreen, sidePanel, action). Route all 168 direct `chrome.*` calls in entrypoints through adapters. 0 direct calls.

**Rationale**: Ports & Adapters pattern (Cockburn, P5). Adapters are thin wrappers with same signature — drop-in replacement, mockable. Enables unit testing entrypoints without chrome global. Adapter layer already exists (4 APIs) — extend, don't rewrite.

**Alternatives considered**:
- ❌ Keep direct calls — cannot unit test entrypoints
- ❌ Move all chrome.* to features — violates FSD (features should not know about chrome.*)
- ❌ Use sinon.mock for chrome global — works but doesn't fix the boundary violation

### D5: Enforce barrel-only imports (M18, cite spec §H2)

**Decision**: Expand feature barrels to export all symbols entrypoints need. Flip 36 deep imports to barrel imports. Manual grep verify (ESLint plugin defer sang phase 3).

**Rationale**: FSD import rule — features expose public API via barrel, internals are private. Deep imports = leaky boundaries. tsc catch missing exports — expand barrel, retry. Manual grep verify sufficient for 36 imports (no plugin needed yet).

**Alternatives considered**:
- ❌ Add ESLint plugin `import/no-internal-modules` now — defer sang phase 3 per spec §Out of Scope (manual verify sufficient)
- ❌ Delete barrels, allow deep imports — reverses FSD, makes boundaries leaky
- ❌ Move all entrypoint logic into features — entrypoints become empty, loses MV3 surface separation

### D6: Finish Strangler Fig — delete `src/types/` (M19, cite spec §H3)

**Decision**: Migrate 78 `@/types/` imports to `@/entities/*`. Resolve `SubtitleFormat` divergence (consolidate to `@/entities/subtitle` definition with 'ssa'|'unknown'). Delete `src/types/{media,message,subtitle}.ts` (keep `muxjs.d.ts`).

**Rationale**: Strangler Fig pattern (Fowler, P3). `@/types/*` already re-export from `@/entities/*` — flip is mechanical, tsc catch error. `SubtitleFormat` divergence is known debt (noted in `src/types/media.ts:14-16`) — consolidate now. 1 type system = less confusion for AI agents + new devs.

**Alternatives considered**:
- ❌ Keep `@/types/` as permanent alias — 2 type systems confuse, `SubtitleFormat` divergence unresolved
- ❌ Delete `@/entities/`, keep `@/types/` — reverses FSD, entities are the FSD layer
- ❌ Keep both, add ESLint rule — defer plugin, but debt remains

### D7: Thin content script via controller extraction (M20, cite spec §H4)

**Decision**: Move subtitle UI orchestration from `content-script.ts` (774 lines) to `features/subtitle/ui/contentScriptController.ts` (exports `init()`). Content script becomes thin (< 200 lines): detect `<video>` → if found, call `init()` → wire message listeners. Early-exit on non-video pages.

**Rationale**: Separated Presentation pattern (Fowler). Content script = entrypoint (thin), controller = feature module (testable). Early-exit reduces injection overhead on non-video pages (performance). Import from barrel (not deep imports — supports D5).

**Alternatives considered**:
- ❌ Keep heavy content script — 774 lines on every page, slow parse, hard to test
- ❌ Dynamic injection via `chrome.scripting.executeScript` — defers injection but doesn't fix 774-line logic
- ❌ Move to MAIN world — loses chrome.* access (ISOLATED world needed for chrome.runtime)

### D8: Storage schema versioning (M21, cite spec §H5)

**Decision**: `shared/lib/storage/settingsStore.ts` — `loadSettings()` + `saveSettings()` with `schemaVersion: number`. Migration functions for version bumps. All settings access through `settingsStore.ts`.

**Rationale**: Schema evolution (Kleppmann, P7). Settings shape changes every feature release — without versioning, existing users get stale settings (undefined fields, crashes). `settingsStore.ts` centralizes access — single point for migration logic. No migration library needed (simple version check + function map, ponytail rung 3).

**Alternatives considered**:
- ❌ No versioning — settings break on schema changes (current state)
- ❌ Use migration library (e.g. `migrate`) — overkill for simple version check, ponytail rung 5
- ❌ Version in manifest — settings version ≠ extension version, separate concerns

## Consequences

### Positive
- ✅ 3 Critical Lifecycle fixed — "stuck downloads" bug resolved, SW testable, fetch survives eviction
- ✅ 5 High fixed — entrypoints testable, boundaries sealed, 1 type system, content script fast
- ✅ Anti-pattern score: 17/42 → ≤ 5/42 (target 0 in Critical/High)
- ✅ Foundation for Orca platform — testable entrypoints, sealed boundaries, versioned storage

### Negative
- ⚠️ More files in `entrypoints/background/handlers/` — but each < 200 lines, single responsibility
- ⚠️ Offscreen fetch adds 1 message round-trip latency — but prevents silent abort (worth it)
- ⚠️ `settingsStore.ts` adds indirection — but centralizes migration (worth it)
- ⚠️ Manual grep verify for barrel imports (no ESLint plugin) — defer plugin sang phase 3

### Neutral
- SW path unchanged (`src/entrypoints/background/index.ts`) — manifest/vite no change
- Offscreen document unchanged — extend, not rewrite
- Adapter layer unchanged — extend with 4 APIs

## Implementation milestones (cite plan)

| Milestone | Decision | Spec § | Effort |
|---|---|---|---|
| M14 | D1 Split SW | §C1 | L |
| M15 | D2 Fetch to offscreen | §C2 | M |
| M16 | D3 Rehydrate state | §C3 | M |
| M17 | D4 Adapter routing | §H1 | M |
| M18 | D5 Barrel-only | §H2 | S |
| M19 | D6 Strangler Fig | §H3 | M |
| M20 | D7 Thin content script | §H4 | M |
| M21 | D8 Schema versioning | §H5 | S |

## References

- **Spec**: `docs/specs/spec-refactor-architecture-debt.md`
- **Plan**: `docs/plan/plan-refactor-architecture-debt.md`
- **Architecture review**: `docs/reviews/architecture-review-2026-07-01.md`
- **Intent**: `docs/intent/intent-refactor-system-architecture.md` (research P1-P12)
- **ADR-016**: FSD phase 1 (M0-M13 done)
- **Patterns**: Extract Class (Fowler), Strangler Fig (Fowler), Ports & Adapters (Cockburn), Separated Presentation (Fowler)
- **MV3 docs**: https://developer.chrome.com/docs/extensions/mv3/architecture-overview
