# Plan: Refactor Architecture Debt (Phase 2) — Implementation Plan

> **Phase**: G2 Implementation Plan (output cto-persona + doubt-driven-development + planning-and-task-breakdown high-level)
> **Status**: Draft — chờ anh review
> **Date**: 2026-07-01
> **Spec source**: `docs/specs/spec-refactor-architecture-debt.md` (8 findings: C1-C3 + H1-H5)
> **Intent source**: `docs/intent/intent-refactor-system-architecture.md` (updated 2026-07-01)
> **Architecture review**: `docs/reviews/architecture-review-2026-07-01.md`
> **Related**: ADR-016 (FSD phase 1), `docs/2-architechture-system.md`

## Approach (per spec requirement — cite spec §)

### Critical Lifecycle (C1-C3) — Milestone M14-M16

#### M14. Split SW god-file (cite spec §C1)

**Approach**: Extract-and-delegate pattern (Fowler "Extract Class" + Feathers "seam"):
1. Identify handler boundaries in `BackgroundService` — group message types by feature (download, media-detection, subtitle, settings, offscreen)
2. Create `src/entrypoints/background/handlers/<feature>.ts` — each handler imports feature module, registers via `messageBus.on()`
3. `index.ts` becomes thin: init messageBus → register all handlers → onStartup/onInstalled (M16)
4. Business logic stays in `features/*` — handlers only delegate
5. Move `Downloader` instance management from `index.ts` to `handlers/download.ts` (handler owns downloader, not SW)

**Build-vs-buy**: Build (extract manually). No refactoring tool needed — codebase is TypeScript, tsc + IDE refactor support sufficient. Ponytail rung 2: reuse existing `messageBus` (already typed, Map-based registry).

**Risk mitigation** (cite spec §C1 AC1.4-1.7):
- Characterization tests: existing unit tests in `tests/unit/entrypoints/background/` pin behavior. Run after each extraction.
- Parallel Change: extract handler → update `index.ts` to delegate → test → commit. One handler at a time.
- Browser verification after all handlers extracted (AC1.7).

**Milestone exit**: `index.ts` ≤ 300 lines, 0 business logic, all handlers < 200 lines.

#### M15. Move fetch to offscreen (cite spec §C2)

**Approach**: Delegate-via-message pattern (existing offscreen pattern for ffmpeg):
1. Add `FETCH_REQUEST` / `FETCH_RESPONSE` message types to `entities/message/types.ts`
2. Offscreen handler (`entrypoints/offscreen/ffmpegRunner.ts` or new `fetchRunner.ts`) handles `FETCH_REQUEST`
3. `shared/lib/chrome-apis/offscreen.ts` adapter — `offscreenFetch(url, options)` sends message to offscreen, returns Response
4. SW `handlers/download.ts` calls `offscreenFetch()` instead of `fetch()`
5. Small payloads (< 1MB, subtitle) can stay in SW with 5s timeout — ponytail rung 6 (one-liner if small)

**Build-vs-buy**: Build. No fetch library needed — stdlib `fetch()` in offscreen. Ponytail rung 3: stdlib.

**Risk mitigation** (cite spec §C2 AC2.4-2.6):
- Offscreen already exists for ffmpeg — pattern established, extend.
- Test: mock `offscreenFetch()` adapter in unit tests (no real fetch needed).
- Browser verify: download large video, reload extension mid-download, verify offscreen continues (AC2.6).

**Milestone exit**: 0 `fetch()` in `index.ts`, offscreen handles `FETCH_REQUEST`.

#### M16. Add onStartup/onInstalled rehydration (cite spec §C3)

**Approach**: Rehydrate-from-session pattern (existing `SESSION_MEDIA`/`SESSION_DOWNLOADS`):
1. `chrome.runtime.onStartup` + `chrome.runtime.onInstalled` handlers in `index.ts`
2. Load `SESSION_DOWNLOADS` + `SESSION_MEDIA` from `chrome.storage.session`
3. Reconstruct `BackgroundService` state — in-flight downloads, queue, auto-download whitelist
4. If no persisted state → fresh init (current behavior)
5. Persist state on every state change (download start, pause, resume, complete) — extend existing `SESSION_DOWNLOADS` writes

**Build-vs-buy**: Build. No state management library — `chrome.storage.session` is the store. Ponytail rung 4: native platform (chrome.storage.session).

**Risk mitigation** (cite spec §C3 AC3.3-3.5):
- Existing `SESSION_DOWNLOADS` writes already happen — extend, not rewrite.
- Test: mock `chrome.storage.session`, verify rehydration logic.
- Browser verify: start download, reload extension, verify state preserved (AC3.5).

**Milestone exit**: `onStartup` + `onInstalled` exist, state rehydrates, "stuck downloads" bug fixed.

### High Boundary/Storage/Injection (H1-H5) — Milestone M17-M21

#### M17. Route entrypoints through adapter (cite spec §H1)

