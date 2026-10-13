# Design Brief — up-a11y-hit-targets

> Spec: `docs/specs/up-a11y-hit-targets.md` · Intent: `docs/intent/up-a11y-hit-targets.md` · Spec review: `docs/reviews/up-a11y-hit-targets-spec.md` · Mockup: `src/entrypoints/mockup-up-a11y-hit-targets/` (`npm run dev` → `/src/entrypoints/mockup-up-a11y-hit-targets/index.html`)
> Token notation: `touch-target` below denotes the runtime custom property (double-dash prefixed in CSS, injected by `themeTokens.ts`, resolving to `static.touchTarget.mobile` 44px coarse / `static.touchTarget.desktop` 40px fine); `toggle-w`/`toggle-h`/`mobile-sheet-peek-height` are component-local custom properties, not tokens.json leaves. Bare names keep `check-design-brief.mjs` honest.

**Design Read:** An invisible repair — the panel must look pixel-identical while every control's *operable box* silently reaches the pointer floor (44px coarse / 40px fine), and the semantics get labels AT can speak. The design object is the **gap between painted size and hit box**, not any new visual.

**Primary job:** "every control I see is the control I hit — first tap, first Tab stop, first announcement." Frequency: permanent contract, not a flow. Risk: a grown box that swallows a neighbor's tap is worse than a small target — growth direction is chosen per site.

## Function audit

| Function | Class | REQ | Why |
|---|---|---|---|
| Present ≥floor pointer box on every interactive | must-have | REQ-1 | The floor is STANDARD §10.3 / WCAG 2.5.8 — measured, not assumed |
| Keep painted visuals identical | must-have | REQ-1 / N2 | N2: hit growth is invisible or token-bound; no restyle |
| Land focus on a visible element inside `aria-modal` | must-have | REQ-2 | F-2: trap picks `display:none` bottom-nav button today |
| DOM order = visual order on mobile | must-have | REQ-3 | `column-reverse` compensates DOM-first nav; atomic pair |
| Announce nav landmark + current destination + named panes | must-have | REQ-4 | Nav-rail decision recorded in spec |
| Announce custom cards as radios in a group | must-have | REQ-5 | One-attribute fix |
| Announce Advanced disclosure w/o `aria-expanded` | must-have | REQ-6 | Switch + `aria-controls`/`aria-describedby` (recorded) |
| Announce playlist status once | must-have | REQ-7 | Single `role="status"`, per-card `aria-live` removed |
| Prove floor under emulated coarse pointer | must-have | REQ-8 | `isMobile`+`hasTouch` descriptor or CDP media override |

Moments of uncertainty: tapping a 20px toggle track on a trembling hand (→ grown invisible box), first Tab after open (→ visible pick), a grown badge hit overlapping row actions (→ growth direction chosen per site, never horizontal inside clusters).

## Journey map

| # | Step | User action | System response | UI location |
|---|---|---|---|---|
| 1 | Operate | tap any control | grown box activates; paint unchanged | all REQ-1 sites |
| 2 | Open | trigger panel | focus lands on first *visible* focusable | `useFocusTrap` |
| 3 | Cycle | Tab / Shift+Tab | wraps inside dialog; mobile ends at bottom nav | panel DOM order |
| 4 | Browse (AT) | nav item / mode card / Advanced / playlist | landmark + `aria-current="page"`; `radiogroup` position; `aria-controls` region; single `role="status"` | nav surfaces, StudyModes, Playlist |
| 5 | Verify | e2e run | zero `touchTargetViolations` at 44 coarse / 40 fine; no intersecting rects | audit spec |

## Dials

`DESIGN_VARIANCE` 0 (parity is the spec), `MOTION_INTENSITY` 0 (no motion change), `VISUAL_DENSITY` unchanged. The only dials that move are **hit-box geometry** and **semantics** — this brief's real output is the mechanism decisions below.

## Inspiration anchor

Feeling: "tem đo ẩn dưới nắp hộp" — an invisible larger lid under a small knob. Non-digital reference: the oversized contact plate behind a tiny doorbell button — you press the plate, you see the button.

## The mechanism decisions (what DESIGN owns)

### D1 — `::before` bleed is dead as a floor mechanism — every site gets real-box growth

The spec's mechanism ladder ends with "`::before` bleed where no interactive neighbor exists". It cannot ship: REQ-8's collector (`universal-panel-ux-audit.spec.ts:247-263`) measures `el.getBoundingClientRect()` — **pseudo-element overflow never enters the rect**, so a bleed fix still reports the violation and AC-1/AC-3 can never go green. Bleed is also unverifiable pointer area (invisible tap traps) — exactly the risk the intersection rule guards against, moved out of sight.

