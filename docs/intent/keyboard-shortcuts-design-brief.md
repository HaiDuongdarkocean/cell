# Keyboard Shortcuts — Design Brief

> ⚠️ **Superseded note (2026-09-08):** Tài liệu này tham chiếu Liquid Glass / glass material / blur — vật liệu này đã bị loại khỏi Cell. Luật thiết kế hiện hành: `docs/design-system/DESIGN_RATIONALE.md`; checklist: `docs/design-system/DESIGN.md`. Nội dung yêu cầu tính năng trong tài liệu vẫn hiệu lực; chỉ các mô tả visual kiểu glass/blur không còn áp dụng.

## Design Read
The shipped `Keyboard Shortcuts` card renders actions as a **label/pill grid**: label above the pill, 1 column on mobile, 2 columns on desktop.
The association between a label and its pill is weak when label lengths differ, the
uppercase group headers fade into the background, and there is **no conflict detection**
or **empty-state guidance**. The `ShortcutInput` atom is well-built (single key + combo
support), but the surrounding layout is a bare inventory, not a navigable control surface.

## Primary job
Let a language learner (age 5–80) see which keys drive subtitle actions and change them
without reading the whole list, on desktop and Android.

## 3 dials (defaults)
- DESIGN_VARIANCE: 5 — keep the same data/atom, rethink the surface.
- MOTION_INTENSITY: 3 — only layout transitions and a pressed/active flash; honors `prefers-reduced-motion`.
- VISUAL_DENSITY: 6 — one glance at the card must reveal all assigned keys and any conflicts.

## Inspiration anchor
A calm studio mixer: every action has its own fader, labels are vertical, the active
channels glow softly, and nothing shouts. The liquid-glass world of Cell — water, sky,
pebbles — means the surface should feel transparent, gentle, and responsive.

> Context quote: *"tôi muốn liquic glass sẽ là design system style, màu chủ đạo là màu
> xanh dương của bầu trời, tiếp đó là màu xanh lá của cây, trong suốt của nước... yên
> bình, nhẹ nhàng, lả lướt."* — `docs/context/project-context.md`

## Concepts

### Concept A — Refined List (conservative)
- **IA mental model:** one vertical list of action rows, grouped by category. The shortcut
  is a first-class value to the right of the label; groups are readable headers, not dividers.
- **UX flow:** scroll the list → tap/click a row → `ShortcutInput` records the next keypress
  → a conflict dot appears if that key is already used → tap again to clear.
- **UI structure:** `Card` header → `VStack` groups → group header + `SettingsRow`-like rows
  with label + `ShortcutInput`. Mobile is a single column; desktop uses a 2-column grid of
  rows so the card stays compact while preserving label↔pill alignment.
- **3 dials:** VARIANCE 2, MOTION 2, DENSITY 5
- **Why it fits:** minimal learning curve; fixes the scanning problem and adds conflict
  feedback while reusing the existing `ShortcutInput` atom.
- **Risk:** still a list; as more actions are added, the card grows tall and the
  two-column grid may feel cramped below 360 px.
- **Audit findings:** N/A.

### Concept B — Keyboard Map (hybrid)
- **IA mental model:** the keyboard itself is the map. Each key shows the action bound to it;
  unassigned keys stay dim. Combos live in a separate list below the map.
- **UX flow:** type in the search bar to filter actions → the matching key(s) highlight on
  the map → click a key to record/clear → group filter chips (Navigation / Toggle / Generate
  / Card Creator) narrow the view.
- **UI structure:** search `Input` + filter chips → compact QWERTY grid (keycap size scales
  with viewport; on mobile the grid scrolls horizontally or collapses to a focused row) →
  action badge per assigned key → a compact list of combo shortcuts below.
- **3 dials:** VARIANCE 6, MOTION 3, DENSITY 7
- **Why it fits:** spatial memory — users remember *where* a key is, not *which* list row.
  Conflicts are immediately visible (two badges on one key). The search/filter pattern is
  familiar from the rest of Cell.
- **Risk:** a full keyboard map does not fit a 320 px phone width without horizontal scroll;
  combos are harder to represent on a single keycap.
- **Audit findings:** N/A.

### Concept C — Action Lanes (experimental)
- **IA mental model:** actions are horizontal lanes grouped by category; the assigned key
  is a floating "bead" that can be clicked to record or dragged to a key rail.
- **UX flow:** tap a lane header to collapse/expand a category → tap an unassigned action
  to enter record mode (the bead glows) → press a key → the bead snaps to that key's rail.
  Conflicts push the previous bead back to "unassigned".
- **UI structure:** group lanes stacked vertically; each lane shows a row of action labels
  with their beads aligned against a horizontal "key ruler" (A–Z + common symbols). Mobile
  stacks lanes and turns the ruler into a vertical column; desktop shows the full ruler
  with floating beads.
- **3 dials:** VARIANCE 9, MOTION 7, DENSITY 6
- **Why it fits:** turns a settings table into a tactile control surface; the liquid-glass
  "water droplet" bead fits the project's nature metaphor and motion language.
- **Risk:** high interaction cost for simple changes; drag/click ambiguity; accessibility
  of the bead/ruler pattern needs careful ARIA roles; may be over-engineered for 10 actions.
- **Audit findings:** N/A.

