# Spec: Firefox port — spike to compat report

> Intent: `docs/intent/firefox-port.md` · ui_surface: no · Mode: interactive

## Objective

Emit a Firefox-installable build of Tihoka from the same source and SSOT manifest — via a deterministic manifest transform for the manifest-level differences (`background.service_worker` → event page, drop `side_panel`, remove `offscreen`/`sidePanel`/`tts` permissions) and runtime capability-guards for the Chrome-only APIs (`chrome.offscreen`, `chrome.sidePanel`, `chrome.tts`) — then load it on Firefox ≥128 as a temporary add-on, run a defined smoke matrix over core journeys, and produce a compat report (works/degraded/broken + AMO-readiness + Android desk-check) that lets the owner decide: parity port, WXT migration, or drop. Chrome lane output and behavior must not change. The `sidePanel` surface is dead code per owner (subtitle panel lives in-page) — the Firefox build drops it instead of porting to `sidebar_action`.

## Actor ↔ System Boundary

| Actor | Triggers | Inputs | Receives/Views |
|---|---|---|---|
| Dev (Anh/agent) | runs `npm run build:firefox`; loads add-on in `about:debugging`; executes smoke steps | build commands, smoke actions on youtube.com | `dist-firefox/` artifact, extension behavior in Firefox, compat report |
| End user (Firefox) | clicks toolbar action, presses hotkeys on a video page, picks cues | video page, subtitle picks, card actions | panel UI, captured subtitles, downloaded media |
| Content script | `OPEN_SIDE_PANEL` / `CLOSE_SIDE_PANEL` messages on user action | tabId | open/close result |
| Feature subsystems (download/OCR/TTS/pronunciation/fetch-proxy) | heavy-work requests via `OffscreenManager.sendToOffscreen` | work payload | work result / rejection |
| Firefox runtime | grants/denies APIs per manifest | manifest.json | n/a (system reads its responses as API presence/absence) |

System-internal processing never includes human behavior. "Dev decides go/no-go" is actor input arriving after the report is produced — not a system step.

## Requirements

### Functional

REQ-1: Firefox build lane
- Actor: Dev
- Goal: produce `dist-firefox/` that Firefox ≥128 installs without manifest errors
- Preconditions: `npm run build` has produced a valid `dist/` (Chrome lane) in the same run or previously
- Basic flow:
  1. actor runs `npm run build:firefox`
  2. system runs the normal Vite build into `dist/`
  3. system copies `dist/` → `dist-firefox/` and applies the manifest transform (Rules below) on the **emitted** manifest
  4. system emits `firefox-background.html` into `dist-firefox/` wrapping the emitted background bundle as `<script type="module">`
  5. system prints the `dist-firefox/` path + load instructions