**Decision:** remove `::before` bleed from the ladder. The interactive element's own border-box always reaches `min-width`/`min-height: touch-target` (the `touch-target` alias resolving `static.touchTarget.mobile` 44px coarse / `static.touchTarget.desktop` 40px fine). Where the audit requires the *painted* affordance to stay small, paint is inset inside the grown box instead of growing with it (D2/D3). Where the painted control may grow (chrome rows, fields, full-width slots), plain `min-*` is used.

### D2 — Inset-paint pattern: box grows, paint stays

For controls whose painted size must not change, the recipe is — zero markup, three declarations on the element:

```
element {                       /* measured box = border-box = floor */
  min-width/min-height: touch-target;
  border-<axis>: max(0px, calc((touch-target - <visual-size>) / 2)) solid transparent;
  background-clip: padding-box; /* paint stops at the padding edge → centered visual */
}
```

- Axis choice: `border-block` when only height is sub-floor (statusBadge — inline padding already paints full width); both axes for symmetric visuals (Toggle track).
- `max(0px, …)` clamps so larger sizes (Toggle md/lg ≥ floor) collapse to zero inset — one rule set covers all sizes.
- Painted edge keeps its radius: `border-radius: var(--radius-pill)` on the border-box propagates a still-huge radius to the padding-box edge — pill stays a pill.
- `box-sizing: border-box` is asserted where the file doesn't already set it, so `min-*` bounds the border box.
- Focus ring (`outline`) hugs the grown border-box — honest: the target *is* the control. Recorded as intended, not a regression.

### D3 — Toggle: label grows, `.input` fills it, track paint is inset (label-growth arm chosen)

Two candidate arms existed — grow the `.toggle` label and re-constrain `.input`, or leave everything and bleed. Bleed is dead (D1), and constraining `.input` to a fixed painted size would leave the *measured element* (the collector selects `input` elements) sub-floor. So:

- `.toggle` (label): `min-width`/`min-height: touch-target` — grows invisibly inside rows that already exceed the floor.
- `.input`: keeps `width/height: 100%` (now = the grown label, satisfying REQ-8 rect measurement) + `box-sizing: border-box` + transparent `border-block`/`border-inline: max(0px, calc((touch-target - toggle-h)/2))` / `… - toggle-w)/2))` + `background-clip: padding-box`. Painted track stays `toggle-w` × `toggle-h` — 36×20px xs, ~60×32px sm — centered.
- `.thumb`: re-anchor from `left/top: var(--spacing-0-5)` to center-relative `left: calc(50% - toggle-w/2 + var(--spacing-0-5))`, `top: calc(50% - toggle-h/2 + var(--spacing-0-5))` — identical result at ungrown sizes, correct centering when grown. Checked `translateX` transform unchanged (relative offset).
- `toggle-w`/`toggle-h` are component-local vars inside `Toggle.module.css` (not tokens.json leaves) — they stay module-internal, unreferenced by name here.
- Rejected: painted track via `::before` on the input (fragile pseudo on form element), inner track `<span>` (markup churn for zero gain over clip).

### D4 — Status badge: vertical inset-paint, interactive variant only

`.statusBadge:not(.statusBadgeStatic)`: `height: var(--spacing-5)` → `height: auto` + `min-height: touch-target` + `border-block: calc((touch-target - var(--spacing-5)) / 2) solid transparent` + `background-clip: padding-box`. Pill keeps painting 20px × full width; the measured button box is 44px coarse / 40px fine, centered within the row that already reserves a `touch-target`-sized `.actionSlot` beside it. `statusBadgeStatic` (trash rows) untouched — it keeps `min-height: 0` + fixed `height`.

### D5 — Fields grow painted height to floor (the input-policy decision the spec deferred)

**Decision: the painted field IS the target — inputs/selects visibly grow to 40/44px.** Rationale: a field's border *is* its affordance; a hit box larger than the painted field invites taps on dead-looking chrome and lies about where the control ends — the same honesty argument that kills `::before` bleed. Spec pre-accepts the metrics shift ("form rows 32→40/44px is the accepted metrics shift"). Implementation: per-size `min-height: max(the per-size input-height tokens, touch-target)` on `Input`, `Select`, `SearchField`, `Textarea` bases — atom-level so non-panel surfaces inherit the same floor contract (STANDARD §10.3 is system-wide). Rejected: per-call-site overrides (half-fixed siblings, drift), short-visual+padded-hit (dishonest affordance).

### D6 — MobileSheet handle: real growth eats 12px of peek — bleed rejected

