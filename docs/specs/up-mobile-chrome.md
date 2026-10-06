# Spec: up-mobile-chrome — Universal Panel mobile chrome (nav, header, viewport ownership, honest sheets)

> Intent: `docs/intent/up-mobile-chrome.md` · ui_surface: yes · Mode: all
> Sequencing: lands after item 28 `up-tab-layout-contract` (scrollport/bottom-inset M-3) and item 30 `up-a11y-hit-targets` (the 44px coarse-pointer floor this spec *consumes*, never re-derives) — `audit.md:75` deps `31 ← {28, 30}`.

## Objective

Make the Universal Panel read as one trustworthy surface on the persona's primary device class (320–839px): the bottom bar shows ≤5 destinations with complete ≥12px labels in every shipped locale and a positional active indicator; the header names the active tab beside a natural-width tokenize capsule; the panel owns the mobile viewport edge to edge (resolving the 600–839px hybrid band) with the orbital word badge suppressed while open; the collapsed Card Creator advertises itself by name; every sheet affordance is honest (real-or-absent grabber, ≥44px close, no mid-row content slicing); and the vocabulary toolbar survives 320px unclipped. All mechanisms already exist — Tools-sheet rows (`UniversalPanelBottomNav.tsx:88-116`), MobileSheet `header` prop (`MobileSheet.tsx:82-85`), NavItem `.horizontal .pill` recipe (`NavItem.module.css:95-103`), badge `hide()`/`show()` (`mountOrbitalBadge.ts:187-192`), `hideDragHandle` (`BottomSheet.tsx:28,97`) — no new components or dependencies.

## Actor ↔ System Boundary

| Actor | Triggers | Inputs | Receives/Views |
|---|---|---|---|
| End user (persona 5–80, phone/tablet, coarse pointer) | Opens panel via badge/deep link; activates a nav destination or Tools row; taps/drags sheet affordances; resizes window / rotates device / shows-hides mobile browser chrome | Tap/drag/keypress on nav item, Tools row, sheet pill, close control | Nav labels + positional indicator, header title, owned viewport, named peek header, sheet chrome |
| Orbital badge host | Panel open/close state transitions | `hide()`/`show()` calls; `fullscreenchange` events | Suppressed/restored visibility |
| Locale bundle | Ships `panel.tab.*`, `panel.tools.*`, `cardCreator.*` strings | `en.json:1035-1058`, `vi.json:1035-1058` (vi labels longer: "Từ vựng", "Tổng kết", "Cài đặt", "Công cụ") | — |
| Items 28/30 (upstream) | Ship scrollport bottom-inset contract and the 44px floor | `BottomSheet`/`MobileSheet` target-size mechanics, tab scrollport inset above nav | — |

System-internal processing never includes human behavior. "User picks a destination" is actor input; the system reacts (mark active, render title, switch pane).

## Requirements

### Functional

REQ-1: Bottom nav reduced to ≤5 destinations with complete labels
- Actor: End user
- Goal: Read and activate every primary destination without decoding clipped fragments.
- Preconditions: Viewport ≤839px (`@media (max-width:839px)` at `UniversalPanelBottomNav.module.css:15-19`); panel open; locale ∈ {en, vi}.
- Basic flow:
  1. actor opens the panel at ≤839px
  2. system renders the bottom bar with ≤5 destinations — 4 primary tabs + the Tools button — each label rendered complete at ≥`--font-size-xs` (12px floor, `tokens.json:390-391`)
  3. actor activates the Tools button → system opens the Tools `BottomSheet` listing the demoted destinations as navigation rows (icon + label) above/alongside the existing tool rows, then activating a row calls `onTabChange` and closes the sheet
