# Implementation Plan: Netflix Subtitle Detection

> Output của `planning-and-task-breakdown` — G4 đầu, sau spec review + ADR.
> Input: `docs/specs/spec-netflix-subtitle-detection.md` + `docs/adr/029-netflix-subtitle-detection.md`.
> Goal: biết rõ task/function nào phải tuần tự, task/function nào an toàn để chạy song song.
> Scope decision: **WebVTT-only G4**. TTML-only tracks skip graceful; chỉ viết TTML converter nếu G5 browser verify chứng minh có content thực tế chỉ có TTML.

## 1. Dependency graph

```text
T0 baseline + source contract read
  │
  └── T1 shared message/entity contract (BLOCKING GATE)
        │
        ├── Branch A: T2 pure Netflix mapper + tests
        │     extractNetflixTracks()
        │     mapNetflixSubtitleTracks()
        │
        ├── Branch B: T3 MAIN-world hooks + manifest
        │     hookJsonStringify()
        │     hookJsonParse()
        │     postDetectedSubtitles()
        │     hookHistoryApi('pushState'/'replaceState')
        │
        └── Branch C: T4 isolated bridge + background dispatch
              __NF_CS_READY listener/post
              __NF_DETECTED_SUBTITLES listener
              detectionDispatch() Netflix branch
        │
        └── T5 integration/type/lint gate (must be sequential)
              pure mapper → bridge → dispatch → existing auto-load
        │
        └── T6 DNR/download-path verification (sequential after T5)
        │
        └── T7 real browser verify (sequential, stop-the-line)
        │
        └── T8 final review + architecture map update
```

### Function-level dependency rules

| Function/module | Must wait for | Can run in parallel with |
|---|---|---|
| `extractNetflixTracks()` | Contract 1 shape in ADR; no runtime dependency on bridge | `hookJsonParse()`, `content-script` edits |
| `mapNetflixSubtitleTracks()` | `DetectedSubtitle` + Netflix track shape | `hookJsonStringify()`, bridge work |
| `hookJsonStringify()` | `ALL_FORMATS` + debug contract | mapper tests, isolated bridge |
| `hookJsonParse()` | `extractNetflixTracks()` contract; debug contract | `content-script` listener, background branch |
| `postDetectedSubtitles()` | bridge message shape + movieId policy | pure mapper implementation |
| `content-script` Netflix listener | `DetectedSubtitlesPayload.source='netflix'`, `movieId` field | MAIN-world implementation, pure mapper |
| `detectionDispatch` Netflix branch | message type contract + `mapNetflixSubtitleTracks()` export | MAIN-world implementation |
| existing auto-load/download flow | `detectionDispatch` branch + mapped `format='vtt'` | no parallel work; verify only after integration |
| DNR fetch path | mapped absolute URL + existing `setRefererRule()` pattern | unit tests, but browser verification waits for integration |
| browser verification | all code branches + build output | none (sequential stop-the-line) |

## 2. Execution waves

### Wave 0 — Sequential discovery and baseline

#### Task 0: Baseline and implementation guard

**Description:** Confirm current repository state, commands, existing iQIYI patterns, and ensure there is no existing Netflix implementation before editing. Do not change source code.

**Acceptance criteria:**
- [ ] `git status`, existing diff, and current branch recorded.
- [ ] Existing relevant files read: `content-script.ts`, `iqiyi-main-world.iife.ts`, `detectionDispatch.ts`, `languageRegistry.ts`, `declarativeNetRequest.ts`, subtitle downloader/parser.
- [ ] Baseline commands run: `npm run test:unit`, `npm run typecheck`.
- [ ] Any pre-existing failures documented separately from Netflix work.

**Verification:** `npm run test:unit` + `npm run typecheck`

**Dependencies:** None

**Files likely touched:** None

**Estimated scope:** XS

#### Task 1: Shared message/entity contract — blocking gate

**Description:** Land the shared types before parallel branches. Add `source: 'netflix'` and `movieId` to `DetectedSubtitlesPayload`; define/confirm the exported Netflix track/downloadable contract used by pure mapper and background dispatch. Keep movieId transport compatible with the ADR: manifest may be number/string, bridge dedup uses normalized string.

**Acceptance criteria:**
- [ ] `DetectedSubtitlesPayload.source` includes `'netflix'`.
- [ ] `DetectedSubtitlesPayload` has `movieId` field with documented transport type/policy.
- [ ] Netflix mapper types are importable by both MAIN-world boundary contracts and background code without `any`.
- [ ] Existing YouTube and iQIYI payload construction remains type-safe.

