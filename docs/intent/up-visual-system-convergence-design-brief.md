# Design Brief — up-visual-system-convergence (all mode)

> Spec: `docs/specs/up-visual-system-convergence.md` · Intent: `docs/intent/up-visual-system-convergence.md`
> Convergence item — this brief is a **recipe-decision document**, not a new-UI concept. Every chosen recipe cites `DESIGN.md` or an existing in-repo exemplar; nothing is invented.

## Design Read

One visual grammar for the universal panel: two selection recipes, opaque floats, bordered secondary controls, one status chip, hairline grouping, one empty anatomy — "selected", "clickable", "disabled", and "destructive" are learned once and hold on all six tabs + chrome.

## Function audit

| Function (spec REQ) | Features | Element affected |
|---|---|---|
| Render "selected" in one language (REQ-1) | MenuItem checked, queue active row, segments, mode/choice cards | `.item[aria-checked]`, `.segmentActive`, `Card .selected` |
| Keep floating layers opaque + panel edge (REQ-2) | SearchableSelect menu, tool rows, kebab, panel shell | `.menu`, `Surface variant="panel"` |
| Every choice through Menu (REQ-3) | vocab filter/sort, tools sheet, profile switcher, LPP kebab | `Menu`/`MenuItem`/`MenuSeparator` + R-TRIGGER skin |
| One status-chip molecule (REQ-4) | RecapTab `.statusChip`, VocabTab `.statusBadge` | `Chip` `status` prop (extend) |
| Advertise true emphasis (REQ-5) | `.secondary` atom, footer trio, playlist destructive, Sync now | `Button` variants |
| Draw grouping, don't imply it (REQ-6) | sidebar tab/tools split, dictionary↔card-creator seam | `Separator`, single hairline |
| One empty anatomy (REQ-7) | playlist `.empty`, vocab title-only states | `EmptyState` |
| One type recipe + nav labels (REQ-8) | 11 uppercase sites, NavItem label size | `SectionHeader`/`Text`/`Heading`, `--font-size-sm` |
| Advertise affordance/range (REQ-9) | HintIcon, slider track, action tiles, chrome ghosts | R-AFFORD recipes + `--color-track` |
| State failure once (REQ-10) | AnkiConnect banner vs settings status row | `Alert`-level banner owns statement |
| Manage header density (REQ-11) | overflow kebab Menu, lookup home, icon collision | `Menu` + `flame` glyph |
| Keep surface families unified (REQ-12) | playlist rows, ModeCards overrides, opacity-as-color, dashed add-boxes | `Card` scale, color tokens, dashed family |

## Journey map

AS-IS → TO-BE pairs are inherited verbatim from the spec's traceability matrix (journey rows → REQ-1/2/3/4/5/6/7/8/9/10/11/12). The design contribution is resolving the recipe picks the spec deferred to DESIGN; the journey itself does not change — behavior parity (NFR-3) is a hard boundary.

## Dials (baseline + variant)

Baseline (as shipped): DESIGN_VARIANCE 9 (five selected recipes, three chip impls, three emphasis costumes) · MOTION_INTENSITY 2 · VISUAL_DENSITY 6.

## Inspiration anchor

A typeset spec sheet / proof grid — the mockup is a **recipe board**: each specimen pair (current dialect vs converged recipe) sits in a labeled row like a proof sheet, so the difference is the artifact, not the layout around it. Non-digital reference: a printer's color-registration proof — same mark, two inks, judged side by side.

## Primary job

Let the maintainer (and AC evidence) verify that each converged recipe is the right canonical answer *before* DELIVER touches ~60 `variant="secondary"` call sites and shared atoms — the recipe board is the decision record for the four DESIGN-owned picks plus the secondary resolutions the spec delegated.

## Context quote justifying the shape

> "No new visual language is designed; DESIGN chooses only where the system is ambiguous." — intent `Solution` row. So the mockup stages recipes, not layouts: one board, every divergent site class represented, real atoms where the atom already carries a recipe.

## Chosen variant — "Registry Lock" (single justified variant)