- Alt flow: actor activates a demoted destination while it is already active → Tools sheet still opens/closes normally; the row marks itself active via `aria-current` (consistent with the nav bar's active marking) while remaining a navigation row, not a decoration.
- Exception: a shipped locale's label exceeds the per-item budget even at 5 items → DESIGN re-derives the demotion pair or label set; silently shrinking below 12px is not a permitted resolution.
- Rules: mechanism = **≤5 destinations by demotion, not scroll and not shrink**. The demoted pair is recorded once — audit-proposed conservative pair is `playlist` + `recap` (`audit.md:36` consumption surfaces, not task entry points); DESIGN confirms by measuring per-locale label widths before freezing. Demoted rows in the Tools sheet reuse the existing `toolsList`/`toolRow` structure (`UniversalPanelBottomNav.tsx:94-115`) — they may be grouped (divider/section) but must read as navigation. Remove the ≤359px `--font-size-2xs` (10px) shrink + ellipsis rule (`UniversalPanelBottomNav.module.css:34-50`) — below the 12px floor it must not exist. `flex:1;min-width:0` item sizing (`:21-32`) stays. This item may extend the mobile registry's destination list; the two-registry dedup (`UniversalPanel.tsx:52-59` vs `UniversalPanelBottomNav.tsx:29-36`, F-20) stays with item 29 — do not refactor TABS SSOT here.
- Postcondition: ≤5 fully-labeled destinations at every width ≤839px in both locales; demoted tabs reachable in ≤2 taps from any tab.
- NFR refs: NFR-1, NFR-4

REQ-2: Positional active indicator on the bottom nav
- Actor: End user
- Goal: See which destination is active without decoding a color tint.
- Preconditions: Bottom nav rendered (REQ-1); `aria-current="true"` already set on the active item (`UniversalPanelBottomNav.tsx:63`).
- Basic flow:
  1. system renders the active item with a positional mark — the NavItem horizontal pill recipe: bottom-centered bar, `width: var(--space-5)`, `height: var(--border-width-thick)`, `border-radius: var(--radius-full)`, `background: var(--color-primary)` (`NavItem.module.css:95-103`)
  2. actor views the mark on the active destination at every mobile width
- Alt flow: none — the indicator is a state recipe, always on for the active item.
- Exception: none beyond rendering.
- Rules: **reuse the NavItem `.horizontal .pill` recipe — do not invent a new selected-state** (recipe convergence is item 33's scope; audit V-3 already counts 5 recipes). The recipe is ported as CSS on the bottom-nav item (a `::after` or pill element positioned per the recipe), keeping the existing color change (`UniversalPanelBottomNav.module.css:55-59`); `:focus` fill-suppression rules (`:61-65`) and the keyboard `:focus-visible` ring are preserved. `aria-current` wiring unchanged. When the active tab is demoted, the bar shows no indicator — orientation is carried by the header title (and the sheet row state); the Tools button is not marked active.
- Postcondition: active destination carries position + color, never color alone.
- NFR refs: NFR-1, NFR-4

REQ-3: Mobile header names the active surface
- Actor: End user
- Goal: Answer "which tab am I on" from the header alone.
- Preconditions: Panel open at ≤839px; `activeTab` available in `UniversalPanel` (registry at `UniversalPanel.tsx:52-59`); header currently renders profile flag + capsule + close only (`UniversalPanelHeader.tsx:46-79`).
- Basic flow:
  1. system resolves the active tab's full label (`panel.tab.<key>` — full keys, not `*Short`) and renders it as the header title in the space reclaimed by REQ-4's natural-width capsule
  2. actor switches tab → system re-renders the title for the new tab (incl. tabs demoted to the Tools sheet — the title names any active `UniversalPanelTab`)
- Alt flow: profile flag absent → title still renders; extremely narrow widths → title may truncate (single-line ellipsis) only after capsule + close keep their natural sizes.
- Exception: `activeProfile` null → header = title + capsule + close (existing conditional `:47-60` already handles).
- Rules: title uses an existing `panel.tab.*` key — no new strings unless the demotion changes which label a tab should show; title is text, not a second nav control; placement/styling is DESIGN's but must not reduce the close or capsule targets below the item-30 floor.
- Postcondition: header identifies the active surface at every mobile width, both locales.
- NFR refs: NFR-1

REQ-4: Tokenize capsule at natural content width with a seam
- Actor: End user
- Goal: Read the tokenize control as one segmented control, not a stretched void.
- Preconditions: `UniversalPanelHeader` rendered at any viewport (defect spans ~330px mobile and ~1000px desktop — `audit.md:44` F-12/M-5, `:56` V-6).
- Basic flow:
  1. system renders `.capsule` sized to content (`inline-flex` natural width — `flex:1` at `TokenizeControls.module.css:2` removed) with a visible seam dividing the two halves
  2. actor views two joined icon halves at 390px and 1440px alike
- Alt flow: `hasMedia=false` → media half still renders disabled inside the same capsule (existing `TokenizeControls.tsx:59` behavior preserved).
- Exception: header too narrow → the title (REQ-3) truncates first; the capsule never squeezes its halves below their floor.
- Rules: seam = hairline divider between halves (token-based, e.g. `--color-border-subtle`/`--color-divider` — DESIGN picks); both `fullWidth` halves (`TokenizeControls.tsx:38`) drop `fullWidth` so each hugs its icon; `role="group"`, `aria-pressed`, disabled state, `data-cell-id`s unchanged; the fix is shared across all viewports — no media query needed.
- Postcondition: capsule measures natural width at every viewport; seam visible; behavior identical.
- NFR refs: NFR-1

REQ-5: Panel owns the mobile viewport — one chrome model per band ≤839px
- Actor: End user (viewport size + browser chrome show/hide as environment input)
- Goal: The open panel covers the dynamic viewport edge to edge at every width ≤839px — no host-page pixels at any side — under one resolved chrome model per band.
- Preconditions: Host `position:fixed;inset:0` on `document.body` (`mountUniversalPanel.ts:93-96`); overlay `absolute;inset:0` inside it (`UniversalPanel.module.css:1-8`); today ≤839px applies `column-reverse`+mobile nav (`:80-84`) while `border-radius`+94% sizing persist until ≤599px (`:106-116`) — the M-13 hybrid (`audit.md:47`); the ~10px page strip under the nav is the M-2 sizing gap (`audit.md:45`, audit-captured `panel.rect` 380×834 in 390×844).
- Basic flow:
  1. actor opens the panel at width W ≤839px
  2. system sizes the frame to the **dynamic viewport** — the `.panel` frame height tracks `100dvh` (or a `visualViewport`-synced height), with `svh`/`100%` recorded as the documented fallback, while the overlay stays `absolute;inset:0` inside the `fixed;inset:0` host (a `dvh` unit there is a no-op) — and the inner layout stays flex-driven (`column-reverse`, `.body{flex:1;min-height:0}` `:94-97`) so a `dvh` resize reflows chrome without content jumps
  3. actor views zero host-page pixels at any edge, with mobile chrome (bottom nav + header title) active
- Alt flow: browser chrome hides/shows or the device rotates → the frame re-tracks the dynamic viewport; inner flex absorbs the change (no re-mount, no scroll reset — scroll preservation itself is item 28's contract).
- Exception: a target fork (Kiwi/Quetta/Edge Android — `BottomSheet.tsx:37` names the class) without reliable `dvh`/`visualViewport` → the documented `svh`/`100%` fallback applies; a partially-covered viewport is a defect to report, not a silent state.
- Rules: **breakpoint remap = extend the fullscreen sizing (`width/height:100%;border-radius:0` currently ≤599px at `:106-116`) to ≤839px** — the conservative resolution matching the phone chrome already active in the band (M-13's simplest option; scrim/page-context loss is an accepted risk from intent). The alternative — a true floating card with desktop nav in 600–839px — is a recorded DESIGN decision; "phone nav inside a 94% rounded card" is the only disallowed outcome. Whichever model, ≥840px desktop card+sidebar stays untouched. `dvh` applies to the `.panel` frame height (and the host only if a fork requires) — the overlay stays `inset:0`; inner layout stays flex — do not wire `visualViewport` JS unless `dvh` proves insufficient in DESIGN.
- Postcondition: one chrome model per band; panel covers the dynamic viewport ≤839px under browser-chrome transitions; choice recorded in `docs/design-system/` or the design artifact.
- NFR refs: NFR-2, NFR-3, NFR-5

REQ-6: Orbital badge suppressed while the panel is open
- Actor: End user (views); Orbital badge host (system↔system)
- Goal: The floating word badge never renders above the open panel; it returns when the panel closes — including across fullscreen transitions.
- Preconditions: Badge host z-index `--z-overlay-orbital:10004` > panel host `--z-overlay-secondary:10002` at every viewport (`tokens.json:544-546`, `mountOrbitalBadge.ts:42,98` vs `mountUniversalPanel.ts:58`); `hide()`/`show()` exist (`mountOrbitalBadge.ts:187-192`) but are never wired to panel state; `onFullscreenChange` unconditionally restores `display:''` (`:139-161`).
- Basic flow:
  1. system opens the panel → calls badge `hide()` (host `display:none`)
  2. system closes the panel → calls `show()` (host `display:''`)
  3. actor views no badge over the open panel; badge returns on close
- Alt flow: panel opened via a path other than the badge click (deep link, message) → suppression still applies — wiring rides panel open state, not the badge's own `onClick`.
- Exception: fullscreen entry while the panel is open and suppressed — `onFullscreenChange` (`:139-161`) reparents the host AND restores `display:''`; suppression must survive this, so the suppressed state is a flag the fullscreen restore consults (or re-application of `hide()` after reparenting) — **the suppression rides the existing `onFullscreenChange` channel, never a parallel display override** (analyze risk row; reparenting at `:130-169` must keep working). Iframe-fullscreen hide (`:148-151`) is independent and preserved.
- Rules: wire at the orchestration point that already owns both controllers (the content-script/mount layer where `panelController` is passed to `mountOrbitalBadge` at `:26,51`), subscribing through the existing `PanelMountController.onOpenChange?` listener (`panelBridge.ts:11`) — never polling `isOpen()`; do not lower the badge's z-index token (fixes nothing — the badge would still shadow-panel in non-panel contexts) and do not special-case viewports: suppression applies whenever the panel is open.
- Postcondition: badge invisible while panel open at every width; restored on close; survives fullscreen enter/exit without leaking.
- NFR refs: NFR-2, NFR-3

REQ-7: Card Creator collapsed sheet advertises itself by name
- Actor: End user
- Goal: Discover the flagship Card Creator from its collapsed peek — a named header instead of an anonymous ~180px pill (`audit.md:46` M-11).
- Preconditions: `isMobile` path (`useIsMobile(BREAKPOINTS.expanded)`, `CardCreatorPanel.tsx:235`); `MobileSheet` already reserves the 24px peek-header slot (`MobileSheet.tsx:82-85,143-144`, `MobileSheet.module.css:88-95`; `HEADER_ROW_HEIGHT_PX=24` at `:18` raises peek to 56px).
- Basic flow:
  1. system mounts `MobileSheet` on the Dictionary tab with the `header` prop populated — at minimum the sheet's name (`cardCreator.title`, e.g. "Card Creator" / "Tạo thẻ"; a contextual term may follow — DESIGN decides)
  2. actor sees the named peek above the bottom nav while collapsed; taps or drags the pill → sheet expands (existing snap machinery `:159-208` unchanged)
- Alt flow: header text overflow → single-line ellipsis inside the 24px row (`overflow:hidden` already at `.header:94`); long vi name fits or truncates gracefully, never wraps.
- Exception: none — `header={undefined}` keeps today's bare pill for any other consumer.
- Rules: the peek header is **the existing `header` prop only** — no new MobileSheet machinery; header content is presentational (tap target stays the pill — the item-30 floor governs its height); peek growth 32→56px is consumed from the layout contract (item 28 owns the scrollport inset the peek overlaps — ordering dependency already declared).
- Postcondition: collapsed Card Creator is identifiable by name at every mobile width in both locales.
- NFR refs: NFR-1, NFR-4

REQ-8: Honest sheet affordances — grabber, close, bottom edge
- Actor: End user
- Goal: Every sheet affordance behaves the way it looks: a grabber that drags or isn't there, a close you can hit, content that never slices mid-row.
- Preconditions: `BottomSheet` is SSOT for mobile sheets — consumed by the Tools sheet, standalone CardCreator, SubtitleManager mobile, dictionary popup mobile (`BottomSheet.module.css:1-4`); grabber is `aria-hidden` decoration with no pointer handlers (`BottomSheet.tsx:97`); close is `size="sm"` ≈32px (`:108-115`); content scrolls inside `max-height:75vh;overflow:auto` (`BottomSheet.module.css:13-19`) so the last row is sliced mid-height at the scroll boundary — bottom `padding: var(--space-4)` (`:18`) exists but nothing guards the cutoff (corrected N7 mechanism per review D4).
- Basic flow:
  1. system renders the Tools sheet (and every `BottomSheet` consumer) with **no decorative grabber** — `hideDragHandle` applied per consumer (`BottomSheet.tsx:28`) as the conservative honest-or-absent resolution
  2. system renders the close control at ≥44px coarse-pointer target (consuming item 30's floor — not re-deriving the mechanics)
  3. system guards the scroll region's bottom edge with extra bottom inset and/or a scroll-fade so the last content row ends cleanly — never clipped mid-height
- Alt flow: DESIGN proves real drag-to-dismiss cheap → a functional grabber may replace `hideDragHandle` on the Tools sheet; both resolutions satisfy this REQ, half-measures (decorative bar + no gesture) do not. Pointer-drag jitter learnings on low-RAM devices gate this to opt-in (analyze risk row).
- Exception: sheet shorter than 75vh (few rows) → bottom inset/fade is harmless padding; no special-casing.
- Rules: changes are floor-level improvements every consumer wants; if item 30 ships no BottomSheet-close mechanism, this item applies the floor token/pattern directly (applying ≠ re-deriving); per-surface verification of the three other `BottomSheet` consumers is mandatory evidence (they may keep `hideDragHandle` unset where the old look is desired — it is per-consumer opt-in). The scroll-fade/inset mechanism is DESIGN's; the contract is "no mid-glyph/mid-row slice at the sheet's bottom edge at any content length." Escape/overlay-click/focus-trap behavior (`BottomSheet.tsx:57-75`) unchanged.
- Postcondition: every BottomSheet affordance is honest; close ≥44px; no sliced last row.
- NFR refs: NFR-3, NFR-4

REQ-9: Vocabulary toolbar unclipped at 320px
- Actor: End user
- Goal: Reach every toolbar control (filter chip, sort chip, edit toggle) at the narrowest sanctioned width — no sliced chevron (`audit.md:58` M-15, chevron cut ~x=215 at 320px).
- Preconditions: Vocabulary tab rendered at 320px; toolbar is fixed-flex with `toolbarSpacer` and no overflow handling (`VocabularyTab.tsx:211-256`, `VocabularyTab.module.css:15-29`).
- Basic flow:
  1. system renders the toolbar so its full control set fits — mechanism = the row becomes a designed scroll/overflow region (horizontal scroll on `.toolbar` with controls `flex-shrink:0`, or a collapsed overflow affordance); the spacer yields instead of pushing controls off-edge
  2. actor scrolls/activates and every control is intact — labels never clip mid-glyph
- Alt flow: wider viewports where everything fits → no scroll affordance visible, layout identical to today.
- Exception: a locale label too long even alone → ellipsis inside its own chip is permitted only after the row-level overflow mechanism; a clipped chevron/half-button is always a defect.
- Rules: if an overflow menu is the chosen mechanism it MUST use `<Menu>`/`<MenuItem>` (`src/shared/ui/Menu.tsx`) per AGENTS menu mandate — no hand-rolled listbox; `toolbarSpacer` (`VocabularyTab.module.css:22-24`) may shrink to 0 under overflow; menus/popovers themselves are unchanged; trash-state variants (`inTrash` conditionals) keep working at 320px.
- Postcondition: all toolbar controls reachable and unclipped at 320px in both locales.
- NFR refs: NFR-1, NFR-4

### Non-functional (NFR)

| ID | Requirement | Class | Target |
|---|---|---|---|
| NFR-1 | Usability — legibility & orientation floor | U | Nav labels ≥12px and complete in en+vi at 320/390/600–839; positional active indicator; header names active tab; named Card Creator peek; capsule natural-width + seam |
| NFR-2 | Reliability — viewport ownership under chrome dynamics | R | No host-page pixels at any edge ≤839px under browser-chrome show/hide and rotation; `dvh`→`svh`/`100%` fallback documented; badge suppression survives fullscreen transitions |
| NFR-3 | Compatibility — Kiwi/Quetta/Edge Android forks + shadow DOM | R | `dvh`/`visualViewport` behavior verified or fallback applied; badge suppression composes with fullscreen reparenting; BottomSheet changes verified on all 4 consumers |
| NFR-4 | A11y — preserve and consume, don't regress | U | `aria-current`, `aria-expanded`, focus rings preserved; close ≥44px via item-30 floor; no `tablist`/`tab`/`tabpanel` adoption (item 30); label text never the only orientation cue replaced |
| NFR-5 | Resource/perf — reuse only | resource | Zero new components/dependencies; CSS + prop wiring only; dynamic-viewport resize must not thrash layout (flex inner, `dvh` frame) |

## Flows / States

**Chrome model by width band (after REQ-5, conservative resolution):**

```
width ≤ 839px   → fullscreen panel (100% × dynamic viewport, radius 0),
                  column-reverse chrome: bottom nav + header title + capsule
width ≥ 840px   → desktop card (94%, radius, max-width) + sidebar — UNTOUCHED
                  band 600–839px: hybrid REMOVED — the ≤839 rules own it
```

**Badge visibility (REQ-6):**

```
panel closed ──open──▶ panel open: badge.hide()   (host display:none)
panel open   ──close─▶ panel closed: badge.show() (host display:'')
fullscreenchange while suppressed → reparent per onFullscreenChange,
                                    suppressed flag keeps display:none
```

**Tools sheet navigation (REQ-1):**

```
tap Tools ──▶ BottomSheet open: [demoted nav rows] + [tool rows]
tap demoted row ──▶ onTabChange(tab) + sheet close ──▶ tab pane + header title update
```

## Function ↔ Feature Map

| Function (what the system does) | Features (tools supporting it) |
|---|---|
| Navigate primary surfaces on mobile | ≤5-item bottom bar (4 tabs + Tools) — REQ-1; Tools sheet navigation rows — REQ-1 |
| Mark the active destination | `aria-current` + NavItem horizontal pill recipe — REQ-2; header title — REQ-3 |
| Toggle tokenize modes | Natural-width split capsule with seam — REQ-4 |
| Own the mobile viewport | Dynamic-viewport (`dvh`) frame sizing + ≤839px fullscreen remap — REQ-5 |
| Keep floating chrome out of the open panel | Badge `hide()`/`show()` wired to panel open state + fullscreen-aware suppression flag — REQ-6 |
| Advertise the collapsed Card Creator | `MobileSheet` `header` prop (24px peek row) — REQ-7 |
| Dismiss/scroll sheets honestly | `hideDragHandle`, ≥44px close, bottom inset/scroll-fade — REQ-8 |
| Keep toolbar controls reachable | Toolbar overflow region (scroll or Menu-based collapse) — REQ-9 |

Rules hold: no feature without a function; no function without ≥1 feature.

## Data

| Entity | Key fields | Lives in | Retention |
|---|---|---|---|
| `activeTab` | `UniversalPanelTab` (6 values) | `UniversalPanelController` state + `chrome.storage.session` `STORAGE_KEYS.UNIVERSAL_PANEL_TAB` (`mountUniversalPanel.ts:62-76`) | Session — unchanged |
| Mobile nav registry | `key`, `icon`, `label`, + `destination` vs `demoted` split | `TABS` in `UniversalPanelBottomNav.tsx:29-36` (SSOT refactor excluded — item 29) | Static per build |
| Badge suppressed flag | boolean (panel-open derived) | `mountOrbitalBadge` module state, consulted by `onFullscreenChange` | Session |
| Label strings | `panel.tab.*` (full + `*Short`), `panel.tools.*`, `cardCreator.title` | `en.json`/`vi.json:1035-1058,243` | Shipped bundle — no new keys unless DESIGN needs them |

No new storage keys, no schema migration.

## Traceability

| Need (intent ID) | REQ | AC (Success Criteria line) |
|---|---|---|
| N1 (≤5 destinations, complete ≥12px labels, all locales) | REQ-1 | AC-1, AC-2 |
| N2 (positional indicator, not color-only) | REQ-2 | AC-3 |
| N5 (header names active surface) | REQ-3 | AC-4 |
| N4 (capsule = one segmented control, natural width) | REQ-4 | AC-5 |
| N3 (viewport owned; badge never above panel) | REQ-5, REQ-6 | AC-6, AC-7 |
| N8 (one resolved chrome model, 600–839px) | REQ-5 | AC-8 |
| N6 (collapsed Card Creator self-advertises) | REQ-7 | AC-9 |
| N7 (honest sheet affordances) | REQ-8 | AC-10 |
| N9 (320px vocabulary toolbar) | REQ-9 | AC-11 |

| Journey step (TO-BE) | REQ |
|---|---|
| 1. Panel covers dynamic viewport edge to edge; badge suppressed/restored | REQ-5, REQ-6 |
| 2. ≤5 labeled destinations + positional indicator + header title | REQ-1, REQ-2, REQ-3 |
| 3. Capsule = compact segmented control, same at 390px and 1440px | REQ-4 |
| 4. "Card Creator" peeks by name; tap/drag opens | REQ-7 |
| 5. Tools sheet: demoted rows ≤2 taps, honest grabber, ≥44px close, clean bottom edge | REQ-1, REQ-8 |
| 6. 768px = one resolved model; 320px vocab row intact | REQ-5, REQ-9 |

## Boundaries

- Always: `npm run typecheck && npm run lint && npm run test:unit && npm run build` green before commit; tokens/`shared/ui` atoms only, zero new dependencies; **real-Chromium captures at 320 / 390 / one 600–839 width (e.g. 700 or 768) / ≥840, in both en and vi** per AGENTS UI-evidence rule — before/after for every chrome change; `check-design-system-css` clean on touched CSS; verify all four `BottomSheet` consumers (Tools sheet, standalone CardCreator, SubtitleManager mobile, dictionary popup mobile) after REQ-8; reuse NavItem pill recipe, don't invent a 6th selected-state.
- Ask first: any change to `manifest.json` or tokens.json keys beyond what's listed; adopting a real drag gesture on `BottomSheet` (gesture complexity on low-RAM devices — learnings flag jitter); the card-model resolution for 600–839px if DESIGN picks it over fullscreen (recorded decision, intent leans fullscreen); new i18n keys.
- Never: ship labels <12px or mid-glyph truncation as a fit mechanism; lower `--z-overlay-orbital` as the suppression fix; re-derive the 44px floor or scrollport inset mechanics (items 30/28); refactor the two TABS registries into SSOT (item 29); touch the settings subnav strip (item 32); introduce `tablist`/`tab`/`tabpanel` semantics (item 30); edit generated `tokens.css`/`tokens.ts`; desktop sidebar restyle.

## Success Criteria

- [ ] AC-1 (N1/REQ-1): At every width ≤839px the bottom nav renders ≤5 destinations; in both en and vi every label is complete (no mid-glyph truncation) at ≥12px — captures at 320px, 390px, and a 600–839px width.
- [ ] AC-2 (N1/REQ-1): Demoted destinations appear as navigation rows in the Tools sheet and reach their tab in ≤2 taps from any tab; the active demoted tab is still identifiable (header title + sheet row state).
- [ ] AC-3 (N2/REQ-2): The active bottom-nav destination carries the NavItem horizontal pill recipe (bottom-centered bar) — position marks state independent of color; visible in captures at 320/390px.
- [ ] AC-4 (N5/REQ-3): The mobile header displays the active tab's full name at ≤839px in both locales and updates on every tab switch, including tabs demoted into the Tools sheet.
- [ ] AC-5 (N4/REQ-4): The tokenize capsule measures natural content width (no empty pill region) at 390px and 1440px, with a visible seam dividing the halves; toggle/disabled behavior unchanged.
- [ ] AC-6 (N3/REQ-5): With the panel open at ≤839px, zero host-page pixels at any viewport edge — verified at 320/390/768 under mobile browser-chrome shown AND hidden states (Playwright persistent Chromium emulating `dvh` change, or fork smoke test).
- [ ] AC-7 (N3/REQ-6): The orbital badge does not render above the open panel at any width; it reappears on close; suppression survives fullscreen enter/exit (no stuck-hidden, no leak-above-panel).
- [ ] AC-8 (N8/REQ-5): At every width in 600–839px the panel presents one resolved chrome model — no bottom-nav-inside-94%-rounded-card hybrid; the chosen model is recorded in the design artifact.
- [ ] AC-9 (N6/REQ-7): The collapsed Card Creator `MobileSheet` shows a named peek header (≥ `cardCreator.title`) in both locales; tap or drag on the pill expands it; collapsed peek height = 32+24px per `MobileSheet` constants.
- [ ] AC-10 (N7/REQ-8): The Tools sheet (and each `BottomSheet` consumer) shows either a functional drag-to-dismiss grabber or none (`hideDragHandle`); the close target is ≥44px under coarse pointer; scrollable content never slices the last row mid-height (bottom inset and/or fade), verified at 390px on all four consumers.
- [ ] AC-11 (N9/REQ-9): At 320px the vocabulary toolbar renders every control unclipped in both locales (scroll region or collapsed overflow); no sliced chevron, no half-button.

## Definition of Done

- [ ] All Success Criteria pass with capture evidence in `tmp/up-mobile-chrome/` (referenced in report, not committed)
- [ ] `npm run typecheck && npm run lint && npm run test:unit && npm run build` green (build catches Vite/CSS issues tsc misses)
- [ ] Unit coverage: nav destination set/registry test updated for ≤5 + demoted rows; badge suppression wiring test (open→hide, close→show, fullscreen-respects-flag); `MobileSheet` header-prop render if not already covered (`MobileSheet.test.tsx` exists)
- [ ] Real-Chromium verification (Playwright persistent context per `testing-extension-browser`) at 320/390/600–839/≥840, en+vi, incl. browser-chrome show/hide and a fullscreen enter/exit pass
- [ ] `check-design-system-css` clean — no raw values in touched CSS
- [ ] `docs/2-architechture-system.md` updated (chrome model per band, badge suppression channel, demotion set); `docs/0-wiki.md` if docs changed; design artifact records the 600–839px resolution + demoted pair

## Open Questions / Accepted Risks

- **Demoted pair** — playlist+recap is the conservative pick (`audit.md:36`); DESIGN must measure per-locale label widths before freezing; cost of a wrong pick is bounded (≤2 taps back).
- **`dvh` reliability on forks** — Kiwi/Quetta/Edge Android may lag; spec fixes the fallback (`svh`/`100%` on the frame, flex inner) and mandates verification; `visualViewport` JS wiring only if `dvh` fails.
- **600–839px model** — spec pins the conservative fullscreen remap; the card alternative is a recorded DESIGN decision, not silent drift. "Hybrid" is the only disallowed outcome.
- **Real drag vs `hideDragHandle`** — conservative default is absent-grabber (M-12's smallest fix); functional drag requires DESIGN to prove cheap against low-RAM pointer-jitter learnings.
- **Badge suppression channel** — suppression rides `onFullscreenChange`'s display-restore channel via a suppressed flag; a parallel `display` override would race fullscreen reparenting (accepted-risk mitigation from ANALYZE, now a REQ-6 rule).