**Approach**: Extend-and-route pattern:
1. Extend `shared/lib/chrome-apis/` with 4 missing APIs: `webRequest`, `offscreen`, `sidePanel`, `action`
2. Each adapter wraps `chrome.<api>.*` calls — same signature, mockable
3. Update 12 entrypoint files to import from adapters instead of calling `chrome.*` directly
4. Grep verify: 0 direct `chrome.*` in `src/entrypoints/` (comments excluded)

**Build-vs-buy**: Build. Adapters are thin wrappers, no library. Ponytail rung 3-4: stdlib + native.

**Risk mitigation** (cite spec §H1 AC1.3-1.5):
- Adapters have same signature as `chrome.*` — drop-in replacement, behavior preserved.
- Test: mock adapters in entrypoint unit tests (no chrome global needed).
- Browser verify all entrypoints (AC1.5).

**Milestone exit**: 8 adapters, 0 direct `chrome.*` in entrypoints.

#### M18. Enforce barrel-only imports (cite spec §H2)

**Approach**: Expand-and-flip pattern:
1. Audit 36 deep imports — identify symbols entrypoints need from each feature
2. Expand feature barrels (`index.ts`) to export those symbols
3. Flip entrypoint imports: `@/features/subtitle/ui/subtitleOverlay` → `@/features/subtitle`
4. Grep verify: 0 deep imports (no path with > 2 segments after `@/features/<name>/`)

**Build-vs-buy**: Build. No ESLint plugin (defer sang phase 3 per spec §Out of Scope). Manual grep verify. Ponytail rung 2: reuse existing barrels.

**Risk mitigation** (cite spec §H2 AC2.3-2.4):
- tsc catch missing exports — expand barrel, retry.
- Test after each feature barrel expansion.
- Browser verify (AC2.4).

**Milestone exit**: 0 deep imports, all entrypoints use barrels.

#### M19. Finish Strangler Fig (cite spec §H3)

**Approach**: Mechanical migration (78 imports):
1. `@/types/media` → `@/entities/media` (or specific entity: `@/entities/video`, `@/entities/settings`)
2. `@/types/message` → `@/entities/message`
3. `@/types/subtitle` → `@/entities/subtitle`
4. Resolve `SubtitleFormat` divergence — consolidate to `@/entities/subtitle` definition (adds 'ssa'|'unknown')
5. Fix `entities/settings/types.ts:4` → `@/entities/subtitle/types` (sibling)
6. Delete `src/types/{media,message,subtitle}.ts` (keep `muxjs.d.ts`)

**Build-vs-buy**: Build. Mechanical find-and-replace, tsc verify. Ponytail rung 6: one-line per import.

**Risk mitigation** (cite spec §H3 AC3.4-3.5):
- `@/types/*` already re-export from `@/entities/*` — flip is mechanical, tsc catch error.
- Test after each batch of imports.
- `SubtitleFormat` consolidation — verify all consumers handle 'ssa'|'unknown' (grep consumers).

**Milestone exit**: 0 `@/types/` imports, `src/types/` deleted (except `muxjs.d.ts`).

#### M20. Thin content script (cite spec §H4)

**Approach**: Extract-controller pattern:
1. Move subtitle UI orchestration from `content-script.ts` to `features/subtitle/ui/contentScriptController.ts`
2. `contentScriptController.ts` exports `init()` — sets up overlay, panel, shortcuts, drag-drop
3. `content-script.ts` becomes thin: detect `<video>` → if found, call `init()` → wire message listeners
4. Early-exit: `document.querySelector('video')` on `document_idle` → if none, skip
5. Import from `@/features/subtitle` barrel (not deep imports)

**Build-vs-buy**: Build. No framework — plain TypeScript module. Ponytail rung 2: reuse existing subtitle UI modules.

**Risk mitigation** (cite spec §H4 AC4.5-4.6):
- Characterization tests: existing content-script tests pin behavior.
- Browser verify: subtitle overlay on video page, no injection on non-video page (AC4.6).

**Milestone exit**: `content-script.ts` ≤ 200 lines, 0 deep imports, early-exit works.

#### M21. Storage schema versioning (cite spec §H5)

**Approach**: Versioned-store pattern:
1. Create `shared/lib/storage/settingsStore.ts` — `loadSettings()` + `saveSettings()`
2. Add `schemaVersion: number` to settings payload (current version = 1)
3. `loadSettings()`: read from `chrome.storage.local` → check `schemaVersion` → run migrations if needed → persist updated
4. `saveSettings()`: write with current `schemaVersion`
5. Update all settings access to go through `settingsStore.ts` (not direct `chrome.storage.local.get('settings')`)
6. Migration function: `migrate_v1_to_v2(settings)` — placeholder for future, currently no-op (v1 → v1)

**Build-vs-buy**: Build. No migration library — simple version check + function map. Ponytail rung 3: stdlib.

**Risk mitigation** (cite spec §H5 AC5.5-5.6):
- Test: mock `chrome.storage.local`, verify load/save/migrate.
- Browser verify: settings persist across reload, migration runs on version bump (AC5.6).

