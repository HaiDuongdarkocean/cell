# Spec Review — firefox-port

Reviewed `docs/specs/firefox-port.md` against `docs/intent/firefox-port.md`, `review-lenses.md`, `spec-template.md`. Three independent reviews (structure, technical accuracy, intent/traceability) merged; orchestrator spot-checked `vite.config.ts`, `public/manifest.json`, `offscreenManager.ts`, `sidePanelRelay.ts`, `messageBus.ts`, `handlers/ocr.ts`, `chrome-apis/{offscreen,sidePanel}.ts`, offscreen runners.

## What passes

- Full template conformance; all 5 REQs fully fielded (actor/goal/precondition/basic/alt/exception/rules/postcondition/NFR refs); actor steps in flows follow the template's labeled `actor … / system …` convention — no human behavior inside system steps.
- Scope correctly bounded: ends at compat report + owner decision; no parity work implied. REQ-2/3 adapter work is in-scope per intent ("runtime adapter guards … và các API khác report phát hiện").
- Traceability: N1–N7 all forward-mapped; all 5 journey steps mapped; every REQ traces back to a need; Function↔Feature map has no orphans.
- Technical spine verified against code: `OffscreenManager.sendToOffscreen` is the real choke point (callers-untouched feasible); `background.page` + module wrapper is the correct workaround (Firefox rejects `service_worker` AND `background.type:"module"`); `sidebar_action` key names correct; `match_origin_as_fallback` strip needed (manifest.json:38,50,62); `storage.session` FF≥115 under the 128 floor; background bundle uses no SW-only globals.

## Blockers

1. [SC-7 / NFR-1] [TL]: "`dist/manifest.json` byte-identical to pre-change build" is unachievable. REQ-2/3 adapter changes alter bundle hashes (`chunkFileNames: 'assets/[name]-[hash].js'`, vite.config.ts) and crxjs writes hashed refs into the emitted manifest — spec itself notes "hashed filenames" (REQ-1 rules). Fix: semantic equality — "manifest identical modulo hashed asset filenames"; the real criterion is same key set/values + Chrome gates green.

## Major