**Verification:** `npm run typecheck` + focused type/import check.

**Dependencies:** Task 0

**Files likely touched:**
- `src/entities/message/types.ts`
- `src/features/detection/index.ts` or detector type barrel (if needed)

**Estimated scope:** S (1-2 files)

### Checkpoint A — Contract gate

- [ ] Shared types compile.
- [ ] No YouTube/iQIYI type regression.
- [ ] Only after this gate start Branch A/B/C in parallel.

## 3. Wave 1 — Three safe parallel branches

> These branches are independent after Task 1. Run in parallel only if each worker owns disjoint files. Do not let two workers edit `content-script.ts`, `detectionDispatch.ts`, or the same test file simultaneously.

### Branch A — Pure detection logic + tests

#### Task 2A: `extractNetflixTracks()` and `mapNetflixSubtitleTracks()` (TDD)

**Description:** Implement pure, defensive mapper logic. WebVTT-only: choose `webvtt-lssdh-ios8`; allow `urls[0].url` fallback when `downloadUrls` is absent; skip TTML-only, image-based, none-track, malformed entries; lowercase BCP-47 language; guard duplicate forced suffix; preserve `initiator`.

**Functions:**
- `extractNetflixTracks(manifestResult: unknown)`
- `mapNetflixSubtitleTracks(tracks, tabId)`
- small local helpers only if needed for URL/format selection

**Acceptance criteria:**
- [ ] Malformed/unknown manifest returns `[]`, never throws.
- [ ] 42-track fixture maps to expected real text tracks after skipping none/image tracks.
- [ ] WebVTT URL maps to `DetectedSubtitle` with `format: 'vtt'`.
- [ ] TTML-only track is skipped with warning; no `'ttml'` value emitted.
- [ ] `urls[]` alternative shape works.
- [ ] `zh-Hans`, `pt-BR`, `es-ES` are stored lowercased.
- [ ] Forced display name does not become `forced [forced]`.
- [ ] Unit tests cover empty, malformed, missing URL, image, none, forced, alternative URL shape, and TTML-only cases.

**Verification:** `npx jest --selectProjects unit tests/unit/features/detection/logic/netflixSubtitleDetector.test.ts --runInBand`

**Dependencies:** Task 1

**Files likely touched:**
- `src/features/detection/logic/netflixSubtitleDetector.ts` (new)
- `src/features/detection/index.ts`
- `tests/unit/features/detection/logic/netflixSubtitleDetector.test.ts` (new)

**Estimated scope:** M (3 files)

### Branch B — MAIN-world hook + manifest

#### Task 2B: MAIN-world Netflix script and manifest entry

**Description:** Implement the standalone `.iife.ts` script using the existing iQIYI/YouTube MAIN-world conventions. Install hooks at document start, capture only Netflix manifest-shaped data, use defensive guards, cache last tracks, and expose the debug surface from ADR-029. This branch owns the manifest entry so no other branch edits `manifest.json`.

**Functions:**
- `hookJsonStringify()` — add all requested formats, set `showAllSubDubTracks`, increment `stringifyModifiedCount`.
- `hookJsonParse()` — `Array.isArray` guard, movieId fallback, increment `captureCount`, call extraction/post.
- `postDetectedSubtitles()` — post bridge message and update debug state.
- `hookHistoryApi('pushState')` and `hookHistoryApi('replaceState')` — reset dedup state.
- handshake listener for `__NF_CS_READY` — source check must early-return for non-window messages, increment `repostCount`.
- 10-second hook-miss diagnostic — set `hookMiss` + `console.warn`.

**Acceptance criteria:**
- [ ] Script is self-contained MAIN-world IIFE; no forbidden extension imports.
- [ ] Global JSON hooks no-op for unrelated payloads and never break page execution.
- [ ] Request hook modifies only manifest-shaped payloads and records modification count.
- [ ] Response hook captures only array-shaped `timedtexttracks`; malformed data is ignored.
- [ ] Late-inject handshake uses `event.source !== window` early return.
- [ ] `pushState`, `replaceState`, and `popstate` reset dedup state.
- [ ] Debug fields match ADR Contract 8.
- [ ] `manifest.json` has Netflix MAIN-world entry with `document_start`, scoped matches, `all_frames: false`.

**Verification:** `npm run typecheck` + `npm run build`; inspect generated manifest entry.

**Dependencies:** Task 1

**Files likely touched:**
- `src/entrypoints/content/netflix-main-world.iife.ts` (new)
- `public/manifest.json`

