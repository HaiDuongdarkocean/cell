# Design Brief — up-mobile-chrome (Universal Panel mobile chrome)

> Spec: `docs/specs/up-mobile-chrome.md` (REQ-1..9) · Intent: `docs/intent/up-mobile-chrome.md` · Mode: all (single justified variant)
> Token names theo leaf của `tokens.json` (`sizes-xs` = bậc font 12px, `spacing-5` = 20px, `borderWidth-thick` = nét 2px, `textSecondary` = màu text phụ, `touchTarget-mobile` = floor 44px, `zIndex-overlay-orbital` = lớp badge). CSS vars generated mang tên kebab tương ứng.

## Design Read

One resolved chrome per band: the panel is a viewport-owning surface ≤839px whose only floating chrome is its own — five fully-labeled destinations, a positional pill, a header that names the active surface, and sheets that advertise and behave honestly.

## Function audit

| Function (system does) | REQ | Journey step | Surface |
|---|---|---|---|
| Show ≤5 labeled primary destinations | REQ-1 | TO-BE 2 | Bottom nav bar |
| Route demoted destinations | REQ-1 | TO-BE 5 | Tools sheet nav rows |
| Mark active destination by position | REQ-2 | TO-BE 2 | Bar pill + sheet-row pill |
| Name the active surface | REQ-3 | TO-BE 2 | Header title |
| Toggle tokenize modes in one control | REQ-4 | TO-BE 3 | Natural-width capsule + seam |
| Own the dynamic viewport | REQ-5 | TO-BE 1, 6 | `.panel` frame `100dvh` ≤839px |
| Keep badge off the open panel | REQ-6 | TO-BE 1 | Badge `hide()`/`show()` wiring |
| Advertise collapsed Card Creator | REQ-7 | TO-BE 4 | `MobileSheet` peek header |
| Honest sheet affordances | REQ-8 | TO-BE 5 | `hideDragHandle`, ≥44px close, bottom guard |
| Survive 320px toolbar | REQ-9 | TO-BE 6 | Toolbar horizontal scroll region |

Every element below traces to one REQ row; no decorative additions.

## Journey map (TO-BE, condensed)

1. Badge tap → panel covers viewport edge to edge, badge suppressed.
2. Bottom bar: ≤5 complete ≥`sizes-xs` labels + positional pill; header names the tab.
3. Capsule reads as one segmented control at any width.
4. Collapsed Card Creator peeks by name.
5. Tools sheet lists demoted tabs as nav rows ≤2 taps; grabber absent, close ≥44px, no sliced last row.
6. 600–839px same resolved model; 320px vocab toolbar unclipped.

## Dials

| Dial | Baseline (sibling panels) | This design |
|---|---|---|
| DESIGN_VARIANCE | low — quiet-confidence | **low** — chrome correction, not a new archetype |
| MOTION_INTENSITY | `duration-fast`/`ease-standard` fades | **same** — no new motion |
| VISUAL_DENSITY | 52px bar rows, `sizes-xs` labels | **same** — density comes from deletion (2 tabs) not shrink |

## Inspiration anchor

Feeling: a boarding pass — one surface, one destination name, nothing competing for attention. Non-digital ref: a well-labeled instrument panel where the active dial is the only lit one. Visual ref: the system's own `NavItem` horizontal pill (`NavItem.module.css:95-103`) — the indicator is *ported*, not redesigned.

## Primary job

"Let me see where I am and get where I'm going, in my language, on my phone." Every decision defers to legibility + orientation over chrome decoration.

## Context quote justifying the key choice

> "the 600–839px medium band gets either fullscreen phone chrome or a true floating card with desktop nav, not phone nav inside a 94% rounded card" — intent N8 + spec REQ-5 Rules (fullscreen remap pinned as primary; card model = recorded alternative, rejected here because phone chrome is already active in the band and a second chrome model doubles maintenance for an unmeasured user class).

## Variant — "Owned Surface" (chosen, single `all`-mode variant)

