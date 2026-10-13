# Component mapping — up-a11y-hit-targets

Chosen variant: **Inset-paint floor** (only viable variant — REQ-8 rect measurement kills `::before` bleed; N2 kills painted growth where parity is required). Every change is CSS/attribute surgery on existing atoms and feature modules; **zero new components**. Feature-level elements name the shared atom they are built on; the component column lists `src/shared/ui/` names only.

## Shared components (reuse / extend)

| Element | Component | Decision | Token(s) | Icon |
|---|---|---|---|---|
| Settings + Advanced switch | `Toggle` | extend — `.toggle` label gets `min-width`/`min-height: touch-target`; `.input` keeps `100%` box + `box-sizing: border-box` + transparent `border-block`/`border-inline` `max(0px, calc((touch-target - track)/2))` + `background-clip: padding-box`; `.thumb` re-anchors via center-calc; optional `ariaControls`/`ariaDescribedby` props forwarded to the input (additive, default-preserving) | `touchTarget-mobile`, `touchTarget-desktop`, `spacing-0-5`, `radius-pill` | — |
| Vocab status pill (interactive) | `Button` (variant transparent; feature class `.statusBadge`) | redesign CSS only — `.statusBadge:not(.statusBadgeStatic)`: `height:auto` + `min-height: touch-target` + `border-block` inset + `background-clip: padding-box`; pill paints 20px (`--spacing-5`), box reaches floor; `statusBadgeStatic` untouched | `touchTarget-mobile`, `spacing-5`, `spacing-2`, `chip-status-unknown-bg`, `chip-status-tracking-bg`, `chip-status-learning-bg`, `chip-status-known-bg`, `chip-status-ignore-bg`, `radius-full` | — |
| Vocab row action buttons | `Button` | reuse — sm circle fills the existing `touch-target` `.actionSlot` via `width/height: 100%` (slot already reserved) | `touchTarget-mobile`, `iconbutton-size-sm` | icon: `pencil`, icon: `trash` |
| Dict-link name (inline rename trigger) | native `button` `.nameButton` | redesign CSS — `min-height: touch-target` + `width: 100%` inside its name Tihoka; block padding; no neighbor in growth direction | `touchTarget-mobile`, `font-sizes-sm`, `weights-medium` | — |
| Dict-link rename field | `Input` | reuse — `size="sm"` `variant="ghost"` unchanged; inherits the D5 floor binding | `input-height-sm`, `touchTarget-mobile` | — |
| Dict-link edit/delete circles | `Button` | reuse — md circle + `min-width`/`min-height: touch-target` on the local classes | `touchTarget-mobile`, `iconbutton-size-md` | icon: `pencil`, icon: `trash` |
| Dict-link drag grip | `DragHandle` | extend — `min-width`/`min-height: touch-target` on the grip inside its `.gripWrap` slot (both dims — width is the sub-floor axis too) | `touchTarget-mobile`, `spacing-1` | grip dots (built-in) |
| "Show hint" buttons | `HintIcon` | extend — `.hintBtn` gets `min-width`/`min-height: touch-target` (form-row context, growth invisible) | `touchTarget-mobile`, `iconbutton-size-sm`, `spacing-4-5` (icon box) | info glyph (built-in) |
| Mode-card kebab (xs circle) | `Button` | reuse — `min-width`/`min-height: touch-target`; grows down-left into its own card corner (no sibling collision) | `touchTarget-mobile`, `iconbutton-size-xs` | icon: `ellipsisVertical` |
| Dictionary toolbar tabs | `Button` (role=tab in the dictionary toolbar) | reuse — `min-height: touch-target` on `.TihokaToolbarTab`; chrome row grows 32→44px (accepted metrics shift) | `touchTarget-mobile`, `font-sizes-sm` | per-tab glyphs (existing) |
| BottomSheet close | `Button` sm circle | reuse — `min-width`/`min-height: touch-target` on `.closeIcon`/`.closeButtonAbsolute`; header row has room | `touchTarget-mobile`, `iconbutton-size-sm` | icon: `x` |
| Audio-tester play button | `Button` xs | reuse — `min-width`/`min-height: touch-target` | `touchTarget-mobile`, `iconbutton-size-xs` | icon: `play` |
| Profile flag button | `Button` md circle + `FlagIcon` | extend CSS — `.profileButton` `min-width`/`min-height: touch-target` inside the 52px header; flag child pinned to `var(--universal-panel-profile-flag-size)` (34px painted) instead of `100%` | `touchTarget-mobile`, `universal-panel-profile-flag-size` | flag image (built-in) |
| Panel fields (search, settings, Tags) | `Input`, `Select`, `SearchField`, `Textarea` | extend — per-size `min-height: max(the input-height tokens, touch-target)` on the atom base classes; painted field grows to floor (D5 policy) | `input-height`, `input-height-sm`, `input-height-lg`, `touchTarget-mobile` | icon: `search` (where present) |
| MobileSheet grab zone | `MobileSheet` | extend — `.handle` `min-height: touch-target`; `.snapCollapsed` default becomes `calc(touch-target + var(--spacing-6))`; JS peek constant stops being a px literal | `touchTarget-mobile`, `spacing-8`, `spacing-6`, `radius-element`, `shadow-lg`, `zIndex-overlay-low` | — |
| BottomNav strip + Tools rows | `Button` (`size="md"` vertical pill / `.toolRow`) | reuse — already `touch-target`-bound; `aria-current` value `'true'`→`'page'` + selector `[aria-current]` presence form in `UniversalPanelBottomNav.module.css` | `bottom-nav-item-height` (52px), `font-sizes-2xs` (≤359px label) | icon: `bookOpen`, `scanText`, `slidersHorizontal`, `audioWave`, `clock`, `settings`, `layoutGrid` |
| Desktop sidebar | `CollapsibleSidebar` (`NavItem` items) | extend usage — `as="aside"` → `as="nav"` (prop exists); emitted `aria-current` `'true'`→`'page'` (sole consumer is the panel; paint rides `.item.active`, not the aria selector) | `touchTarget-mobile`, `color-primary-subtle`, `color-surface-hover` | per-item glyphs (existing) |
| Tab panes | `.tabPane` divs | extend markup — `role="region"` + `aria-label` = localized tab label; recap pane gets the same wrapper it lacks today | — | — |
| Custom mode cards | `SelectableCard` (`role="radio"`) | reuse — customs wrapper `role="group"` → `role="radiogroup"` (aria-label already there) | — | icon: `ellipsisVertical` (kebab, sibling not child of the radio) |
| Advanced region (VStack block, `data-tihoka-id="advanced-settings"`) | `Stack` | extend markup — stable `id` + `role="region"` + `aria-label`; stays conditionally mounted | — | — |
| Playlist status announcer | `VisuallyHidden` + `role="status"` | reuse — `VisuallyHidden` wraps the region; `aria-atomic="true"`; dedupe via last-announced ref; per-card `aria-live` removed | — | — |
| Focus trap | `useFocusTrap` (shared hook) | extend — initial pick applies the existing `offsetParent !== null \|\| el === root.activeElement` visibility filter | — | — |
| Panel DOM order | `.panel` flex children | redesign — BottomNav node moves after `.body`; ≤839px `column-reverse` → `column` (atomic pair, REQ-3) | `radius-md` (existing mobile radius) | — |

