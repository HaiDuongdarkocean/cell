# Intent — Subtitle Practice Panel v2

> Confirmed layout and behavior after `interview` + prototype elicitation.
> Confirmed by: explicit restatement by Anh yêu.
> Downstream: `docs/specs/subtitle-panel-practice.md` (v2 revision).

## Elicitation Result — subtitle-practice-panel-v2

- **Problem:** Practice panel (Dictation / Cloze) currently wastes vertical space with a two-row options header, clutters the active cue with `(missing: ...)` token notes and a score stats line, hides everything the user already typed when the cue becomes inactive, and buries speed in a dropdown. The user cannot review their own attempts while continuing the session.
- **User:** Language learner 5–80 years old, core persona 10–25, using Chrome / Edge / Brave, desktop + tablet + Android, in the extension side panel or in-page panel.
- **Current workflow:** Open video → pick Dictation or Cloze from the Practice options → listen → type in the footer input → press `Enter` / `>` to advance to the next cue. The active cue displays color-coded token notes and a percentage score; past cues are masked.
- **Pain point:** (1) Header with two labeled rows (`Practice` + `Speed`) eats space on narrow side panels. (2) Token notes and the score line are noisy and hard to read. (3) Past cues do not show the user's own typed sentence for review. (4) Speed control uses a heavy native-style dropdown. (5) User-created study modes are not reachable from the active practice panel.
- **Evidence:** User walked through the implemented `SubtitlePracticeSession` in Player Mode and Split View and sketched the desired single-row action bar, pill speed, colored word feedback, per-cue history, and Vietnamese shortcut legend.
- **Desired outcome:** A compact top action bar with a pill/circle speed control and all study-mode buttons (presets + user custom). Active cue shows words in blue/green and red + underline only, with no token notes and no stats line. Visited cues become history rows that show the user's typed sentence with the same per-word colors and a translation line below. Footer shows a Vietnamese "PHÍM TẮT" legend with key chips. Bottom control bar `< ↻ input >` stays unchanged and input still fills available space.
- **Constraint:** MV3 extension; reuse existing `CueList`, `SubtitlePracticeSession`, evaluation engine, and study-mode store; no new dependencies; touch targets ≥ 40–44 px; support widths 280–1024 px and heights 360–568 px; horizontal overflow is a release blocker; maintain `role=status` / `aria-live` a11y semantics.
- **Scope (MVP + out-of-scope + method):**
  - **MVP:** New top action bar, speed pill/circle, all study-mode buttons including custom, history rows with typed feedback, translation under history rows, colored word feedback (no notes, no stats), Vietnamese shortcut footer, unchanged bottom input bar.
  - **Not doing:** New practice modes, new algorithms (reuse existing O(n) tokenization / evaluation), persistence of attempts beyond the active session, design-system token or manifest changes, in-panel translation toggle (translation follows global subtitle manager setting).
  - **Method:** `prototype` + `interview`; final layout confirmed by restatement and visual ASCII.

## Confirmed Layout — ASCII

```
┌─────────────────────────────────┐
│ [action bar: speed + study btns]│  ← TOP
├─────────────────────────────────┤
│                                 │
│   list cue (history + active)   │
│                                 │
├─────────────────────────────────┤
│ [ < ] [ ↻ ] [ input    ] [ > ]  │  ← BOTTOM, giữ nguyên
└─────────────────────────────────┘
```

- **Action bar** (one horizontal div): contains speed pill + all study-mode buttons, including user custom modes; horizontally scrollable like mobile settings; on mobile, swipe left/right to reveal; on desktop, two floating arrow buttons at the ends when clipped.
- **Speed pill**: wide state `[ − | 0.75x | + ]` with the number transparent and tappable to open a horizontal speed list; narrow state collapses to a circle the same size as study-mode buttons, showing only the number, still tappable to open the same list.
- **Cue list**: grows in cue order; active cue centered; history rows show the typed sentence with per-word colors; translation appears under every history row, controlled by the subtitle manager setting, never under the active cue.
- **Footer "PHÍM TẮT"**: key chips with Vietnamese labels (e.g., `Ctrl/⌘+R` Phát lại, `Enter` Câu tiếp, `Shift+Enter` Câu trước, `Shift+Space` Tạm dừng).
- **Bottom control bar**: `<` previous, `↻` replay, `input` (flex-filled), `>` next — unchanged.

## Methods used

`interview` / `prototype` combination. Prototype was converged to the ASCII above and confirmed with explicit yes.