- **IA mental model:** hub-and-spoke — 4 primary spokes on the bar, 2 low-frequency spokes folded into the Tools hub.
- **Visual archetype:** viewport-owning fullscreen surface with a labeled bottom rail.
- **Non-digital reference:** boarding pass (one carrier, one gate).
- **Material / surface:** solid `surface`/`background` fills, `borderWidth-hairline` `color-divider` seams — no glass.
- **Typography treatment:** nav labels `sizes-xs` `weights-medium`; header title `sizes-sm` `weights-semibold`, single-line ellipsis last resort; sheet title existing `sizes-base`.
- **Motion signature:** existing `duration-fast` `ease-standard` color transitions; sheet slide-up `duration-300`; nothing new.
- **UX flow:** badge → owned surface → 5-item bar / Tools hub → demoted rows → back.
- **UI structure:** header `[flag?] [title flex:1 ellipsis] [capsule natural] [close]`; body flex column; bottom rail 5 equal slots; MobileSheet peek = pill + 24px name row.
- **3 dials:** DESIGN_VARIANCE: low, MOTION_INTENSITY: low, VISUAL_DENSITY: medium.
- **Why it fits:** every mechanism already exists (Tools sheet rows, `header` prop, NavItem pill, `hide()`/`show()`, `hideDragHandle`) — the design *stops doing* wrong things rather than adding things; spec Boundaries "Never" list untouched.
- **Risk:** "Dictionary" (en, ~10 chars) is the widest bar label at `sizes-xs` — measured in the mockup at 320px; if it ever exceeded the slot, the spec-mandated fallback is re-deriving the label set, never shrinking below `sizes-xs`.
- **Audit findings:** | finding | solve / defer / reject | rationale |
  |---|---|---|---|
  | M-1/F-7 clipped labels | solve | demotion to ≤5, delete ≤359px 10px+ellipsis rule |
  | M-4 color-only active | solve | NavItem pill recipe ported as `::after` |
  | M-5/F-12/V-6 stretched capsule | solve | `flex:1`→natural, `fullWidth` halves dropped, seam |
  | M-6 no header title | solve | title in reclaimed capsule space |
  | M-2 page strip under nav | solve | `.panel` `100dvh` ≤839px |
  | M-13 hybrid band | solve | fullscreen remap ≤839px (recorded decision) |
  | M-11 anonymous peek | solve | `header` prop = `cardCreator.title` |
  | M-12 dishonest affordances | solve | `hideDragHandle`, ≥44px close, bottom guard |
  | M-15 clipped chevron | solve | toolbar scroll region |
  | Badge above panel | solve | `onOpenChange`→`hide()`/`show()` + fullscreen flag |
  | M-3 scrollport inset | defer → item 28 | declared upstream dep |
  | 44px floor mechanics | defer → item 30 | consumed, not re-derived |
  | TABS SSOT dedup | defer → item 29 | two-registries stays |

## Rejected alternatives

- **Card model for 600–839px** (floating 94% card + desktop sidebar): a second chrome model to maintain for a band with no telemetry; spec pins fullscreen as primary — rejected, recorded.
- **Overflow Menu for REQ-9:** scroll region is one CSS mechanism, no new focus/keyboard semantics, no clipped-affordance risk — `<Menu>` reserved as fallback only if scroll proves awkward on hardware.
- **Real drag-to-dismiss on `BottomSheet`:** low-RAM pointer-jitter learnings; `hideDragHandle` (absent) is the honest default. A functional grabber may replace it later per REQ-8 alt flow — not designed here.

## Demoted pair confirmation (REQ-1 exception)

Fixed: **playlist + recap** (`audioWave`, `clock` icons) — consumption surfaces, lowest task-entry frequency per `audit.md:36`. Bar becomes `dictionary / vocabulary / studyModes / settings / Tools`.

Label budget at 320px, 5 slots → ~64px/slot, `sizes-xs` (12px), Inter `weights-medium`:

