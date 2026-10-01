# Verify — lookup-hot-path

VERDICT: PASS

Stage: deliver → shipped
Spec: `docs/specs/lookup-hot-path.md` (APPROVE_WITH_CHANGES round 2, both changes applied) · Intent: `docs/intent/lookup-hot-path.md` · uiSurface=no (design skipped)

## Deterministic gates

| Gate | Result | Evidence |
|---|---|---|
| `npm run typecheck` | pass | tsc clean |
| `npm run lint` | pass | eslint clean (fixed pre-existing unused `testInfo` in committed anki spec) |
| `npm run test:unit` | pass | 659 suites / 7761 tests (+12 new: 7 orchestrator hot-path, 2 resource-handler invalidation, 3 wireEvents settings seam) |
| `npm run build` | pass | vite build + postbuild CSP patch |
| `check-feature-cycles` / `check-deep-imports` | pass | 27 features, 62 edges clean; 0 new deep imports |

## Real-browser verification (Playwright + packed `dist`, Chromium)

`e2e/stage2/dictionary-nested-popup.spec.ts` — 2/2 pass: three levels of real `LOOKUP_REQUEST` lookups resolve seeded dictionary entries end-to-end through the new parallel assembly/memo path (winner + candidates render identical definitions; nested popup stack + Escape semantics unchanged).

Pre-existing stage2 failures observed in the same run, all downstream of a working lookup and unrelated to this diff (no UI text, playback, or queue code touched): `popup-status-keys` expects lowercase `unknown` vs committed i18n `Unknown` (label change in `6be1fd87`); `subtitle-target-dictionary` video-pause assertion (`484eca5b` changed mount-time pause); `queue-lazy-lookup` universal-panel mount after quick-add.

Spec seed helper also fixed: `DB_SCHEMA_VERSION` pin 12→13 + dynamic `indexedDB.databases()` version resolution (lesson recorded: `e2e-idb-seed-version-drift`).

## Requirement traceability

- REQ-1 deterministic-parallel candidate assembly: `Promise.all` over eligible specs + sequential fold applying surface/lemma content predicate vs phrase dedupe-only predicate; `seen` pre-check on query term and post-check on resolved term; single-`plugin.lemma` fallback keeps its no-`seen`-add behavior (`skipSeenAdd`).
- REQ-2 parallel lemma probing: all `lemmaCandidates` minus exact `lookupTerm` probed in one batch; first non-empty in candidate order wins; abort checked at batch boundary.
- REQ-3 per-request `ReadMemo`: fresh per `lookupOrchestratorMulti`, verbatim `lang|term` keys, in-flight + resolved promises retained for the request — instrumented test proves each distinct term read exactly once.
- REQ-4 cached context: `settingsCache` + `lookupContextCache` per langCode, rejected promises evicted; `clearDictionaryProbeCache()` extended as the single invalidation point; wired to `chrome.storage.onChanged` `settings` key in `wireEvents` (covers every writer incl. sync-applied) and `RESOURCE_RENAME`/`RESOURCE_SET_COMPONENTS` handlers.
- REQ-5 abort: checked at request boundary, after candidate batch, and inside assemble paths; aborted requests reject, no partial results.
- REQ-6 tests: all listed cases implemented and passing (see suite counts above).
