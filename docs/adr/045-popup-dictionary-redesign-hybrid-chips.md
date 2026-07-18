# ADR-045: Popup Dictionary Redesign — Hybrid Chips + Expand

## Context

ADR-043 shipped the first round of popup UX improvements (close button, audio play state, image grid, links chips, Quick Add toast, focus trap, drag header). A learner-perspective review of the candidate IA surfaced three remaining friction points:

1. **Candidate list IA** — appended candidates stacked vertically under the winner, forcing the learner to scroll past the winner's definitions to compare alternates. With 3+ candidates the popup grew tall and the active entry lost prominence.
2. **Toolbar per candidate** — each appended candidate carried its own toolbar slot, so the popup rendered N toolbars for N candidates. Tab state, badges, and selection maps were duplicated and the DOM grew linearly.
3. **Header density** — the header mixed term, reading, frequency, status badge, audio, close, settings, send, quick-add on one row. On narrow viewports (tablet portrait, Android) the row wrapped unpredictably.

## Decision

Redesign the popup IA to a **hybrid chips + expand** layout with a single context-aware toolbar, keeping the existing Shadow DOM + vanilla DOM stack (ADR-038) and reusing tokens from ADR-044.

### D1 — Active entry + candidates split

- The popup body is now: **active entry** (header + definitions, scrollable) → **materials slot** (one toolbar) → **candidates container** (chips + expandable list) → **footer** (Send + Settings — status moved to header row 2).
- The active entry is the only place definitions render. Switching the active candidate replaces the active entry's header + definitions and rebinds the single toolbar to the new candidate's state.
- Candidates are no longer stacked vertically. They appear as **chips** in a horizontal scroll container with an **expand button** pinned to the right. Expanding reveals a **detail list** of the non-active candidates (term + first POS + first definition snippet); collapsing hides it.

### D2 — Single context-aware toolbar

- Exactly **one toolbar** lives in the materials slot, between the active entry and the candidates container. It binds to the **active candidate's** snapshot (definition selection, audio/image selections, translation, active tab).
- `PopupDictionaryState` carries an `activeCandidateIndex` (0 = winner) and a `candidateStates: Map<number, CandidateState>` for appended candidates. `getActiveSnapshot` / `setActiveSnapshot` read/write the right slice; the winner slice lives on the top-level state fields for backward compat with the per-term tab-panel cache.
- When the candidates detail list **expands**, the toolbar **body** (tab panel) collapses via a CSS class on the materials slot (`cell-materials--collapsed`), so the expanded list gets vertical room without pushing the toolbar off-screen. The toolbar **bar** (4 tab buttons) stays visible so the learner can still switch tabs.

### D3 — 2-row header (v3: word + reading-row + second header)

- **Row 1** (`.cell-header__row`): main group (word + reading-row) + actions (Quick Add + Close).
  - **word** (`.cell-header__word-row`): word only, truncates with ellipsis.
  - **reading-row** (`.cell-header__reading`): IPA + audio-group grouped together. When the header is too narrow, the reading-row wraps below the word so the audio buttons stay with the IPA.
  - **audio-group** (`.cell-header__audio-group`): word audio button + sentence audio button, close together. Uses `audioWave` and `messageSquare` icons.
- **Row 2** (`.cell-header__second`): badges (frequency) + status badge, same row. Scroll main axis (`overflow-x: auto`) if badges overflow in the future.
- Status badge is now in the header (cycle on click). Footer holds only Send to Creator + Settings — the "decision" actions (send to SRS, open settings).
- **Audio tab dedup**: the first word audio and first sentence audio are playable from the header buttons, so the Audio tab skips them (`tabWordAudios()` / `tabSentenceAudios()` slice from index 1) to avoid duplication.

### D4 — Candidate chips (scroll-x only)

- Candidates render as a single horizontal scrollable row of chip buttons (`div.cell-candidates__chips-scroll`, `overflow-x: auto`).
- Each chip is a button with the candidate term; the active chip gets `cell-chip--active`.
- No expand button and no detail list — the active entry already shows the full candidate; switching is one chip click.

### D5 — State mutation discipline

- `setActiveSnapshot` mutates the live state object in place (winner fields or `candidateStates` entry) and returns the same reference. This avoids stale-closure bugs where a callback captures an old state object while async work mutates the live one.
- `rerender` reads from the live state, so async tab callbacks (translation, audio fetch) always see the latest data.
- `hidePopup` resets `activeCandidateIndex` and `candidateStates` but **keeps** the per-term tab-panel cache (`cachedResultTerm`, `cachedContextSentence`, `audioItems`, `imageItems`, `translation`) so reopening the same term reuses fetched data.

## Consequences

- **Learner**: comparing candidates is one chip click; the active entry stays prominent; the toolbar always reflects the active candidate.
- **DOM size**: O(1) toolbar instead of O(N). Candidate chips are O(N) but tiny (button + text).
- **State**: one source of truth for the active candidate's mutable state; winner fields remain on the top-level state for cache compat.
- **CSS/Layout**: new BEM blocks `cell-active-entry`, `cell-materials`, `cell-candidates`, `cell-chip`, `cell-toolbar__tab` added to `popupDictionary.css`; all use existing tokens. Container query on `.cell-popup` shows/hides `.cell-label` text for toolbar tabs, Quick Add, and Send to Creator. The materials slot now lives inside `.cell-active-entry` between the header and definitions; when a tab is open `.cell-materials--open` expands to fill the active-entry column and hides the definitions panel until the tab is closed.
- **Tests**: `popupContent.test.ts` and `popupDictionaryController.test.ts` rewritten to cover the new IA (active entry, toolbar slot, chips, footer, single toolbar, active candidate switch). `popupToolbar.test.ts` updated for `cell-toolbar__tab--active` class.
- **Backward compat**: legacy wrappers (`renderCandidate`, `appendCandidateContent`, `getOrCreateCandidateList`, `CandidateCallbacks`) and `toggleCandidatesExpanded` removed — no external callers remained.

## Alternatives considered

- **Variant A (vertical stack, current)**: rejected — active entry loses prominence with 3+ candidates; N toolbars.
- **Variant B (tabs for candidates)**: rejected — tabs conflict with the toolbar tabs (audio/image/translate/links); two tab rows confuse.
- **Variant C (master-detail sidebar)**: rejected — too wide for tablet portrait; popup is constrained to viewport width.
- **Variant D (hybrid chips + expand)**: chosen — keeps active entry prominent, one toolbar, chips are glanceable, expand gives detail when needed.