- Alt flow: build already ran → transform can be run standalone (`node scripts/build-firefox.mjs`) against an existing `dist/`; `npm run build:firefox` is a thin wrapper = `npm run build` + the standalone script
- Exception: emitted manifest missing expected keys (e.g. `background.service_worker`) → transform fails loud with a named error, no partial `dist-firefox/`
- Rules:
  - Transform reads `dist/manifest.json` (post-crxjs, hashed filenames) — never `public/manifest.json` directly
  - `background.service_worker`+`type` removed → `background.page: "firefox-background.html"`; wrapper HTML loads the emitted `service_worker` file as `<script type="module">` (event page = document context, module OK; Firefox refuses `service_worker` — web-ext issue #2532 — and refuses `background.scripts`+`type:"module"`). Note: deviates from intent N3's literal `background.scripts` wording — `background.page` chosen because it is the only shape that supports ES-module entry on Firefox
  - `side_panel` key removed entirely — no `sidebar_action` replacement: the surface is dead code per owner (subtitle panel lives in-page); `OPEN_SIDE_PANEL`/`CLOSE_SIDE_PANEL` degrade to logged no-ops via REQ-3
  - Permissions: remove `offscreen`, `sidePanel`, `tts` (`chrome.tts` is a 4th Chrome-only API — absent in Firefox; keeping the permission produces lint warnings); everything else (`webRequest`, `declarativeNetRequest`, `downloads`, `storage`, `activeTab`, `tabs`, `webNavigation`, `cookies`, `unlimitedStorage`) kept
  - Add `browser_specific_settings.gecko = { id: "tihoka@the0cean.dev", strict_min_version: "128.0" }`
  - Strip Chrome-only keys Firefox warns on: `match_origin_as_fallback` (content_scripts entries), `use_dynamic_url` (web_accessible_resources)
  - Keep `content_scripts[].world: "MAIN"` (FF ≥128 — note: stripping `match_origin_as_fallback` loses opaque-origin iframe injection → pre-mark a `degraded` report row), `default_locale`/`_locales`, `content_security_policy`, `options_page` (verify Firefox accepts it vs `options_ui` in lint/smoke), `action`, `icons`
  - Transform is deterministic: same `dist/` → byte-identical `dist-firefox/manifest.json`
- Postcondition: `dist-firefox/` exists, `manifest.json` valid for Firefox
- NFR refs: NFR-1, NFR-2, NFR-3, NFR-4

REQ-2: Capability-guarded heavy-work host
- Actor: internal feature subsystems (download/transmux, OCR, TTS, pronunciation, offscreenFetch) — trigger via existing message flow
- Goal: WASM/heavy work executes on Firefox where `chrome.offscreen` does not exist
- Preconditions: feature invoked (e.g. download requested)
- Basic flow:
  1. subsystem requests work via the existing `OffscreenManager.sendToOffscreen` path
  2. system capability-checks `chrome.offscreen`
  3. Chrome path unchanged → message to offscreen document
  4. Firefox path → invoke the offscreen handler set **in-process** inside the background event page (event page has full DOM + WASM)
  5. response returns to the caller on the same Promise contract
- Alt flow: handler modules are imported lazily on first Firefox invocation (keep background startup light)
- Exception: runner throws → error propagates through the same `sendToOffscreen` rejection contract; no silent swallow
- Rules:
  - Seam = `src/shared/lib/chrome-apis/offscreen.ts` + `OffscreenManager`; callers untouched
  - Dispatch contract: today the offscreen entry registers 3 separate `onMessage` listeners (`ffmpegRunner.ts:472` — incl. `_OFFSCREEN_*` normalization at ll.339-352, `ttsRunner.ts:20`, `pronunciationRunner.ts:17`), each `(msg, sender, sendResponse)` + `return true` + `!sender?.tab` filter. The Firefox dispatcher MUST: iterate all registered listeners; synthesize `sender` without `.tab` (so the `!sender?.tab` offscreen filter passes); convert `sendResponse` to the returned Promise with first-response-wins; preserve the `_OFFSCREEN_` type normalization exactly. Listeners returning `false`/`undefined` without `sendResponse` must not hang the caller
  - Event-page suspension is a hard requirement, not an open question: `blob:` URLs minted in the event page (`wireEvents.ts:244-249`) die when the page suspends → `chrome.downloads.download` breaks mid-job. Firefox path MUST pin the page during heavy work (keep-alive mechanism — e.g. periodic `browser.runtime.getPlatformInfo()` or a pending listener event) for the job duration and release it on completion; blob-URL lifetime goes into the smoke matrix
  - Capability detection (`typeof chrome.offscreen === 'undefined'`) — never UA sniffing
  - `chrome.runtime.sendMessage` does NOT self-deliver to the sender's context on Chrome — direct-call path is mandatory, not optional. (Reconciles the folklore comment at `ocr.ts:32`: if sendMessage self-delivered, `messageBus.broadcast()` inside handlers would recurse infinitely — the shipped extension disproves it. Firefox self-delivery behavior is spike-verified.)
- Postcondition: feature completes identically on both browsers, or fails with a logged root cause
- NFR refs: NFR-1, NFR-5, NFR-6

REQ-3: Panel surface dropped on Firefox
- Actor: content script (`OPEN_SIDE_PANEL`/`CLOSE_SIDE_PANEL` messages — dead surface kept wired for Chrome)
- Goal: absence of `chrome.sidePanel` never crashes; no panel surface is exposed on Firefox
- Preconditions: Firefox manifest has no `side_panel`/`sidePanel` (REQ-1 strips both)
- Basic flow:
  1. content script sends `OPEN_SIDE_PANEL`/`CLOSE_SIDE_PANEL` (unchanged)
  2. background adapter detects `chrome.sidePanel` absent → returns `{ success: false, error: 'sidePanel unsupported on this browser' }` through the existing response contract
  3. content script's existing failure path runs — `sidePanelOpen` flag stays consistent (see relay semantics in `sidePanelRelay.ts`)
- Alt flow: none — surface is intentionally absent (dead code per owner; subtitle panel is in-page)
- Exception: any caller that bypassed the adapter and touched `chrome.sidePanel` directly → runtime throws are recorded in the smoke matrix (adapter audit row)
- Rules:
  - Capability branch lives inside `chrome-apis/sidePanel.ts` — call sites unchanged
  - No `sidebar_action`, no tab fallback, no new UI — dropped, not ported
  - `setPanelBehavior` has no call sites today (`sidePanel.ts:26-30` is dead code) — Firefox impl is a no-op; note as adapter-audit finding
  - Report rows: toolbar click on Firefox opens `action.default_popup` (popup still works); in-page subtitle panel is the canonical panel
- Postcondition: Firefox console shows no unhandled rejection from sidePanel paths; in-page subtitle panel verified working in smoke
- NFR refs: NFR-5

REQ-4: Firefox install + smoke run
- Actor: Dev
- Goal: verified load + core-journey evidence on real Firefox ≥128
- Preconditions: `dist-firefox/` built; Firefox ≥128 installed
- Basic flow:
  1. actor loads `dist-firefox/manifest.json` via `about:debugging` → system installs (no `service_worker disabled` error)
  2. actor opens youtube.com video → system injects content scripts + MAIN-world interceptors (`world:"MAIN"` honored on FF ≥128)
  3. actor verifies the in-page subtitle panel renders on the video page
  4. actor triggers subtitle capture → cues list populates in the in-page panel
  5. actor triggers a download → heavy-work host executes ffmpeg merge (REQ-2 path), `chrome.downloads.download` of the minted `blob:` URL completes (blob-URL lifetime verified across the job)
  6. actor creates an Anki card from a cue → card flow completes
  7. system logs each step's outcome (console evidence) for REQ-5
- Alt flow: any step broken → capture console error + stack, mark `broken`, continue remaining steps (a broken step never aborts the matrix); steps not reached are marked `untested`, never left blank
- Exception: extension fails install → spike stops early, install errors become the report's first finding
- Rules:
  - smoke steps fixed and enumerated in the report template; evidence = console logs/screenshots per step
  - environment rows beyond the journey (verify or mark `untested`): `AudioContext` usable in event page (supertonicTtsEngine.ts:46, ttsQueue.ts:33 — autoplay policy risk); OPFS `navigator.storage.getDirectory()`; `Worker` spawn; `downloads.download` of a `blob:` URL; `options_page` accepted (vs `options_ui`)
  - newly-discovered API gaps during the run: guard now **if the fix is adapter-local** (single seam, ≤1 file); otherwise record `broken` with root cause and defer to the parity decision — the seam discipline from Boundaries still applies
  - statuses limited to `works` / `degraded` / `broken` / `untested`
- Postcondition: every smoke row has a status + evidence
- NFR refs: NFR-4, NFR-5, NFR-6

REQ-5: Compat report
- Actor: Dev (produces), owner (consumes — outside system boundary)
- Goal: `tasks/reports/firefox-port-compat.md` containing decision-grade evidence
- Preconditions: REQ-4 matrix executed
- Basic flow:
  1. actor gathers smoke evidence + any discovered API gaps
  2. system (report artifact) presents: per-feature matrix (works/degraded/broken/untested + root cause), full list of `chrome.*` call sites observed failing, AMO-readiness section (`<all_urls>` review risk, WASM bundling, data practices), Android feasibility desk-check (no sidebarAction, restricted API set, curated-list install), recommendation inputs for port/WXT/drop
- Alt flow: partial run (install OK but smoke incomplete) → report still produced with `untested` rows explicitly marked — no silent gaps
- Exception: none beyond REQ-4 failure capture
- Rules:
  - every row cites evidence (log/screenshot); unknowns marked `untested`, never guessed
  - TTS rows pre-marked `degraded` (`chrome.tts` absent on Firefox; `speechSynthesis` in a hidden event page has known broken-voice/audio behavior — actual outcome recorded by smoke)
  - adapter-audit findings land here too: `setPanelBehavior` dead code, `sidePanel` surface dropped per owner, opaque-origin iframe injection loss, toolbar popup behavior
- Postcondition: report is complete enough that the owner decides without re-running the spike
- NFR refs: NFR-2

### Non-functional (NFR)

| ID | Requirement | Class | Target |
|---|---|---|---|
| NFR-1 | Chrome lane zero regression — `dist/` runtime behavior and manifest semantics unchanged | R | all existing gates green; `dist/manifest.json` semantically identical (same key set + values, modulo hashed asset filenames — adapter edits change bundle hashes) |
| NFR-2 | Single SSOT manifest — Firefox variant generated, never hand-edited | S | `public/manifest.json` only source; transform deterministic |
| NFR-3 | No new runtime dependency; `web-ext` via `npx` or devDep only (engineering boundary anchoring N6/N7 — keep the spike diff minimal and reversible) | +infra | `dependencies` untouched |
| NFR-4 | Firefox ≥128 floor (world:MAIN); strict_min_version enforced in manifest | S | install fails clean below 128 |
| NFR-5 | Absent-API failures degrade gracefully — guard + fallback or logged error, never unhandled crash | R | zero unhandled rejections in Firefox console during smoke |
| NFR-6 | Event page stays alive for the duration of a heavy job ≤5min (pin during work, release after); `blob:` URLs outlive the job that mints them | P | ffmpeg merge of typical single video + `downloads.download` complete; longer = degraded note |

## Flows / States

Build lane (activity):

```
npm run build:firefox
  → vite build → dist/ (Chrome artifact, unchanged)
  → transform → dist-firefox/
     ├─ copy dist/*
     ├─ manifest: sw→page, side_panel dropped, +gecko, strip Chrome-only
     └─ emit firefox-background.html (<script type="module"> wrapping emitted loader)
```

Runtime API routing (per-call branch at adapter seams):

```
caller → chrome-apis adapter → capability check
   ├─ chrome.offscreen present  → Chrome path (unchanged)
   ├─ absent                    → in-process handler dispatch (event page)
   └─ unknown API absent        → guard → log + degrade
```

Smoke sequence (fixed order, REQ-4): install → inject (youtube) → in-page panel renders → capture → download (incl. blob-URL lifetime) → card → report.

## Function ↔ Feature Map

| Function (what the system does) | Features (tools supporting it) |
|---|---|
| Emit Firefox-installable artifact | manifest transform script `scripts/build-firefox.mjs`; `npm run build:firefox`; `firefox-background.html` emitter; gecko settings injection; `side_panel`/`offscreen`/`tts` strip |
| Execute heavy WASM work without offscreen API | shared offscreen-handler dispatch table (SSOT for Chrome listener + Firefox direct call); lazy runner import on Firefox path |
| Degrade cleanly without sidePanel | capability guard inside `chrome-apis/sidePanel.ts` returning structured `{success:false}`; manifest strips `side_panel`+permission |
| Produce decision-grade compat evidence | fixed smoke matrix; compat report template `tasks/reports/firefox-port-compat.md` |

## Data

| Entity | Key fields | Lives in | Retention |
|---|---|---|---|
| Firefox manifest transform rules | key renames, strips, gecko block | `scripts/build-firefox.mjs` (code) | n/a |
| `firefox-background.html` | module script src = emitted SW loader | `dist-firefox/` | build artifact |
| Compat report | feature, status, evidence, root cause | `tasks/reports/firefox-port-compat.md` | permanent (decision record) |

## Traceability

| Need (intent ID) | REQ | AC (Success Criteria line) |
|---|---|---|
| N1 (load on FF ≥128) | REQ-1, REQ-4 | SC-1, SC-2, SC-3 |
| N2 (capture pipeline) | REQ-1 (world:MAIN retention), REQ-4 | SC-4, SC-12 |
| N3 (background on event page) | REQ-1 | SC-3 |
| N4 (WASM sans offscreen) | REQ-2, NFR-6 | SC-5, SC-11 |
| N5 (panel UI) | REQ-3 | SC-6 |
| N6 (Chrome no-regress) | NFR-1, NFR-3, NFR-5 | SC-7, SC-9, SC-10 |
| N7 (decision-grade report) | REQ-5 | SC-8 |

| Journey step (TO-BE) | REQ |
|---|---|
| 1. `build:firefox` emits valid `dist-firefox/` | REQ-1 |
| 2. Temporary install; inject on video page | REQ-4 |
| 3. Panel + capture + download + card | REQ-2, REQ-3, REQ-4 |
| 4. Compat report with AMO + Android sections | REQ-5 |
| 5. Owner decides; Chrome stays green | REQ-5, NFR-1 |

## Boundaries

- Always: capability-detect (`typeof chrome.x === 'undefined'`), never UA-sniff; Chrome call sites untouched — branches live inside adapters; run `npm run typecheck && npm run test:unit && npm run build` before commit; verify the actual loaded bundle (`unpacked-ext-sw-stale-bytecode` lesson applies to event pages too).
- Ask first: any new dependency (target: zero; `npx web-ext` preferred over devDep); changing `public/manifest.json` shape for Chrome keys; persistence/keep-alive hacks for the event page beyond one documented mechanism.
- Never: hand-edit `dist-firefox/manifest.json` (transform is SSOT); commit a second static manifest; ship a Firefox-only feature flag that changes Chrome behavior; modify runner business logic to satisfy the host change — only the dispatch seam may change.

## Success Criteria

- [ ] SC-1: `npm run build:firefox` completes and emits `dist-firefox/`; `dist-firefox/manifest.json` contains `background.page`, `browser_specific_settings.gecko` with `strict_min_version: "128.0"`; no `service_worker`/`side_panel`/`sidebar_action`/`offscreen`/`sidePanel`/`tts` keys remain.
- [ ] SC-2: `npx web-ext lint --source-dir dist-firefox` exits 0 with no `ERROR`-severity findings (warnings enumerated in the report).
- [ ] SC-3: Temporary install on Firefox ≥128 succeeds; background event page initializes without console errors.
- [ ] SC-4: On youtube.com, content script + MAIN-world interceptors run (marker/log evidence) and subtitle cues reach the panel.
- [ ] SC-5: A video download is **attempted** via the Firefox heavy-work path and its outcome recorded with evidence (works = download completes end-to-end; broken = root cause logged in report).
- [ ] SC-6: `OPEN_SIDE_PANEL`/`CLOSE_SIDE_PANEL` return `{success:false, error}` without throwing; no unhandled rejection from sidePanel paths; in-page subtitle panel renders on the video page.
- [ ] SC-7: Chrome lane gates green: `npm run typecheck`, `npm run test:unit`, `npm run build`; `dist/manifest.json` semantically identical to pre-change build (same keys/values modulo hashed asset filenames).
- [ ] SC-8: `tasks/reports/firefox-port-compat.md` exists with complete matrix (works/degraded/broken/untested + evidence per row), discovered API-gap list, AMO-readiness, and Android feasibility sections.
- [ ] SC-9 (NFR-3): `package.json` `dependencies` unchanged; any `web-ext` usage is `npx` or devDep.
- [ ] SC-10 (NFR-5): zero unhandled promise rejections / uncaught errors in the Firefox console across the full smoke run, not just init.
- [ ] SC-11 (NFR-6): during a heavy job, the event page does not suspend mid-job — `downloads.download` of the minted `blob:` URL completes after the runner finishes.
- [ ] SC-12: Anki card creation from a captured cue completes on Firefox, or is recorded broken with root cause.

## Definition of Done

- [ ] All Success Criteria pass (or explicitly recorded as report blockers)
- [ ] `npm run typecheck && npm run lint && npm run test:unit && npm run build` green
- [ ] Firefox real-browser smoke executed and evidenced (per REQ-4)
- [ ] `docs/2-architechture-system.md` gains a Firefox-lane section; ADR for the event-page dispatch seam if the pattern holds post-spike

## Open Questions / Accepted Risks

- Keep-alive mechanism choice for the event page (poll `runtime.getPlatformInfo` vs pending-event pinning) — picked in DELIVER; failure mode (mid-job suspension killing `blob:` URLs) is a hard requirement (REQ-2/NFR-6), not a question.
- WASM CSP `wasm-unsafe-eval` on Firefox extension pages — manifest CSP is copied verbatim by transform; smoke verifies.
- DNR session-rules parity on Firefox — unverified until smoke.
- Whether Firefox `runtime.sendMessage` self-delivers to the background page (Chrome does not) — spike-verified; the REQ-2 direct-call path is correct either way.
- Android: desk-check only this item; device testing is a follow-up decision.