- **IA mental model:** the Canonical Recipe Registry (spec) IS the interface — 14 recipes, each with a pre/post specimen pair. The mockup concept switcher flips the whole board between "current dialect" and "converged recipe".
- **Visual archetype:** proof-sheet specimen rows on the real token surface — no new chrome; rows are labeled with the site file + recipe id.
- **Non-digital reference:** print registration proof (same mark, two inks).
- **Material / surface:** real atoms (`Menu`/`MenuItem`, `Button`, `Card`, `Chip`, `SegmentedControl`, `NavItem`, `Surface`, `EmptyState`, `Separator`, `Text`, `SectionHeader`, `HintIcon`) mounted inside specimen frames; divergent hand-rolled sites reproduced with the exact production rules in `mockup.module.css`; proposed deltas applied through the same CSS variables/rules DELIVER will ship (`--button-solid-border`, `--panel-shadow`/`--panel-border` overrides, `[aria-checked]` composition).
- **Typography treatment:** untouched — the system `Text`/`SectionHeader` scale; the uppercase dialect appears only as a "current" specimen.
- **Motion signature:** none added; hover/focus states come from the atoms.
- **UX flow:** switcher → board; each row readable as `site → recipe → pre/post`.
- **UI structure:** sections per registry group (Selected · Floating+Edge · Menu+Trigger · Chips · Emphasis · Grouping · Empty · Headings · Affordance · Surface family).
- **3 dials:** DESIGN_VARIANCE 1 · MOTION_INTENSITY 2 · VISUAL_DENSITY 6
- **Why it fits:** the spec forbids invention — the only defensible "concept" is the registry rendered. A side-by-side board is also exactly what NFR-1/AC-17 before/after evidence needs.
- **Risk:** specimen rows abstract sites — mitigated by using real atoms + verbatim production rules for replicas, and by the DELIVER-stage real-Chromium sweep that re-verifies on live surfaces.
- **Audit findings:** all 12 needs (N1–N12) → solve; nothing deferred (predecessor items own structure).

### ASCII sketch — recipe board (desktop stage)

```
┌ controls: [Current] [Converged] · [390] [768] [full] · [Dark] [Light] ─┐
├ SELECTED ─────────────────────────────────────────────────────────────┤
│ MenuItem checked   [ All words ✓ ]   primary-subtle + primary text     │
│                    [ Known       ]   hover → primary-subtle-hover-bg   │
│ Card selected      ( mode card )     primary-subtle + inset-selected   │
│ Segment (filled)   [ Day | Week ]    accent recipe on tinted track     │
│ Nav marker         ▌Dictionary       aria-current → R-NAV-CURRENT kept │
├ FLOAT + EDGE ─────────────────────────────────────────────────────────┤
│ Panel on dark page ▓▓▓▓▓▓            shadow-modal + border             │
│ Panel on bright    ░░░░░░░░            (border beats border-subtle)    │
│ Floating menu      ┌──────────┐       field-solid + emphasized hairline│
├ TRIGGER / EMPHASIS ───────────────────────────────────────────────────┤
│ Vocab triggers     [⚙ All ▾] [Recent ▾]  secondary skin + chevron      │
│ Footer             [Clear] [Add] [Update]  errorSubtle · 2ndary · 1°   │
├ CHIPS / HEADINGS / EMPTY / DASHED ────────────────────────────────────┤
│ Status chips       (unknown)(known)    one Chip status prop            │
│ Group heading      STATUS              → SectionHeader / Text label    │
│ Empty pane         icon + title + hint → EmptyState compact            │
│ Dashed boxes       ┄┄ add box ┄┄        border + radius-lg + input-ht  │
└────────────────────────────────────────────────────────────────────────┘
```

## Recipe decisions — the registry, pre → post

### R-SEL-LIST (choice-in-list) — `primary-subtle` bg + `primary` text

| Site | Pre (verified) | Post |
|---|---|---|
| `Menu.module.css` `.item[aria-checked='true']` | accent text only (`:35-37`) | add `background: var(--color-primary-subtle)`; checked:hover → `background: var(--button-primary-subtle-hover-bg)` — verbatim the `NavItem.module.css:52` composition (selected rest = subtle, hover = deepened subtle), so checked+hover never collides with the unchecked `surface-hover` wash |
| `QueueSidebar.module.css` `.cc-queue__item--active` | `primary-subtle` bg, no accent text | add accent text (`color-primary`) → full recipe |
| `SegmentedControl` `.filled`/`.chips` `.segmentActive` | solid `primary` fill + inverse text (`:132-137`,`:171-176`) | repoint to `primary-subtle` + `text-accent-strong` — the `.accent .segmentActive` (`:94-97`) recipe already shipped; **contrast gate** on the `surface-hover`/`field` track in both themes — if it fails, the solid fill becomes the documented variant (golden-rule-9 justification + measured contrast), never an ad-hoc survivor |
| `SearchableSelect` `.optionSelected` | already canonical | verify only |
| `VocabularyTab` radio items | inherits `Menu` | automatic |

