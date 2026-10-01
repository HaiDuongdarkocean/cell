# Verify — subtitle-bulk-status

VERDICT: PASS

Stage: deliver → shipped
Spec: `docs/specs/subtitle-bulk-status.md` (APPROVE_WITH_CHANGES, all fixes applied) · Intent: `docs/intent/subtitle-bulk-status.md` · Design: `docs/intent/subtitle-bulk-status-design-brief.md` + component mapping (design review APPROVE — Concept B "water wash") · Plan: `tasks/plan-subtitle-bulk-status.md`

## Deterministic gates

| Gate | Result | Evidence |
|---|---|---|
| `npm run typecheck` | pass | tsc clean |
| `npm run lint` | pass | eslint clean |
| `npm run test:unit` | pass | 662 suites / 7788 tests; +~205 lines new coverage in `subtitleTokenizeController.test.ts` (selection API, clear-on-cue-change, selected marking) and `CueList.test.tsx` (Ctrl/Cmd-click dispatch, selected class, selection subscribe) |
| `npm run build` | pass | vite build + postbuild CSP patch |
| `check-feature-cycles` / `check-deep-imports` | pass | clean |

## Real-browser verification (Playwright + packed `dist`, Chromium)

`e2e/extension-subtitle-bulk-status.spec.ts` — 4/4 pass (42.9s):

1. **Streaming split-view cue list**: `t` opens split view → cue timestamp click seeks video (split-view AC-2.4 re-verified) → Ctrl-click two terms → `2 selected` announcer text → key `3` applies `tracking` to both → selection auto-clears → plain click still opens the dictionary popup → fresh selection + `Escape` clears.
2. **Streaming overlay block**: tokenized overlay line Ctrl-click selects the token (deep shadow-root query).
3. **Streaming Player Mode**: `g` enters Player Mode → cue-list tokenization active → Ctrl-click selects → `Escape` clears → computed style on the selected token shows `background-image` containing `gradient` (Concept B wash) while an unselected token does not; status underline survives.
4. **Local player**: drag-drop `noop-1s.mp4` + `test-video.en.srt` → overlay + panel both tokenized → Ctrl-click two cue-list terms → key `3` → `known`-count check → overlay selection + `Escape` → editable `OverlayPreview` confirmed not tokenized.

Pixel evidence (Concept B wash visible, underline preserved):
- `tmp/subtitle-bulk-status/cue-list-selected.png`
- `tmp/subtitle-bulk-status/local-selected.png`
- `tmp/subtitle-bulk-status/player-mode-selected.png`
- `tmp/subtitle-bulk-status/player-mode-selected-zoom.png` (zoomed token — wash + red `unknown` underline coexist)

## Requirement traceability

- Ctrl/Cmd-click toggles membership in the shared `selectedTerms` set on every required surface — overlay block, split-view panel, Player Mode, local-player overlay + cue list (all five verified e2e).
- Keys `1–4` apply the status to every selected term and clear the selection afterward (`statusKeyControls` reads `selectedTerms` before hover/native-selection fallback).
- `Escape` clears selection; plain click opens the dictionary popup; an open popup keeps priority for status keys (`getPopupStatusTarget` unchanged, first in the priority chain).
- Selection clears on active-cue change (`render` index-change guard) and on `setCues`.
- Concept B visual: `js-cell-token--selected` → `background-image` `linear-gradient(color-mix(--color-primary 18%))` layered so underline/frequency remain visible — asserted via computed style, not just class presence.
- Accessibility: `#cell-token-selection-announcer` (`role=status`, `aria-live=polite`, visually hidden) announces localized count/cleared via `tokenize.selection.count` / `tokenize.selection.cleared` (en+vi).

## Split-view AC re-verification

`docs/specs/subtitle-split-view-ac.md` re-checked against the diff: `t` toggle clean open/close, full cue list inside panel ShadowRoot, cue click → seek (asserted in test 1), Player Mode transition intact (`t` inside Player Mode toggles the PM cue list, no stray wrapper), panel resize untouched.

## Known quirks (documented, not defects)

- Host-page layout on the mock streaming page can occlude token click points — e2e uses composed `dispatchEvent` clicks on those surfaces, which still exercise the real token handler and modifier path.
- Duplicate occurrences of one term render multiple selected DOM nodes — selection semantics are term-based (`Set`), verified via unique-term assertions.
