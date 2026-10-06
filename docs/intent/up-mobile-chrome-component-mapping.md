# Component Mapping — up-mobile-chrome

> Brief: `docs/intent/up-mobile-chrome-design-brief.md` · Variant: "Owned Surface" · Elements deconstructed từ mockup `src/entrypoints/mockup-up-mobile-chrome/`
> Token names theo leaf của `tokens.json`. "create" = region CSS trong feature `.module.css` — KHÔNG tạo shared component mới (NFR-5: zero new components).

| Element | Component | Decision | Token(s) | Icon |
|---|---|---|---|---|
| Bottom rail container (`nav`) | Flex | create — region CSS trong feature bottom-nav module; `nav` landmark, `display:flex` ≤839px, hidden ≥840px | `universal-panel-bottom-nav-bg`, `universal-panel-bottom-nav-border`, `universal-panel-bottom-nav-item-height`, `spacing-1`, `borderWidth-hairline` | — |
| Destination item (4 primary tabs) | Button | reuse — `variant="ghost" shape="pill" size="md" orientation="vertical"`, `flex:1;min-width:0`, radius 0; registry split bar/demoted (SSOT refactor stays item 29) | `sizes-xs` (via `button-vertical-label-size`), `weights-medium`, `text`, `universal-panel-bottom-nav-active-fg` | `bookOpen`, `scanText`, `slidersHorizontal`, `settings` |
| Tools trigger | Button | reuse — same recipe + `aria-expanded`/`aria-haspopup="dialog"`; never marked active | `universal-panel-bottom-nav-active-fg` | `layoutGrid` |
| Bar active pill | NavItem | extend — recipe `.horizontal .pill` ported as `::after` CSS on the nav item (bottom-centered bar); component NOT imported — `.horizontal` hides labels | `spacing-5`, `borderWidth-thick`, `radius-full`, `color-primary`, `spacing-0-5`, `duration-fast`, `ease-standard` | — |
| Header title | Text | create — one-line styled text in feature header module between flag and capsule; `flex:1;min-width:0`, ellipsis last resort, ≤839px only | `sizes-sm`, `weights-semibold`, `leading-tight`, `text`, `spacing-3` | — |
| Profile flag | Button | reuse — feature header flag button unchanged | `universal-panel-profile-flag-size`, `spacing-0` | — |
| Tokenize capsule | Button | redesign — feature `TokenizeControls`: `.capsule` `flex:1` → `inline-flex` natural width; halves drop `fullWidth`; seam = hairline divider; global fix, no media query | `universal-panel-tokenize-height`, `universal-panel-tokenize-capsule-bg`, `radius-pill`, `radius-none`, `borderWidth-hairline`, `color-border-subtle`, `color-divider`, `shadow-sm` | `scanText`, `video` |
| Panel close | Button | reuse — circle ghost unchanged, target ≥ floor via item 30 | `touchTarget-mobile` | `x` |
| Panel frame / overlay | Overlay | redesign — feature `UniversalPanel.module.css`: fullscreen sizing + `radius-none` extended from ≤599px to ≤839px; frame height `100%` → `100dvh` cascade (`svh`/`100%` fork fallback); overlay stays `inset:0`; inner flex unchanged | `radius-none`, `radius-md`, `zIndex-overlay-secondary`, `color-overlay`, `duration-normal`, `ease-standard` | — |
| Orbital badge | Avatar | reuse — feature `mountOrbitalBadge` wiring only: subscribe `PanelMountController.onOpenChange` → `hide()`/`show()`; suppressed flag consulted inside `onFullscreenChange` display-restore | `zIndex-overlay-orbital`, `zIndex-overlay-secondary` | — |
| Card Creator peek header | MobileSheet | extend — populate existing `header` prop with `cardCreator.title` text; 24px row under pill; single-line ellipsis; no new sheet machinery | `sizes-xs`, `weights-medium`, `color-text-tertiary`, `spacing-4`, `spacing-6`, `leading-tight` | — |
| Tools sheet (modal) | BottomSheet | redesign — consumer sets `hideDragHandle`; close control ≥44px floor (consumed from item 30, fallback = apply `touchTarget-mobile` min-size directly); scroll region gains bottom inset + fade so last row never slices | `touchTarget-mobile`, `spacing-6`, `spacing-4`, `radius-element`, `color-overlay`, `duration-300`, `ease-standard`, `color-surface` | `x` |
| Demoted nav rows (in sheet) | Button | reuse — existing `toolsList`/`toolRow` structure (icon + full `panel.tab.*` label); active row = `aria-current="true"` + left-edge pill port (vertical recipe) + active fg | `universal-panel-tool-row-bg`, `universal-panel-tool-row-border`, `universal-panel-tool-row-hover-bg`, `radius-xl`, `radius-sm`, `spacing-3`, `spacing-1`, `spacing-4`, `sizes-sm`, `weights-semibold`, `color-text`, `universal-panel-bottom-nav-active-fg`, `color-primary`, `color-border-emphasized` | `audioWave`, `clock` |
| Nav/tool row divider | Separator | reuse — hairline divider between demoted nav rows and tool rows | `borderWidth-hairline`, `color-divider` | — |
| Vocab toolbar scroll region | Flex | create — `.toolbar` becomes `overflow-x:auto` row; controls `flex-shrink:0`; `toolbarSpacer` collapses to zero under overflow; `scrollbar-width:none` + optional edge fade | `spacing-1`, `spacing-2` | — |
| Vocab toolbar chips | Button | reuse — filter chip, sort chip (`chevronDown`), edit toggle — untouched beyond `flex-shrink:0` | `sizes-sm`, `textSecondary` | `chevronDown`, `pencil` |

## Notes

- Pill ports (bar `::after` + sheet-row left edge) reuse the two NavItem positional recipes — horizontal bottom bar and vertical left bar — the same marks `NavItem` already ships. No third recipe is introduced (item 33 boundary).
- `MobileSheet` peek growth 32→56px is consumed from the layout contract; item 28 owns the scrollport inset it overlaps (declared `31←{28,30}` ordering).
- Demoted rows call `onTabChange` then close the sheet — identical to `toolRow` activation, so ≤2 taps holds.
- Badge suppression has no visual element in the mapping beyond wiring — the mockup demonstrates it as a toggle-able state.
