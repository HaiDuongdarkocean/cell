# Spec — lookup-latency-marks (backlog #18)

Intent: `docs/intent/lookup-latency-marks.md` (analyze: `docs/reviews/lookup-latency-marks-analyze.md`, `all` mode) · uiSurface: no → no design stage
Review: spec-reviewer round 1 → REJECT (implementability gaps); all findings applied below.

## Goal

Dev-only User Timing instrumentation on the two persona-critical hot paths — lookup dispatch→popup render and audio-tab-click→rows committed — so the <3s contract is measurable and regressions are visible in DevTools. Zero production cost: everything behind `isDevMode || isCellDebug()`.

## Non-goals

- No persistence/reporting of latency data (ring buffer / Drive / lookupLog duration fields — follow-up if needed).
- No marks inside the background SW or offscreen (different realm, separate buffer; content-script render latency is the user-visible number).
- No prefetch-path marks (`lookupCache.prefetch` fan-out would pollute user-facing numbers).
- No pointer-event→dispatch mark (hover-intent/trigger debounce latency unmeasured — accepted deviation from intent's 4-point journey for S-size; dispatch→render covers the actionable span).
- No telemetry, thresholds, or production instrumentation. No UI.

## Requirements

### REQ-1 — Dev-gated mark helper (single module)

New `src/shared/lib/dev/perfMarks.ts`:

- `markLookup(point: string, requestId: string)` → emits `cell:lookup:<point>:<requestId>`.
- `markAudio(point: string, term: string)` → emits `cell:audio:<point>:<term>`.
- `measure(name, startMark, endMark)` → `performance.measure`, `console.debug(\`${name}: ${duration}ms\`)`, then `clearMarks(startMark, endMark)`.
- Every entry point no-ops unless `isDevMode || isCellDebug()` — callers invoke unconditionally; `isCellDebug()` (`src/shared/lib/cellDebug.ts`, `__CELL_DEBUG__` define) exists specifically so **E2E builds (`CELL_E2E=1`) keep marks while production stays clean**.
- Marks are disposable once measured; **measures are kept** — they are what `getEntriesByType('measure')` and the DevTools User Timing lane expose (buffer ~150 entries, oldest dropped — accepted ceiling for a dev tool; optional `clearMeasures` per dispatch is allowed but not required).

### REQ-2 — Lookup path marks (pinned positions)

1. `dispatch:<id>` — `controller/popupLifecycle.ts`, immediately before the primary `sendMessage(LOOKUP_REQUEST)` (~:503). Cache-hit early return (~:455–460) produces **no marks** — repeat-term hovers are silently unmeasured (accepted gap, documented).
2. `response:<id>` — inside the response `.then`, **after** the `owner` lookup resolves (a superseded request's dropped response gets no measure).
3. `render:<id>` — **no requestId plumbing through mount options** (that channel doesn't exist); instead `popupLifecycle` schedules `requestAnimationFrame` immediately after applying results to the level (`setResult` — the state lands this frame, rAF callback ≈ commit). Mark from `popupLifecycle` itself using the **`requestId` captured in the response closure** — `level.requestId` is nulled at :512 before result application, so it must not be re-read.

Measures: `cell:lookup:dispatch→response:<id>`, `cell:lookup:dispatch→render:<id>`.

### REQ-3 — Audio path marks

1. `start:<term>` — `useDictionaryToolbar.fetchAudio`, **after** the early-return guards (~:210–212) so aborted fetches leave no orphan marks.
2. `applied:<term>` — immediately after `setAudioItems(wordItems)` (~:252) — word-audio data ready; sentence TTS remains a separate later item.
3. `render:<term>` — in `PronunciationAudioPanel`: effect keyed on `items.length > 0 && !loading`, then `requestAnimationFrame` → mark. `loading` stays true until `fetchAudio`'s `finally`, so this commit reflects rows-visible — not the skeleton flash.

Measures: `cell:audio:start→applied:<term>`, `cell:audio:applied→render:<term>` (must be measured **before** `clearMarks` removes the `applied` mark — order the clears accordingly), `cell:audio:start→render:<term>`.

Term-keyed marks can collide if the same term is open in two surfaces (popup + integrated panel share `useDictionaryToolbar`) — accepted; each measure still reports a duration, just possibly cross-wired when identical terms overlap.

### REQ-4 — Isolated-world visibility

`performance.mark` in a content-script isolated world lands in the **page's** per-Window User Timing buffer — visible in DevTools Performance panel and page-console `getEntriesByType`. Verified on real Chromium (REQ-6); if isolation proves otherwise, the deliverable degrades to `console.debug` summary and the gap is recorded in the verify artifact.

### REQ-5 — Tests

- `perfMarks` unit test: gate on → marks/measures created, marks cleared, measures retained; gate off → `performance.mark` spy never called. jsdom's `performance.measure` support is partial — the harness may stub `performance.mark/measure/clearMarks` rather than rely on jsdom.
- Call-site smoke: dispatch marks before sendMessage; response handler marks for owning level only; `fetchAudio` marks after guards.
- Existing popup/toolbar tests pass unchanged (non-dev default → no marks).

### REQ-6 — Real-Chromium verify (E2E build, not production)

The extension fixture loads `dist/` — production `isDevMode` is false. The spec relies on `__CELL_DEBUG__` being compiled in for e2e (`build-e2e.mjs` sets `CELL_E2E=1`); e2e must run against that build (`npm run test:e2e:build`).

`e2e/extension-latency-marks.spec.ts`: trigger a lookup on the mock stream page, then `page.evaluate(() => performance.getEntriesByType('measure').filter(e => e.name.startsWith('cell:lookup:')))` — assert ≥1 measure, `duration >= 0`. Same for `cell:audio:*` after the audio tab fetch runs.

## Interfaces touched

- `src/shared/lib/dev/perfMarks.ts` — new.
- `src/features/dictionaryPopup/controller/popupLifecycle.ts` — dispatch + response + rAF render marks.
- `src/features/dictionaryPopup/logic/useDictionaryToolbar.ts` — audio start/applied marks.
- `src/features/dictionaryPopup/ui/PronunciationAudioPanel.tsx` — audio render mark (post-loading rAF).
- `e2e/extension-latency-marks.spec.ts` — new verify spec.
- No component mount-option changes (requestId stays inside popupLifecycle; render mark fires there via rAF).

## Alternatives considered

- `console.time`/`console.timeEnd`: console-only, doesn't land in the Performance timeline — rejected.
- Persist durations into `lookupLogStore` entries: useful follow-up, heavier than needed — deferred.
- `PerformanceObserver` aggregation: overkill for S-size.
- RequestId plumbed into popup component via mount options: correct but adds a channel for one mark — rejected; rAF at the popupLifecycle boundary approximates commit with zero plumbing.
- Marks in background SW: separate realm, measures wall-clock not render latency — out of scope.

## Success criteria (measurable)

- Real Chromium (E2E build): a lookup produces `cell:lookup:*` measures; audio tab produces `cell:audio:*` measures; durations ≥0 and sane (<3s target).
- Production emits zero `cell:` marks on these paths — runtime spy proves no `performance.mark` call when gated off; dist string-grep is best-effort only (if the helper isn't inlined by DCE, literals may survive harmlessly).
- All gates: typecheck, lint, `test:unit`, build, feature-cycles/deep-imports clean.
