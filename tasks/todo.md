# Task Checklist: Independent Candidate List in Dictionary Panel

- [ ] T1 — Extract/share `buildPrefill` and per-candidate media fetch helpers.
  - AC: `buildPrefill` can be imported by both `useDictionaryPanel` and a new `useCandidate` hook without code duplication.
  - Depends on: none.

- [ ] T2 — Create `useCandidate` hook with per-candidate state and lazy actions.
  - AC: own `activeTab`, `definitionSelection`, `status`, `translation`, `audioItems`, `imageItems`; lazy fetch on tab open; builds prefill; calls `onSendToCard`/`onQuickAdd`.
  - Depends on: T1.

- [ ] T3 — Add unit tests for `useCandidate`.
  - AC: toggles tab, selects definitions, fetches audio/image lazily, cycles status, builds prefill.
  - Depends on: T2.

- [ ] T4 — Create `CandidateView` component from existing single-candidate panel body.
  - AC: renders header, toolbar, definitions, tab panels, and actions using `useCandidate`.
  - Depends on: T2/T3.

- [ ] T5 — Refactor `DictionaryPanelView` to map all candidates to `CandidateView`.
  - AC: all candidates visible in a scrollable list; chips remain but jump-scroll to candidate; no global tab state.
  - Depends on: T4.

- [ ] T6 — Adjust `DictionaryPanelView.module.css` for candidate list layout and tab selection badges.
  - AC: candidate cards separated, scroll container works, chip bar affordance retained, tab buttons can host a numeric badge top-right.
  - Depends on: T5.

- [ ] T6b — Add selected-item count badges to candidate tab buttons.
  - AC: definitions/audio/image tabs show selected count on top-right when > 0; updates on toggle; translate/links have no badge.
  - Depends on: T4/T5.

- [ ] T7 — Cleanup `useDictionaryPanel` per-candidate dead state and update its tests.
  - AC: `useDictionaryPanel` focuses on search and result list; tests match new behavior OR dead state is removed in a follow-up.
  - Depends on: T5.

- [ ] T8 — Update architecture docs/function index for new files.
  - AC: `docs/2-architechture-system.md` lists `useCandidate`/`CandidateView` if they are new public modules.
  - Depends on: T4/T5.

- [ ] T9 — Run quality gates and real-browser verification.
  - Commands: `npm run typecheck`, `npm run test:unit`, `npm run build`, `npx vite build --mode development`.
  - Browser: Chrome DevTools, desktop + narrow viewport, multiple candidates, tab independence, chip jump.
  - Depends on: T6/T8.

- [ ] T10 — Refine against plan AC and fix evidence-backed gaps only.
  - Depends on: T9.
