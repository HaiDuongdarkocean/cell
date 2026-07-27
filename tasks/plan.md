# Implementation Plan: Independent Candidate List in Dictionary Panel

## Overview
Refactor the dictionary panel so every lookup candidate is rendered as an independent, vertically scrollable card. Each card keeps its own tab state, definition selection, audio/image/translation data, and action buttons. The chip bar becomes a jump-link navigation that scrolls to a candidate instead of replacing the active result. This removes the cross-candidate tab contamination and the need to click a chip before seeing another candidate.

## Current state
- `useDictionaryPanel.ts` stores one `currentResult`, a `candidates` array, and a single set of tab/media/selection state.
- `DictionaryPanelView.tsx` renders one header, one tab toolbar, one set of tab panels, and one definitions list for `currentResult`. Candidate chips below switch `currentResult`.
- `LookupResult` has no stable `id`; candidates are identified by index in the lookup result list (`[currentResult, ...candidates]`).

## Architecture decisions
1. **Per-candidate state with `useCandidate` hook.** A new `useCandidate(candidate, contextSentence, sourceLang, targetLang, onSendToCard, onQuickAdd)` hook encapsulates all candidate-local state (`activeTab`, `definitionSelection`, `status`, `audioItems`, `imageItems`, `translation`, etc.) and lazy fetchers. Each `CandidateView` mounts its own `useCandidate`, so tab and selection state never leak between candidates.
2. **`CandidateView` component.** Extract the existing single-candidate body (header, toolbar, tab panels, definitions, actions) into a self-contained component. `DictionaryPanelView` maps the result list to `<CandidateView … />`.
3. **Chips become jump links.** The chip bar stays but `onClick` scrolls the selected candidate into view and updates a local highlight index. It no longer swaps `currentResult` or resets global state.
4. **Lazy media remains.** Audio, image, and translation fetchers live inside `useCandidate` and only run when the candidate's own tab is opened.
5. **Selection badges on tab buttons.** Each candidate's tab toolbar shows a numeric badge on the audio/image/definitions tabs indicating how many items are currently selected (`selectedDefinitions.length`, selected audio count, selected image count). Badges are small counters positioned at the top-right of the tab button and update immediately as the user toggles items. Translate and links tabs do not carry item selection, so they do not show a badge.
6. **Shared `buildPrefill` moved to a pure helper.** `buildPrefill` and its dependencies are moved/extracted so both `useDictionaryPanel` and `useCandidate` can build card-creator prefills without duplication.
6. **Keep `useDictionaryPanel` search API stable in this slice.** The hook continues to own search, history updates, and result list. Per-candidate fields in its return object will become unused by `DictionaryPanelView`; dead-state cleanup is deferred to a follow-up task to avoid breaking existing unit tests until the new UI is verified.

## Dependency graph
```
shared buildPrefill helper
        |
        +--> useCandidate hook
                |
                +--> CandidateView component
                        |
                        +--> DictionaryPanelView candidate list mapping

useDictionaryPanel (search result list only)
        |
        +--> DictionaryPanelView (search, history, chips, scroll orchestration)
```

## Task list

### Phase 1: Foundation
- [ ] Task 1: Extract/share `buildPrefill` and media fetch helpers for single candidate.
- [ ] Task 2: Create `useCandidate` hook with per-candidate state and lazy actions.

### Checkpoint: Foundation
- [ ] `npm run typecheck` passes
- [ ] New `useCandidate` unit tests pass
- [ ] `useDictionaryPanel` still compiles and its existing tests pass

### Phase 2: Core UI refactor
- [ ] Task 3: Create `CandidateView` component from the existing single-candidate panel body.
- [ ] Task 4: Refactor `DictionaryPanelView` to render `CandidateView` for every result and turn chips into jump links.
- [ ] Task 5: Adjust `DictionaryPanelView.module.css` for candidate list spacing, scroll containers, and sticky chip affordance.

### Checkpoint: Core UI
- [ ] `npm run test:unit` passes
- [ ] `npm run build` passes
- [ ] Manual Chrome check: multiple candidates visible, each tab independent, chip scroll works

### Phase 3: Cleanup and verification
- [ ] Task 6: Remove/update `useDictionaryPanel` per-candidate dead state and its unit tests.
- [ ] Task 7: Update architecture docs/function index if new files are introduced.
- [ ] Task 8: Final typecheck, unit tests, production build, and real-browser verification.

## Risks and mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| `useDictionaryPanel` unit tests break when API changes | Medium | Keep API stable in the first slice; only `DictionaryPanelView` stops consuming per-candidate fields. Clean tests after UI is verified. |
| Candidate list becomes long on mobile | Medium | Use vertical scroll; candidate cards stack naturally. Do not virtualize in MVP. |
| Media fetched for many candidates simultaneously | Medium | Keep lazy fetch inside `useCandidate`; only the candidate whose tab is opened fetches. |
| Duplicate keys if two candidates have the same `term` | Low | Use `index` in the lookup result list as the stable key and for scroll `id`. |
| Status cycle in `CandidateView` may conflict with `useDictionaryPanel` global status | Low | `CandidateView` calls `cycleWordStatus` and holds local `status` state initialized from the candidate. `useDictionaryPanel` global status becomes unused. |

## Open questions
- Should the chip active highlight track scroll position via `IntersectionObserver` or only reflect the last clicked chip?
- Does the context sentence for each candidate stay as the searched term, or should it be candidate-specific?
