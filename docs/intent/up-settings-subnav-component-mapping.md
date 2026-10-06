# Component Mapping — up-settings-subnav (Labeled settings sub-navigation)

> Brief: `docs/intent/up-settings-subnav-design-brief.md` · Variant: "Labeled Scroll Strip" · Spec: `docs/specs/up-settings-subnav.md`
> Token names use leaf names of `tokens.json` written as `--<leaf>` (e.g. `--spacing-3` = CSS var space-3).

| Element | Component | Decision | Token(s) | Icon |
|---|---|---|---|---|
| Settings nav strip (`<nav>` landmark) | Navigation | extend — horizontal branch gains `.navWrap` root + edge-affordance state; `<nav>` keeps `aria-label`, click delegation, `overflow-x:auto`; vertical path untouched | `--spacing-1`, `--spacing-2` | — |
| Nav destination item | NavItem | extend — `.horizontal` drops `padding:0; gap:0` + `display:none` on `.label`; gains `padding-inline` `--spacing-3`; `gap` falls back to base `--spacing-2`; `width:auto`+`flex-shrink:0` keep `.label` ellipsis dormant | `--spacing-2`, `--spacing-3`, `--font-sizes-xs`, `--weights-medium`, `--leading-tight`, `--touchTarget-mobile`, `--touchTarget-desktop`, `--radius-pill` | — |
| Active underline pill | NavItem | reuse — `.horizontal .pill` centered recipe verbatim (`NavItem.module.css:95-103`); item 33 owns recipe convergence | `--spacing-5`, `--borderWidth-thick`, `--radius-full`, `--spacing-0-5`, `--primary` | — |
| Scroll-left arrow | Button | reuse — `size="sm" shape="circle" variant="secondary" ripple={false}`, class `.arrow` (min touchTarget block/inline), `aria-label` `settings.nav.scrollLeft`, `data-cell-id="settings-nav-scroll-left"` | `--touchTarget-mobile`, `--touchTarget-desktop` | Icon: `chevronLeft` |
| Scroll-right arrow | Button | reuse — same recipe, `aria-label` `settings.nav.scrollRight`, `data-cell-id="settings-nav-scroll-right"` | `--touchTarget-mobile`, `--touchTarget-desktop` | Icon: `chevronRight` |
| Edge fade (left/right) | Navigation | extend — `.fadeStart`/`.fadeEnd` classes on `.nav.horizontal`, `mask-image` linear-gradient `transparent → #000` over `--spacing-6`, toggled by edge state; pure CSS, no element | `--spacing-6` | — |
| Strip wrapper `.navWrap` | Navigation | extend — flex row sibling container inside `Sidebar` `.body` horizontal (`Sidebar.module.css:72-79`); `flex:1; min-width:0`; arrows outside scroll track | `--spacing-1` | — |
| Section icons per item | Icon | reuse — existing `Icon size="sm" color="current"` inside `NavItem` (`NavItem.tsx:36`) | — | Icon: `settings` |
| Sidebar bar (sticky strip host) | Sidebar | reuse — unchanged; `[data-orientation="horizontal"]` keeps `max-height` = touchTarget + `--spacing-2` × 2 budget and `border-bottom` `--color-divider` hairline | `--color-divider`, `--borderWidth-hairline`, `--zIndex-sticky` | — |
| Orientation cutoff | — | extend — expression change only at `SettingsDialogContent.tsx:139`: `containerWidth < BREAKPOINTS.medium` → `containerWidth < SIDEBAR_LABEL_MIN_WIDTH`; no component change | — | — |
| Arrow i18n names | — | create — new keys `settings.nav.scrollLeft`/`scrollRight` in `en.json` + `vi.json` (`studyModes.actionBar.scrollLeft/Right` precedent); the only new strings | — | — |
| Item labels | — | reuse — existing `settings.nav.*` × 13 in both locales (`en.json:7,402-413`, `vi.json:7,402-413`) | — | — |
| Focus ring on items/arrows | NavItem + Button | reuse — `:focus-visible` outline `--spacing-0-5` `--color-border-focus` (`NavItem.module.css:38-41`); Button ships its own ring | `--spacing-0-5`, `--color-border-focus` | — |

## Notes

- No `create` component — every element maps to `Navigation`/`NavItem`/`Sidebar`/`Button`/`Icon` or CSS-region extensions inside `Navigation.module.css`/`NavItem.module.css`. The archetype (labeled horizontal nav with edge affordance) is expressible by the existing atoms; `Tabs` was rejected because it lacks the scroll-sync machinery (`contentRef`/`sectionRefs`/`scrollNavToId`/`clickScrollingRef`).
- Wrapper semantics (REQ-3 rules): `<nav>` remains the landmark with `aria-label`; `.navWrap` is a plain flex div that must shrink inside the horizontal sidebar `.body` — hence `min-width:0` + `flex:1`.
- Dormant ellipsis (REQ-6 rule): `.label` keeps `overflow:hidden; text-overflow:ellipsis` (`NavItem.module.css:141-149`) — inert under `width:auto`+`flex-shrink:0`; DELIVER may optionally scope it to `.vertical` as defense-in-depth.
- i18n strings (DELIVER fills values): `settings.nav.scrollLeft` → "Scroll sections left" / "Cuộn các mục sang trái"; `settings.nav.scrollRight` → "Scroll sections right" / "Cuộn các mục sang phải".
- Arrows never render when the strip fits — zero-DOM affordance, not hidden-DOM (matches `StudyModeActionBar` conditional render).
- Remaining section-icon ids are `languages`, `library`, `video`, `captions`, `bookOpen`, `move`, `audioWave`, `playRoundedRect`, `download`, `slidersHorizontal`, `sun`, `navRepeat` — all existing `ICON_CATALOG` entries already used at `SettingsDialogContent.tsx:153-167`.