### Concept D — Two-Pane Editor (conservative)
- **IA mental model:** master–detail. Left pane lists actions by group; right pane is a live
  mini-keyboard. Pick an action, then press or click a key to assign it.
- **UX flow:** click an action in the left list → it highlights on the left and its current
  key highlights on the right → press a key (or click the keycap) → the binding updates,
  conflicts shown instantly. Mobile stacks the panes vertically.
- **UI structure:** split card body: left `ActionList` (groups + rows) + right `KeyPad` (QWERTY
  keycaps). The selected action row gets a `var(--color-primary-subtle)` background; the
  active keycap gets a `var(--color-primary)` border.
- **3 dials:** VARIANCE 5, MOTION 2, DENSITY 6
- **Why it fits:** preserves the scannability of a list while adding the spatial clarity of
  a keyboard; the two-pane pattern is familiar from IDEs and MIDI controllers.
- **Risk:** right pane needs horizontal space; below 360 px the keyboard becomes a scrollable
  row, which weakens the spatial benefit.
- **Audit findings:** N/A.

### Concept E — Press-First Recorder (hybrid)
- **IA mental model:** key-first, then action. Instead of choosing an action then pressing a
  key, the user presses a key first, then picks which action it should drive.
- **UX flow:** click the large "Press a key" capture area → press a key → the area shows the
  captured key and a conflict summary → the action list below filters to show (a) actions
  already using that key and (b) all other actions you can assign it to. Click an action to
  bind, or click the conflicted action to rebind it.
- **UI structure:** hero capture card on top (shows current captured key, combo support,
  conflict status) → filterable action list below. Mobile keeps the same vertical flow.
- **3 dials:** VARIANCE 7, MOTION 3, DENSITY 6
- **Why it fits:** flips the mental model from "find the action" to "find the key" — natural
  when the user already knows which physical key they want to use. Also makes free/unused
  keys immediately visible.
- **Risk:** if the user wants to edit a specific action, they must first guess or search its
  current key; the search field mitigates this.
- **Audit findings:** N/A.

### Concept F — Bento Cards (experimental)
- **IA mental model:** a dashboard of action tiles. Each tile is a first-class object with
  label, group tint, and shortcut. The user clicks a tile to record.
- **UX flow:** scan the bento grid → click a tile (it expands or enters record mode) → press
  the new key → the tile updates and neighboring tiles dim if the key is taken. Mobile
  becomes a single-column stack of the same tiles.
- **UI structure:** CSS grid of `Card` tiles (2 columns mobile → 4 columns desktop). Each tile
  has a top accent stripe by group, label, and a large `ShortcutInput` / `Kbd` pill. Empty
  tiles show a dashed "Press key" placeholder.
- **3 dials:** VARIANCE 8, MOTION 4, DENSITY 7
- **Why it fits:** breaks the long list into glanceable, touch-friendly tiles; the group tint
  and large key pill fit the liquid-glass card language used in other Cell settings.
- **Risk:** more vertical scrolling than a list; tiles can feel heavy if the action count
  grows beyond ~12.
- **Audit findings:** N/A.

## Responsive behavior

| Viewport | A · Refined List | B · Keyboard Map | C · Action Lanes | D · Two-Pane | E · Press-First | F · Bento |
|----------|------------------|------------------|------------------|--------------|----------------|-----------|
| **320 px** | Single-column list; groups stack; pill full-width. | Keyboard row scrolls horizontally; combos as vertical list. | Lanes stack; beads at key positions; ruler hidden or one-column. | Panes stack; keyboard row below action list. | Capture area full-width; action list single column. | Single-column tiles; 1 tile per row. |
| **768 px** | Two-column row grid; group headers span. | Full QWERTY grid; combo list 2 columns. | Lanes expand; ruler visible; beads align. | Side-by-side panes; keyboard 60 % width. | Same as 320; two-column action list. | 2-column bento grid. |
| **1280 px** | Same as 768; more whitespace. | Grid with hover lift; filter chips in one row. | Full ruler with bead glow. | Panes with more padding; keycap hover lift. | Same as 768; capture area larger. | 3-column bento grid. |
| **1920 px** | Centered max-width card; no layout fork. | Grid scales slightly. | Lanes can show all groups. | Panes stay side-by-side; no fork. | Same as 1280. | 4-column bento grid. |

## States
- **default** — current binding shown, no conflict.
- **hover** — row/key/lane background lifts to `var(--color-surface-hover)`.
- **focus-visible** — `var(--shadow-focus)` ring on the actionable element.
- **active / recording** — the target flashes `var(--color-primary-subtle)` and waits for the
  next keypress.
- **unassigned / empty** — pill shows a subtle placeholder hint (e.g. "—" or "Press key").
- **conflict** — the duplicated binding gets a `var(--color-destructive)` dot and a tooltip.
- **disabled / reduced-motion** — transitions removed, no flash, instant state change.

## Anti-patterns avoided
- No three color/style-only variations of the same list — each concept uses a different IA.
- No static image or artboard — every concept is interactive in the mockup.
- No skipping the real production panel — the shipped `ShortcutInput` card is mounted live.
- No hardcoded colors, px, or M3 tokens — everything uses `tokens.css`.
- No mobile-afterthought — 320 px is the default viewport in the mockup.

## Mockup
`src/entrypoints/mockup-keyboard-shortcuts/` — Real panel + Concept A/B/C/D/E/F, with concept,
viewport, and theme switchers.