1. [REQ-2 Rules] [TL]: "the same `onMessage` handler map" does not exist today — the offscreen entry registers 3 separate listeners: `ffmpegRunner.ts:472` (incl. `_OFFSCREEN_*` normalization, ll.339-352), `ttsRunner.ts:20`, `pronunciationRunner.ts:17`, each using `(msg, sender, sendResponse)` + `return true` + `!sender?.tab` filter. Fix: specify the dispatch contract — iterate multiple listeners, first-`sendResponse`-wins, synthesize `sender` without `.tab`, convert sendResponse→Promise, preserve `_OFFSCREEN_` normalization. Otherwise listeners return `false` and sends hang silently.
2. [REQ-2 / Open Questions] [TL]: event-page suspension understated — `blob:` URLs minted in the event page (`wireEvents.ts:244-249`) die with the document → `chrome.downloads.download` breaks if the page suspends mid-job; no pending extension event pins the page during ffmpeg work. Fix: promote suspension handling from open question to an explicit mechanism requirement in REQ-2/NFR-6; add blob-URL lifetime to the smoke matrix.
3. [REQ-1 / Objective] [TL]: `chrome.tts` is a 4th Chrome-only API the spec misses — `tts` permission kept (manifest.json:18 → web-ext warning), `chrome.tts` undefined at runtime (`ttsEngineService.ts`, `handlers/tts.ts`, `handlers/localTts.ts`); the `speechSynthesis` fallback in a hidden event page has known broken-voice/audio behavior. Fix: strip `tts` in the transform; add `chrome.tts` to the guarded-API inventory; pre-mark TTS `degraded` in the report template.
4. [Flows/REQ-4] [BA]: the "unknown API absent → guard → log + degrade" branch (diagram line ~144) has no owning REQ — intent scope explicitly includes guards for APIs discovered during the spike, but no spec text states the decision rule (guard now vs report-only). Fix: add a rule to REQ-4/REQ-5, e.g. "guard if the fix is adapter-local; otherwise record broken with root cause."
5. [Success Criteria] [PO]: coverage gaps — nothing verifies NFR-3 (deps untouched), NFR-5 (zero unhandled rejections across the whole smoke, not just init — SC-3 only covers init), NFR-6 (≤5min job boundary); SC-5 is unfailable ("completes OR recorded broken" passes either way — recast as "download attempted via REQ-2 path AND outcome recorded with evidence"); no SC covers the Anki-card smoke step (REQ-4 step 5, journey step 3). Fix: reword SC-5; add SCs or explicit matrix rows for NFR-3/5/6; add a card-flow SC.
6. [REQ-4 vs Flows/States] [PO]: two normative smoke enumerations disagree — canonical sequence (line 147) lists `capture` but REQ-4's flow has no capture step (only "cues list populates"); alt flow says "blocked" vs canonical `works/degraded/broken`. Fix: align REQ-4 steps to the canonical sequence; use only `works/degraded/broken/untested`.
7. [REQ-4 smoke matrix] [TL]: missing environment rows — AudioContext in event page (`supertonicTtsEngine.ts:46`, `ttsQueue.ts:33`, autoplay policy risk), OPFS `navigator.storage.getDirectory()` (`opfsStorage.ts`), Worker spawn, `downloads.download` of `blob:` URL. Fix: add these rows.
8. [NFR refs] [PO]: orphan NFRs — NFR-3 and NFR-6 are cited by no REQ. NFR-6 (the spec's top risk) belongs on REQ-2; NFR-3 on REQ-1. Fix: add the refs.

## Minor

1. [REQ-1] `background.page` deviates from intent N3's literal `background.scripts` — technically justified (module wrapper) but undocumented; add a one-line note.
2. [Traceability] SC-2 is an orphan AC (map to N1); N2 row should also cite REQ-1 (world:MAIN retention is a transform rule).
3. [Boundary table] REQ-2/REQ-3 actors (internal subsystems, content script) absent from the Actor↔System table; REQ-3 names the end user as actor but no user-trigger step exists in its flow.
4. [REQ-1 alt flow] `npm run build:firefox` ↔ `node scripts/build-firefox.mjs` relationship (wrapper vs standalone) unstated.
5. [REQ-2 rules] sendMessage self-delivery claim — ARBITRATED: the spec's claim is correct for Chrome semantics (if sendMessage self-delivered, `messageBus.broadcast()` inside handlers — e.g. sidePanelRelay VIDEO_TIME_UPDATE — would recurse infinitely; the shipped extension disproves the folklore comment at `ocr.ts:32`). Keep the rule; add a note reconciling with that comment; treat Firefox self-delivery behavior as spike-verified.
6. [REQ-3] `sidebarAction.open()` user-gesture rationale likely outdated — the activation requirement was removed for extension-context callers in FF126 (bug 1799347); keep the hedge, fix the stated prior so it doesn't bias the report.
7. [REQ-3 rules] `setPanelBehavior` has no call sites (sidePanel.ts:26-30) — dead-code reference; signals the adapter audit is incomplete.
8. [REQ-1] consider `sidebar_action.open_at_install: false` (default `true` pollutes smoke evidence); stripping `match_origin_as_fallback` loses opaque-origin iframe injection → pre-mark a degraded row; toolbar click opens `action.default_popup` (not the panel) on Firefox → add compat row.
9. [REQ-5] exception flow delegates entirely to REQ-4; postcondition ("owner can decide") is actor-side state, and human analysis is compressed into step 1 — acceptable for a spike, but thin.
10. [SC-2] "no errors that block install" is subjective — name an exit-code/error-class threshold.
11. [Objective] `background.service_worker` listed among "runtime capability-guards" — it's a manifest transform, not a runtime guard.
12. [NFR-3] no intent anchor — cite N6/N7 or annotate as engineering boundary.
13. [verify] `options_page` support on Firefox (vs `options_ui`) — add to lint/smoke checks.

## Nhận xét theo role

- BA: problem-first objective, scope fence matches intent exactly; the only real hole is the unowned discovered-API guard branch.
- PO: REQs fully fielded and ACs mostly testable; the fixes that matter are SC-7 (impossible), SC-5 (unfailable), and the 3 unverified NFRs.
- TL: seam selection correct and verified against code; REQ-2's dispatch contract is the riskiest underspecification, and suspension risk is under-rated relative to its blob-URL consequence.

## Action items (required before DELIVER)

1. SC-7/NFR-1: "byte-identical" → semantic manifest equality — Success Criteria / NFR table.
2. REQ-2: write the dispatch contract (multi-listener iteration, first-sendResponse-wins, synthetic sender sans `.tab`, sendResponse→Promise, `_OFFSCREEN_` normalization) — REQ-2 Rules.
3. REQ-2/NFR-6: promote event-page keep-alive mechanism + blob-URL lifetime from open question to requirement — REQ-2 Rules, REQ-4 matrix, Open Questions.
4. REQ-1 + Objective: strip `tts` permission; add `chrome.tts` to guarded-API inventory; pre-mark TTS `degraded` — REQ-1 Rules, Objective, REQ-5.
5. REQ-4/REQ-5: owner + decision rule for newly-discovered API gaps — REQ-4 Rules.
6. Success Criteria: reword SC-5 (attempt + recorded outcome); add SCs for NFR-3/5/6 and the Anki-card step.
7. REQ-4: align basic flow to the canonical sequence (add `capture`); "blocked" → "broken".
8. REQ-4 matrix rows: AudioContext, OPFS, Worker spawn, `downloads.download` of `blob:` URL.
9. REQ tables: NFR-3 → REQ-1 refs, NFR-6 → REQ-2 refs; Traceability: SC-2 → N1, REQ-1 → N2 row.
10. REQ-1/Open Questions: note `background.page` deviation from N3's `background.scripts` wording.
11. REQ-1/REQ-3: `open_at_install: false`; fix gesture rationale; add opaque-origin-injection and popup-click compat rows.

## Risks chấp nhận

- `wasm-unsafe-eval` CSP on Firefox extension pages — revisit with smoke evidence (already flagged).
- DNR session-rules parity; `sidebarAction.open()` gesture semantics; Firefox `sendMessage` self-delivery quirk — revisit when smoke runs.
- `speechSynthesis`/audio output from a hidden event page — revisit when the TTS smoke row runs.

Required changes: action items 1–8 mandatory; 9–11 strongly recommended.

## Applied fixes

Applied to `docs/specs/firefox-port.md` after review (all 11 action items):

1. SC-7 + NFR-1: "byte-identical" → semantic manifest equality (same keys/values modulo hashed asset filenames).
2. REQ-2 Rules: dispatch contract specified — iterate the 3 existing `onMessage` listeners, synthetic `sender` without `.tab`, sendResponse→Promise first-wins, `_OFFSCREEN_` normalization preserved.
3. REQ-2 Rules + REQ-4 + NFR-6 + Open Questions: event-page suspension promoted to a hard requirement (pin during job, release after; `blob:` URL lifetime in smoke matrix).
4. Objective + REQ-1 Rules + REQ-5 Rules: `chrome.tts` added as 4th guarded API; `tts` permission stripped; TTS rows pre-marked `degraded`.
5. REQ-4 Rules: owner + decision rule for newly-discovered API gaps (guard if adapter-local, else record `broken`).
6. Success Criteria: SC-5 reworded to attempt+recorded-outcome; added SC-9 (NFR-3 deps), SC-10 (NFR-5 zero unhandled rejections across full run), SC-11 (NFR-6 blob-URL lifetime), SC-12 (Anki card flow).
7. REQ-4 basic flow aligned to canonical sequence (capture step added as step 4); statuses limited to works/degraded/broken/untested.
8. REQ-4 Rules: environment rows added — AudioContext, OPFS, Worker spawn, `downloads.download` of `blob:` URL, `options_page` acceptance.
9. NFR refs: NFR-3 → REQ-1, NFR-6 → REQ-2/REQ-4; traceability updated (SC-2 → N1, REQ-1 → N2 row, new SCs mapped).
10. REQ-1 Rules: `background.page` deviation from intent N3's `background.scripts` documented (only shape supporting ES-module entry).
11. REQ-1/REQ-3: `open_at_install: false` added; gesture rationale corrected (FF126 bug 1799347); opaque-origin-injection + popup-click compat rows noted for the report.

Minor fixes folded in: Actor↔System table gained content-script + feature-subsystem actors; REQ-1 alt flow now states wrapper↔standalone relationship; REQ-2 notes the `ocr.ts:32` folklore reconciliation; SC-2 names the exit-code/severity threshold; Objective no longer calls `service_worker` a runtime guard; NFR-3 anchored to N6/N7.

VERDICT: APPROVE_WITH_CHANGES