**Estimated scope:** M (2 files)

### Branch C — Isolated bridge + background dispatch

#### Task 2C: Content bridge and unified background dispatch

**Description:** Add the Netflix handshake post and message listener to the existing isolated content script, then route `source === 'netflix'` through the existing single `DETECTED_SUBTITLES` dispatcher. This branch owns `content-script.ts` and `detectionDispatch.ts`.

**Functions/modules:**
- content-script startup handshake `window.postMessage({ type: '__NF_CS_READY' })`
- Netflix `window.message` listener/dedup/relay block
- `registerDetectionDispatchHandlers()` Netflix branch

**Acceptance criteria:**
- [ ] Content script posts `__NF_CS_READY` after listener setup.
- [ ] Netflix bridge validates `event.source === window` through existing early-return pattern.
- [ ] Dedup uses normalized movieId string and does not use falsy `0` sentinel.
- [ ] Relay payload includes `source: 'netflix'`, tracks, movieId.
- [ ] Dispatch routes Netflix tracks only to `mapNetflixSubtitleTracks()`.
- [ ] YouTube/iQIYI branches and shared post-map flow remain unchanged.
- [ ] Empty mapped result clears stale subtitle state as existing flow defines.

**Verification:** `npm run typecheck` + focused dispatch/bridge tests if available.

**Dependencies:** Task 1; logically needs Task 2A mapper export before final compile, but bridge skeleton may be prepared in parallel.

**Files likely touched:**
- `src/entrypoints/content/content-script.ts`
- `src/entrypoints/background/handlers/detectionDispatch.ts`

**Estimated scope:** M (2 files)

## 4. Wave 2 — Sequential integration gate

#### Task 3: Integrate branches and resolve contract mismatches

**Description:** After Branches A/B/C finish, integrate in dependency order: pure mapper export → MAIN-world call boundary → isolated relay → background dispatch → existing store/auto-load/download flow. Resolve all type and naming mismatches before browser testing.

**Acceptance criteria:**
- [ ] `netflix-main-world.iife.ts` can post a message matching the isolated listener contract.
- [ ] Relayed payload passes `DetectedSubtitlesPayload` typing.
- [ ] Background maps WebVTT tracks and reuses existing store/broadcast/auto-load flow.
- [ ] No new handler registration duplicates `DETECTED_SUBTITLES`.
- [ ] Existing YouTube/iQIYI unit tests still pass.
- [ ] No TTML code path reaches `downloader.ts` or `subtitleParser.ts`.

**Verification:** `npm run test:unit` + `npm run typecheck` + `npm run lint` + `npm run build`

**Dependencies:** Tasks 2A, 2B, 2C

**Files likely touched:** Any branch files only; no unrelated refactor.

**Estimated scope:** M (integration fixes only)

### Checkpoint B — Integration gate

- [ ] `npm run test:unit` passes.
- [ ] `npm run typecheck` passes.
- [ ] `npm run lint` passes.
- [ ] `npm run build` passes.
- [ ] No existing YouTube/iQIYI regression.

## 5. Wave 3 — Sequential browser and fetch verification

#### Task 4: DNR and subtitle download-path verification

**Description:** Verify the already-existing per-URL `setRefererRule()` path works with Netflix CDN URLs. Do not add a domain-wide DNR rule. If 403 occurs, debug the existing fetch/DNR flow before changing architecture.

**Acceptance criteria:**
- [ ] WebVTT download URL is fetched as complete text, not CMAF fragment.
- [ ] Existing per-URL Referer rule is created and cleaned up.
- [ ] Background fetch receives HTTP 200 on the real Netflix URL, or the failure is documented with root cause.
- [ ] `parseVtt` succeeds on the returned content.

**Verification:** real Edge/Chrome DevTools MCP + background logs + DNR rule inspection.

**Dependencies:** Task 3

**Files likely touched:** None expected; only edit if verification identifies a real bug.

**Estimated scope:** S (verification-first)

#### Task 5: End-to-end browser acceptance test

**Description:** Test the real Netflix flow on the verified movie/episode. Treat browser failure as stop-the-line; do not paper over it with more polling or a speculative CMAF parser.

