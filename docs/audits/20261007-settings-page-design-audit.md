# Settings Page (Universal Panel) — Design Audit & Redesign Plan

> Date: 2026-10-07 · Surface: Universal Panel → Settings tab (13 section cards)
> Evidence: user screenshots (6, dark/Dawn palette) + live measurements on Brave `:9224` (`tmp/debug-brave-agent/measure-settings*.mjs`), viewport 1064×900 → panel 804×793 / content column 762px
> Standard: `docs/design-system/DESIGN.md`, `src/shared/styles/STANDARD.md`, `tokens.json`, persona 5–80 any device
> Stance: adversarial designer review — assume the current state will cost money in support, rework and churn.

## 1. Measured ground truth

| Thing | Measured | Token that should own it |
|---|---|---|
| Section cards | 13 cards, content column 762px, total scroll ≈ **6500px** | — |
| Card background | `srgb 0.178353` (#2D2D2D) | `color-surface-card` |
| Card radius | **8px** | `--radius-card` = **12px** (not used) |
| Card padding | **8px 8px 0** (`space-2`) | `space-4` (16) / `space-5` (20) |
| Gap between cards | **12px** (`space-3`) | `space-3`–`space-4` |
| Title → desc gap | **4px** (`space-1`) | `space-1`/`space-2` |
| Desc → first row | **8px** (`space-2`) | `space-3` |
| Section title | 18px / 600 / #F1F1F1 / lh 1.2 | `font-size-lg`, `font-weight-semibold` |
| Section description | **12px** / 400 / #AAAAAA / lh 1.3 | `font-size-xs` (should be `sm` 14) |
| Row label | 14px / 500 / #F1F1F1 | `font-size-sm`, `font-weight-medium` |
| Row min-height | **40px**, vertical padding **0**, gap 8px | `touch-target` 40/44 |
| Micro label ("top ≤") | **10px** muted | below the 12px floor |
| Every control height | **40px** (chips, keycaps, inputs, selects, toggles) | `element-lg`; `element-sm` 28 / `element-md` 32 unused |
| Radius of almost every control | **9999px (pill)** | `radius-lg` 8 / `radius-md` 6 / `radius-pill` (badges only) |
| Theme mode cards | 177×69, radius **8**, `role=radio` | `radius-card`/`lg` |
| Keycap "buttons" | **272.9 × 40 pills**, 14px/600 centered, 2-col grid, gap 8 | should be a compact key |
| Frequency number inputs | **120×40 pills**, padding 6/10 | `radius-lg`, width ~96 |
| Resource component chips | 40px tall, 12px/500, padding `2px 8px`, pill | `element-sm/md`, `radius-lg` |
| Chip ON | `primary-subtle` bg + `color-text-accent` fg | ✅ recipe exists |
| Chip OFF | **transparent bg, #F1F1F1 fg** — loses its shape | must keep surface + border |
| Toggle | 40×40 pill, `#6AB2F5` | ✅ |
| Description contrast | #AAA on #2D2D2D ≈ **5.9:1** (AA pass, AAA fail, at 12px) | `color-text-secondary` |
| Sticky elements | only the settings nav row (`z-index 1100`) | ✅ |

## 2. Executive read — six root causes

1. **One visual weight for everything.** 13 identical cards, identical title style, identical padding, 6500px of scroll. Frequent settings (Subtitles, Dictionary popup) and rare ones (Keyboard Shortcuts, Downloads, Sync) are indistinguishable; there is no scan path.
2. **No row grammar.** The same card mixes *inline-control* rows (label left, toggle right) with *stacked-control* rows (label line, full-width select below), and mixes inline value text with below-label descriptions. The user cannot learn one row pattern.
3. **Accidental shape language.** Cards 8px, theme tiles 8px, everything else a 9999px pill — chips, selects, numeric inputs, keycaps, the dictionary search field. Radius carries no meaning; two competing languages coexist.
4. **Primary color has ~7 jobs** (toggle ON, selected chip, selected tile, links, filled buttons, numbered badges, focus ring) while genuine primary actions (Add resource, Connect account, Add link) render neutral/outline. Emphasis is inverted: nothing ranks.
5. **Spacing is under-scaled at the container level and over-scaled at the control level.** 8px card padding around 18px headings (title nearly touches the border) while every text-only control is 40px tall with 2px/8px inner padding. The system's own scale (8/12/16/24 + element-sm/md/lg) is available and unused.
6. **Descriptions are too small and too loud at once.** 12px muted copy (below the 14px body size) used for explanations, inline values ("everyday words", "Native: Tiếng Việt", URL templates) and micro-labels — three different meanings share one weak style, so real values read as disabled.

## 3. Findings by axis

### 3.1 Hierarchy & information architecture

| ID | Finding | Evidence |
|---|---|---|
| H-1 | **Resources card has two headers for one idea**: section title "Resources" + "Dictionaries and frequency lists for lookup." then a second heading "Resources" + "Dictionaries and frequency lists in one place." | measured sub-header node at y=666; screenshot 1 |
| H-2 | 13 flat sections, no grouping, no frequency ordering; profile-scoped and app-scoped settings interleaved | 13 cards measured; "Show readings" (per-profile per spec) lives in the app-level **Subtitles** card |
| H-3 | **"Dictionary popup" toggle sits in General** although a whole Dictionary Popup section exists | screenshot 1; `SettingsDialogContent` General block |
| H-4 | Same job rendered two ways: Theme "Mode" = 177×69 radio cards; Audio "Output mode" = pill row. Both are pick-one-of-N | measurements + screenshots 3, 5 |
| H-5 | Dictionary Popup invents numbered step badges (1/2/3) — no other card uses them; the section title also carries a hint icon while Media does not | screenshot 2 |
| H-6 | Duplicate action in one card: "Sync now" in the Sync header *and* "Sync now" in the last row | screenshot 6; rows measured at y=6304 / 6406 |
| H-7 | Nav label "Dictionary popup" vs card title "Dictionary Popup" — casing drift inside one surface | nav source vs measured title |
| H-8 | **CONFIRMED — Settings mounts a second dictionary panel.** `SettingsDialogContent.tsx:352-359` passes `lookupPanel={<Dictionary variant="integrated" isOpen={false}/>}` and `ResourcesPanel.tsx:860-862` renders it in `aside.lookupColumn`. That column is a sticky 360px right column only at `@container (min-width: 860px)` (`ResourcesPanel.module.css:31-45`); below that it stacks **under** the resources list. Measured with the Settings tab active: 771×227 block rendering the dictionary search + "Ready when you are" empty state inside the Resources card, and the document has **two** elements with `id="dictionary-panel-search-input"` (duplicate id) | live probe on Brave :9223 + :9224; user screenshot 1 |

### 3.2 Spacing & proximity

| ID | Finding |
|---|---|
| S-1 | Card padding **8px** around 18px headings → title touches the container edge; every other system surface uses 16–20 |
| S-2 | Card padding (8) < card gap (12): internal content is not clearly "closer" than external separation, so cards read as tight boxes floating in space |
| S-3 | Row vertical padding **0** with 40px min-height; consecutive toggle rows rely on hairline dividers to separate — divider inset/alignment differs from the label column |
| S-4 | Group labels exist only in Downloads ("Speed", "Format & quality", "File naming") — other multi-group cards (Audio, Dictionary Popup, Resources) use ad-hoc spacing instead |
| S-5 | 4px title→desc, 8px desc→row, 8px row gap, 12px card gap, 8px card padding: five different proximity steps inside one screen, none of them semantic |
| S-6 | Oversized empty regions: Word badge preview ~130px tall for a 20px dot; OCR-style blank in Resources below the drop zone |

### 3.3 Shape

| ID | Finding |
|---|---|
| SH-1 | Two competing languages: **8px** (cards, theme tiles, settings nav chips) vs **9999px** (selects, chips, numeric inputs, keycaps, search field, toggle) |
| SH-2 | `--radius-card` (12) exists and is bypassed by every card (8) |
| SH-3 | Keycaps are 272.9×40 pills with centered text — shape says "button", not "key"; combos (`Ctrl Shift T`) are one pill with a stray blue circle around "T" |
| SH-4 | Numeric threshold inputs are 120×40 pills; the "top ≤" prefix is 10px text outside the control, so label and value are not bound |
| SH-5 | Off-state chips (transparent, no border) lose their shape entirely → invisible hit area, invisible group membership |

### 3.4 Color & contrast

| ID | Finding |
|---|---|
| C-1 | Primary blue carries ~7 meanings (toggle, selected chip, selected tile, link, filled button, numbered badge, focus ring) — no ranking left for real emphasis |
| C-2 | Genuine primary actions are neutral: "Add resource" (dashed box), "+ Connect another account" (outline), "+ Add link" (outline) — inverted emphasis vs "Choose package folder…" (filled) |
| C-3 | Muted #AAA used for descriptions **and** real values (thresholds' "top ≤", "Native: Tiếng Việt", URL templates) → values read as disabled |
| C-4 | Status semantics missing: Sync shows "0 changed, **35 errors**" in the same neutral style as success; the "Protected" green dot competes with the header action |
| C-5 | Selected states are all `primary-subtle` (0.12 alpha) — at Dawn palette the tint is nearly indistinguishable from `surface-hover`, so "selected" vs "hover" is a coin flip in screenshots |

### 3.5 Typography

| ID | Finding |
|---|---|
| T-1 | Five sizes in one surface (10 / 12 / 14 / 18 / 24px) with no role mapping; 10px falls below the system floor |
| T-2 | Description (12) is **smaller than** row label (14) and equal to chip label (12) — hierarchy of explanation vs control vs value is flat |
| T-3 | Line-height: desc 1.3 while the token set defines `snug 1.3` / `normal 1.5` — long descriptions (Sync paragraph, 3 lines) run tight |
| T-4 | Casing drift (H-7) and inconsistent label nouns ("Button size" vs "Pointer scale" vs "Autoplay" with a bare number `0`) |
| T-5 | No tracking use on the micro/uppercase-ish group labels → they read as body text at small size |

### 3.6 Behavior & interaction

| ID | Finding |
|---|---|
| B-1 | Audio "Output mode" has no visible container — the selected item is a subtle tint on transparent, so at a glance the control looks unset (screenshot 3) |
| B-2 | Row click target: only the control/label wiring is guaranteed; rows are 40px with 0 padding — verify whole-row activation for toggles/selects |
| B-3 | `Autoplay` renders a select whose value is `0` with no unit or context |
| B-4 | Sliders (Button size, Pointer scale) put the value far right of the track; no live numeric input, no step ticks |
| B-5 | Downloads' open select menu (screenshot 4) overlaps the row below with a surface/radius that does not match the trigger control |
| B-6 | Sync "Bridge add-on" row: status text ("Unknown") sits at the right edge and appears clipped in the screenshot — verify truncation |
| B-7 | Keyboard shortcuts: 14 full-width pills create a 211px-tall wall for low-priority content |

## 4. Target system (the rules to implement)

### 4.1 Spacing grammar
```
card padding          16px (space-4)         ← from 8
card radius           var(--radius-card) 12  ← from 8
gap between cards     16px (space-4)
section title→desc    4px
desc→body             12px (space-3)
body→group label      20px (space-5)
group label→rows      8px  (space-2)
row padding-block     8px  (space-2), min-height 40 (44 coarse)
row→row               0 + divider (inset to content edge)
control gap           8px
```

### 4.2 Shape rules (meaningful radius)
| Element class | Radius |
|---|---|
| Container (card, panel section) | `radius-card` 12 |
| Interactive control (select, input, chip, segmented item, keycap) | `radius-lg` 8 |
| Small inline control (badge-like chip, icon button) | `radius-md` 6 |
| Status badge, avatar, toggle | `radius-pill` |

### 4.3 Type roles
| Role | Spec |
|---|---|
| Section title | 18 / 600 / primary |
| Section description | 14 / 400 / secondary, lh 1.5, max 2 lines |
| Group label | 12 / 600 / secondary, tracking wide |
| Row label | 14 / 500 / primary |
| Row value / inline hint | 14 / 400 / secondary |
| Meta (timestamps, counts) | 12 / 400 / tertiary |
| Micro | **removed** — no 10px in settings |

### 4.4 Color roles
- **Primary** reserved for: one primary action per card header, selected state, focus ring.
- **Selected recipe (single)**: `primary-subtle` bg + `color-text-accent` text + 1px `color-primary` @ 40% border. **Off recipe**: `color-surface-hover` bg + secondary text + transparent border — shape never disappears.
- **Value text** (thresholds, port, templates) uses primary text or a code style, never muted.
- **Status**: success/warn/error tokens drive the Sync line; the status owns color, not the button.
- **Section action slot**: top-right of the card header for "Change", "New profile", "Add link", "Sync now" — one place, one style (secondary), never floating mid-card.

### 4.5 Component recipes (one job → one recipe)
| Job | Recipe | Replaces |
|---|---|---|
| Pick one of N | Choice group: visible track container (`surface-hover`), items `radius-lg`, selected = recipe above | Audio output mode pills, Theme 177×69 tiles, Dictionary popup step chips |
| Multi-select components | Same chip recipe + ON/OFF recipes from 4.4 | Resource component chips (transparent OFF) |
| Keycap | 32×32 min, `radius-md`, mono 14/600, `surface-hover`; combos = separate keycaps joined by "+" | 272.9×40 pills |
| Numeric value | 96px, right-aligned, `radius-lg`, unit as a real label column | 120px pills + 10px "top ≤" |
| Hint affordance | hint icon **only** when the row has a consequence not stated by its description; otherwise delete | duplicated hints |
| Slider | track + editable numeric field aligned in the label row | far-right value label |

## 5. Plan

### Phase 0 — Decide the contract (0.5 day, no UI change)
- Add the missing semantic tokens: `--settings-card-padding`, `--settings-row-height`, `--settings-group-gap`, `--control-radius` (= `radius-lg`). No new values — only aliases to existing scale.
- Freeze the rules in §4 into `STANDARD.md` so every later slice has a single source of truth.

### Phase 1 — Layout grammar (biggest perceived-quality jump)
1. Card padding 8→16, radius 8→`radius-card`, gap 12→16.
2. Section header block: title/desc gap 4, desc 12→14px, desc→body 12.
3. Row: padding-block 8, min-height 40/44, divider inset to content edge.
4. Group label component (12/600) + apply to Downloads, Audio, Dictionary Popup, Resources.

**Verify:** screenshots before/after at 596/804/1099px column widths; measured padding/gaps equal to §4.1.

### Phase 2 — Shape convergence
1. Apply §4.2 to selects, inputs, chips, segmented items, keycaps, search field.
2. Delete the accidental pill on text-only controls; keep pill for toggle/badges only.
3. Rebuild keycaps as compact keys (32×32, `radius-md`), combos as key sequences.

**Verify:** a computed-radius dump per control class shows exactly 2–3 radii in use, each with a stated meaning.

### Phase 3 — Component recipes
1. Build `ChoiceGroup` (pick-one) from the existing chip/segmented primitives; migrate Audio output mode, Theme mode, Dictionary popup steps 1–3.
2. Fix chip OFF state (surface + border) and use the same chip for resource components and multi-selects.
3. Numeric field recipe; migrate the 4 frequency thresholds; add unit labels.
4. Slider recipe (value as editable number in the label row); migrate Button size / Pointer scale.
5. Hint-icon rule pass: remove hints that duplicate descriptions.

**Verify:** same-job surfaces render identically (side-by-side screenshot sheet).

### Phase 4 — Color & emphasis
1. Strip primary from numbered badges (deleted in Phase 3), decorative icons, and non-action links.
2. Add the section-action slot; move "Change", "New profile", "Add link", "Sync now" into it.
3. Promote real primary actions (Add resource, Connect account) to the primary style; demote "Choose package folder…" if it is not the card's main action.
4. Status color semantics for Sync; single status line + single action.
5. Value text off `--color-text-secondary` where it carries meaning.

**Verify:** per-card screenshot audit — exactly one emphasized element per card.

### Phase 5 — Content & IA
1. Collapse the duplicate Resources header (H-1); delete restating descriptions.
2. Move the "Dictionary popup" toggle into the Dictionary Popup card (H-3).
3. Mark profile-scoped settings (Show readings, and any language-dependent row) with a scope badge, or relocate them under Language profiles.
4. Reorder sections by use frequency: General → Language profiles → Resources → Subtitles → Dictionary Popup → Audio → Word badge → Media → Local player → Downloads → Theme → Keyboard Shortcuts → Sync; split nav into two groups ("Learning" / "App") if the chip row stays horizontal.
5. Sentence-case pass (H-7) + label noun pass (T-4).

### Phase 6 — Behavior
1. Whole-row activation for toggle/select rows (B-2) with correct focus ring.
2. `Autoplay` → labeled unit ("seconds before replay") or a real control (B-3).
3. Open select menu surface: match trigger radius/width, elevation token, no row overlap (B-5).
4. Word badge preview: constrain height, show the badge in context (B-6/S-6).
5. Sync "Bridge add-on" row: verify/repair truncation (B-6).
6. Repro pass for H-8 (stray Dictionary pane in Settings) — if reproducible, it is a P0 layout leak.

**Verify:** keyboard walkthrough (tab order, focus visible on every row/control), touch walkthrough at 375×667.

### Phase 7 — Verify & ship in slices
- Each phase: `npm run typecheck && npm run test:unit && npm run build`, design-system CSS check, then real-Chromium before/after screenshots at 375 / 768 / 1064 / 1440 widths, dark + light palettes.
- Update the nav/scroll contract tests if Phase 5 changes section order.
- One PR per phase; no phase mixes spacing and IA.

## 6. Priority

| Pri | Items | Why first |
|---|---|---|
| **P0** | H-8 (**confirmed**: duplicate dictionary panel + duplicate DOM id), SH-5 (invisible OFF chip), B-1 (unset-looking segmented), C-4 (error state invisible) | broken affordance / misleading state / invalid DOM |
| **P1** | Phase 1 (layout grammar), SH-1/SH-2, H-1, H-3, T-2, C-2 | the perceived-quality jump; cheap, mechanical |
| **P2** | Phase 3 recipes, Phase 4 emphasis, H-4, SH-3, SH-4 | consistency debt that keeps re-generating findings |
| **P3** | Phase 5 IA/order, H-6, S-6, B-3, B-4, B-7 | structural polish, needs product input on ordering |

## 7. Remove / Add / Move (one-line answers)

**Remove** — duplicate Resources header; restating descriptions; 1/2/3 step badges; the 10px "top ≤" micro text; the stray blue keycap circle; duplicate "Sync now"; hint icons that repeat their description; "Profiles · 1" count; 40px height on text-only chips.

**Add** — section grouping (Learning/App) or a two-tier nav; a single section-action slot; group labels for multi-group cards; a unit label column for numeric fields; scope badges for profile-scoped rows; one choice-group component; keycap component; slider-with-number component.

**Move** — "Dictionary popup" toggle → Dictionary Popup card; "Show readings" → Language profiles (or badge it as profile-scoped); "Change"/"New profile"/"Add link"/"Sync now" → card header action slot; section order → frequency-of-use; Sync status → single status line with color semantics.

## 8. Open items needing a decision or repro

1. H-8 — **confirmed** (see §3.1); fix decision needed: hide the lookup column below the 860px container breakpoint, or make it a deliberate labelled preview with a distinct input id.
2. Section order / grouping — needs product sign-off (Phase 5).
3. Profile-scoped vs app-scoped split — decide whether the Settings tab keeps both or Language profiles owns the profile-scoped ones.
4. Light palette pass — every measurement here is dark/Dawn; the same audit must be repeated in light mode before Phase 4 ships.
