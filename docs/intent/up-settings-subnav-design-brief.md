# Design Brief — up-settings-subnav (Labeled settings sub-navigation)

> Spec: `docs/specs/up-settings-subnav.md` · Intent: `docs/intent/up-settings-subnav.md`
> Mockup site: `src/entrypoints/mockup-up-settings-subnav/` · Evidence: `tmp/up-settings-subnav/*.png`
> Mode: `all` — single justified variant (no user gate)
> Token names use leaf names of `tokens.json` (e.g. `--spacing-3` = CSS var space-3).

## Design Read

The settings sub-nav stops being a row of 13 nameless glyphs and becomes a **labeled scroll-strip**: every destination shows icon + text, overflow is announced by edge fades and paging chevrons, and the existing scroll-sync keeps the active label centered — the Settings toolbar works like a tab bar you can actually read.

## Function audit

| Function (what the system does) | Class | Why |
|---|---|---|
| Identify each of the 13 sections | `must-have` | N1/REQ-1 — label beside every icon |
| Mark the active destination | `must-have` | N4/REQ-5 — existing pill recipe |
| Route to a section on activation | `must-have` | REQ-4 — `data-section-id` → `scrollIntoView` |
| Track reading position (scroll spy) | `must-have` | REQ-4 — rAF spy + auto-center |
| Reveal off-screen destinations | `must-have` | N2/REQ-3 — edge fade + chevron `Button`s |
| Orient nav by container width | `must-have` | REQ-2 — `<768px` cutoff via `SIDEBAR_LABEL_MIN_WIDTH` |
| Localize labels + arrow names | `must-have` | REQ-6/REQ-7 — `settings.nav.*` + 2 new keys |
| Icon-only collapsed rail | `remove` (product-unreachable) | REQ-2 — band 600–767 gets labeled strip |
| `title` tooltip naming | `merge` → supplemental | REQ-7 — may remain, no name depends on it |

Primary job: **pick the right settings section on first attempt** — read the name, tap it, land there.

## Journey map

| # | Step | Actor action | System response | UI location |
|---|---|---|---|---|
| 1 | Open Settings | opens panel tab / dialog | labeled strip renders; arrows+fades iff overflowing | `Navigation` horizontal |
| 2 | Scan destinations | reads labels | icon + label per item, nowrap, never truncated | `NavItem` `.horizontal` |
| 3 | Reach off-screen item | taps chevron / pans strip | `scrollBy(±0.75 clientWidth)` smooth; edges hide at bounds | wrapper arrows + mask |
| 4 | Activate a section | click/tap/Enter on item | `aria-current` + pill + section `scrollIntoView`; item auto-centers | `Navigation` machinery |
| 5 | Free-scroll content | scrolls main column | spy marks nearest-top section; strip re-centers | unchanged |
| Edge | strip fits width | — | zero arrows, zero fades | state machine |
| Edge | non-EN locale | `?lang=vi` | wider labels flow into same overflow rule | i18n |

## Dials

| Dial | Baseline | Chosen |
|---|---|---|
| DESIGN_VARIANCE | 1 (icon strip) | **3** — same `Navigation`/`NavItem` stack, labels unhidden, one overflow affordance added |
| MOTION_INTENSITY | 2 | **2** — smooth scroll only (`scroll-behavior:smooth` already on `.horizontal`); fades are pure CSS masks; `prefers-reduced-motion` kills smooth scroll as today |
| VISUAL_DENSITY | 6 (dense icons) | **4** — labels widen items; single-line strip, `max-height` budget unchanged |

## Chosen variant — "Labeled Scroll Strip"