| Label | en | vi (wider) | est. width @12px | Fits 64px |
|---|---|---|---|---|
| dictionary | Dictionary | Từ điển | ~60px / ~44px | ✓ (tightest, verified in mockup) |
| vocabulary | Vocab | Từ vựng | ~34px / ~44px | ✓ |
| studyModes | Study | Học | ~32px / ~24px | ✓ |
| settings | Settings | Cài đặt | ~48px / ~42px | ✓ |
| tools | Tools | Công cụ | ~32px / ~44px | ✓ |

No label needs `*Short` beyond what the registry already ships; `vocabularyShort`/`studyModesShort` stay (they're existing shipped keys, complete words). Final pixel check = the 320px mockup capture (`tmp/up-mobile-chrome/`).

## ASCII layout sketch

### 320px — owned surface, Dictionary active

```
┌──────────────────────────────┐ 320
│ ⚑   Dictionary     ◐|◑   ✕   │ header 52px: flag · title · capsule(nat) · close
│──────────────────────────────│
│                              │
│      (tab content flex:1)    │
│                              │
│   ╭──────────────────────╮   │ MobileSheet peek 56px
│   │        ▬▬▬           │   │ pill 32 + name row 24
│   │  Card Creator        │   │ (Dictionary tab only)
│───┴──────────────────────┴───│
│ 🕮      ▛      ⚙      ⚙   ⊞  │ bottom rail 52px
│ Từ điển Từ vựng Học Cài đặt Công cụ   (vi shown — widest)
│       ▁▁▁ (pill under active)│
└──────────────────────────────┘
zero host-page pixels — panel = 100% × 100dvh
```

### 390px — Tools sheet open, Playlist active (demoted)

```
┌────────────────────────────────────┐ 390
│ ⚑   Playlist          ◐|◑     ✕    │ title names demoted tab
│────────────────────────────────────│
│         (content dimmed)           │
│ ┌───────────────────────────────┐  │ BottomSheet 94% w
│ │  Tools              [✕ ≥44px] │  │ NO grabber (hideDragHandle)
│ │ ┌───────────────────────────┐ │  │
│ │ │▌≋ Playlist            (✓) │ │  │ demoted nav rows, aria-current
│ │ │▌◷ Recap                   │ │  │ + left pill on active
│ │ ├───────────────────────────┤ │  │ hairline divider
│ │ │ ⊞ Open Reader             │ │  │
│ │ │ ⊞ Open Memory             │ │  │ existing tool rows
│ │ │ ⊞ Open local player       │ │  │
│ │ └───────────────────────────┘ │  │
│ │         ░░░ fade ░░░          │  │ bottom guard: pad+fade,
│ └───────────────────────────────┘  │ never a sliced row
│ 🕮     ▛     ⚙      ⚙     ⊞        │ bar: NO pill shown
│ Dict   Vocab  Study  Settings Tools│ (demoted active → no bar mark)
└────────────────────────────────────┘
```

### 600–839px — same resolved model (fullscreen remap, hybrid removed)

```
┌──────────────────────────────────────────────┐ ≤839
│ ⚑   Dictionary                  ◐|◑      ✕   │ one chrome model —
│──────────────────────────────────────────────│ identical to ≤599,
│                                              │ just wider slots
│               (tab content)                  │
│                                              │
│─── bottom rail ──────────────────────────────│
│   Dictionary   Vocab   Study   Settings  Tools│
│      ▔▔▔                                      │ pill scales with slot
└──────────────────────────────────────────────┘
NO rounded card, NO page peek — radius 0, 100%×100dvh
```

### ≥768 (768 shown) — same model continues to 839; ≥840 untouched

```
768–839px: fullscreen surface (above layout)
─────────────────────────────────────────────
≥840px   : ┌─overlay──────────────────────────┐
           │  ╭─card 94%, radius, max-w─╮    │
           │  │ ▌sidebar │ header | body │    │  UNTOUCHED —
           │  ╰─────────────────────────╯    │  desktop card+sidebar
           └─────────────────────────────────┘
```

## Responsive table

| Width | Chrome | Nav | Header | Sheet |
|---|---|---|---|---|
| 320 | fullscreen `100dvh`, radius 0 | 5 slots ~64px, `sizes-xs` complete | title + capsule + close, title ellipsizes last | peek 56px; sheet 94%, ≥44px close |
| 390 | same | slots ~78px | same | same |
| 600–839 | fullscreen (remap — hybrid removed) | slots ~120–168px | same | same |
| ≥840 | 94% card + radius + sidebar | bottom rail hidden | title hidden (desktop header unchanged beyond capsule fix) | BottomSheet unchanged rules |

## States for the chosen direction

- **Nav item:** default `text` color; active = `universal-panel-bottom-nav-active-fg` + `::after` pill (`spacing-5` × `borderWidth-thick`, `radius-full`, `color-primary`, `bottom: spacing-0-5`); `:focus` keeps transparent bg, `:focus-visible` ring preserved; demoted-active → NO bar mark anywhere (Tools unmarked). **Label budget rule:** the item's horizontal padding yields to `spacing-0` — the slot width IS the label budget; Button's default ~`spacing-3` sides would consume ~24px and clip "Dictionary" (measured 59px at `sizes-xs` in a ~61px slot at 320px). Label span gets `min-width: 0`.
- **Tools sheet demoted row:** nav row (icon + full `panel.tab.*` label); active row = `aria-current="true"` + left-edge pill port (`spacing-1` × `spacing-4`, `radius-sm` right-caps, `color-primary`) + `universal-panel-bottom-nav-active-fg` fg; divider (`borderWidth-hairline` `color-divider`) separates nav rows from tool rows.
- **Header title:** visible ≤839px only; full `panel.tab.<key>`; ellipsis only after capsule+close keep natural size; absent flag → title shifts left, layout stable.
- **Capsule:** `inline-flex`, `radius-pill` outline + `borderWidth-hairline` `color-border-subtle` + `shadow-sm`; seam = `borderWidth-hairline` `color-divider` between halves; active half `primarySubtle`; media half disabled with `hasMedia=false`; never stretches at any viewport (fix is global, no media query).
- **Frame:** `.panel` ≤839px = `width:100%`, `height:100%` then `height:100dvh` cascade fallback, `radius-none` (radius 0), `max-width:none`; overlay stays `inset:0`; `svh`/`100%` documented fork fallback; inner flex absorbs `dvh` reflow.
- **Badge:** suppressed flag → `display:none` while panel open; `onFullscreenChange` restore consults the flag; restore on close.
- **MobileSheet peek:** pill (32px) + 24px name row — `cardCreator.title`, `sizes-xs` `weights-medium` `color-text-tertiary`, single-line ellipsis, `padding-x: spacing-4`; tap/drag unchanged.
- **BottomSheet:** `hideDragHandle` per consumer (Tools sheet opts in); close ≥`touchTarget-mobile`; scroll region bottom guard = `spacing-6` extra bottom inset + bottom scroll-fade (`mask-image` gradient `spacing-8`) — last row ends cleanly at any content length.
- **Vocab toolbar:** `overflow-x:auto`, controls `flex-shrink:0`, `toolbarSpacer` → `min-width:0` yields to zero, `scrollbar-width:none` + subtle edge fade; ≥841px identical to today.
- **Empty/disabled/focus/pressed:** all inherited — no new states introduced.

## Anti-patterns avoided

- No invented selected-state — pill is the NavItem `.horizontal .pill` recipe ported as CSS (the `.horizontal` label-hiding rule at `NavItem.module.css:119-121` is exactly why we port CSS instead of importing the component).
- No 10px/ellipsis labels — the ≤359px shrink rule is deleted, not tuned.
- No new components/dependencies — NFR-5.
- No badge z-index surgery — suppression via `onOpenChange` channel + fullscreen-aware flag.
- No `tablist`/`tab`/`tabpanel` adoption — item 30's scope.
- Mockup mounts real `UniversalPanelBottomNav`, `UniversalPanelHeader`, `MobileSheet`, `BottomSheet` — comparison against shipped UI is the point.
