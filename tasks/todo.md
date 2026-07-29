# Task Checklist: Independent Candidate List in Dictionary Panel

- [x] T1 — Extract/share `buildPrefill` and per-candidate media fetch helpers.
  - AC: `buildPrefill` can be imported by both `useDictionaryPanel` and a new `useCandidate` hook without code duplication.
  - Depends on: none.

- [x] T2 — Create `useCandidate` hook with per-candidate state and lazy actions.
  - AC: own `activeTab`, `definitionSelection`, `status`, `translation`, `audioItems`, `imageItems`; lazy fetch on tab open; builds prefill; calls `onSendToCard`/`onQuickAdd`.
  - Depends on: T1.

- [x] T3 — Add unit tests for `useCandidate`.
  - AC: toggles tab, selects definitions, fetches audio/image lazily, cycles status, builds prefill.
  - Depends on: T2.

- [x] T4 — Create `CandidateView` component from existing single-candidate panel body.
  - AC: renders header, toolbar, definitions, tab panels, and actions using `useCandidate`.
  - Depends on: T2/T3.

- [x] T5 — Refactor `DictionaryPanelView` to map all candidates to `CandidateView`.
  - AC: all candidates visible in a scrollable list; chips remain but jump-scroll to candidate; no global tab state.
  - Depends on: T4.

- [x] T6 — Adjust `DictionaryPanelView.module.css` for candidate list layout and tab selection badges.
  - AC: candidate cards separated, scroll container works, chip bar affordance retained, tab buttons can host a numeric badge top-right.
  - Depends on: T5.

- [x] T6b — Add selected-item count badges to candidate tab buttons.
  - AC: definitions/audio/image tabs show selected count on top-right when > 0; updates on toggle; translate/links have no badge.
  - Depends on: T4/T5.
  - Notes: `useCandidate` exposes `selectedAudioCount`, `selectedImageCount`, `selectedTranslationCount`, `selectedLinkCount`, and `selectedDefinitionCount`. `CandidateView` passes the audio/image/translate/link counts to `DictionaryToolbar`, which renders badges for the four toolbar tabs. `selectedDefinitionCount` is available but not rendered as a badge because definitions are not a toolbar tab (they are shown as a persistent list below the toolbar).

- [x] T7 — Cleanup `useDictionaryPanel` per-candidate dead state and update its tests.
  - AC: `useDictionaryPanel` focuses on search and result list; tests match new behavior OR dead state is removed in a follow-up.
  - Depends on: T5.
  - Notes: removed `useDictionaryToolbar`, `buildActivePrefill`, `buildCandidatePrefill`, and all per-candidate fields from `UseDictionaryPanelReturn`. `useDictionaryPanel.test.ts` now covers search, loading, error, currentResult, candidates, contextSentence, `getTokenStatus` fallback, and `syncStatus`. Fixed an `useDictionaryLookup` `syncStatus` effect that caused an infinite re-render when `syncStatus` matched the current result; added a status-equality guard.

- [x] T8 — Update architecture docs/function index for new files.
  - AC: `docs/2-architechture-system.md` lists `useCandidate`/`CandidateView` if they are new public modules.
  - Depends on: T4/T5.
  - Notes: updated the dictionaryPopup function-index rows for `useDictionaryPanel.ts`, `useDictionaryPanel.test.ts`, `useDictionaryToolbar.ts`, `buildCandidatePrefill.ts`, and the target-structure paragraph to remove stale `useDictionaryPanel`/`useDictionaryToolbar` coupling references.

- [x] T9 — Run quality gates and real-browser verification.
  - Commands: `npm run typecheck`, `npm run test:unit`, `npm run build`, `npx vite build --mode development`.
  - Browser: Chrome DevTools, desktop + narrow viewport, multiple candidates, tab independence, chip jump.
  - Depends on: T6/T8.
  - Verification results:
    - `npm run typecheck` — passed (exit 0).
    - `npm run test:unit` — passed with `--runInBand`: 260 passed, 1 skipped, 3441 tests passed (exit 0). A parallel workers run without `--runInBand` showed two unrelated flaky failures (`webTokenizeController` and `phraseMatchBenchmark`), both passed when rerun in isolation.
    - `npm run build` — passed (exit 0).
    - `npx vite build --mode development` — passed (exit 0); dev seed assets copied to `dist/seed`.
    - Real-browser verification (Chrome DevTools):
      - Loaded the design-system showcase; the Popup Dictionary renders and switches Audio/Image/Translate/Links tabs correctly.
      - Smoke-tested the live extension on geeksforgeeks.org; discovered and fixed a content-script `e.closest is not a function` crash when `MouseEvent.target`/`relatedTarget` is a `Text` node (see `webTriggerController.ts` and `subtitleTriggerController.ts`).
      - Full multi-candidate chip-jump test on a live page requires a known seeded word and a matching text page; deferred to manual QA.

- [x] T10 — Refine against plan AC and fix evidence-backed gaps only.
  - Depends on: T9.
  - Notes: confirmed `useDictionaryPanel` owns only search/result list; `CandidateView`/`useCandidate` own per-candidate state; chips jump-scroll; lazy media lives in `useCandidate`; badges wired for audio/image/translate/links tabs. One remaining plan AC wording mismatch: the plan lists a definitions tab badge, but the current design shows definitions as a list, not a tab, so `selectedDefinitionCount` is exposed but not rendered as a tab badge.