**Acceptance criteria:**
- [ ] `window.__NF_MAIN_WORLD_INJECTED === true`.
- [ ] `__NF_DEBUG.stringifyModifiedCount > 0` after manifest request.
- [ ] `__NF_DEBUG.captureCount > 0` after manifest response.
- [ ] `__NF_DETECTED_SUBTITLES` reaches content script and background with `source: 'netflix'`.
- [ ] Expected WebVTT tracks populate; TTML-only tracks are skipped without crash.
- [ ] Target/native auto-load and bilingual overlay work.
- [ ] Forced track label is correct.
- [ ] Image-based/none tracks are absent.
- [ ] Switch episode: old subtitles clear and new movieId is detected; test `replaceState` path.
- [ ] Existing YouTube/iQIYI smoke checks remain green.

**Verification:** Edge/Chrome MCP acceptance run + captured logs/report.

**Dependencies:** Tasks 4 and 3

**Files likely touched:** None expected; browser-only verification.

**Estimated scope:** M (verification)

### Checkpoint C — Release gate

- [ ] `npm run test:unit` pass.
- [ ] `npm run typecheck` pass.
- [ ] `npm run lint` pass.
- [ ] `npm run build` pass.
- [ ] Browser verify pass on real Edge/Chrome.
- [ ] No critical console/runtime errors.

## 6. Wave 4 — Documentation and review

#### Task 6: Architecture map and final code review

**Description:** Update architecture map for every added/modified `src/` file, review the final diff, and record any intentional ceilings. Do not modify spec content further unless browser evidence changes the decision.

**Acceptance criteria:**
- [ ] `docs/2-architechture-system.md` updated: tree, dependency table, function index.
- [ ] `git diff --check` clean.
- [ ] Code review covers security (global hooks, untrusted manifest data), performance (hook filters), and backward compatibility.
- [ ] Any remaining TTML-only limitation is documented as known ceiling.

**Verification:** `git diff --check` + `npm run test:unit` + `npm run typecheck` + `npm run lint` + `npm run build`.

**Dependencies:** Task 5

**Files likely touched:**
- `docs/2-architechture-system.md`
- possibly `docs/0-wiki.md` if new file index is explicit

**Estimated scope:** S-M

## 7. What is sequential vs parallel

### Must be sequential

1. **Baseline → shared contract**: cannot safely edit consumers before `source`/`movieId` contract is fixed.
2. **Mapper export → final bridge/dispatch compile**: bridge and dispatch can be drafted in parallel, but final integration must wait for mapper names/types.
3. **All code branches → integration gate**: test/typecheck/lint/build must evaluate the combined system.
4. **Integration → DNR/download verification**: browser fetch tests are meaningless before dispatch produces real mapped URLs.
5. **DNR verification → browser E2E**: first prove the subtitle content can be fetched and parsed, then test auto-load/UI.
6. **Browser E2E → architecture update/final review**: document the behavior actually verified, not the intended behavior.

### Safe to run in parallel

After Task 1 only:

- **Branch A** pure functions + unit tests.
- **Branch B** MAIN-world script + manifest entry.
- **Branch C** content-script bridge + background dispatch.

Inside Branch B, these are also independent pure sections but should remain in one owner/file:

- request hook logic (`JSON.stringify`)
- response hook logic (`JSON.parse`)
- history/handshake/debug wiring

Do not parallelize edits to the same file:

- `content-script.ts`: one owner only.
- `detectionDispatch.ts`: one owner only.
- `public/manifest.json`: one owner only.
- `docs/2-architechture-system.md`: update once after final file list is known.

## 8. Risk controls

| Risk | Impact | Mitigation |
|---|---|---|
| Netflix changes MSL decrypt to Worker/custom parser | High | `captureCount` + `hookMiss` diagnostic; no CMAF parser in G4; reload instruction; future upgrade path documented |
| TTML-only title | High for that title | WebVTT-first; skip with warning; add TTML converter only after real G5 evidence |
| Global hook breaks Netflix page | Critical | Defensive guards, preserve original return values, no-op non-manifest payloads, browser smoke test |
| Late MAIN/ISOLATED injection | High | `__NF_CS_READY` handshake + `repostCount` debug counter |
| Manifest schema drift | High | `Array.isArray`, shape validation, stringify/capture drift counters, focused fixtures |
| BCP-47 exact comparison regression | Medium | audit exact comparisons; use `languageMatches()`/`toIso6391()` |
| DNR 403 | High | reuse existing per-URL rule; verify before E2E |
| Regression YouTube/iQIYI | High | existing unit tests + smoke tests + single unified dispatch branch |

## 9. Stop conditions before implementation

- [ ] Anh yêu approves this dependency-aware plan.
- [ ] Task 1 contract policy is accepted: manifest movieId may be number/string; bridge dedup normalizes to string.
- [ ] WebVTT-only G4 scope remains approved.
- [ ] No new dependency is needed for G4.
