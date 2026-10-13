# UI/UX Audit Checklist — Tihoka Design System

System-level audit rubric for any screen, component, or surface in Tihoka.
Every axis cites its **canonical instance** (repo source of truth) and the
external authority it maps to (Nielsen heuristics, WCAG 2.2, Material 3, Apple HIG).

Verified by `inquiry-creativity` (SIFT: NN/g + W3C + M3 + HIG = high;
designsystems.one + Componiq = medium). Grounded in real Tihoka defects:
chevron recolor, invisible menu border, "None" hidden by paint order,
ripple row-collapse, per-option card surfaces, misaligned field edges.

---

## 0. Audit order & evidence rules

Audit **in this order** — layout errors move everything downstream; fixing
hierarchy before layout invalidates later findings.

`tokens → surfaces → layout/spacing → shape → color/emphasis → type →
states → layout-integrity-under-interaction → a11y → motion → edge cases →
screen heuristics → cross-screen diff`

Evidence rules for every finding:

- File `expected vs actual` with values, not adjectives ("border #303030
  on #2D2D2D" not "border too faint").
- Attach pixel evidence (screenshot or computed-style probe), both themes
  when the axis is color/surface.
- Score severity: **2** blocks task or breaks a11y · **1** visible
  inconsistency · **0** nit. Record justified exceptions — a deviation with
  a stated reason is a decision, not a defect.
- Reproduce on the real browser before filing (AGENTS.md rule).

## 1. Tokens & surface grammar

> Canonical: `src/shared/styles/tokens.json` + `STANDARD.md`; field grammar
> = dictionary popup search (`surface-elevated` + `border-subtle` + pill,
> hover `border-emphasized`, focus `shadow-focus`).

- [ ] Token-only — zero hardcoded hex/px/radius in component CSS.
- [ ] Each surface is distinguishable from the layer below **in both
  light and dark** — dark theme relies on surface tint + *real* shadow
  (M3 tonal elevation; dark shadows resolved in `derived.dark`).
- [ ] No nested surfaces unless hierarchy requires it — a card inside a
  card inside a menu is noise (per-option card rows = known defect pattern).
- [ ] Shadow/border use semantic tokens (`surface-popover`,
  `border-emphasized`, `shadow-popover`); a 6%-alpha shadow on dark is
  invisible → defect.
- [ ] Same role → same token everywhere (field, elevated menu, selected
  row each have ONE recipe).
- [ ] **Elevation only goes up — never dig holes**: a child surface must
  be *lighter* (or equal + shadow/border) than its parent, never
  darker. A darker child reads as a hole punched into the card
  (`.profileForm` `#212121` inside an elevated section = defect).
- [ ] **Borderless elevation is the canonical menu grammar** (Google/M3):
  `surface-popover` + a *real* shadow, no border. Border is the
  fallback when shadow alone cannot separate (dense light-theme
  lists), not the default.
- [ ] **Dark-theme shadows must actually resolve**: elevation shadows
  authored at light-theme alpha (<10% black) are invisible on dark —
  defect at the token level. Dark `shadow-popover`/`modal`/`floating`
  need ≥30–50% black; a faint `1px` light inset ring may ride inside
  the same token for edge definition.
- [ ] **Nested interactive surface ≥1 tonal step from its container** —
  a field whose bg equals the menu/card bg is invisible except its
  border; under the borderless grammar the child field uses a filled
  tone (`field-solid`) instead of a border.
- [ ] **Rows must never sink below their card** — list/pending/empty
  rows on an elevated card that use `color-surface*` fills or
  `border-subtle` render as invisible-edged dark holes (defect:
  ImportProgress pending rows, EmptyState `bordered`). Placeholder
  rows reuse the dropzone recipe: `color-field` fill + dashed
  `color-border`; persistent rows use a hairline `color-divider`
  border on transparent.

## 2. Layout, spacing rhythm & alignment

> Canonical: spacing tokens `space-1…space-8`; Apple HIG — controls need
> visible separation; Componiq — spacing must follow a documented system.

- [ ] One rhythm per container: gap/padding/margin drawn from the same
  token family — no lone 11px or arbitrary offsets.
- [ ] **Edge alignment**: inner columns align — a search field inside a
  menu insets to the same left/right edge as the option rows below it.
- [ ] Related items sit closer than unrelated groups (gestalt proximity);
  section gaps > item gaps > inline gaps.
- [ ] Even vertical rhythm: header → control → list → footer follows a
  consistent interval, not per-section improvisation.
- [ ] Grid/inset consistency at every supported width (narrow, zoom 200%,
  mobile sheet).
- [ ] **Coupled-pair gaps have a fixed recipe** — trigger↔expanded-menu,
  label↔field, group-label↔list use one token each, everywhere. A
  floating menu hugs its trigger; an in-flow expansion needs more
  separation (`space-2`) so the boundary reads as a region, not an
  attached strip.

## 3. Shape

> Canonical: `radius-sm/md/lg/xl/pill` tokens; container→item radius
> descends one step.

- [ ] One radius family per component: container `radius-md` → items
  `radius-sm` → field `radius-pill` (dictionary grammar). No free mixing
  of 6/8/10px in one surface.
- [ ] Shape communicates role: pill = field/chip, rounded-rect = panel/
  menu/row. A shape that lies about its role is a defect.

## 4. Color & emphasis (focal hierarchy)

> Canonical: `color-primary`, `primary-subtle`, `text-accent-strong`;
> M3 color roles; Apple HIG — max 1–2 prominent actions per view.

- [ ] **One focal point per view state** — squint test: the thing that
  pops first must be the thing the user acts on next.
- [ ] Emphasis budget: ≤1 focus ring + ≤1 accent surface visible at once;
  competing accents (blue chevron + blue border + blue rows) = noise.
- [ ] **Nested focusables — the deepest element owns the ring**: when an
  open state moves focus into a child (menu opens → search focused),
  the parent trigger must *release* the ring (keep border/bg open cue
  only). Two stacked `shadow-focus` rings = defect, even if each state
  is individually correct.
- [ ] Hierarchy order: selected/primary > interactive affordance >
  decoration. Decorative chrome (chevron, divider, border) never takes
  accent color — accent = state, not ornament.
- [ ] Selected = `primary-subtle` fill + `text-accent-strong` label +
  check/glyph — the recipe exists, do not invent a second one.
- [ ] Accent colors appear only for real state (selected/focus/active/
  destructive) — never decoration.
- [ ] Secondary/supporting content uses `text-secondary`; status meaning
  carried by icon+text, not color alone.

## 5. Typography

> Canonical: `font-size-sm/base/lg` + `font-weight-*` tokens.

- [ ] Sizes only from the type scale; dense lists/rows = `font-size-sm`
  (14px), body = `base` (16px).
- [ ] Consistent hierarchy: label / value / hint / caption each have one
  recipe across screens.
- [ ] Weight differentiates, size rarely jumps inside one component.

## 6. States & feedback

> Canonical: `surface-hover`/`surface-pressed` washes, `shadow-focus`,
> `field-hover`; M3 state layers; Nielsen #1 (visibility of status).

- [ ] Every interactive element defines: rest / hover / focus-visible /
  pressed / selected / disabled / loading / error / empty — no invisible
  states.
- [ ] One state = one signal: focus = `shadow-focus` ring (2px, accent,
  WCAG 2.4.13); hover = `surface-hover` wash; pressed = `surface-pressed`
  or ripple; open ≠ recolor decorative chrome.
- [ ] **Every user action produces feedback** within the frame (press,
  state change, or explicit pending state) — Nielsen #1.
- [ ] Disabled communicates via opacity/non-color cue too, not color only.
- [ ] State signals don't conflict: an open-state style must not fake
  focus when nothing is focused.

## 7. Layout integrity under interaction

> Canonical: `spawnRipple` uses `overflow:clip` (not `hidden`); `.option`
  uses `isolation:isolate` + `::after z-index:-1`.

- [ ] Press/hover/ripple must never change geometry — `overflow:hidden`
  injected on a flex/grid child zeroes its auto min-size → row collapses;
  use `clip`, or `flex-shrink:0` on rows.
- [ ] Overlay paint order: washes/ripples render **under** text
  (`isolation` + `z-index:-1` on the pseudo-element) — a wash painting
  over the label hides it (the "None" bug).
- [ ] Long content has a declared strategy — ellipsis/wrap — never
  overflow or resize siblings.

## 8. Interaction & accessibility

> Canonical: `pushEscapeLayer`, `composedPath` click-outside, Menu arrow
> nav; WCAG 2.2 AA.

- [ ] Semantics: real `<button>`/`<input>`/`<a>` first; correct roles
  (`listbox`/`option`, `menuitem*`, `aria-expanded`, `aria-selected`,
  `aria-pressed` for toggles). Chip toggles = `button` + `aria-pressed`;
  labels = `span`; navigation = `a`.
- [ ] Keyboard complete: open, arrow-nav, Enter, Escape closes topmost
  layer only, focus restores on close; highlighted item scrolls into view.
- [ ] Focus visible and **not obscured** by sticky chrome/overlays
  (WCAG 2.4.11).
- [ ] Target size ≥24×24 CSS px (WCAG 2.5.8 AA); primary controls 40–44px
  (repo `--touch-target` = 40 / HIG 44pt).
- [ ] Contrast ≥4.5:1 text, ≥3:1 large text & focus indicator — both themes.
- [ ] Touch equivalents exist for hover-only affordances; guard
  `hover:hover` media so touch users aren't stranded.
- [ ] Status changes announced (live region / role) where the change
  isn't focus-driven — e.g. "No results" participates in the listbox.

## 9. Motion

> Canonical: `duration-*`/`ease-*` tokens; Button press/release/ripple
> tokens.

- [ ] Animate transform/opacity/color only; durations from tokens;
  direction matches intent (open = rotate chevron, not recolor).
- [ ] `prefers-reduced-motion` honored — no essential information carried
  by animation alone.

## 10. Content, copy & edge cases

> Canonical: i18n via `t()` — audit-text-in-ui skill; language registry
> empty-value pattern.

- [ ] Empty state has content ("No results"), never blank.
- [ ] Empty-value options render their label — `''` ≠ invisible
  (value `''` still needs visible text like "None").
- [ ] Long/short/narrow/zoom-200% variants verified; truncation has a
  declared strategy.
- [ ] Copy in plain language, jargon gets HintIcon (Nielsen #2, #10);
  errors state what happened + how to fix (Nielsen #9).
- [ ] Destructive or hard-to-reverse actions confirm first (Nielsen #5);
  Escape/undo exists for modal flows (Nielsen #3).

## 11. Screen-level heuristics (Nielsen pass)

Second pass, whole-screen, after component axes:

- [ ] #1 Status visible — user always knows what the system just did.
- [ ] #4 Consistency & standards — same action, same control, same
  position across screens; platform conventions kept.
- [ ] #6 Recognition over recall — labeled controls over icon-only;
  state visible, not memorized.
- [ ] #7 Efficiency — keyboard accelerators for repeat actions; dense
  flows (subtitle nav, dictionary lookups) have shortcuts.
- [ ] #8 Aesthetic & minimal — every element earns its place; remove
  before decorating.
- [ ] Response < 3s (AGENTS persona), no layout jank on interaction.

## 12. Cross-screen consistency

> Canonical instance: **dictionary popup** (field/menu/color grammar).

- [ ] Screenshot the target **next to** its canonical sibling (same theme,
  same zoom): if field/menu/row read as different families → defect.
- [ ] Same component family = one visual grammar — sibling components
  (`Select`/`SearchableSelect`, `Menu`/`Popover menu`) must not diverge.
- [ ] No new palette/surface/shape invented locally when an existing
  recipe solves it — a new shade is a token decision, not a component value.

---

## Finding format

```text
[severity 0-2] [axis #] screen/component — expected vs actual + evidence
e.g.: [2] [#7] Settings/select — option row 40px → 18px on press;
      ripple set overflow:hidden on flex child; fixed by clip.
```

## Canonical instances table

| Role | Instance |
|---|---|
| Field/search | dictionary popup searchWrap (`surface-elevated`+`border-subtle`+pill) |
| Elevated menu | `Menu`/`Popover` menu variant + SearchableSelect menu |
| Flat option row | `MenuItem` (`surface-hover` wash, `font-size-sm`) |
| Selected row | `primary-subtle` + `text-accent-strong` + check |
| Toggle chip | `Chip as="button"` + `aria-pressed` |
| Focus signal | `shadow-focus` (2px accent ring) |
| Touch target | `--touch-target` 40px |
| Ripple | `spawnRipple` (`overflow:clip`) |
