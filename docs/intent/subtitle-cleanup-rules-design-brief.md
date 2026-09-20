# Subtitle Cleanup Rules — Design Brief

> Spec: `docs/specs/subtitle-cleanup-rules.md` · Mode: `all` (autonomous — single justified variant) · ui_surface: yes

## Design Read

The shipped Advanced card is a calm stack of labeled chip-rows and checkboxes inside one `Card`. The feature replaces the single "Remove text in brackets" checkbox with a **manageable rule set** (10 built-ins + user customs) plus a new numeric setting (`cueLeadInMs`). The risk to avoid: a regex-management UI that looks like a developer console inside a learner-facing settings card.

## Function audit (spec → UI)

| Function (spec) | REQ | UI element needed |
|---|---|---|
| List resolved rules, built-ins first | REQ-1.1 | Rule rows inside Advanced card |
| Toggle each rule | REQ-1.2 | Per-row `Toggle` |
| Show name + description + pattern | REQ-1.1, REQ-5 | Row text + mono pattern line |
| Add custom rule | REQ-1.3 | "Add rule" button → editor dialog |
| Edit / delete custom rule | REQ-1.4 | Per-row ghost buttons + confirm dialog |
| Validate pattern / name | REQ-1 exception | Inline error text in editor |
| Built-ins locked from edit/delete | REQ-1 rules | No action buttons on built-in rows |
| Set `cueLeadInMs` 0–2000 step 50 | REQ-8.1 | Slider row with ms value |
| Legend shows `Ctrl` for replay | REQ-6.2 | `Kbd` label in practice footer |
| Full-width answer input | REQ-7 | CSS deletion — no element |

## Journey (TO-BE, from intent doc)

1. Learner opens Study Modes → Advanced → sees "Subtitle cleanup" group with the rule list.
2. Toggles a built-in off → subtitles re-clean everywhere.
3. Adds a custom rule (name, description, regex) → saved, applied.
4. Edits/deletes a custom rule → confirm → applied.
5. Sets "Replay lead-in" slider → replays land earlier.
6. In practice, taps `Ctrl` → cue replays; answer field spans the row.

## Primary job

Let a learner decide **which non-spoken annotations disappear from subtitles** — glance the rules, flip them, add their own — without leaving the settings mental model they already know (toggles, list rows, dialogs).

## 3 dials

- DESIGN_VARIANCE: 3 — same card, same row grammar as the rest of Advanced; the only new furniture is a list of rules and a slider.
- MOTION_INTENSITY: 1 — existing `Dialog`/toggle transitions only; honors `prefers-reduced-motion`.
- VISUAL_DENSITY: 4 — built-ins collapse to name + one-line description; pattern shown in mono so it reads as data, not prose.

## Chosen variant — "Rule list rows" (justified)

A settings-card-consistent list: each rule is a row (`Toggle` + name + description + pattern in `Code`), custom rows carry `Edit`/`Delete` ghost buttons, "Add rule" opens a `Dialog` form (`FormGroup` fields), delete uses the same confirm `Dialog` as custom modes. `cueLeadInMs` is a `SliderRow` under the group.

**Why this and not alternatives:** an accordion-per-rule ( expandable rows) adds a disclosure layer for data already short enough to scan; a separate "Rules manager" page/sheet breaks the Advanced card's single-surface convention and over-builds for ≤50 rows. The list-rows variant is the smallest structure that expresses order, state, and ownership (built-in vs custom) at once.

## Layout sketch

```
Advanced (Card)
┌─────────────────────────────────────────────────────┐
│ Skip when there is no dialogue      [chip row]      │
│ ─────────────────────────────────────────────────── │
│ SUBTITLE CLEANUP                          [+ Add]   │
│ Remove annotations that aren't spoken, in order.    │
│ ┌─────────────────────────────────────────────────┐ │
│ │ ●──o  HTML tags            <[^>]+>               │ │
│ │ ●──o  Brackets ( ) [ ] { }  \(…\)|\[…\]|\{…\}   │ │
│ │ ●──o  Speaker labels       ^-?NAME:              │ │
│ │  …   (built-ins, toggle only)                    │ │
│ │ ─── custom ────────────────────────────────────  │ │
│ │ ●──o  Netflix credits      \[.*\]   [Edit][Del]  │ │
│ └─────────────────────────────────────────────────┘ │
│ ─────────────────────────────────────────────────── │
│ 🕐 Replay lead-in                       [slider] 300ms│
│    Start replays slightly before the cue.           │
│ ─────────────────────────────────────────────────── │
│ Pause when a cue has an unknown word  [chip row]    │
└─────────────────────────────────────────────────────┘

Add/Edit rule (Dialog)                Delete rule (Dialog)
┌───────────────────────────┐        ┌──────────────────────┐
│ New cleanup rule          │        │ Delete rule?         │
│ Name        [__________]  │        │ "Netflix credits"    │
│ Description [__________]  │        │ cannot be undone.    │
│ Regex       [__________]  │        │    [Cancel] [Delete] │
│ ⚠ invalid pattern         │        └──────────────────────┘
│        [Cancel] [Save]    │
└───────────────────────────┘

Practice footer (existing layout, legend only)
[↺ Replay]  Ctrl        — answer input now spans full row width
```

## Responsive behavior

| Viewport | Behavior |
|---|---|
| 320 px | Rule rows stack: toggle left, name/desc/pattern right, actions wrap under; Add button keeps ≥44px target; slider full width. |
| 768 px | Same card widens; pattern truncates with ellipsis, not wrap. |
| 1280 px+ | No fork — card already capped by side-panel width. |

## States

- **default** — toggle reflects persisted enabled state; custom rows show Edit/Delete; built-ins don't.
- **empty customs** — no "custom" divider; list ends after built-ins; Add stays.
- **error** — editor dialog shows inline error (invalid regex, empty/duplicate name, caps hit); Save disabled until valid.
- **disabled** — rule toggle off → row text stays readable (toggle state communicates, no dimming of the row).
- **focus-visible** — `--color-border-focus` outline on toggle/buttons/dialog fields.
- **reduced-motion** — dialog appears without transition.

## Anti-patterns avoided

- No new components — every element maps to `src/shared/ui` atoms or existing feature patterns (mode-row edit/delete, dialog confirm).
- No developer-console styling — pattern is `Code`-styled data, not a terminal block.
- No hardcoded tokens — everything via `var(--*)`.
- No scope pixels — legend change reuses existing `Kbd`; input width is a CSS deletion.

## Mockup

`src/entrypoints/mockup-subtitle-cleanup-rules/` — real Advanced card + the variant, with viewport + theme switchers. `http://localhost:5173/src/entrypoints/mockup-subtitle-cleanup-rules/`