### R-SEL-CARD (card/segment) — `primary-subtle` + `text-accent-strong` + `--shadow-inset-selected`

| Site | Pre | Post |
|---|---|---|
| `StudyModesTab` `.modeCard` | bespoke `--card-background: field` card | `Card` `selected` variant owns it |
| `LanguageProfilePanel` `.choice[aria-checked]` | `border-color: primary` outline ring | swap to `box-shadow: var(--shadow-inset-selected)` (Card `.selected` recipe `Card.module.css:28-32`) |
| `LanguageProfilePanel` `.item:has(.card[aria-checked])` | already canonical | verify only |
| `ModeCards` overrides `border-width`/`--card-radius` | off-scale | removed — REQ-12 |

### R-NAV-CURRENT — kept

NavItem `aria-current` (pill bar + `primary-subtle` + accent icon) and bottom-nav tint stay untouched: location marker, not choice. Decision: **no edit** — it already composes `primary-subtle` + `primary-subtle-hover-bg` on hover, the same selected-tint physics MenuItem gains.

### R-FLOAT + R-PANEL-EDGE — opaque floats, real panel edge

- **`panel.shadow → var(--shadow-modal)`** in every theme block (`component.panel.shadow`, currently `--shadow-sm`).
- **`panel.border →` the `color-border` token** — DESIGN pick between the two registry-sanctioned hairlines. Evidence for `border` over `border-subtle`: light-theme `border` = `#E2E2DF` (a real hairline on white pages) while `border-subtle` = `surface` + 3% `primary` (≈invisible); dark `border` = `#303030` while `border-subtle` = `border` at 65% alpha. V-9's failure is a bright-page edge loss, and `DESIGN.md §5.1:155` reserves `border-subtle` for outlines only — it vanishes on elevated contexts. AC-4's dark+bright-page capture validates; if `border` were to fail the bright-page capture the spec's only other sanctioned option (`border-subtle`) would be weaker, so `border` is the committed pick.
- **`popover.border →` the `border` token** in every theme block (`component.popover.border`, currently `"transparent"` — discovered during mockup render: Popover.module.css:8 declares `border: hairline solid var(--popover-border, border)` — `--popover-border` with a `border` fallback — so the hairline rule exists but paints transparent on every Menu/Popover/`Surface variant="popover"`). Same reasoning as the panel edge: AC-3 demands a *visible* hairline on every floating surface; a transparent border on `surface-elevated` fails low-contrast pairs (elevated-vs-surface in light themes ≈ `#FFFFFF` on `#FAFAF9`). Registry already cites the Popover recipe as canonical — this value change makes the token honor the declared rule. Blast radius: all Popover surfaces (menus, toolbar popovers) + `Surface variant="popover"`; no rule edit, one token leaf.
- `SearchableSelect .menu` `border: none` → `border-width-hairline solid var(--color-border-emphasized)` — the `Select .menu` canonical hairline (`Select.module.css:163-172`).
- `SearchableSelect .option` resting `--input-bg` → `surface` (§5.1 resting-control-on-surface); `:active` `overlay-pressed` → `var(--color-surface-pressed)` (no alpha washes on floating/on-surface fills).
- `.toolRow`/`--universal-panel-tool-row-bg` sites die with the R-MENU migration (below).
- LPP portaled `.menu` dies with the R-MENU migration.

### R-MENU — every choice list