**Milestone exit**: `settingsStore.ts` exists, 0 direct settings access, schema versioning works.

## Scope (cite spec §Scope)

| Milestone | Finding | Spec § | Effort | Risk |
|---|---|---|---|---|
| M14 | C1 Split SW god-file | §C1 | L | Medium — large extraction, but messageBus exists |
| M15 | C2 Move fetch to offscreen | §C2 | M | Medium — offscreen pattern exists |
| M16 | C3 onStartup/onInstalled | §C3 | M | Low — extend existing SESSION_DOWNLOADS |
| M17 | H1 Route through adapter | §H1 | M | Low — adapters are thin wrappers |
| M18 | H2 Enforce barrel-only | §H2 | S | Low — mechanical expand+flip |
| M19 | H3 Finish Strangler Fig | §H3 | M | Low — mechanical, tsc verify |
| M20 | H4 Thin content script | §H4 | M | Medium — 774 lines extraction |
| M21 | H5 Storage schema versioning | §H5 | S | Low — new file, update consumers |

**Total effort**: ~5L (per intent Q1:C estimate)

## Risk Mitigation (cross-milestone)

| Risk | Mitigation | Cite |
|---|---|---|
| Behavior change无意 | Characterization tests pin behavior; `npm run test:unit` + `npx tsc --noEmit` after each commit | spec §NFR1 |
| SW split break message routing | messageBus already typed + Map-based — extract handlers, keep wiring | spec §C1 |
| Fetch move break download | Offscreen pattern exists for ffmpeg — extend | spec §C2 |
| Strangler Fig break 78 imports | `@/types/*` already re-export — flip is mechanical, tsc catch | spec §H3 |
| Adapter routing break entrypoints | Same signature, drop-in replacement | spec §H1 |
| Browser runtime bug | Browser verification (MCP/Playwright) before commit — stop-the-line rule | AGENTS.md |
| Bus factor = 1 | ADR per milestone + update `2-architechture-system.md` | intent §8 |

## Milestones (high-level — NOT detailed task list)

> **Note**: Detailed task list runs at G4 start (after Spec G1 + Plan G2 + ADR G3). This is high-level milestone plan only.

| Milestone | Description | Spec § | Commit cadence |
|---|---|---|---|
| M14 | Split SW god-file → thin orchestrator + handlers/ | §C1 | 1-3 commits (one per handler group) |
| M15 | Move fetch to offscreen | §C2 | 1-2 commits (adapter + handler update) |
| M16 | onStartup/onInstalled rehydration | §C3 | 1 commit |
| M17 | Route entrypoints through adapter | §H1 | 2-3 commits (extend adapters + route entrypoints) |
| M18 | Enforce barrel-only imports | §H2 | 1-2 commits (expand barrels + flip imports) |
| M19 | Finish Strangler Fig | §H3 | 1-2 commits (migrate imports + delete types/) |
| M20 | Thin content script | §H4 | 1-2 commits (extract controller + thin entry) |
| M21 | Storage schema versioning | §H5 | 1 commit (settingsStore + update consumers) |

**Order rationale**: M14-M16 (Critical Lifecycle) first — fix user-visible bug. M17-M21 (High) next — fix maintainability. M14 before M15 (SW split enables fetch delegation). M17 before M18 (adapter before barrel enforcement — adapters are imported via barrels).

## Build-vs-buy (cross-milestone)

| Decision | Verdict | Reason |
|---|---|---|
| Refactoring tool (automated) | ❌ Buy | TypeScript + IDE refactor sufficient, no tool needed |
| Fetch library | ❌ Buy | stdlib `fetch()` in offscreen |
| State management library | ❌ Buy | `chrome.storage.session` is the store |
| Migration library | ❌ Buy | Simple version check + function map |
| ESLint plugin `import/no-internal-modules` | ❌ Defer | Manual grep verify cho M18, plugin sang phase 3 |
| FSD framework | ❌ Buy | Structure already in place, no framework |

## Dependencies (cite spec)

- **Spec**: `docs/specs/spec-refactor-architecture-debt.md` (8 findings, AC per finding)
- **Architecture review**: `docs/reviews/architecture-review-2026-07-01.md` (evidence per finding)
- **Existing codebase**: FSD structure (M0-M13 done), messageBus, adapters (4 APIs), offscreen document
- **AGENTS.md**: ponytail, baseline TDD, browser verification, commit rules

## Out of Scope (cite spec §Out of Scope)

- ❌ Medium findings (M1-M5) — defer phase 3
- ❌ Low findings (L1-L3) — defer phase 3
- ❌ ESLint plugin — defer phase 3
- ❌ New features (Orca platform) — refactor only
- ❌ UI changes — no UI change
- ❌ Build framework migration — keep @crxjs/vite-plugin
- ❌ Zustand slice pattern — defer phase 3
- ❌ Populate `src/app/` + `src/stores/` — defer phase 3 (Q2:A)