## CSS tokens consumed

| Use | Token |
|---|---|
| Floor everywhere | `touch-target` alias → `static.touchTarget.mobile` (44px) / `static.touchTarget.desktop` (40px) — read-only consumer |
| Inset-paint recipe | transparent `border-*` + `background-clip: padding-box`; radii `--radius-pill`/`--radius-full` preserved on paint edge |
| Vocab pill | `--spacing-5` (20px paint), `--spacing-2` inline pad, `chip-status-*-bg/fg` per state |
| Slots | `component.iconbutton.size-*` painted sizes; `universal-panel.bottom-nav-item-height` 52px; `universal-panel.profile-flag-size` 34px painted flag |
| Fields | `input.height*` per size vs `touch-target` via `max()` |
| Sheet | `--spacing-6` header row in peek calc; `radius-element`, `shadow-lg`, `zIndex.overlay-low` unchanged |
| Focus | `color-border-focus`/`primary` outlines hug the grown box (honest ring — recorded) |

## New i18n keys (en + vi)

- `panel.paneAria.<tab>` or reuse existing `panel.tab.*` label keys for `role="region"` names — DELIVER picks reuse-first.
- `studyModes.advancedToggle.hint` — the `aria-describedby` text ("Shows or hides advanced settings below" / vi equivalent).
- `playlist.status.ready` / `playlist.status.failed` (pluralized) — the `role="status"` summary text.

## Trace

| Element | REQ | Journey step |
|---|---|---|
| Toggle xs/sm, statusBadge, nameButton, grip, hint, circles, flag, tabs, close, audio play, fields, sheet handle | REQ-1 | TO-BE 1–2, AC-3 |
| Rect-intersection + min(w,h) measurement | REQ-8 | AC-4 |
| Focus-trap visible initial pick | REQ-2 | TO-BE 3, AC-5 |
| BottomNav DOM move + `column` | REQ-3 | TO-BE 3, AC-6 |
| `as="nav"`, `aria-current="page"`, `[aria-current]` selector, named panes | REQ-4 | TO-BE 4, AC-7 |
| `radiogroup` on customs | REQ-5 | AC-8 |
| `ariaControls`/`ariaDescribedby` + named region | REQ-6 | AC-9 |
| `VisuallyHidden` `role="status"` + dedupe; `aria-live` off cards | REQ-7 | AC-10 |
| Emulated coarse pass (device descriptor or CDP) + evidence | REQ-8 | AC-1, AC-2, AC-11 |

## Verification hooks for DELIVER

- All bindings reference `touch-target` — never a px literal.
- `Toggle`/`Input`/`Select`/`SearchField`/`Textarea`/`HintIcon`/`BottomSheet`/`MobileSheet` edits are additive/min-* only — no size-token value changes in `tokens.json` (ask-first boundary).
- Kebab-over-card containment is the allowed intersection class; sibling overlap is the flagged class.
- `data-tihoka-id` attributes unchanged — the audit spec locates controls by them.