`.handle` `height: var(--spacing-8)` → `min-height: touch-target`; collapsed peek grows 56px → 64px fine / 68px coarse. The 56px budget was a choice, not a law — a reliable full-width grab target beats 12px of occluded collapsed space. `::before` bleed rejected twice over: downward hits the header row's potential interactives, upward sits on arbitrary panel content, and neither direction registers in rect measurement (D1). JS side: `mobile-sheet-peek-height` must stop being a px literal — set it as `calc(touch-target [+ var(--spacing-6)])` strings (or measure the rendered `.handle` height) so CSS remains SSOT; the keep-in-sync px constants go away.

### D7 — Kebab & circle buttons: slot-fill where a slot exists, min-* elsewhere

- Inside a reserved `touch-target` slot (vocab `.actionSlot`): the `Button`/`IconButton` gets `width/height: 100%` — the hover halo fills the already-reserved slot; resting glyph unchanged.
- Free-standing sm/xs circles (BottomSheet close, dict-toolbar, audio tester, mode-card kebab, dict-link edit/delete): `min-width`/`min-height: touch-target`. The kebab grows down-left into the card corner — overlapping its own parent card is the *intended* overlay pattern (a corner tap fires the kebab, not the card); it never approaches a sibling control. The REQ-8 rect-intersection check must treat ancestor/descendant containment (kebab ⊂ card corner) as allowed and flag only sibling-control overlap — noted for DELIVER.
- Hover halo grows with the box (32→44px on coarse) — a bigger hover affordance on the same resting glyph; accepted as correct, not a repaint.

### D8 — Profile flag: button grows, flag stays 34px

`.profileButton` gets `min-width`/`min-height: touch-target` inside the 52px header; the flag child keeps `width/height: var(--universal-panel-profile-flag-size)` (34px — change its `width/height: 100%` rule to the token) centered in the transparent ghost button. Painted flag identical; the header's 52px row already exceeds the floor so nothing reflows.

### D9 — Dict-link name button & grip: real-box growth inside the row

