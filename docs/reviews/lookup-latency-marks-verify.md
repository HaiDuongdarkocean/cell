# Verify — lookup-latency-marks

VERDICT: PASS

Stage: deliver → shipped
Spec: `docs/specs/lookup-latency-marks.md` (APPROVE_WITH_CHANGES round 2, all 4 minors applied) · Intent: `docs/intent/lookup-latency-marks.md` · uiSurface=no (design skipped)

## Deterministic gates

| Gate | Result | Evidence |
|---|---|---|
| `npm run typecheck` | pass | tsc clean |
| `npm run lint` | pass | eslint clean |
| `npm run test:unit` | pass* | 662 suites; +8 new tests (4 perfMarks gate/clear/retain, 3 popupLifecycle ordering/stale/cache-skip, 1 toolbar guard placement). `DictionaryTab.test.tsx` failed once under full-suite timing (definitions still skeleton when assertion ran) — passes in isolation; diff does not touch the universal-panel search path |
| `npm run build` | pass | vite build + postbuild CSP patch |
| `check-feature-cycles` / `check-deep-imports` | pass | clean |
| `npm run test:e2e:build` | pass | CELL_E2E=1 dist for the e2e spec |

## Real-browser verification (Playwright + packed E2E `dist`, Chromium)

`e2e/extension-latency-marks.spec.ts` — 1/1 pass. Clicked a seeded word on the mock stream page (real `LOOKUP_REQUEST` round-trip) and opened the Audio tab (fallback chain pinned to vendored eSpeak → real `PRONUNCIATION_ESPEAK_TTS` synthesis). Measures read from `performance.getEntriesByType('measure')` **in the page's own buffer**:

```
cell:lookup:dispatch→response:dp-…-1 = 30.9ms
cell:lookup:dispatch→render:dp-…-1   = 41.1ms
cell:audio:start→applied:silence     = 282.3ms
cell:audio:applied→render:silence    = 18.4ms
cell:audio:start→render:silence      = 300.7ms
```

All durations non-negative; every number far under the <3s persona contract.

### Isolated-world answer (REQ-4)

`performance.mark()` emitted inside the content-script isolated world **is** visible in the page's User Timeline buffer — no gap, no fallback needed. The `console.debug` summaries remain as a second surface.

### Production gate

Production `dist` still contains the `cell:lookup:*`/`cell:audio:*` literals (minifier does not strip gated calls — spec's softened criterion), but every helper call sits behind `isDevMode || isCellDebug()` which folds to `false` in the production artifact — zero runtime marks.

## Requirement traceability

- REQ-1: `src/shared/lib/perfMarks.ts` — `markLookup`/`markAudio`/`measureLookup`/`measureAudio`/`clearLookupMarks`/`clearAudioMarks`; marks cleared after the chain closes, measures retained (~150-entry buffer cap accepted).
- REQ-2: `popupLifecycle.ts` — `dispatch` before `sendMessage(LOOKUP_REQUEST)` (cache-hit fast path unmeasured); `response` only after the stale-ownership guard; `render` in `requestAnimationFrame` after `renderLookupResult`, keyed by the closure `requestId` (not `level.requestId` — nulled before application).
- REQ-3: `useDictionaryToolbar.ts` — `start` after all early-return guards, `applied` right after `setAudioItems(wordItems)`; `PronunciationAudioPanel.tsx` — `render` in rAF once `items.length > 0 && !loading` (real rows, not skeleton), then `applied→render` + `start→render` measured before `clearAudioMarks`.
- REQ-5: `perfMarks.test.ts` (gate on/off, clear, retain, missing-mark skip) + `popupLifecycle.perfMarks.test.ts` (ordering, stale suppression, cache-hit skip) + toolbar test (start/applied marks only past guards).
- REQ-6: e2e uses `test:e2e:build` artifact; assertions via measure entries with console-line fallback.
