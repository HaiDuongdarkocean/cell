# Spec: up-visual-system-convergence — Recipe convergence execution sheet for the Universal Panel

> Intent: `docs/intent/up-visual-system-convergence.md` · ui_surface: yes · Mode: all
> Ships LAST — dep order `product-backlog.md:68` (33 ← 28, 29, 30, 31, 32). Every site cited below was re-verified in SPECIFY; DELIVER must re-verify against predecessor diffs before starting each subsystem commit.

## Objective

Collapse the panel's competing visual dialects onto the design system's existing recipes: two sanctioned selected-state recipes, opaque floating layers (`DESIGN.md §5.1`), `Menu`/`MenuItem` for every choice list, one status-chip molecule, one heading typography, divider-based grouping, one `EmptyState` anatomy, enabled-vs-disabled emphasis that can't be mistaken, and `tokens.json`-driven edges. The spec is an **execution sheet**: each REQ names one canonical recipe (with its exemplar), the verified sites that diverge, and the convergence mechanism. No new visual language; behavior is untouched.

## Actor ↔ System Boundary

| Actor | Triggers | Inputs | Receives/Views |
|---|---|---|---|
| Maintainer/agent (this pipeline item's owner) | Runs the convergence task, subsystem commit by commit | Edits to the named source files/tokens; runs npm gates + audit greps; captures before/after evidence | Gates green; rendered output on the new recipes |
| End user (persona 5–80, any device) | Opens/uses the universal panel | Pointer/keyboard interaction | One state language: selected, clickable, disabled, destructive read identically on all six tabs + chrome |
| Items 28–32 owners | Ship structural changes first | — | This item converges whatever remains after their diffs land |

System-internal processing never includes human behavior. The "system" here = checked-in TSX/CSS/tokens plus the design-system checkers; the maintainer supplies edits, the system renders.

## Canonical Recipe Registry

The whole spec references these recipes. Every one already exists in the system — this item selects and applies, it does not invent.

| ID | Meaning | Recipe | Canonical exemplar |
|---|---|---|---|
| R-SEL-LIST | Choice-in-list selected | `background: var(--color-primary-subtle); color: var(--color-primary)` | `DESIGN.md §5:130`; `SearchableSelect.module.css:201-204` |
| R-SEL-CARD | Card/segment selected | `primary-subtle` bg + `text-accent-strong` + `box-shadow: var(--shadow-inset-selected)` | `Card.module.css:28-44`; token `tokens.json:203`; adopted verbatim by `LanguageProfilePanel.module.css:153-156` |
| R-NAV-CURRENT | Nav *location* marker (`aria-current`) — semantically distinct from selection | `NavItem` `primary-subtle` + accent icon + pill bar (`NavItem.module.css:43-52,76-93`); horizontal/tint variant for bottom nav (`UniversalPanelBottomNav.module.css:52-59`) | `NavItem.module.css` |
| R-FLOAT | Floating layer (menu/popover/listbox/sheet) | opaque `surface-elevated`/`field-solid` + hairline `border`/`border-emphasized` + `shadow-popover`/`shadow-modal`; **never** `field`/`field-hover`/`overlay-hover`/`overlay` washes | `DESIGN.md §5.1:143-157`; `Select.module.css:163-174`; `Popover.module.css:2-11` |
| R-PANEL-EDGE | Panel shell vs page | `shadow-modal` + visible `border-subtle`/`border` hairline | `tokens.json` `panel.*` group `:690-697` (single consumer — `variant="panel"` used only by `UniversalPanel.tsx:193`) |
| R-MENU | List of choices/actions | `Menu` + `MenuItem` + `MenuSeparator` (`Menu.tsx`; surface = `Popover variant="menu"`, opaque + bordered + `shadow-popover`); `MenuItem` `radio`/`selected` for single choice, `destructive` for destructive, `emphasis` prop for sheet-style rows | `VocabularyTab.tsx:259-316` (already canonical) |
| R-TRIGGER | Menu/select trigger | Visible affordance — bordered or filled `Button` skin + chevron + `aria-haspopup`/`aria-expanded`; never bare text/underlined link | defect class V-5; skin chosen in DESIGN from existing `Button` variants |
| R-CHIP-STATUS | Status chip (unknown/tracking/learning/known/ignore) | One `shared/ui` molecule consuming the `--chip-status-*` pastel token pairs; hover = solid token-pair swap; never `filter: brightness()` | token pairs defined for the popup's `.cellHeaderStatus` (`CandidateView.module.css:169-179`); shared `Chip.tsx` hover contract (`Chip.module.css:70-104`) |
| R-EMPH | Emphasis ladder | ≤1 `primary` per surface (L-SCARCITY, `Button.module.css:147`); enabled-secondary = bordered `secondary`/`outline` fill — distinct from `primary`, `ghost`, and `:disabled`; destructive = `destructive`/`error` variant or `MenuItem destructive`; disabled = `--opacity-disabled`/`--button-disabled-opacity` only when actually disabled | `Button.module.css` variant table; `Menu.module.css:43-53` danger rows |
| R-DIVIDER | Region/row grouping | hairline `var(--color-divider)` — `Separator` atom or border; `border-subtle` is outlines-only (vanishes on elevated, `DESIGN.md §5.1:155`); never structural voids, never doubled edges | `Menu.module.css:93-97` separator; `DictionaryTab.module.css:18` hairline |
| R-EMPTY | Empty pane | shared `EmptyState` — icon + title + description + optional action; `size="compact"` in panel | `EmptyState.tsx`; `RecapTab.tsx:241-246` |
| R-HEAD | Section/group heading | `SectionHeader` / `Heading` / `Text variant="label"` — sentence-case token typography (`--text-*` + `tracking-normal`); never `text-transform: uppercase` + wide tracking | `SectionHeader.module.css:15-21`; `Text.module.css` `.label` |
| R-AFFORD | Control affordance | Interactive hover = `surface-hover` (+`--opacity-hover` where the family defines it, `DESIGN.md §5:126-141`); focus ring only on `:focus-visible`; overlay-chrome ghosts carry border + primary tint hover (golden rule 7) | `IconButton`/`Button ghost`; `Menu.module.css:25-33` |
| R-TEXT-TONE | Text/icon hierarchy | color tokens (`text-primary`/`text-secondary`/`text-muted`/`text-accent-*`); `opacity` is reserved for true disabled and the sanctioned `--opacity-hover` hover — never a muted-*look* on live text | `Text.module.css` color classes |

## Requirements

### Functional

REQ-1: Selected-state convergence — two recipes, one nav marker (N1 · V-3)
- Actor: Maintainer
- Goal: "Selected" reads identically everywhere: choice-in-list → R-SEL-LIST; card/segment → R-SEL-CARD. Underline-as-selected and bespoke variants are gone. `aria-current` nav markers stay R-NAV-CURRENT (location, not choice).
- Preconditions: items 28–32 landed; `Menu`/`MenuItem`/`NavItem`/`Card`/`SegmentedControl`/`SearchableSelect` atoms exist.
- Basic flow:
  1. actor applies the site map:

  | Site (verified) | Today | Converges to | Mechanism |
  |---|---|---|---|
  | `Menu.module.css:35-37` `.item[aria-checked='true']` | accent text only | R-SEL-LIST incl. `primary-subtle` bg | add `background: var(--color-primary-subtle)` — exactly what `DESIGN.md §5:130` sanctions; checked+hover composition resolved in DESIGN (hover overlay on top of selected tint) |
  | `VocabularyTab.tsx:265-315` menu radio items | MenuItem checked → inherits Menu fix | R-SEL-LIST | automatic once Menu lands |
  | `SearchableSelect.module.css:201-204` `.optionSelected` | `primary-subtle` + `color: primary` | already R-SEL-LIST | verify only |
  | `QueueSidebar.module.css:77-79` `.cc-queue__item--active` | `primary-subtle` bg, no accent text | R-SEL-LIST | add accent text color |
  | `NavItem.module.css:43-52,95-103` + `UniversalPanelBottomNav.module.css:52-59` | pill bar / tint | R-NAV-CURRENT — kept as-is | no change; the pill marks "you are here", not a chosen value |
  | `SegmentedControl.module.css:103-139` `.filled .segmentActive`, `:171-176` `.chips .segmentActive` | solid `--color-primary` fill + inverse text | R-SEL-CARD or R-SEL-LIST (in-track selection — DESIGN picks; `.accent .segmentActive :94-97` is already R-SEL-LIST) | repoint active-segment recipe; **contrast gate**: verify `primary-subtle` legibility on the `surface-hover` tinted track on real Chromium in both themes — if it fails, the solid fill becomes a documented variant (golden-rule-9 written justification), not an ad-hoc survivor |
  | `StudyModesTab.module.css:38-58` `.modeCard` (radio card) | custom `--card-background: field` card | R-SEL-CARD via `Card` selected variant | route selected through `Card`'s `.selected` (drop bespoke overrides) |
  | `LanguageProfilePanel.module.css:153-156` `.item:has(.card[aria-checked])` | `primary-subtle` + `inset-selected` | already R-SEL-CARD | verify only |
  | `LanguageProfilePanel.module.css:413-416` `.choice[aria-checked]` | `border-color: primary` outline ring + `primary-subtle` | R-SEL-CARD | swap outline ring for `--shadow-inset-selected` (same recipe as Card `.selected`) |
  | `ModeCards.tsx:41` (Card `variant="selected"`) | R-SEL-CARD already — but `ModeCards.module.css:14-16` overrides `border-width: space-0-5` + `--card-radius: radius-pill` | R-SEL-CARD on the unmodified Card scale | decoration overrides → REQ-12 |
  | Settings subnav underline-selected (V-3 "underline") | underline marker | whatever item 32 ships, converged to R-SEL-LIST/R-NAV-CURRENT | verify post-32 output; if item 32 leaves an underline selected recipe → converge here |

  2. system renders each surface on the recipe; radiogroup/menuitemradio semantics unchanged.
- Alt flow: a surface whose divergent recipe carries real meaning (contrast failure on the muted segment track) → documented variant with written justification + measured contrast evidence; never a fourth ad-hoc recipe.
- Exception: `aria-current` surfaces (sidebar, bottom nav) are R-NAV-CURRENT, not selection — they do not take R-SEL-LIST.
- Rules: exactly two selection recipes survive in panel scope (plus R-NAV-CURRENT for wayfinding and, only if the contrast gate fails, the documented segment variant); no underline-as-selected anywhere in panel scope.
- Postcondition: a user learns "selected" once and it holds on all tabs.
- NFR refs: NFR-1, NFR-2, NFR-4

REQ-2: Floating layers opaque + panel edge (N2 · V-2, V-9, F-11)
- Actor: Maintainer
- Goal: Every floating surface inside the panel = R-FLOAT; the panel shell = R-PANEL-EDGE. No alpha wash on a floating layer; the panel edge is visible on dark AND bright pages.
- Preconditions: `Select.menu` is already canonical (`Select.module.css:163-174` — `field-solid` + `border-emphasized` hairline + `shadow-popover`); `--panel-shadow`/`--panel-border` resolve `shadow-sm`/`transparent` (`tokens.json` `panel` group :690-697 → `tokens.css:521-525` per theme).
- Basic flow:
  1. actor repoints the `panel.*` token group in `tokens.json` (every theme block): `panel.shadow → var(--shadow-modal)`, `panel.border → var(--color-border)` or `var(--color-border-subtle)` — DESIGN picks between the two registry-sanctioned hairlines; the pick is evidence-gated by AC-4's dark+bright-page capture (V-9 risk: `border-subtle` may wash out on bright pages) rather than pre-decided (hairline already painted by `Surface.module.css:9` — only the token value changes; `--panel-border: transparent` is what makes it invisible today). Single-consumer change verified: `variant="panel"` appears only at `UniversalPanel.tsx:193`.
  2. actor converges residual floating/alpha-wash sites:

  | Site (verified) | Defect | Convergence |
  |---|---|---|
  | `LanguageProfilePanel.module.css:272-321` `.menu`/`.menuItem` | hand-rolled portaled popover: `border: none`, `shadow-floating` (weakest), `overlay-hover` item wash | deleted — migrates to R-MENU in REQ-3 |
  | `UniversalPanelBottomNav.module.css:84-102` `.toolRow` (via `--universal-panel-tool-row-bg/-border/-hover-bg`, `tokens.json:777-779`) | `surface-elevated` rest + `overlay-hover` wash hover | deleted — rows migrate to R-MENU/`MenuItem` in REQ-3; the `tool-row-*` tokens retire with them |
  | `SearchableSelect.module.css:85-97` `.menu` | `surface-elevated` but `border: none` | hairline `border` (R-FLOAT) |
  | `SearchableSelect.module.css:163-172` `.option` resting + `:198` `:active` | resting fill `--input-bg` (field = alpha mix) on elevated menu; `overlay-pressed` on active | resting = `surface` per §5.1; pressed = `surface-pressed` — never `overlay-*` |
  | `HintIcon.module.css:40-56` `.hintText` | already `surface-popover` + `border` + `shadow-popover` | verify only |
  | `MediaList.module.css:226-236` `.cc-media__preview` | `dialog-overlay-bg` scrim | correct — scrim slot, not a floating panel; verify only |
  | `CardCreatorPanel`/tab surfaces | none floating | n/a |

  3. actor runs the **residual-surface audit** (this is the enumerated sweep — "Select.menu residual surfaces"): `grep -rn "position: \(fixed\|absolute\)"` + `z-index` under every CSS module rendered inside the panel (universalPanel, cardCreator, vocabulary, sessionRecap, studyModes, settings, sync, condensedAudio subtrees + shared atoms they consume) and checks each floating bg against R-FLOAT; plus `grep -rn "overlay-hover\|overlay-pressed\|color-field[^-]"` for alpha-wash usage on floating/on-surface contexts. The sweep's output list lands in DESIGN/DELIVER evidence — the table above is the verified starting set, not assumed complete.
- Alt flow: a floating surface that genuinely needs translucency (none known) → DESIGN must name it and justify against §5.1; otherwise converged.
- Exception: scrims (`overlay`, `dialog-overlay-bg`) and hover washes on *resting* surfaces are legitimate — only floating-layer backgrounds and on-surface control fills must be opaque.
- Rules: R-FLOAT applies to every portaled surface reachable from the panel (popover/menu/select/hint/sheet); panel shadow+border verified on a bright-content page (V-9 risk — the AC-4 bright-page capture decides which hairline ships).
- Postcondition: no page content bleeds through any floating surface; the panel reads unmistakably above the page.
- NFR refs: NFR-1, NFR-4

REQ-3: Every choice list through `Menu`/`MenuItem` (N3 · V-5 residual, F-11, F-25)
- Actor: Maintainer
- Goal: `Menu`/`MenuItem`/`MenuSeparator` is the only choice/action-list implementation in panel scope; every menu trigger is a visible control (R-TRIGGER), not a bare text link.
- Preconditions: vocab filter/sort menus are already canonical (`VocabularyTab.tsx:259-316` — `Menu` + `radio` `MenuItem` + `MenuSeparator`); the residual defect is trigger presentation + parallel patterns elsewhere.
- Basic flow:

  | Site (verified) | Today | Converges to | Mechanism |
  |---|---|---|---|
  | `VocabularyTab.tsx:212-241` `.toolBtn` filter/sort/edit triggers (`VocabularyTab.module.css:26-34`) | `Button ghost` + `text-secondary` → reads as bare underlined link (V-5) | R-TRIGGER: bordered or field-backed `Button` skin + chevron retained; `aria-haspopup="menu"`/`aria-expanded` preserved | DESIGN picks the trigger skin from existing variants (`outline`, field-backed, or a documented menu-trigger treatment); `.toolBtn` custom color rules deleted |
  | `UniversalPanelBottomNav.tsx:88-115` + `.module.css:67-102` tools sheet | hand-rolled `.toolRow` (`surface-elevated` rest + `overlay-hover` wash) | R-MENU rows inside the `BottomSheet` — `MenuItem` (with `emphasis` for the sheet action style) or `ListItem` if item 31's sheet redesign mandates it | DESIGN picks the row mechanism; either way the `.toolRow` chrome + `tool-row-*` tokens die |
  | `UniversalPanel.tsx:246-262` profile switcher | `Dialog` + `RadioGroup` modal for a single pick | R-MENU: `Menu` anchored to `.profileButton` (`UniversalPanelHeader.tsx:47-60`), `MenuItem radio` per profile, `selected = activeProfileId` | lift a `triggerRef` to the header button; Dialog + RadioGroup deleted |
  | `LanguageProfilePanel.module.css:272-321` kebab `.menu`/`.menuItem` | hand-rolled fixed popover, portaled, `overlay-hover` wash, `menuItemDanger` text-only | `Menu` + `MenuItem` (`destructive` prop for the danger entry, `MenuSeparator` where groups exist) | replace the portaled div wholesale; Menu owns dismissal/arrow-keys/anchoring |

- Alt flow: `Select`/`SearchableSelect` keep `listbox`/`option` semantics (form fields, not menus) — their surfaces converge via REQ-2 only; nav lists (sidebar, bottom nav) are navigation, excluded.
- Exception: a choice list whose interaction `MenuItem` genuinely cannot express (e.g., needs inline controls per row) → justify per golden rule 9; none expected — tools rows are flat actions.
- Rules: `Menu` owns surface, dismissal (outside-click via `composedPath`, Escape via `pushEscapeLayer`, scroll), and arrow-key roving — never re-implemented locally (`Menu.tsx:28-34` contract); `data-cell-id`s preserved.
- Postcondition: `grep` for hand-rolled menu surfaces (`.menu`, `.menuItem` custom classes under panel scope) → 0 outside shared/ui.
- NFR refs: NFR-1, NFR-3, NFR-4

REQ-4: One status-chip molecule (N4 · F-13)
- Actor: Maintainer
- Goal: The status-chip job (unknown/tracking/learning/known/ignore) has exactly one implementation in `shared/ui`, consuming the `--chip-status-*` pastel pairs, with one hover physics.
- Preconditions: three impls today — shared `Chip` (lookup chips `RecapTab.tsx:50-53`, `+N` `:54,:87`), hand-rolled `.statusChip` (`RecapTab.tsx:78-86` + `RecapTab.module.css:98-131`, hover `filter: brightness(1.06)`), `.statusBadge` (`VocabularyTab.tsx:447-455` interactive + `:373` static trash variant + `VocabularyTab.module.css:112-137`, hover `brightness(0.95)` — opposite direction, verified). `--chip-status-*` tokens exist (used by the popup's `.cellHeaderStatus`, `CandidateView.module.css:169-179`).
- Basic flow:
  1. actor promotes the molecule: new `StatusChip` in `src/shared/ui/` (or a `status` variant on `Chip` — DESIGN picks per golden rule 9, smallest proposal; either way it consumes `--chip-status-*` and ships showcase + test per `DESIGN.md §10.2`).
  2. hover/active = solid token-pair swap consistent with `Chip`'s contract (`Chip.module.css:70-104`); `filter: brightness()` is deleted, both directions.
  3. `RecapTab.tsx:78-86` `.statusChip` buttons → molecule; `VocabularyTab.tsx:447-455` cycle button and `:373` static trash badge → molecule (`static`/non-interactive prop — no pointer cursor, no hover swap).
  4. `.statusChip`/`.statusBadge` CSS + `STATUS_CLASS` maps deleted; status labels/`aria-label`s preserved verbatim.
- Alt flow: none — one molecule, all consumers.
- Exception: dictionary popup `.cellHeaderStatus` adoption is out of scope (popup surface outside the panel) — but the molecule must consume the same `--chip-status-*` tokens so the popup can adopt it later.
- Rules: RECAP lookup `Chip`s are a different job (filter chips) — they stay `Chip`; only status chips converge; sizes follow the molecule's own scale (panel = `sm`).
- Postcondition: `grep -rn "statusChip\|statusBadge"` → 0; `filter: brightness` on chips → 0.
- NFR refs: NFR-1, NFR-4

REQ-5: Emphasis recipes — footers, enabled-secondary, destructive (N5 · V-12, V-17, F-25)
- Actor: Maintainer
- Goal: Every action's emphasis truthfully advertises its weight: ≤1 `primary` per surface; enabled-secondary never wears the disabled costume; destructive is distinguishable from ghost siblings.
- Preconditions: **atom gap found in SPECIFY** — `Button.tsx:6` declares `variant: 'secondary'` but `Button.module.css` defines **no `.secondary` rule**; ~60 call sites across ~40 files (`SyncPanel.tsx:257-258`, `CardCreatorDialogContent.tsx:361`, `MediaList.tsx:104`, `QueueSidebar.tsx:182,222`, `SpeedPill.tsx:108,121`, `StudyModeActionBar.tsx:105,130,150`, `SubtitlePractice.tsx:273`, `RecapTab.tsx:216`, dictionary-popup `DictionaryPanelView.tsx:366`, `ImagePanel.tsx:128,140`, `ImportWizard.tsx:362`, `AnkiStatusSyncPanel.tsx:160`, `Select.tsx:440`, `SearchableSelect.tsx:158`, `CopyButton.tsx:61`, `CollapseButton.tsx:55`, `PronunciationButton.tsx:56`, subtitle split-view `SubtitlePanel.tsx:389`, `SubtitleSearchPanel.tsx:94`, `ApiKeyManager.tsx:218`, `SubtitleManagerPanel.tsx:318`, plus `SrsDeckDetail` ×10, local-player, popup, showcase) render base-button chrome — the actual mechanism behind V-17's "disabled costume". Shared atoms multiply the reach: `Chip.tsx:63`, `Tabs.tsx:113`, `Accordion.tsx:108` route internally through `variant="secondary"`, so every Chip-as-button/tab-trigger/accordion-trigger inherits the fix.
- Basic flow:
  1. actor adds the canonical `.secondary` rule to `Button.module.css` — an enabled secondary fill/border recipe distinct from `primary`, `ghost`, and `:disabled` (exact tokens picked in DESIGN; candidate: `surface-elevated`/`field-solid` + `border` family, sitting between `outline` and `ghost`). One atom edit fixes every consumer, including outside the panel.
  2. actor runs the **secondary-consumer sweep**: `grep -rn "variant=.secondary"` over `src/` and checks each consumer for *compensating overrides* that assume the missing class, not just call sites — verified example `SubtitleManagerPanel.module.css:344-356` `.offRow.offRow` (doubles specificity to reset `background`/`box-shadow` but not `border` → a bordered `.secondary` leaks a border onto the off-track row). Each compensating override is classified: reset-complete → rides the new recipe; reset-incomplete → DESIGN resolves atom-side or flags it as a subtitle-file follow-up for that surface's owner — subtitle split-view files are never edited here (Boundaries), and `docs/specs/subtitle-split-view-ac.md` is re-verified after the atom lands (DoD).
  3. card-creator footer (`CardCreatorDialogContent.tsx:292-317`): today `outline`(Clear) + `primarySubtle`(Add) + `primary`(Update) — three weights for sibling commits. Converge to R-EMPH: exactly one `primary` (DESIGN picks which commit owns it), the rest on the single secondary recipe; `Clear` (a destructive-ish reset opening a confirm dialog) reads neutral-secondary or `errorSubtle` — DESIGN picks, but not a third bespoke weight.
  4. playlist destructive (delete vs preview ghost siblings in `PlaylistTab.tsx:227-260` action cluster): destructive carries `errorSubtle`/error-icon treatment or `MenuItem destructive` if moved to a kebab — distinguishable at a glance.
  5. `--opacity-disabled`/`--button-disabled-opacity` + `:disabled` costume applied only where `disabled`/`aria-disabled` is actually true; `Sync now` verified enabled (`SyncPanel.tsx:257-262`, always clickable when signed in) → renders the new secondary recipe.
- Alt flow: an action whose correct weight is genuinely none of primary/secondary/destructive (e.g. the vocabulary `Edit` toggle — a mode switch) → `aria-pressed` + the documented toggle treatment, not an emphasis variant.
- Exception: `primary:disabled` (`field` bg + `text-disabled`, `Button.module.css:157-161`) stays — that IS the true disabled costume; the bug is enabled actions wearing muted chrome, not disabled ones reading disabled.
- Rules: L-SCARCITY enforced per surface; no new variants beyond `.secondary`; the `.secondary` rule must satisfy DESIGN audit greps (tokens only).
- Postcondition: muted-look ⇒ disabled, always; `Sync now`, `Update`, playlist delete each read their true weight.
- NFR refs: NFR-1, NFR-2, NFR-4

REQ-6: Grouping via hairlines; seam collapse (N6 · V-10, F-15)
- Actor: Maintainer
- Goal: Structure is expressed by `divider` hairlines / section labels — never voids or doubled edges.
- Preconditions: sidebar tab/tools groups split by ~64px void (`CollapsibleSidebar.module.css:24-28` `.sections` `gap: space-2` + structural layout); dictionary↔card-creator panes each paint a hairline → 2px seam (`DictionaryTab.module.css:18` `border-right` + `CardCreatorPanel.module.css:10` `border-left`).
- Basic flow:
  1. sidebar: a `divider` hairline (`Separator` atom or border) separates the tab section from the tools section — the void collapses to section spacing + separator; collapsed (≤64px) rail keeps a legible divider treatment.
  2. seam: one of the two pane borders is removed (keep `leftPane`'s `border-right`; drop `CardCreatorPanel`'s `border-left` — the mobile `.cardCreatorPanelMobile` already zeroes it, `CardCreatorPanel.module.css:22`); computed seam = exactly `border-width-hairline` (1px) at desktop widths.
- Alt flow: additional doubled edges discovered in the sweep get the same single-hairline treatment.
- Exception: none.
- Rules: use `--color-divider` for region hairlines — `border-subtle` vanishes on elevated surfaces (`DESIGN.md §5.1:155`); no new spacing voids to fake separation.
- Postcondition: grouping is drawn, not implied; the split panes share one line.
- NFR refs: NFR-1

REQ-7: One EmptyState anatomy (N7 · V-11, F-25)
- Actor: Maintainer
- Goal: Every tab's empty state renders through shared `EmptyState` with the same anatomy (icon + title + description; action where meaningful).
- Preconditions: `PlaylistTab.tsx:172-184` + `.module.css:56-64` hand-roll `.empty` (icon + two `Text`s, no atom); `VocabularyTab.tsx:345,351,417,419` already uses `EmptyState` but title-only (the audit's "lone line"); `RecapTab.tsx:241-246` shows the canonical compact anatomy.
- Basic flow:
  1. playlist empty → `<EmptyState size="compact" icon={<Icon name="audioWave" …/>} title description/>` (copy i18n keys reused); `.empty` CSS deleted.
  2. vocabulary empty states gain the full anatomy (icon + title + description) consistent with siblings — description copy requires new `vocabulary.empty*` hint keys (none exist today; existing title keys `vocabulary.empty`/`.emptyFiltered`/`.emptyTrash` stay unchanged).
  3. playlist loading branch (`records === null` → `Spinner` + `role="status"`, `:164-169`) is a *loading* state, not empty — kept, or mapped to the shared loading pattern if one exists in `shared/ui`.
- Alt flow: a tab whose empty state needs a CTA (e.g., add-first-item) uses `EmptyState`'s `action` slot — same anatomy.
- Exception: EmptyState vertical *centering* inside the pane is item 28's (`CardCreatorPanel.module.css:72-74` owns it today) — not touched, not regressed.
- Rules: `role="status"` announcement preserved (atom provides it); `data-cell-id`s kept.
- Postcondition: one empty anatomy across all six tabs.
- NFR refs: NFR-1, NFR-3

REQ-8: One heading recipe + nav label size (N8 · V-4, V-14)
- Actor: Maintainer
- Goal: The small-caps dialect (`text-transform: uppercase` + wide tracking, sans-only type system) is gone from panel-rendered surfaces; headings speak `Text`/`Heading`/`SectionHeader` token typography; primary nav labels leave the caption size.
- Preconditions: verified uppercase+tracking sites in panel scope:

  | Site | Class |
  |---|---|
  | `CardCreatorDialog.module.css:209-215` | `.cc-dialog__section-title` uppercase + `tracking-wide` |
  | `SettingsDialog.module.css:88-96` `.groupLabel`, `:109-115` `.downloadGroupTitle` | uppercase + `tracking-wide`/`tracking-widest` |
  | `LanguageProfilePanel.module.css:52-61` `.bannerLabel`, `:100-106` `.sectionLabel` | uppercase + literal `0.04em` |
  | `QueueSidebar.module.css:48-54` | `.cc-queue__title` uppercase + `tracking-wide` |
  | `StudyModesTab.module.css:185-192` | `.customsDivider` uppercase |
  | `PracticeOptions.module.css:16-25` | `.eyebrow` — uppercase layered on `Text variant="label"` (the atom is right; the transform is the dialect) |
  | `VocabularyTab.module.css:60-67` | `.groupHeader` uppercase + literal `0.04em` |
  | `ShortcutInput.module.css:33,48,65`; `MultiSelect.module.css:107-108`; `InkTabs.module.css:37-38` | shared atoms carrying uppercase — only converged if they render inside the panel (verify per consumer) |

- Basic flow:
  1. every site above → R-HEAD: `SectionHeader` (title + optional action slot) or `Text variant="label"`/`Heading` — sentence case, token tracking (`--tracking-normal`/`--text-*-letter-spacing`); `text-transform` and hand tracking deleted.
  2. sweep: `grep -rn "text-transform: uppercase"` over every CSS module reachable from the panel → 0 remaining in scope (out-of-scope entrypoints like `srs-study`/`local-player` keep theirs or become follow-up items).
  3. nav label: `NavItem.module.css:15` `--font-size-xs` → `--font-size-sm` (V-14); verified: no mid-word truncation at the 180px expanded rail, labels hidden ≤64–80px container by the existing container queries (`:151-176`); non-panel `NavItem` consumers re-checked.
- Alt flow: small-caps survives ONLY if DESIGN rules it a brand accent — then it needs a token + written rule (`DESIGN.md §10` contribution), which itself resolves the dialect.
- Exception: `<kbd>` glyph casing inside `ShortcutInput` (`kbdModifier`/`kbdKey`) is glyph content, arguably not a heading — DESIGN decides whether those sites converge; heading labels in that atom (`:33`) do.
- Rules: no new type variants outside `Text`/`Heading`/`SectionHeader`; i18n strings unchanged (casing is presentation).
- Postcondition: `grep` clean on panel scope; every heading is a token recipe; nav labels read at label size.
- NFR refs: NFR-1, NFR-2

REQ-9: Affordance recipes — hints, slider track, tiles, chrome icons (N9 · V-15, V-18, V-19, V-21)
- Actor: Maintainer
- Goal: Every control advertises affordance and range via R-AFFORD: hint ⓘ reads as a ghost button; slider unfilled track is visible; action tiles fit their content; overlay-chrome icons carry the bordered-ghost recipe.
- Preconditions: `HintIcon.module.css:18-21` hover = `primary-subtle` + `text-accent-strong` (reads as a selected/radio state; focus outline is correctly `:focus-visible`-only at `:23-26`); `--color-track` = `color-mix(text, transparent 85%)` ≈ 15% (`tokens.json:88,264`) feeding `Slider.module.css:34-38`, `Progress.module.css:5,52`, `Toggle` default (`tokens.json:712`); header ghosts `.profileButton`/`.closeButton`/tokenize halves are borderless vs golden rule 7.
- Basic flow:
  1. `HintIcon` `.hintBtn` → ghost recipe: hover `surface-hover`, accent only on `aria-expanded`/`:focus-visible` (R-AFFORD); `cursor: help` kept or standardized in DESIGN.
  2. slider track: strengthen `--color-track` (or point the slider's unfilled track at a stronger token) so the range is visible on surface backgrounds in both themes — blast-radius check on `Toggle`/`Progress` before touching the shared token; if they need the faint value, DESIGN picks a separate vehicle (one token + ADR only if a genuine gap).
  3. action tiles (V-19 — "action tiles (Q/E) dwarf their keycap", `audit:59`): exact sites pinned by the sweep (practice/shortcut-affordance surfaces in Study Modes/Settings scope); tiles size to content (intrinsic/content-based recipe), not to surrounding voids.
  4. overlay-chrome icons (V-21, golden rule 7): header `.profileButton`, `.closeButton`, tokenize capsule halves gain the overlay-chrome treatment — `border` + theme-primary hover tint (the same ghost-on-overlay recipe the dictionary popup header uses); applied on top of whatever header structure item 31 ships.
- Alt flow: none — four independent recipe applications.
- Exception: focus/selected outlines that are *states* (`:focus-visible` ring) are not chrome borders; don't conflate.
- Rules: R-AFFORD hover contract (`surface-hover`, never `primary-subtle` on a non-selected rest); all recipes token-only.
- Postcondition: live controls look live; the slider's full range is visible; chrome icons read as buttons on busy video.
- NFR refs: NFR-1, NFR-2, NFR-4

REQ-10: Failure stated once (N10 · V-7)
- Actor: Maintainer
- Goal: The AnkiConnect failure renders once per view, at the level it blocks — no banner + inline duplication.
- Preconditions: blocking banner `CardCreatorDialogContent.tsx:208-217` (`cc-alert-error`, `role="alert"`) and ambient status row `CardCreatorSettingsPanel.tsx:408-418` (`cc-connection-status`/`.statusDetail`) can render the same failure in one view.
- Basic flow:
  1. rule: the banner owns the failure *statement* (it appears only when the failure blocks the create flow); the settings row owns *ambient status* (dot + label + retry) and suppresses the duplicated failure text while the banner is mounted in the same view — or the inverse ownership if DESIGN rules the settings row is the blocking level in that view. One view = one statement.
- Alt flow: connection *status* (connected/testing/version) stays ambient in the settings row — only the error duplication dies.
- Exception: none.
- Rules: `role="alert"`/live-region semantics preserved on whichever surface owns the statement; retry affordance stays next to the statement.
- Postcondition: a failure is read once; status remains glanceable.
- NFR refs: NFR-1, NFR-3

REQ-11: Header density → overflow `Menu`; lookup home; icon disambiguation (N11 · V-16, V-22, F-25 icon collision)
- Actor: Maintainer
- Goal: A collapsed/over-dense header overflows tools into a `Menu` instead of an unlabeled ~17-icon strip; one lookup home exists; `slidersHorizontal` stops naming two things.
- Preconditions: **boundary** — the header pill's job/layout (V-6) and tokenize capsule shape (F-12) are item 31's; this item applies overflow-into-Menu + icon chrome to *whatever item 31 ships*, per intent N11 (`audit:56`; durable cite — the "~5 visible cap" was dropped in the analyze review because it only exists in deleted `loop/` evidence).
- Basic flow:
  1. header tool icons beyond the primary set overflow into a kebab `Menu` (`Menu`/`MenuItem`) rather than a bare icon strip; every overflowed action keeps its label inside the menu.
  2. V-22: the header's search-looking surface and the dictionary hero input resolve to one lookup home — co-owned with item 31 (it owns the layout decision; this item owns converging the surviving surface's chrome onto R-AFFORD/R-FLOAT).
  3. `slidersHorizontal` collision (F-25): the glyph names the vocabulary *filter* trigger (`VocabularyTab.tsx:223`) AND the Study Modes tab (`UniversalPanel.tsx:55`, `UniversalPanelBottomNav.tsx:32`) → one keeps it, the other picks a distinct `ICON_CATALOG` icon (DESIGN picks which side + glyph).
- Alt flow: if item 31 ships a different header structure (sheet, rail), the same rule applies to its tools overflow.
- Exception: none.
- Rules: every overflowed action is labeled inside the menu (V-16's failure was unlabeled icons); applied post-31, not on the pre-31 header.
- Postcondition: no unlabeled icon strip; one lookup home; one glyph = one meaning.
- NFR refs: NFR-1, NFR-4

REQ-12: Surface-family unity — card scale + opacity-as-color removal (N12 · F-23, F-14)
- Actor: Maintainer
- Goal: Card radius/decorations follow the `Card` atom's own scale; opacity is never used as a color for text/icon hierarchy.
- Preconditions: `PlaylistTab.module.css:9-10` `.itemRow` forces `radius-md` + 2px `border-left` status stripe (F-23, with dead `--error`/`#e3e3e0` fallbacks item 29 removes); `ModeCards.module.css:14-16` overrides `border-width` + `--card-radius: radius-pill`; `StudyModesTab.module.css:62` `.modeIcon{opacity:.8}`, `:78` `.modeDesc{opacity:.85}`, `:91` `.modeCard:hover{opacity:.85}` (F-14 + off-token hover).
- Basic flow:
  1. playlist rows: `.itemRow` radius override + default-row stripe removed — rows ride the `Card` scale (`--card-radius`); the failed-state stripe (`:14`) either dies or becomes a documented status treatment (DESIGN picks — e.g. `error` tint via tokens, not a bespoke border column).
  2. `ModeCards` border/radius overrides removed → unmodified `Card` geometry.
  3. opacity-as-color: `.modeIcon`/`.modeDesc` get real color tokens (`text-secondary`/`text-muted` — or `currentColor` at full opacity where the `primary-subtle` selected surface needs the accent cascade; DESIGN resolves per-state); `.modeCard:hover` `0.85` → `var(--opacity-hover)` or the Card.interactive hover recipe.
  4. sweep: `grep -rn "opacity:"` under panel scope — any `opacity` on text/icon that is hierarchy (not disabled, not `--opacity-hover`, not a transition keyframe) converts to a color token; contrast ≥4.5:1 re-checked on `primary-subtle` selected surfaces in dark mode (F-14 risk).
  5. V-13 dashed add-boxes converge to one radius + height family (traces AC-15's V-13 clause). Verified sites:

  | Site (verified) | Today | Converges to |
  |---|---|---|
  | `LanguageProfilePanel.module.css:29-31` `.banner` (universal-native box) | `1px` dashed `border` + `radius-xl` + `primary-subtle` | the family recipe |
  | `EmptyState.module.css:106-110` `.root.bordered` | hairline dashed `border` + `radius-lg` (`DictLinksManager.tsx:116` consumes it) | the family recipe — atom-side, all `bordered` consumers follow |
  | `MediaList.module.css:86-88` `.cc-media__empty` | hairline dashed **`--color-text`** (off-token) + `radius-md` + `--input-height` floor | the family recipe; border color moves to the family's border token |
  | `MediaList.module.css:33-34` `.cc-media__dropzone` | hairline dashed `transparent` at rest, revealed on drag-over + `radius-md` | same radius family; transparent-rest behavior kept (drag feedback, not an add-box at rest) |
  | `DictLinksManager.module.css:36-37` `.dropPlaceholder` | hairline dashed `border` + `radius-lg` | same radius family |

  DESIGN picks the family (one radius token + one border-color token + the `--input-height`-class height floor — visual consistency only; hit-target size stays item 30); remaining `dashed` surfaces under panel scope (`Dropzone.module.css:2`, `ResourcesPanel.module.css:157`, `ImportProgress.module.css:7`) are pinned by the sweep and either join the family or are documented as a different job (drag/placeholder feedback). Documented different-job retentions: `Dropzone.module.css` 2px dashed = drag-over affordance (thicker stroke is the reveal signal, not an add-box); `ImportProgress.module.css` `border-subtle` dashed = in-progress placeholder track; `ResourcesPanel.module.css` dashed = drop placeholder. These keep `dashed` because dashed encodes "drop here", not "add item".
- Alt flow: none.
- Exception: keyframe/transition opacity, `disabled` opacity, and the sanctioned `--opacity-hover` are legitimate — not F-14.
- Rules: no per-tab radius override on `Card`; every muted *look* is a muted *token*.
- Postcondition: cards share one radius/decoration scale; text hierarchy is color-tokened end to end.
- NFR refs: NFR-1, NFR-2

### Non-functional (NFR)

| ID | Requirement | Class | Target |
|---|---|---|---|
| NFR-1 | Visual verification — before/after screenshots or pixel-scan per touched surface (DOM rect/computed alone insufficient, per AGENTS.md) | R | every subsystem commit carries captures; overlays re-checked after scroll + near viewport edges |
| NFR-2 | No contrast/a11y regression — opacity→token and selected-recipe changes keep ≥4.5:1 text contrast in light + dark | S | computed-style check on resting AND `primary-subtle`-selected states; WCAG 1.4.x |
| NFR-3 | Behavior parity — handlers and `data-cell-id`s unchanged; `aria-*`/`role` unchanged except REQ-3's sanctioned `Menu` migrations (radio→`menuitemradio`, dialog→menu); existing i18n keys unchanged, new keys added only where anatomy requires (REQ-7 `vocabulary.empty*` hints) | R | unit tests stay green; interaction flows verified on real Chromium |
| NFR-4 | Blast radius — shared-atom edits (`Menu`, `Button.secondary`, `NavItem`, `SegmentedControl`, `StatusChip`, `tokens.json` groups) verified against ALL consumers (dictionary popup, settings dialog, showcase, local player) | S/resource | consumer capture sweep before merge |
| NFR-5 | Sequencing discipline — re-read items 28–32 diffs before locking file-level scope; converge what they ship | ops | spec site map re-verified at DELIVER start |
| NFR-6 | No new tokens/components unless DESIGN proves the gap (then one token + ADR per `DESIGN.md §10`) | resource | zero unapproved additions |

## Flows / States

**Convergence staging (per AGENTS.md — chrome → tab surfaces → shared molecules, one reviewable commit each):**

```
commit 1 (chrome)   : panel edge tokens → header chrome icons → sidebar divider → seam collapse → REQ-11 overflow (on item-31 header)
commit 2 (tabs)     : vocab triggers+groupHeader+statusBadge → playlist rows+empty+destructive → study-modes cards+opacity+divider → settings headings+Sync now → card-creator footer+banner dedup
commit 3 (molecules): MenuItem checked bg → Button.secondary → StatusChip promotion → SegmentedControl (+ documented-variant decision) → NavItem label → SearchableSelect surface
capture per commit  : before/after on every touched surface; Menu/overlay instance vs canonical sibling
```

**Error-surfacing state (REQ-10):**
```
anki healthy          → settings row: status dot + label         (no banner)
anki fails, dialog    → banner owns the statement                (row: status only)
anki fails, settings  → row owns the statement + retry           (no banner in view)
```

## Function ↔ Feature Map

| Function (what the system does) | Features (tools supporting it) |
|---|---|
| Render "selected" in one language | R-SEL-LIST/R-SEL-CARD recipes + site convergence (REQ-1) |
| Keep floating layers legible over any page | R-FLOAT retargets + `panel.*` token edge + residual-surface sweep (REQ-2) |
| Present every choice as the canonical menu | `Menu`/`MenuItem` adoption + R-TRIGGER skins (REQ-3) |
| Render status chips identically | promoted `StatusChip` molecule (REQ-4) |
| Advertise true action weight | `Button.secondary` atom fix + footer/destructive recipes (REQ-5) |
| Express grouping structurally | `divider` hairlines + single-seam panes (REQ-6) |
| Render empty panes uniformly | `EmptyState` routing (REQ-7) |
| Speak one type system | `SectionHeader`/`Text`/`Heading` convergence + NavItem label size (REQ-8) |
| Advertise affordance/range | hint ghost recipe, slider track, content-sized tiles, chrome-icon borders (REQ-9) |
| State a failure once | banner/settings ownership rule (REQ-10) |
| Manage header density | overflow `Menu` + lookup-home convergence + icon disambiguation (REQ-11) |
| Keep surface families unified | card-scale enforcement + opacity→color-token swaps (REQ-12) |

## Data

| Entity | Key fields | Lives in | Retention |
|---|---|---|---|
| Token values | `panel.shadow`, `panel.border`, `universal-panel.tool-row-*` (retire), `color-track` (verify consumers) | `tokens.json` → generated `tokens.css` | permanent (source of truth) |
| `StatusChip` molecule | status enum, static/interactive | `src/shared/ui/` (new or `Chip` variant) | permanent, `DESIGN.md §10` lifecycle |

No runtime state, storage, or messages touched — pure CSS/component convergence.

## Traceability

| Need (intent ID) | REQ | AC (Success Criteria line) |
|---|---|---|
| N1 one selected language | REQ-1 | AC-1, AC-2 |
| N2 opaque floating layers + panel edge | REQ-2 | AC-3, AC-4 |
| N3 canonical Menu for choices | REQ-3 | AC-5, AC-6 |
| N4 one status-chip molecule | REQ-4 | AC-7 |
| N5 unambiguous emphasis | REQ-5 | AC-8 |
| N6 divider-based grouping | REQ-6 | AC-9 |
| N7 one EmptyState anatomy | REQ-7 | AC-10 |
| N8 token typography + nav label | REQ-8 | AC-11 |
| N9 affordance/range advertisement | REQ-9 | AC-12 |
| N10 failure stated once | REQ-10 | AC-13 |
| N11 header density + lookup home | REQ-11 | AC-14 |
| N12 surface-family unity | REQ-12 | AC-15 |
| — cross-cutting | all | AC-16, AC-17 |

| Journey step | REQ |
|---|---|
| AS-IS 1 / TO-BE 1 (panel floats weak, listboxes bleed → modal edge + opaque floats) | REQ-2 |
| AS-IS 2 / TO-BE 3 (footer noise, doubled error, disabled-costume → true emphasis + one statement) | REQ-5, REQ-10 |
| AS-IS 3 / TO-BE 2 (link-triggers, lone empty line, dim-vs-brighten chips → Menu triggers, EmptyState, one chip) | REQ-3, REQ-4, REQ-7 |
| AS-IS 4 / TO-BE 5 (small-caps headings, dead-looking Sync, invisible track, radio-looking hint, icon landfill → token type + affordance + overflow) | REQ-8, REQ-9, REQ-11 |
| AS-IS 5 / TO-BE 4 (sidebar void, 2px seam, five "selected" recipes → hairlines + two recipes) | REQ-1, REQ-6 |
| AS-IS 6 (bright-page edge loss, skipped live actions) | REQ-2, REQ-5 |

## Boundaries

- Always: tokens only (`tokens.json` edited, never generated `tokens.css`); every choice list through `Menu`/`MenuItem`/`MenuSeparator`; `npm run typecheck && npm run lint && npm run test:unit && npm run build` before commit; `DESIGN.md §7` audit greps + `check-design-system-css` (both scopes if item 29's `check-design-system-css:features` gate landed); before/after screenshot or pixel-scan evidence per touched surface; verify shared-atom consumers before merging atom-level changes; overlay/menu edges re-verified after scroll + near viewport edge against a canonical sibling (Menu).
- Ask first: adding any token or component (needs DESIGN gap proof + `§10` lifecycle + ADR if a new token family); deleting the `universal-panel.tool-row-*` token group outright; changing `aria-*`/`role` semantics beyond what MenuItem migration requires (item-30 territory); touching the dictionary popup's own rendering; edits to files owned by items 28–32 beyond the converged recipes (coordinate via `pipeline-state` handoff).
- Never: invent a new visual recipe; `filter: brightness()` on interactive chips; alpha-wash (`field*`/`overlay-*`) floating backgrounds; underline-as-selected; `opacity` as text hierarchy; EmptyState *centering* (item 28), token-literal/typo cleanup beyond what a deleted class removes (item 29), hit-target sizes/focus-trap/tablist semantics (item 30), header-pill job/capsule shape/bottom-nav structure (item 31), settings subnav structure (item 32); editing subtitle split-view *files* — `Button.secondary` reaches those surfaces atom-side (`SubtitlePanel.tsx:389`, `SubtitleSearchPanel.tsx:94`, `ApiKeyManager.tsx:218`, `SubtitleManagerPanel.tsx:318`), an atom-level visual change that is acknowledged and re-verified against `docs/specs/subtitle-split-view-ac.md` per DoD, but no `src/features/subtitle/` file is edited; behavior changes; commit trailers/attribution.

## Success Criteria

Canonical AC source for DELIVER.

- [ ] **AC-1** (N1) — Exactly two selection recipes render in panel scope: choice-in-list = `primary-subtle` bg + accent text; card/segment = `primary-subtle` + `text-accent-strong` + `--shadow-inset-selected`. Verified by computed-style captures on: vocab filter menu checked row, study-mode selected card, segment active, theme ModeCard, language-profile checked card/choice, queue active row. No underline-as-selected or bespoke recipe survives. A third recipe may exist ONLY as a documented variant with written justification + measured contrast evidence (SegmentedControl escape).
- [ ] **AC-2** (N1) — `aria-current` surfaces (sidebar, bottom nav) keep the nav marker recipe and no `aria-current` surface wears a choice-selection recipe. Carve-out: the mobile tools-sheet rows (item 31) intentionally render as `MenuItem` destinations carrying `aria-current="page"` + `menuitemradio` checked state — a menu-of-destinations, not a choice list; this is the sanctioned exception.
- [ ] **AC-3** (N2) — Every floating surface reachable from the panel (select listboxes, menus, hint popover, tools sheet, profile menu, profile kebab) renders on an opaque surface token (`surface-elevated`/`field-solid`/`surface-popover`) + hairline border + `shadow-popover`/`shadow-modal`; `grep`/computed-style audit finds zero `field`/`field-hover`/`overlay-hover`/`overlay` as a floating background. The residual-surface sweep list is attached to the DELIVER report.
- [ ] **AC-4** (N2) — Panel shell renders `shadow-modal` + a visible border on both a dark video page and a bright page, light + dark themes (V-9 edge case).
- [ ] **AC-5** (N3) — Zero hand-rolled choice lists in panel scope: tools-sheet rows, profile switcher, and LanguageProfilePanel kebab all render through `Menu`/`MenuItem`/`MenuSeparator` (destructive entry uses the `destructive` prop); `LanguageProfilePanel.module.css` `.menu`/`.menuItem`/`menuWrap` classes deleted.
- [ ] **AC-6** (N3) — Vocabulary filter/sort triggers carry visible control affordance (border or fill + chevron, R-TRIGGER) — capture shows them reading as controls, not text links.
- [ ] **AC-7** (N4) — One status-chip implementation exists under `src/shared/ui/` consuming `--chip-status-*`; RecapTab and VocabularyTab (interactive + static-trash) consume it; `filter: brightness()` on chips → 0 repo-wide; `.statusChip`/`.statusBadge` deleted; hover physics identical in both tabs.
- [ ] **AC-8** (N5) — `Button.module.css` defines `.secondary` as an enabled-secondary recipe distinct from `primary`/`ghost`/`:disabled`; card-creator footer renders exactly one `primary` + uniform secondaries; `Sync now` captures as clearly enabled; playlist destructive reads distinct from ghost siblings; `--opacity-disabled` appears only where `disabled`/`aria-disabled` is true.
- [ ] **AC-9** (N6) — Sidebar tab/tools groups are separated by a hairline divider (no ~64px void) in expanded AND collapsed rail; the dictionary↔card-creator seam computes to `border-width-hairline` (1px) at desktop widths.
- [ ] **AC-10** (N7) — Every tab empty state renders `EmptyState` (icon + title + description; action where meaningful): playlist hand-rolled `.empty` and vocabulary title-only states converged; `role="status"` preserved; item-28 centering not regressed.
- [ ] **AC-11** (N8) — `grep -rn "text-transform: uppercase"` over panel-rendered CSS modules → 0 (exempt sites, if any, are documented with rule); nav labels render `--font-size-sm` with no mid-word clipping at the expanded rail.
- [ ] **AC-12** (N9) — `HintIcon` hover = `surface-hover` ghost recipe (focus ring on `:focus-visible` only); slider unfilled track visibly distinct from its surface in both themes; V-19 action tiles sized to content; header/chrome ghost buttons carry the overlay-chrome border (golden rule 7).
- [ ] **AC-13** (N10) — The AnkiConnect failure is stated once per view: banner owns the blocking statement in the dialog view; the settings status row shows ambient status without duplicating the failure text; retry stays adjacent to the statement.
- [ ] **AC-14** (N11) — Collapsed/over-dense header tools overflow into a `Menu` (applied to item-31's header output); no unlabeled ~17-icon strip exists; one lookup home per the item-31 layout (V-22); `slidersHorizontal` no longer names two different things.
- [ ] **AC-15** (N12) — Playlist rows ride the `Card` radius scale with no `radius-md` override and no bespoke stripe on default rows; `ModeCards` rides unmodified Card geometry; `grep -rn "opacity:"` under panel scope shows zero hierarchy-masking literals (allowed: `disabled`, `--opacity-hover`, keyframes) — V-13 dashed add-boxes share one radius + height family *as visual consistency* (the `--input-height`-class floor), explicitly NOT asserting hit-target size (item-30 territory).
- [ ] **AC-16** — `npm run typecheck && npm run lint && npm run test:unit && npm run build` green; `DESIGN.md §7` audit greps return 0 on touched files; `check-design-system-css` green (default scope + `check-design-system-css:features` if item 29's gate exists).
- [ ] **AC-17** — Before/after screenshot (or pixel-scan) evidence attached per touched surface — panel shell (dark + bright page, both themes), all six tabs, every converged overlay open (incl. anchor check after scroll + near viewport edge), plus non-panel consumers of every shared atom edited (dictionary popup, settings dialog, showcase).

## Definition of Done

- [ ] All Success Criteria pass
- [ ] `npm run typecheck && npm run lint && npm run test:unit && npm run build` green
- [ ] Design-system CSS check passes (default + features scope where wired)
- [ ] Real-Chromium verification (Playwright persistent Chromium per `testing-extension-browser`): panel over dark AND bright pages, light + dark theme, desktop + 390px, menus/sheets open, hover/focus/checked states
- [ ] Blast-radius captures for shared-atom edits: `Menu` checked-state, `Button.secondary` (~60 call sites / ~40 files), `NavItem` label, `SegmentedControl`, `StatusChip`, `tokens.json` `panel.*`/`color-track`/`tool-row-*` consumers — dictionary popup, settings dialog, local player, showcase pages
- [ ] `docs/specs/subtitle-split-view-ac.md` re-verified after `Button.secondary` lands — subtitle surfaces consume the variant atom-side; no `src/features/subtitle/` file edited
- [ ] Items 28–32 confirmed landed (or their deltas accounted) before file-level scope is locked
- [ ] `docs/2-architechture-system.md` updated (new molecule, Button variant, token-group changes); ADR only if a new token family/variant lifecycle decision was made
- [ ] `git status` clean of stray root files before commit

## Open Questions / Accepted Risks

| Item | Status |
|---|---|
| SegmentedControl `filled`/`chips` solid-primary may be needed for legibility on the `surface-hover` track — contrast gate in REQ-1; failure → documented variant (still satisfies AC-1's escape), never an ad-hoc survivor | risk carried to DESIGN |
| Small-caps may be an intended brand accent — conservative default is token typography; keeping it requires a token + written rule (DESIGN-stage output) | accepted risk |
| `.secondary` recipe's exact tokens unset — constraint is "enabled, distinct from primary/ghost/disabled"; DESIGN picks from the existing map | open (DESIGN) |
| `StatusChip` mechanism — new molecule vs `Chip` variant — DESIGN decides per golden rule 9 smallest-proposal | open (DESIGN) |
| V-19 tile sites + REQ-2 residual-surface list are pinned by the sweeps (durable audit rows only; raw `loop/` evidence is deleted) | accepted |
| `Sync now` verified enabled when signed in (`SyncPanel.tsx:257-262`); a signed-out render path (if any) gets the true disabled costume | verified |
| Tools-sheet row mechanism (`MenuItem` vs `ListItem` under item 31's sheet) — whichever ships, the `overlay-hover` wash dies | open (DESIGN, post-31) |
| NavItem `xs→sm` may crowd the 180px rail or other consumers — AC-11 requires the truncation check; failure → DESIGN-chosen label size | risk carried |