`.nameButton` `min-height: touch-target` + `width: 100%` (it owns the name Tihoka — no lateral interactive neighbor until the action circles, which sit in their own flex siblings and can't be overlapped by in-box growth). Grip (`DragHandle` sm) grows via padding inside its `gripWrap` slot to reach the floor; edit/delete md circles get `min-*` (D7).

### D10 — Semantics layout (invisible to the eye, drawn here for completeness)

- Sidebar `CollapsibleSidebar` switches `as="aside"` → `as="nav"` (prop already exists — cheapest landmark); bottom `<nav>` unchanged. Both emit `aria-current="page"`; `CollapsibleSidebar` is single-consumer (UniversalPanel) and its active paint comes from `.item.active`, so flipping the emitted value is safe; `UniversalPanelBottomNav.module.css` selector updates `[aria-current="true"]` → `[aria-current]` presence form.
- Six panes → `role="region"` + `aria-label` = tab label (recap gets the same `.tabPane` wrapper it lacks today).
- Customs wrapper `role="group"` → `role="radiogroup"` (aria-label already present).
- Advanced `Toggle` gains optional `ariaControls`/`ariaDescribedby` passthrough props; revealed `VStack` gets `id` + `role="region"` + `aria-label`; region stays conditionally mounted (absent IDREF is legal, ignored by AT).
- Playlist: `aria-live` off the cards; one `VisuallyHidden` `role="status"` + `aria-atomic="true"` region; refresh() writes a localized diff summary, deduped by last-written value.

## Chosen variant — "Inset-paint floor" (single justified variant, `all` mode)

- **IA mental model:** unchanged — same panel, same rows, same controls.
- **Visual archetype:** pixel-parity. The only new "shape" is the invisible hit box.
- **Material / surface:** unchanged tokens; no new color/shadow/radius.
- **Motion signature:** none added.
- **UX flow:** identical — every control simply *works* within a bigger invisible boundary.
- **Why it fits:** it's the only variant consistent with N2 ("no visual restyle") and REQ-8's rect measurement — any bleed-based variant is unshippable by construction (D1).
- **Risk:** transparent-border inset-paint must not collide with existing `border` declarations — statusBadge's hairline transparent border is overridden harmlessly; `.input` had `border: none`. Verified in the mockup.
- **Audit findings:** V-1/M-8/F-4 (sub-floor targets) → solve via D2–D9; F-2 (focus + DOM order) → solve via REQ-2/3 (mechanism-only, no visual decision needed); F-8/F-16/F-17/F-18 → solve via D10; M-10 (unmeasured coarse claim) → solve via REQ-8.

## ASCII sketches

### Specimen sheet (the mockup stage) — before/after, debug rings on

```
┌─ specimen · floor simulator: [fine 40 | coarse 44] · fix: [before | after] ─┐
│                                                                            │
│  Settings row                                                              │
│  ┌──────────────────────────────────────────────┬·······················┐  │
│  │ Show word status                             │╌╌╌╌╌ ┌──────┐ ╌╌╌╌╌╌│  │
│  │                                              │╌╌╌╌╌ │ ◯─── │ ╌╌╌╌╌╌│  │ ← dashed = grown box (44²)
│  │                                              │╌╌╌╌╌ └──────┘ ╌╌╌╌╌╌│  │   solid pill = painted 36×20
│  └──────────────────────────────────────────────┴·······················┘  │
│                                                                            │
│  Vocab row                                                                 │
│  ┌────────────────────────────┬············─┬··········┬··········┐        │
│  │ serendipity        12:04   │╌╌┌────────┐╌╌│╌╌( ✏ )╌╌│╌╌( 🗑 )╌╌│        │
│  │                            │╌╌│ Known  │╌╌│╌╌ 32→44╌╌│╌╌ 32→44╌╌│        │
│  │                            │╌╌└────────┘╌╌│╌╌╌╌╌╌╌╌╌│╌╌╌╌╌╌╌╌│        │
│  └────────────────────────────┴············─┴··········┴··········┘        │
│   pill painted 20px, box 44px (border-block inset-paint)                   │
│                                                                            │
│  Field (painted grows — D5)                                                │
│  ┌──────────────────────────────────────────────────────────────┐          │
│  │ 🔍 Search vocabulary…                              32→44px    │          │
│  └──────────────────────────────────────────────────────────────┘          │
│                                                                            │
│  Sheet handle (real growth, peek −12px — D6)                               │
│  ┌······························································┐          │
│  ┆╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌ ( ─── ) ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┆          │
│  └······························································┘          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Toggle xs anatomy (D3)

```
        grown .toggle label = .input border-box = 44px (coarse)
        ┌───────────────────────────────────┐
        │    transparent border-block 12px  │
        │   ┌─────────────────────────┐     │
        │   │  painted track 36×20    │     │  ← padding-box clip
        │   │  (◯ thumb re-anchored   │     │
        │   │   via center calc)      │     │
        │   └─────────────────────────┘     │
        │    transparent border-block 12px  │
        └───────────────────────────────────┘
        before: border-box 36×20 = paint    after: border-box 44×44, paint 36×20
```

### Mobile DOM order (REQ-3, atomic pair)

```
BEFORE  DOM: bottomNav → sidebar → body      css ≤839: column-reverse
        visual: ┌ body ┐ ┌ bottomNav ┐   focus: nav FIRST ✗

AFTER   DOM: sidebar → body → bottomNav      css ≤839: column
        visual: ┌ body ┐ ┌ bottomNav ┐   focus: nav LAST ✓  (pixel-identical)
```

## Responsive

| Width | Behavior |
|---|---|
| 320–839px (coarse) | `touch-target` resolves 44px; bottom nav DOM-last; rows unchanged height where slots pre-reserved; fields paint 44px tall |
| ≥840px (fine) | `touch-target` resolves 40px; sidebar visible, bottom nav `display:none` (inert in DOM-last position); fields 40px |
| ≤359px | existing nav-item compaction unchanged — nav buttons already meet floor via `universal-panel.bottom-nav-item-height` 52px |

## States

All specimens render default + focus-visible (ring hugs grown box) + hover (halo at grown size) + disabled where applicable (Toggle). Debug overlay draws the measured box; "fix off" state shows today's sub-floor geometry for contrast.

## Anti-patterns avoided

- No `::before`/`::after` hit bleed anywhere — unmeasurable and neighbor-risky (D1)
- No painted-size changes where the audit demands parity — inset-paint instead of restyle (D2)
- No token value edits — the floor is read from the existing `touch-target` alias, never bumped (`static.touchTarget.*` stays 44/40)
- No new components — every element maps to an existing shared atom or feature class
- No `.menuSurface`/ad-hoc lists — not a menu surface at all
- `aria-current` selector updated atomically with the value change — no stale `"true"` matcher
- Mockup is design-time only — specimen replicas prove the CSS; DELIVER ports the declarations into the real module files

## Why this is the only variant

`all` mode asks for one justified variant; here justification is structural, not stylistic: the audit's own measurement (element rects) forbids the only alternative (bleed), and N2 forbids the other (visual growth where parity is required). The remaining freedom — Toggle label-vs-input growth, field visual policy, handle-vs-peek, status region form — is decided above with rationale.
