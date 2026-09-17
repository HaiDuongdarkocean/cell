# Intent — `cue-difficulty-map`

> Backlog #5 · Source: lingq + internal-audit · Cost: S · Value: ★★★
> Confirmed frame: inferred (autonomous elicitation — `idea-pick-off` zero-questions mode)

## Pain (seed)

> Cue nào dễ/khó không thấy — seek mò; heat per-cue để nhảy tới đoạn i+1

## 8-field frame

1. **Problem**: Cue-level difficulty is invisible in the subtitle list. Token underlines show word-level status, but nothing summarizes a cue's difficulty at a glance. To find i+1 content the user must either read every cue's underlines or engage the cue filter — which hides all non-matching cues and loses surrounding context.
2. **User**: Immersion learner browsing the cue list on any SubtitlePanel surface (Split View, Player Mode, side panel, local player) looking for a good spot to rewatch or practice.
3. **Current workflow**: Scroll the list and eyeball token underlines per cue; or open the cue-filter FAB and pick i+1 — which removes every other cue from view.
4. **Pain**: Seeking is blind. i+1 "sweet spots" and dense clusters look identical until inspected, so the user guesses or loses the surrounding-cue context by filtering.
5. **Evidence**: `cueDifficultyMap` (backlog #4, shipped `763c8a75`) already computes `{strange, tracking}` per cue at metadata resolve — the heat data exists for free. LingQ's word-level difficulty coloring and Migaku's 1T marking validate surfacing difficulty in the reading surface.
6. **Desired outcome**: Every cue row carries a subtle ambient heat indicator — the user glances at the list, spots the easy/i+1/dense bands, and clicks the cue timestamp to seek directly. Zero interaction, zero new data fetch.
7. **Constraint**: Reuse the `difficulties` map (no new fetch, no new pipeline); show only under the same eligibility gate as the filter FAB (`cueFilterEnabled`) so heat never claims difficulty data the product considers untrustworthy; design tokens only — reuse the token-status color vocabulary (green/amber/red); non-color accessibility channel mandatory; works on every CueList surface and both cueListWrap branches; must not fight the current-cue highlight or token underlines.
8. **Scope**: Per-cue heat indicator in `CueList` + band semantics in `cueDifficulty` + tooltip/screen-reader text + i18n en/vi + tests. **Out**: video timeline/progress-bar heat strip (different surface, bigger scope), difficulty sorting, practice-mode display, user-configurable band thresholds.

## Design decisions (autonomous)

- **Form**: a thin vertical heat bar on the cue row's left edge — `data-heat` + dedicated span so it can carry a `title` tooltip. Ambient, scannable as a column, doesn't change layout or compete with cue text.
- **Bands** (from `CueDifficulty.strange` — already unknown+tracking under the freq gate, same semantics as the FAB): `0 → easy`, `1–2 → i1`, `≥3 → dense`. Three bands map to the existing token-status colors: known-green / tracking-amber / unknown-red — a temperature metaphor the user already reads on word underlines.
- **Eligibility**: `cueFilterEnabled` gate — tokenize on, not zh-suppressed, not practice, not blurred, resolved non-empty difficulties. No heat when the data isn't trustworthy; consistent mental model with the FAB.
- **Interaction**: none required — the heat is ambient; the existing timestamp button already seeks. `title` tooltip gives the strange-word count on hover; `VisuallyHidden` span gives screen readers the same count.
- **Missing data**: cue absent from the map (empty text, unresolved) → no `data-heat`, no bar — never fabricate a band.
