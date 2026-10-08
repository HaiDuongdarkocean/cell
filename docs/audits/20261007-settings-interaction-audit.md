# Settings (Universal Panel) — Interaction & Section Audit (part 2)

> Date: 2026-10-07 · Surface: Universal Panel → Settings tab, all **13 section cards**
> Part 1 (layout/type/color): `docs/audits/20261007-settings-page-design-audit.md`
> Evidence: live Brave `:9224` (agent profile, extension built from current `dist/`), viewport 1064×900 and 375×667 — `tmp/debug-brave-agent/audit-settings*/` (≈90 screenshots) + `measure-settings4.mjs` computed-style dumps.
> Every state below was reached by **driving the real UI** (click / hover / focus / type / Escape), not by reading code alone. Items marked *(not captured)* are explicitly unverified.

## 0. State matrix actually captured

| Section | base | hover | focus | open surface | reveal / edit | notes |
|---|---|---|---|---|---|---|
| General | ✓ | ✓ | ✓ | select menu (Download card) | — | clicking the label hit the hint icon |
| Language profiles | ✓ | ✓ | — | *(menu not captured)* | `New profile` form | profile row + nested surface |
| Resources | ✓ | ✓ | ✓ | — | **edit mode** ✓ | chips toggle ✓ |
| Media | ✓ | ✓ | ✓ | *(MultiSelect not captured)* | — | conditional row |
| Subtitles | ✓ | ✓ | ✓ | — | — | cleanest card |
| Dictionary popup | ✓ | ✓ | — | **Edit link dialog** ✓ · **Delete confirm** ✓ | — | step chips |
| Word badge | ✓ | ✓ | ✓ | *(select not captured)* | — | sliders |
| Audio | ✓ | ✓ | ✓ | chip click ✓ | try-it ✓ | nested card |
| Local player | ✓ | ✓ | ✓ | — | — | — |
| Downloads | ✓ | ✓ | — | **select menu** ✓ | — | 7 selects |
| Shortcuts | ✓ | ✓ | — | **keycap capturing** ✓ | — | 11 keycaps |
| Theme | ✓ | ✓ | — | select menu | — | 3 radio tiles |
| Sync | ✓ | ✓ | ✓ | *(select not captured)* | port focus ✓ | long paragraph |

## 1. Per-section findings

### 1.1 General
- Row anatomy mixes *stacked* (label line + full-width select) with *inline* (label + toggle) inside one card — the same card teaches two different row patterns.
- The hint icon sits **between** the label and the control at 40×40; a click on the row's text hit the hint instead of opening the select (verified: the hint got the focus ring, the menu never opened). Hit-target competition.
- Toggle row has **no divider** while the same control type has dividers in Subtitles/Local player/Media.
- The `Dictionary popup` toggle duplicates the whole Dictionary Popup card (IA leak, part 1 H-3).
- Select is full-width (1130px) for values like “Auto (browser)”.