| Site | Pre | Post |
|---|---|---|
| vocab filter/sort `.toolBtn` triggers | `Button ghost` + `text-secondary` → link-look (V-5) | **R-TRIGGER pick: `Button variant="secondary" size="sm"`** + leading icon + trailing `chevronDown`; `aria-haspopup="menu"`/`aria-expanded` unchanged; `.toolBtn` color rules deleted. Rationale: `secondary` (this item's new recipe) is *the* enabled-secondary weight — a bordered, filled, quiet control that sits between `outline` (reserved for field-like emphasis, `border-emphasized`) and `ghost` (chrome actions); the chevron + bordered pill is the affordance V-5 lacked. The Edit toggle is a mode switch, not a trigger → stays `ghost` + `aria-pressed` accent (spec alt flow). |
| bottom-nav tools `.toolRow` | `surface-elevated` rest + `overlay-hover` wash | `MenuItem` rows inside the `BottomSheet` (`emphasis` for the sheet style) — R-MENU; `ListItem` only if item 31's sheet redesign mandates (open per spec) |
| profile switcher `Dialog`+`RadioGroup` | modal for one pick | `Menu` anchored to `.profileButton`, `MenuItem radio`, `selected` = active profile |
| LPP kebab `.menu`/`.menuItem` | portaled `border:none` + `shadow-floating` + `overlay-hover` | `Menu` + `MenuItem` (`destructive` prop on the danger entry, `MenuSeparator` between groups) — Menu owns dismissal/roving |

### R-CHIP-STATUS — one molecule

**DESIGN pick: `status` prop on `Chip`** (`status: 'unknown'|'tracking'|'learning'|'known'|'ignore'`), not a new component — golden rule 9 smallest proposal: Chip already owns span/button duality (`as`), sizes (`sm`/`md`), icons, focus, disabled, and the solid-pair hover contract; the delta is five color-way classes consuming the chip-status token pairs (`--chip-status-unknown-bg`/`--chip-status-unknown-fg` … `--chip-status-ignore-bg`/`--chip-status-ignore-fg`).

- Interactive hover: deepened status bg via `color-mix` of the status bg token with `color-text` 8% — the Chip contract (subtle → muted swap, `Chip.module.css:78-100`) adapted because the status family ships no muted variant; `filter: brightness()` dies both directions.
- Static = `as="span"` (existing prop — no new `static` API).
- `RecapTab .statusChip` + `VocabularyTab .statusBadge` (interactive + static-trash) consume it; `STATUS_CLASS` maps + bespoke CSS die; dictionary-popup `.cellHeaderStatus` adoption stays out of scope but shares the tokens.
- New public API on a stable atom → `Chip.showcase` + `Chip.test` additions per `DESIGN.md §10.2`; status stays `experimental` until two consumers land (they do here).

### R-EMPH — `.secondary` atom + footer/destructive recipes

**DESIGN pick for `.secondary` (the V-17 root fix):**

```css
.secondary {
  background: var(--button-secondary-bg);   /* color-surface */
  color: var(--button-secondary-fg);        /* color-text-primary */
}
/* + border-color: color-border  — the affordance the base chrome lacked */
```

Rationale: `components.css:236` `.btn` secondary modifier (the legacy recipe the variant name was designed for) = `surface` fill + `text-primary` fg + `overlay-hover` — `Button.module.css` base already paints exactly that via `--button-solid-surface`/`--button-solid-foreground`/`--button-solid-border`/`--button-solid-shadow` plus the `::after` `overlay-hover` feedback. The missing piece V-17 names is *affordance*: a hairline `border` makes it read as a control, landing it between `.outline` (`surface-elevated` + `border-emphasized`, no shadow — the heavier weight) and `.ghost` (nothing). `color-border` chosen over `border-subtle` for the same §5.1:155 reason (subtle vanishes on the `surface`/`elevated` cards these buttons sit on). `:disabled` keeps `opacity: var(--button-disabled-opacity)` — muted ⇒ disabled stays true. The `.offRow.offRow` `border`-leak is a DELIVER sweep item (reset completes there or is flagged to the subtitle owner — subtitle files are never edited here).

- Card-creator footer: `Update` owns the single `primary` (it is the commit); `Add` → `secondary`; `Clear` → `errorSubtle` (destructive-ish reset — the `error-subtle` tint is the truthful weight and it's still gated by a confirm dialog; not a third bespoke weight).
- Playlist destructive: `Button variant="errorSubtle"` — distinguishable from ghost siblings, no kebab move (smallest diff).
- `Sync now` (verified enabled) → renders `.secondary`; `--opacity-disabled` only on actually-disabled controls.

### R-DIVIDER — hairlines draw grouping

- Sidebar tab/tools groups: `Separator` atom (`--color-divider` hairline) between sections; the ~64px void collapses to section spacing; collapsed rail keeps a legible divider (horizontal hairline in the 64px rail).
- Dictionary↔card-creator seam: keep `DictionaryTab` `border-right`, drop `CardCreatorPanel` `border-left` (mobile already zeroes it) → exactly `border-width-hairline`.

### R-EMPTY — one anatomy

- Playlist `.empty` → `<EmptyState size="compact">` with `audioWave` icon + title + description (i18n keys reused); hand-rolled CSS dies.
- Vocabulary title-only states gain full anatomy; new `vocabulary.empty*Hint` description keys (existing title keys unchanged — spec-sanctioned).
- Playlist `records === null` loading branch stays `Spinner` + `role="status"` (a loading state, not empty).

### R-HEAD — token typography + ruling on the dialect

- All 11 enumerated uppercase/tracking sites → `SectionHeader` (title + action slot) or `Text variant="label"`/`Heading`; `text-transform` + hand tracking deleted.
- **Ruling: small-caps is NOT a brand accent** — conservative default per spec open-questions; keeping it would require a token + written rule, which itself resolves the dialect. No exemption.
- `<kbd>` glyphs in `ShortcutInput` (`kbdModifier`/`kbdKey`) keep casing — key names are literal glyph content, not headings; the atom's heading label (`:33`) converges.
- `NavItem` label `font-size-xs` → `--font-size-sm` (V-14) with the AC-11 truncation check at the 180px rail; non-panel consumers re-checked.

### R-AFFORD + R-TEXT-TONE — controls look live, hierarchy uses color

- `HintIcon .hintBtn` hover → `surface-hover` ghost recipe; accent only on `aria-expanded`/`focus-visible` (`:focus-visible` ring stays); **`cursor: help` kept** — it advertises "hint" semantics distinctly from a press action.
- Slider unfilled track: **strengthen the shared `--color-track`** `transparent 85%` → `transparent 75%` in both theme blocks (15% → 25% ink, the same magnitude family as `border-emphasized` ≈22–24%). Blast radius verified — consumers are `Slider` unfilled track, `Progress` track + circular, `Toggle` default (`toggle.default` at `component.toggle.default`): all three suffer the identical invisibility defect, none needs the faint value; `toggle.active` = `primary` still differentiates on/off. One value tweak — no new token, no ADR.
- V-19 action tiles: content-sized (`padding`/`min-width` from the `--spacing-2`/`--spacing-4` scale, no fixed oversized boxes) — sites pinned by the DELIVER sweep.
- Overlay-chrome ghosts (`.profileButton`, `.closeButton`, tokenize halves): golden rule 7 — `border-width-hairline solid` `color-border` rest + `primary-subtle`/`primary` hover tint, applied post-item-31.
- Opacity-as-color (`.modeIcon`, `.modeDesc`, `.modeCard:hover`): `.modeIcon`/`.modeDesc` → `color-text-secondary`; on the selected `primary-subtle` surface → `var(--color-text-accent-strong)` (accent cascade keeps contrast on the tint — F-14 risk). `.modeCard:hover` literal `0.85` → `var(--opacity-hover)` — i.e., the `Card.interactive` hover recipe once `modeCard` rides `Card` (REQ-1).

### R-TRIGGER skin — decided

`secondary` (above) — chosen over `outline` because `border-emphasized` reads as field emphasis, and over a bespoke menu-trigger treatment because the spec constrains the pick to existing variants. Verified in the mockup on a toolbar row.

### R-NAV-CURRENT icon collision (REQ-11)

- **`slidersHorizontal` stays on the vocabulary filter trigger** — its "adjust/filter" idiom binds to filtering.
- **Study Modes tab → `flame`**: practice-destination idiom; unused inside the panel chrome (only SRS-streak surfaces outside the panel), so no in-panel collision. Rejected: `gauge` (playback-speed glyph — `PlaybackSpeedControl`, `RecapTab` stat — collides inside the panel), `layoutGrid` (already a tools-sheet row icon in the same nav surface), `layers` (SRS tool row), `repeat` (SyncPanel), `zap` (card creator + popup).
- Header overflow → kebab `Menu` on whatever item 31 ships; every overflowed action keeps its label.

### Failure stated once (REQ-10)

The `Alert`-level blocking banner owns the failure *statement* in the card-creator dialog view; the settings status row renders ambient status (dot + label + retry) only, suppressing its failure text while the banner is mounted in the same view. `role="alert"` stays on the banner; retry stays adjacent to the statement.

### Dashed add-box family (V-13, REQ-12.5)

**Family = `border-width-hairline dashed color-border` + `radius-lg` + `min-height: var(--input-height)` floor** for add/drop affordance boxes:

| Site | Pre | Post |
|---|---|---|
| `EmptyState .root.bordered` | hairline dashed `border` + `radius-lg` | **canonical exemplar** — the family follows it (atom-side, all consumers follow) |
| `LanguageProfilePanel .banner` | `radius-xl` | `radius-lg` (keeps its `primary-subtle` CTA fill) |
| `MediaList .cc-media__empty` | dashed `color-text` (off-token) + `radius-md` | `border` + `radius-lg`; keeps the `input-height` floor |
| `MediaList .cc-media__dropzone` | transparent-rest dashed + `radius-md` | `radius-lg`; transparent-rest drag feedback kept (a different job at rest) |
| `DictLinksManager .dropPlaceholder` | `radius-lg` | already family — verify |
| residual `dashed` (`Dropzone`, `ResourcesPanel`, `ImportProgress`) | — | sweep-pinned: join family or documented as drag/placeholder feedback |

Radius pick rationale: the shared atom (`EmptyState.bordered`) and the card scale (`--card-radius` = `radius-lg`) agree; `radius-xl` is panel/dialog scale, `radius-md` is input scale — `radius-lg` is the box family.

### Playlist row surface (REQ-12)

`.itemRow` rides `Card` scale (`--card-radius`, no `radius-md` override); the 2px bespoke stripe dies on default rows; the **failed state** becomes a documented status treatment — `var(--color-error-subtle)` bg + `color-error` status mark (the Alert error recipe in row form), not a bespoke border column.

## Responsive table

| Width | Board behavior |
|---|---|
| 320 | single-column specimen stack; touch rows ≥44px via atom `min-height: touch-target` |
| 390 | same; specimens never clip (flex-wrap) |
| 768 | two-up specimen rows where they fit |
| 1280+ | sections cap at content width; stage fluid |

No responsive behavior is designed for the product UI — DELIVER changes recipe values only (NFR-3 parity).

## States for chosen direction

Every specimen renders rest + hover (fine-pointer) + focus-visible where the atom defines them; Menu checked renders rest + hover composition (the `primary-subtle-hover-bg` pick above); `.secondary` renders enabled + `:disabled` side by side so the enabled/disabled distinction is visible in one capture; dark + light via `data-theme`; panel-edge section on dark AND bright specimen backdrops (AC-4's evidence shape).

## Audit findings addressed

V-2, V-3, V-4, V-5, V-7, V-9, V-10, V-11, V-12, V-13, V-14, V-15, V-16, V-17, V-18, V-19, V-21, V-22 → solve (recipe per tables above; V-16/V-22 applied post-item-31 per boundary). F-11, F-13, F-14, F-15, F-23, F-25 → solve.

## Anti-patterns avoided

- No invented recipe — every pick cites `DESIGN.md §5`/`§5.1`, a `tokens.json` group, or a shipped exemplar (`NavItem.module.css:52`, `Card.module.css:28-44`, `Select.module.css:163-174`, `SearchableSelect.module.css:201-204`, `components.css:236`, `EmptyState.module.css:106-112`).
- No new token/component beyond the `Chip` `status` prop (`§10.2` lifecycle: showcase + test + experimental).
- No scope creep into items 28–32's files/behavior; subtitle files untouched (`.secondary` reaches them atom-side, `subtitle-split-view-ac.md` re-verify carried to DELIVER).
- No `common.tsx` shared layout — this mockup is one board by design (single variant), not three skins.

## Why the variant shape

Three divergent concepts would be theater: the spec already fixed the language. The genuinely open decisions — `border` vs `border-subtle`, checked-hover composition, trigger skin, chip mechanism, dashed family, segment recipe, icon side — are all resolved above against shipped exemplars, so DELIVER executes rather than deliberates.