- **IA mental model:** named tab bar — a Settings toolbar of named destinations, not a glyph rail. Familiar from every browser tab strip and `StudyModeActionBar`.
- **Visual archetype:** quiet pill strip — transparent items on a color-surface bar with a hairline `--color-divider` bottom border (existing `Sidebar` horizontal), centered underline pill as the active mark.
- **Non-digital reference:** index tabs on a binder divider — the label IS the affordance.
- **Material / surface:** item transparent → `--color-surface-hover` on hover → `--primary` fg + `--primary` underline pill when `aria-current`; radius stays `--radius-pill`.
- **Typography:** label = `--font-sizes-xs` + `--weights-medium` + `--leading-tight` (the existing `.label` recipe), `nowrap`, no truncation — width flows to overflow.
- **Motion signature:** none new; `--duration-fast` `--ease-standard` color transitions already on `.item`.
- **UX flow:** labeled scan → arrow/drag to reveal → activate → auto-centered active mark.
- **UI structure (the DELIVER diff):**
  - `NavItem.module.css` `.horizontal` — drop `padding:0; gap:0` and `.horizontal .label{display:none}`; gain `padding-inline` = `--spacing-3` (matches `.vertical`'s labeled recipe — one labeled-item spacing across orientations); `gap` falls back to base `.item` `--spacing-2`; `width:auto` + `flex-shrink:0` keep `.label`'s ellipsis rule dormant (REQ-6 rule); min block/inline stays `--touchTarget-mobile`/`--touchTarget-desktop`.
  - `Navigation.tsx` — horizontal branch wraps `<nav>` in `.navWrap` (`display:flex`, `align-items:center`, `min-width:0`, `gap` `--spacing-1`); conditional `Button` `size="sm" shape="circle" variant="secondary"` + `Icon` `chevronLeft`/`chevronRight` at each edge; `ResizeObserver` + passive `scroll` edge-state machine per `StudyModeActionBar.tsx:35-62`; `scrollBy(±0.75 clientWidth, smooth)`; arrows scroll the strip only, never `contentRef`.
  - `Navigation.module.css` — `.horizontal` gains `overscroll-behavior-x: contain` (scrollTrack precedent) + `.fadeStart`/`.fadeEnd` `mask-image` gradient classes toggled by edge state (fade length `--spacing-6`); `.navWrap` + `.arrow` (min `--touchTarget-mobile`/`--touchTarget-desktop` block/inline per `StudyModeActionBar.module.css:22-26`) added.
  - `SettingsDialogContent.tsx:139` — `containerWidth < BREAKPOINTS.medium` → `containerWidth < SIDEBAR_LABEL_MIN_WIDTH` (SSOT 768; collapsed rail unreachable in product).
  - `en.json`/`vi.json` — add `settings.nav.scrollLeft`/`scrollRight` (`studyModes.actionBar.scrollLeft/Right` precedent).
- **Why this over alternatives:**
  - *Menu/overflow "⋯"* (rejected): hides the very names being introduced, adds a second IA level, and an active item inside a closed menu is invisible — breaks REQ-5's glanceable active mark. `Menu` stays the right tool if the strip ever needs a "more" surface — not now.
  - *Rebase on `Tabs`* (rejected per spec): `Tabs` lacks `contentRef`/`sectionRefs`/`scrollNavToId`/`clickScrollingRef` — zero overflow benefit, full scroll-sync rewrite.
  - *Two-row wrapped nav* (rejected): `Sidebar` horizontal `max-height` (`touchTarget` + `--spacing-2` × 2) forbids a second row; wrapping also breaks `scroll-padding` centering.
- **Risk:** 13 labeled items ≈ 1.1–1.4× the widest common strip → overflow is the norm, not the edge; the affordance must read at 320px. Mitigated: arrows are real `Button`s ≥ `--touchTarget-mobile`/`--touchTarget-desktop` block/inline, fades are pure CSS.

## Layout sketches

### ≥768px — standalone dialog `navMode='auto'` → vertical expanded sidebar (unchanged surface)

```
┌──────────────────────── dialog ≥768 ────────────────────────┐
│  Settings     │  main column (cards)                        │
│  ◔ General    │  ┌─────────────────────────────┐            │
│  ◔ Lang prof… │  │ General                     │            │
│  ◔ Media      │  │ …                           │            │
│  ◔ …(13)      │  └─────────────────────────────┘            │
│  ← sidebar →  │                                             │
└───────────────┴─────────────────────────────────────────────┘
Universal panel `navMode='horizontal'` renders the labeled strip
below at EVERY width instead (see next sketches).
```

### 600–767px — NEW band: labeled strip replaces the collapsed icon rail

```
┌────────────── 700px container ──────────────┐
│ ┌─────────────────────────────────────────┐ │
│ │ ◔General ◔Lang… ◔Res… ◔Media ◔Subt… ◔Di░│ │  ← items nowrap;
│ │        ━━━ (active pill)            ▒ › │ │    right fade + ›
│ └─────────────────────────────────────────┘ │    (left hidden at bound)
│  ┌─────────────── cards … ───────────────┐  │
│  │                                       │  │
└──┴───────────────────────────────────────┴──┘
```

### <600px (e.g. 390) — strip overflows both directions once scrolled

```
┌────────── 390px ──────────┐
│ ┌───────────────────────┐ │
│ │‹ ░◔Media ◔Subt… ◔Dic▒›│ │  ← ‹ › arrows + both fades
│ │       ━━━             │ │
│ └───────────────────────┘ │
│  ┌────── cards ────────┐  │
│  │                     │  │
└──┴─────────────────────┴──┘
```

### 320px edge — same recipe; arrows keep `touchTarget` hit areas

```
┌───────── 320px ─────────┐
│ ‹ ░◔Gen… ◔Lang… ◔Res…▒› │
│      ━━━                │
└─────────────────────────┘
```

At every width: labels never wrap, never truncate — excess width is
the strip's horizontal scroll; arrows/fades appear only on
overflowing edges and vanish at bounds or when the strip fits.

## States

- **Per edge (live):** `scrollLeft <= 0` → left arrow+fade hidden · `scrollLeft > 0` → shown · `scrollLeft >= scrollWidth - clientWidth - 1` → right hidden · `scrollWidth <= clientWidth` → all affordances hidden.
- **Per item:** default · hover (`--color-surface-hover`) · active (`aria-current` → `primary` + underline pill `--spacing-5` × `borderWidth-thick`, `radius-full`, `--spacing-0-5` above item bottom) · `:focus-visible` ring (`--spacing-0-5` `color-border-focus`) · disabled (`--opacity-disabled`) — all existing recipes.
- **Surfaces:** panel (forced horizontal, every width) · dialog auto (labeled strip <768, vertical sidebar ≥768).
- **Locales:** `en` + `vi`; `vi` is the widest expected (`Hồ sơ ngôn ngữ`, `Trình phát video`, `Badge từ vựng`).
- **Themes:** light + dark via tokens only.
- **Reduced motion:** `scroll-behavior:smooth` → auto (existing media query).

## Audit findings addressed

| Finding | Verdict | How |
|---|---|---|
| V-8 — icon-only nav unidentifiable | solve | REQ-1 labels in `.horizontal`, REQ-2 kills the 600–767 collapsed band |
| M-7 — edges clip mid-glyph, no cue | solve | REQ-3 fade + chevron arrows, bounds-aware |
| Root cause 5 — `title` tooltip is the only name | solve | label is the primary name; tooltip supplemental |

## Anti-patterns avoided

- No new selected recipe — `NavItem.module.css:95-103` horizontal pill kept verbatim (item 33 territory untouched).
- No `tablist`/`tab`/`tabpanel`, no roving tabindex, no hit-target resizing (item 30 — targets already ≥ `--touchTarget-desktop`/`--touchTarget-mobile`).
- No `Tabs` adoption, no second nav component, no Liquid Glass, no ad-hoc colors — `tokens.json` leaf names only.
- `vertical` + `@container` collapsed rules byte-identical; bottom nav untouched (item 31).

## Responsive table

| Width | Behavior |
|---|---|
| <320–599 | labeled strip; overflow expected → both-edge affordance once scrolled; items `min-height` `--touchTarget-mobile` |
| 600–767 | labeled strip replaces collapsed rail (REQ-2); partial overflow → right-edge affordance |
| 768–1199 | dialog → vertical sidebar; panel → labeled strip (may still overflow below ~1200) |
| ≥1200 | dialog → vertical sidebar; panel → labeled strip, fits or light overflow |