### 1.2 Language profiles
- Nested surface for “Universal native language” uses the **same radius as the parent card** (8 vs 8) → no nesting cue.
- Card action `Change` = 14px muted text (reads disabled); card action `+ New profile` = primary **text link**; other cards use a filled button (`Sync now`), an outlined button (`Add link`), or an icon (`pencil`). Four treatments for one job.
- Profile row: `radio → flag(s) → chevron → name/native → vertical divider → kebab`, inside a box that is itself inside the card — three nesting levels; the selected state is a **2px primary outline** (recipe #4, unique in the product).
- The two flags in one row are different shapes/sizes: native = 24px circle, target = 28px rounded square.
- `Profiles · 1` — the count carries no decision value.

### 1.3 Resources (most broken card)
- **Duplicate header** (part 1 H-1) confirmed live.
- `Add resource` is a dashed box whose “button” is 15px/600 text with no button shape and no hover state.
- Row anatomy: drag handle (far left) · name + chips · toggle (far right) — the name and its toggle are ~800px apart with no divider between resources; two resources read as one continuous block.
- **Edit mode**: pencil becomes a **filled blue circle with a checkmark** (the loudest element in the card, meaning “done”); a lighter edit bar appears with `Select all  0 of 2 selected` and **`Enable` / `Disable` / `Delete all` as plain text links** (destructive bulk actions with no button affordance); each row gains a checkbox and **loses its enable toggle** — the right slot changes meaning from “enabled” to “delete”.
- Frequency thresholds: `Common  everyday words` on the left, then ~800px of empty space, then 10px `top ≤` + a 120px pill input on the right. Label and value are visually unrelated; rows are ~120px apart.
- **Embedded dictionary panel** (part 1 H-8) measured at 1064 and 375: `.columns` is `flex-direction: column` with **32px gap**, the lookup column is **746×223, position static**, stacked **inside** the card → +255px of dead space showing a search field + “Ready when you are”, and the document contains **two** `id="dictionary-panel-search-input"` (invalid DOM).
- Component chips are the same component as the single-select chips in Dictionary popup (same shape, same colors, different semantics).

### 1.4 Media
- Toggle row + divider (good), then the conditional `Subtitle languages` row.
- MultiSelect surface: **radius 8** (not the pill used by every other select), 52px tall, a bare magnifier icon, and the selected chip is a **solid primary fill** (`--color-primary` with dark text) — the loudest element on the whole settings page for a filter value. Recipe #5.

### 1.5 Subtitles
- Cleanest card: 4 toggle rows, 40px, dividers inset to the label edge.
- **Every** row carries a hint icon → 4 identical ⓘ in a column; the affordance stops carrying information.
- Card bottom padding (~30px) is visibly larger than the top (~16px).

### 1.6 Dictionary Popup
- **Numbered step badges 1 / 2 / 3** with a vertical connector line that dangles below each badge. The stepper metaphor implies order/dependency; the three groups are independent settings.
- Choice chips: 3 groups (`Open with` 5 options, `Show first` 6, `When selecting…` 4) — correct selected recipe (subtle + primary text) but the chips are pill-shaped and 40px tall for 12px text.
- A `role=tablist` preview strip (746×48) sits between the chips and the link list with no label → looks like another control.
- Dictionary links: rows are ~110px tall for two lines, drag handle far left / pencil + trash far right, URL at 14px muted (lowest contrast in the card) while it is the field users edit.
- **Edit link dialog**: radius 12, background `#2D2D2D` — **identical to the card background**, `#0F0F0F` panel behind → no scrim, no visible border, so the dialog does not read as “above”. The close X carries the blue focus ring, which reads as “selected”.
- **Delete confirm**: destructive button uses a desaturated maroon fill (`~#7A4A48`) that reads “disabled”, and its label is the full entity name (`Delete Cambridge Dictionary`) — long button, weak danger signal.

### 1.7 Word badge
- Preview box ~150px tall with a 40px dot and no context or label — reads as an empty panel.
- Group label `Pointer position` = **12px/500 muted**; its value = 14px/500 white. Slider labels (`Button size`, `Pointer scale`) = **12px/500 muted** while their values (`36px`, `25%`) = **12px/600 white** → the value outranks its label (inverted hierarchy), and 3 of 4 labels in this card are muted.
- Slider value sits at the far right edge of a 746px row; label and value are ~700px apart.
- Slider track/thumb use primary blue — one of the few primary usages left for a non-action.

### 1.8 Audio
- Output mode: pill **track** `#363636`, radius 9999, padding 2px, height 44; items 40px. Selected = `primary-subtle` (0.12 alpha) over the track → the selected cell is **darker** than its track, i.e. it reads “pressed/inset”, the opposite of the Theme tiles where selected is lighter.
- Source order: 5 chips with an icon + an **unlabelled colored dot** (orange/green) + arrows between them. The dots carry status meaning with no legend; the arrows imply sequence for what is a priority list.
- `Local audio files` = a **nested card** (radius 12, bg equal to the parent card) containing a divider and the page's only **filled primary button** (`Choose package folder…`) → the strongest emphasis on the page belongs to a secondary, rarely-used action.
- `Try it`: input with **24px** text inside a 40px control (placeholder clipped visually), plus a 40px circular play button inside the field; helper text below.
- `Autoplay`: full-width select whose value is a bare `0` with no unit.

### 1.9 Local player
- Two toggle rows with dividers — consistent with Subtitles (the good pattern), but it is the *only* other card that does this.

### 1.10 Downloads
- Four group labels (`Speed`, `Format & quality`, `Conversion`, `File naming`) rendered **12–14px muted** → weaker than the row labels they group (inversion).
- Row grammar: label above + full-width select, EXCEPT `Format & quality` which is a **2-column** row → mixed grammar inside one card.
- **No dividers at all** here while other cards use them → row separation differs per card.
- Values without units: `3` (simultaneous downloads), `Auto` (conversions).
- Hint icon appears on exactly one row (`Simultaneous conversions`).

### 1.11 Keyboard Shortcuts
- 11 keycaps rendered as **345×40 pills** with the key letter centered → they read as buttons, not keys; ~500px of vertical space for the least-used settings.
- **Three keycap styles in one control**: `CTRL` / `SHIFT` = small dark pills with 11px uppercase text, `T` = a **solid blue circle**, single letters = plain 14px/600 text.
- Group labels (`Playback`, `Display`, `Translation`, `Flashcards`) = muted regular → weaker than row labels (same inversion as Downloads).
- 2-column grid leaves a hole in the last group; reading order is row-major while the groups are column-major.
- **Capturing state** (click a keycap): the only change is a **1px blue border** — no “press a key” prompt, no cancel hint, no conflict warning. Indistinguishable from focus.

### 1.12 Theme
- 3 radio tiles 177×69: **unselected tiles use the card background** (`#2D2D2D`) with no border → two of the three options look like plain text with an icon; only the selected one looks like a control.
- Selected = subtle fill + inset ring (recipe #2, unique).
- Palette select has no swatch preview; “Dawn” is the only clue.

### 1.13 Sync
- Status (`Protected` + green dot) and action (`Sync now`) sit at opposite ends of a 1130px row.
- Sub-headings `Connected accounts`, `Language profiles`, `Anki status sync` render at **18px/600 — the same as the card title** → the reader cannot tell a section from a sub-section. `Anki status sync` is effectively a card inside a card with no container.
- Account row: link icon (low contrast) + email 16px bold + provider 14px muted + `System` pill + `Disconnect` as **bare 14px muted text** (no button affordance; it is a destructive action).
- `Connect another account` = full-width outlined button — the only full-width button in settings.
- Info paragraph runs the full ~1000px (≈145 characters per line) in 14px muted — ~2× the readable measure.
- `Bridge add-on port`: 4-digit value in a full-width input with a native number spinner; helper text *below* the control (the only row in settings with that order).
- `Bridge add-on` row: `Not detected` right-aligned; its explanation line is clipped at the card/viewport edge in the captured state *(verify whether it is only the screenshot crop)*.

## 2. Cross-cutting defects (measured, all 13 cards)

| # | Defect | Numbers |
|---|---|---|
| X-1 | **Card padding 8px** (`8px 8px 0px`) around 18px titles | card 762 wide, content 746 |
| X-2 | **Card radius 8** while `--radius-card` = 12 | part 1 |
| X-3 | **Four radii, no rule**: 8 (cards, nav chips, theme tiles, multiselect), 12 (panel, dialogs, nested audio card), 9999 (selects, chips, keycaps, inputs, segmented), 6 (n/a) | measured per element |
| X-4 | **Six “selected” recipes**: subtle fill · subtle+inset ring · subtle+primary text · 2px outline · solid primary fill · filled blue check circle | per section |
| X-5 | **Selected is darker than its track** in Audio segmented, lighter in Theme tiles | track `#363636` vs item `rgba(106,178,245,.12)` over card |
| X-6 | **Six text roles on four sizes**: 18/600 title · 12/400 muted desc · 12/500 muted group+slider label · 14/500 row label/value · 12/600 slider value · 10px `top ≤` | no role→size mapping |
| X-7 | **Group labels are weaker than their rows** (Downloads, Shortcuts) and **sub-headings equal card titles** (Sync) | 12/500 muted vs 14/500 white; 18/600 vs 18/600 |
| X-8 | **Row separation is per-card**: dividers in Subtitles/Local player/Media/Sync, none in General/Downloads/Resources | — |
| X-9 | **Hint icons** are on every row in one card, one row in another, none in a third; 40×40 target adjacent to the label steals clicks | verified click miss |
| X-10 | **Full-width controls for short values** (selects 1130px, port input 1000px for 4 digits, menu 1010px with the checkmark at the far right edge) | menu items 44px, check at x≈1320 |
| X-11 | **Dialogs have no scrim** and use the card background → no elevation cue | dialog `#2D2D2D`, panel `#0F0F0F`, radius 12 |
| X-12 | **Two inputs use 24px text** (dictionary search, Try it) inside 40px controls | measured font-size 24px |
| X-13 | **Long paragraphs run the full column** (~145 chars/line, 14px muted) | Sync, Resources, Audio |
| X-14 | **Horizontal nav overflows at 1064**: chips need ~1139px inside a 1006px row; the last two (`Shortcuts`, `Theme`) are clipped/faded and read as plain text | measured chip x-positions |
| X-15 | **Duplicate DOM id** `dictionary-panel-search-input` ×2 in the settings document | `searchInputs: 2` at 1064 and 375 |

## 3. State recipes the redesign must define (one each)

| State | Where it appears today | Recommendation |
|---|---|---|
| Selected (option) | 6 variants | `primary-subtle` fill + `primary` text + 1px `primary@40%` border; identical for chips, segmented items, tiles, nav |
| Unselected (option) | invisible in Theme tiles, transparent in chips | `surface-hover` fill + secondary text — **never** transparent, so the shape survives |
| Editing / armed | Resources pencil → blue check circle; edit bar as text links | a labelled bar: `Done` button + real buttons for bulk actions; keep the toggle visible and add a separate delete |
| Capturing (shortcut) | 1px border only | inset ring + inline `Press a key… Esc to cancel` + conflict message row |
| Disabled | `autoLoadAsr` etc. | muted text + 50% control opacity + keep the row clickable to explain why |
| Dialog | no scrim, bg = card | scrim `rgba(0,0,0,.5)`, surface `surface-popover`, radius 12, 1px border, modal shadow |
| Menu | full width, check at far edge | width = trigger, max 360px; check at the item's left or immediately after the label; 36px items |
| Empty | “Ready when you are” inside Resources | one empty state per surface, never inside another card (fix H-8) |
| Error | none captured | define inline error row (red text under the field + red border) |

## 4. Deep plan (adds to part 1 phases)

**Phase 2.5 — state recipes (before per-section work).** Build `ChoiceGroup` (segmented + chips + tiles as one component with size variants), fix the OFF recipe, define dialog/menu surfaces, define the armed/editing bar, define the capturing state. Everything below then becomes a swap, not a redesign.

**Phase 3.5 — per-section surgery**
1. Resources: single header; dropzone as a real button; rows separated by dividers with the toggle adjacent to the name; edit bar with buttons; frequency thresholds as a labelled table (`Common ≤ 3000` in one line, 4 rows, 56px); **fix H-8** (hide the lookup column below its 860px container, give the embedded input a distinct id).
2. Dictionary popup: delete the step badges; keep the three groups as labelled groups; label or remove the preview strip; link rows 64px with the URL at 14px primary.
3. Audio: segmented items 32px inside a 40px track; source-order chips drop the arrows and gain a legend for the dots; nested card → plain group with a divider; `Choose package folder…` demoted to secondary; Try-it input 14px.
4. Shortcuts: real keycaps (32×32, radius 6, mono) in a 2-col list with 40px rows; group labels 12/600 primary-ish; capturing state per §3.
5. Sync: sub-headings 14/600; account row → `Disconnect` becomes a secondary button; paragraph max-width 640px; port input 120px with the unit inline; `Anki status sync` becomes a real sub-section with a divider.
6. Language profiles: card actions into the header slot; profile row → single level with the kebab outside the bordered box; one flag shape; selected = standard recipe.
7. Media: MultiSelect → standard select/chip recipe (radius 8, subtle fill).
8. Downloads/Theme/General/Word badge: apply the type scale, one row grammar, unit labels, tile OFF state, slider value as an editable field.

**Phase 5.5 — navigation.** With 13 cards and a 1006px chip row that overflows, either (a) two labelled groups with the nav allowed to wrap to 2 lines, or (b) the vertical settings sidebar at ≥1000px panel width (the panel already has the space) — decided together with the part-1 IA question.

## 5. Priority (part 2 items only)

| Pri | Items | Why |
|---|---|---|
| **P0** | H-8 (duplicate panel + duplicate id), capturing state (no cue), Theme OFF tiles invisible, dialog without scrim, destructive `Disconnect`/`Delete all` as bare text | users cannot tell state or danger |
| **P1** | X-1/X-2 (padding/radius), X-4/X-5 (selected recipes), X-6/X-7 (type roles), X-8 (row separation), X-9 (hint icons) | the systemic layer; cheap and stops new findings |
| **P2** | Resources edit mode, step badges, keycaps, source-order chips, audio nested card, X-10/X-12 | per-section surgery on top of the recipes |
| **P3** | X-11/X-13/X-14/X-15 polish, section order/grouping, light palette pass | needs decisions |

## 6. Not captured / open

1. ProfileMenu contents (kebab), MultiSelect open list, Word badge select menu, Sync profile-mapping select — trigger not located by the automated pass.
2. Sync `Bridge add-on` clipped line — confirm crop vs real clipping.
3. Light palette — the whole audit is dark/Dawn.
4. 600–839px band — measured only at 1064 and 375.
