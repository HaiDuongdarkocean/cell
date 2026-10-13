# Spec: up-a11y-hit-targets — Universal Panel accessibility floor

> Intent: `docs/intent/up-a11y-hit-targets.md` · ui_surface: yes · Mode: all
> Evidence base: `docs/audits/20261006-universal-panel-ux-audit.md` (V-1/M-8/F-4/F-2/M-9/F-8/F-16/F-17/F-18/M-10); floor contract `src/shared/styles/STANDARD.md:311-315` (§10.3: coarse ≥44px, fine ≥40px; WCAG 2.5.8 AA minimum 24px).

## Objective

Bind every interactive element inside the Universal Panel surface to the pointer-adaptive `--touch-target` token (44px coarse / 40px fine, `tokens.json:554-557` + `themeTokens.ts:59-61`) so no measured target falls below the floor — today the worst sit at 18.7–32px, below even WCAG 2.5.8's 24px. Fix the modal's focus trap so opening the panel lands focus on a **visible** element inside the `aria-modal` dialog (it currently picks a `display:none` bottom-nav button, `useFocusTrap.ts:34-35`), and reorder the BottomNav after `.body` in the DOM so mobile focus order matches visual order (`UniversalPanel.tsx:207-211` vs `UniversalPanel.module.css:80-84` `column-reverse`). Land the semantics batch: nav-rail semantics for the tab strip (decision recorded below), `radiogroup` for custom mode cards, disclosure semantics on the Advanced toggle, and a single `role="status"` for playlist churn. Prove it: re-run the existing audit spec under **emulated coarse pointer** (`isMobile`+`hasTouch` device descriptor or CDP `Emulation.setEmulatedMedia` — `hasTouch: true` alone does not flip `@media (pointer: coarse)` in Chromium) and drive `touchTargetViolations` to zero.

## Actor ↔ System Boundary

| Actor | Triggers | Inputs | Receives/Views |
|---|---|---|---|
| Touch / low-dexterity user (persona 5–80) | Tap on any panel control | Pointer down/up on a control's hit box | Control activates on first try; visuals unchanged |
| Keyboard-only user | Open panel, Tab / Shift+Tab / Escape | Key events | Focus lands on a visible control inside the dialog; cycling stays contained; focus restored to trigger on close |
| Screen-reader user (AT consuming the a11y tree) | Browse/activate nav items, mode cards, Advanced toggle; playlist status churn | — | Announces nav landmark + current destination, radio group position, expanded region, single status summary |
| Maintainer / agent (owner) | DELIVER edits + verification runs | Code/CSS edits; e2e + npm gates | Empty `touchTargetViolations` list; green gates; before/after evidence |
| Playwright e2e harness | Emulated-pointer audit runs | Device descriptor (`isMobile`+`hasTouch`) or CDP media override | `matchMedia('(pointer: coarse)')` truth + measured rects |

System-internal processing never includes human behavior. "User decides" never appears inside a system flow; actor input is modeled as triggers/inputs.

## Requirements

### Functional

REQ-1: Hit-target floor — every panel control bound to `--touch-target`

- Actor: Touch / low-dexterity user (beneficiary); Maintainer (implements)
- Goal: Every interactive element inside `[data-tihoka-id="universal-panel"]` (and sheets/dialogs it opens: tools BottomSheet, profile Dialog, MobileSheet, dictionary toolbar) presents a pointer target ≥ `var(--touch-target)` — 44px under `@media (pointer: coarse)`, 40px fine — in **both** width and height.
- Preconditions: `--touch-target` is already pointer-adaptive (`themeTokens.ts:59-61`); `Button`/`NavItem` already consume it; the debt is components that never bind it.
- Basic flow:
  1. actor binds each enumerated sub-floor site to `--touch-target` per the mechanism column
  2. system resolves `--touch-target` per primary pointer → hit boxes meet 44px (coarse) / 40px (fine)
  3. coarse-pointer e2e re-measure (REQ-8) returns an empty `touchTargetViolations` list
- Site inventory (all measured; growth mechanism preference order: (1) `min-width`/`min-height: var(--touch-target)` where visual growth is acceptable or the element already sits inside a ≥floor slot; (2) transparent padding inside the element's own box where layout must hold; (3) `::before` bleed **only** where the grown direction has no interactive neighbor — never horizontal bleed inside action clusters):

  | Site | Ref | Measured | Chosen mechanism |
  |---|---|---|---|
  | `Toggle` xs track (9× settings + Advanced) | `Toggle.module.css:18-25` (`--toggle-h: var(--space-5)` = 20px) | 20px | `min-height`/`min-width` on the `.toggle` label inside its row — settings rows already exceed the floor via text+padding, so the label grows invisibly within existing row height; the `.input` track is `width/height: 100%` of the label (`Toggle.module.css:46-47`), so label growth grows the track too — keeping the 20px visual requires separately constraining `.input`, not just the label (DESIGN calls visual policy) |
  | `Toggle` sm | `Toggle.module.css:23-26` | 32px | same |
  | Dict-link name button (inline rename) | `DictLinksManager.tsx:179-191` `.nameButton` | 18.7px | `min-height: var(--touch-target)` + block padding; button fills its column, no neighbor above/below in the row's name Tihoka |
  | Dict-link drag grip / edit / delete circles | `DictLinksManager.tsx:143,197-217` (md circle = `--iconbutton-size-md` 40px → fails coarse) | 40px | bind circle buttons to `min-width`/`min-height: var(--touch-target)`; grip: padding growth inside its slot |
  | HintIcon "show hint" buttons | `HintIcon.module.css:11-16` (Button sm iconOnly) | 32px | min-size binding on `.hintBtn` (form-row context, no tight neighbor) |
  | xs/sm circle `IconButton`/`Button` uses: mode-card kebab, vocab row actions, dictionary toolbar buttons | `tokens.json:733-734` (xs 28 / sm 32); `StudyModesTab.tsx:259-275`; `VocabularyTab.module.css:101-108` (`.actionSlot` already `--touch-target`-sized); `DictionaryToolbar.tsx` | 28/32px | where a `--touch-target` slot already exists (vocab `.actionSlot`): button fills the slot (`width/height: 100%` or min-*). Where the button is overlaid/floating (mode-card kebab): min-* growth if the card corner has room, else `::before` bleed — vertical-only in row contexts, no bleed into a sibling control's rect |
  | Profile flag button | `UniversalPanelHeader.module.css:22-28` (`--universal-panel-profile-flag-size` = 34px, `tokens.json:765`) | 34px | `min-width`/`min-height: var(--touch-target)` on `.profileButton`; flag icon keeps `--universal-panel-profile-flag-size` (visual 34px, target 40/44px) |
  | `.statusBadge` (vocab status cycle) | `VocabularyTab.module.css:112-129` (`height: var(--space-5)` = 20px, `min-height: 0`) | 20px | keep the 20px visual pill; grow the hit via `::before` vertical bleed within the row's own height (vertical direction has no neighbor — horizontal bleed forbidden: `.actionSlot` buttons are lateral siblings) or wrap-in-slot pattern if bleed proves fragile; `min-height: 0` carve-out stays for the pill itself. **Bind only the interactive variant** — `.statusBadgeStatic` (`VocabularyTab.module.css:131`, trash rows `VocabularyTab.tsx:373`) is a non-interactive `<span>` and stays untouched |
  | MobileSheet `.handle` grab zone | `MobileSheet.module.css:54-67` (`height: var(--space-8)` = 32px; 56px peek constraint noted at `:52-53`) | 32px | `min-height: var(--touch-target)` only if the collapsed-peek budget allows, else `::before` top-edge bleed into the sheet body; handle is full-width so horizontal is free — the constraint is the 56px peek, DESIGN decides which side of the trade-off |
  | BottomSheet close (sm icon button) | `BottomSheet.tsx` close + `tokens.json:733` (sm 32px) | ~32px | min-* binding on the close button (header row, room exists) |
  | Dict-popup toolbar tabs | `DictionaryToolbar.tsx:45-51` (`role="tab"` buttons) | 32px | `min-height: var(--touch-target)` — toolbar row grows; acceptable, DESIGN confirms chrome height |
  | Audio-tester play button | `src/features/audio/ui/AudioPanel.tsx` (settings audio test) | 28px | min-* binding |
  | Inputs/selects on `--input-height` = `--size-element-md` 32px (vocab search 38.1px, dictionary search, settings fields, Tags input) | `tokens.json:639,452` | 32–38.1px | `min-height: var(--touch-target)` on the control; **whether the visible field grows to 40/44px or keeps a shorter visual with padded hit is a DESIGN decision** (declared `ui_surface: yes`; form rows 32→40/44px is the accepted metrics shift) |

- Alt flow: a control whose site cannot take min-*/padding without reflow → mechanism (3) `::before` bleed, permitted only where the expanded direction hits no other interactive element (vocab statusBadge vertical case is the canonical allowed use).
- Exception: a grown hit box that intersects a sibling interactive's box → reject that mechanism for the site; wrong-control activation (a tap on A firing B's delete) is worse than a small target. The measurement pass must flag rect intersections, not just sizes.
- Rules:
  - Bind the **token**, never a literal px — the same CSS must resolve 44 coarse / 40 fine.
  - Visual restyle is out (N2): glyphs, pill shapes, and row metrics stay unless the site's mechanism column says otherwise; no color/typography/border changes.
  - Shared atoms (`Toggle`, `IconButton`, `HintIcon`, `BottomSheet`, `MobileSheet`) may be edited only insofar as the binding reaches panel usage — do not bump `tokens.json` size values globally (e.g. raising `element-md` or `iconbutton-size-*` values changes every surface; that's an ask-first boundary, not a default).
  - Keep all `data-tihoka-id` attributes — the audit spec locates controls by them.
- Postcondition: zero interactive elements inside the panel measure below the active pointer's floor; no two interactive hit boxes intersect.
- NFR refs: NFR-1, NFR-2, NFR-3

REQ-2: Focus trap lands on a visible element inside the `aria-modal` dialog

- Actor: Keyboard-only user
- Goal: Opening the panel on any of the six tabs moves focus to a visible focusable element inside the dialog; Tab/Shift+Tab cycle within; close restores focus to the pre-open element.
- Preconditions: `useFocusTrap.ts:34-35` picks the first DOM-order focusable with no visibility filter; the cycling path at `:41` already filters `el.offsetParent !== null || el === root.activeElement`; on desktop the DOM-first node is `UniversalPanelBottomNav`, whose items are `display:none` (`UniversalPanelBottomNav.module.css:5`), so `.focus()` no-ops and focus stays on the background page while `aria-modal="true"` claims containment.
- Basic flow:
  1. actor applies the existing visibility filter (same predicate as `:41`) to the initial pick at `:34-35`
  2. system, on open: reads the panel's own root via `getRootNode()` (`:29-31`, unchanged), records `root.activeElement`, focuses the first **visible** focusable
  3. Tab/Shift+Tab wrap at the first/last visible focusable; Escape/close runs cleanup → focus returns to the recorded element
- Alt flow: Dictionary tab — the 250ms deferred self-focus (`DictionaryPanelView.tsx:216-233`) fires after the trap pick and refines focus onto the search input; it already guards `isOpen` and targets a visible in-dialog element. Rule for any deferred/self-focus in panel tabs: the target must be inside the dialog and visible at fire time — never a hidden pane's control.
- Exception: no visible focusable found (empty pane state) → focus the dialog container itself if it carries `tabindex`, else leave focus where it is and keep the cycle guard — never pick a hidden element.
- Rules: all focus reads/writes pierce the shadow boundary via `getRootNode()` (`AGENTS.md` shadow-DOM rule); the trap must not race a tab switch — panes mount/unmount on tab change (`visitedTabs` gating, `UniversalPanel.tsx:275-290`), the initial pick runs once per open.
- Postcondition: after open settles (trap pick + any deferred self-focus, ≤300ms), `root.activeElement` is a visible element inside `[data-tihoka-id="universal-panel"]` on every tab; no `display:none` element ever receives focus.
- NFR refs: NFR-4, NFR-5

REQ-3: BottomNav DOM order matches visual order (DOM move + `column-reverse` removal — atomic pair)

- Actor: Keyboard-only / SR user on ≤839px layouts
- Goal: On mobile, the bottom navigation is the **last** focusable stop — DOM order equals visual order.
- Preconditions: `UniversalPanel.tsx:207-211` renders `<UniversalPanelBottomNav>` as the first child of `.panel`; `UniversalPanel.module.css:80-84` sets `flex-direction: column-reverse` ≤839px, which throws the DOM-first nav to the visual bottom — correct visually, inverted for focus order.
- Basic flow:
  1. actor moves `<UniversalPanelBottomNav>` after `</div>` of `.body` in `UniversalPanel.tsx` (sidebar → body → bottomNav DOM order)
  2. actor changes the ≤839px rule `flex-direction: column-reverse` → `column` (or removes the override — `.panel` is plain `display: flex`/`row` at `:16`, so the media query must still set `column`)
  3. system renders: body on top, nav at bottom — identical visual placement, DOM-last position
- **The two steps are one atomic change.** DOM-last + `column-reverse` would put the nav visually on top; DOM-first + `column` leaves the defect in place. Neither half ships alone.
- Alt flow: desktop ≥840px — BottomNav stays `display:none`; DOM move is inert except focus-trap initial pick now lands on sidebar/header instead of a hidden node (REQ-2 synergy).
- Exception: visual regression (nav renders on top or collapses) → revert the pair, do not patch one side; verified by mobile screenshot + e2e tab-order check before ship.
- Rules: profile `Dialog` and tools `BottomSheet` (declared between sidebar and `.body` today at `:246-262` / inside `UniversalPanelBottomNav`) keep their positions — overlays portal/stack above regardless of DOM position; `data-tihoka-id`s unchanged.
- Postcondition: DOM order = sidebar, body, bottomNav; visual order unchanged on both sides of the 839px breakpoint; Tab sequence ends at the bottom nav's last item on mobile.
- NFR refs: NFR-4, NFR-5

REQ-4: Tab strip exposes documented nav-rail semantics (decision recorded)

- Actor: Screen-reader user
- Goal: The six panel destinations announce as a coherent set with current-state and named panes; the semantic choice is recorded so F-8 stops being re-flagged.
- Decision (recorded here, satisfies "the choice is written down"): **nav-rail, not ARIA tabs.** Rationale: the strip is a destination switcher that also launches tools (sidebar tools section, mobile Tools sheet) — not a pure tablist; adopting `tablist`/`tab`/`tabpanel` would impose roving tabindex + arrow-key semantics on a launcher and risk regressions in the most-used navigation surface (intent risk row). Rejected alternative: full ARIA tabs pattern — revisit only if the strip ever becomes pure tab panes.
- Preconditions: NavItems carry `aria-current`-only (`CollapsibleSidebar.tsx:83`, `UniversalPanelBottomNav.tsx:63`); panes are anonymous `<div hidden>` (`UniversalPanel.tsx:275-290`); sidebar `<aside>` has `aria-label`, bottom `<nav>` has `aria-label` (`:52`).
- Basic flow:
  1. actor keeps/declares both nav surfaces as navigation landmarks: sidebar `as="aside"` gains `role="navigation"` (or is wrapped in `<nav>`) with its existing `aria-label`; bottom nav `<nav aria-label>` already correct
  2. active item exposes `aria-current="page"` (upgrade `'true'` → `'page'` — true is legal but `page` names the relationship; kept consistent across both surfaces)
  3. each tab pane becomes a named region: `role="region"` + `aria-label` = the tab's localized label (recap pane included — it mounts conditionally without `.tabPane` wrapper today, `UniversalPanel.tsx:287`; it gets the same treatment or an equivalent labelled wrapper)
  4. system announces "Vocabulary, current page" on nav focus and names the region on entry
- Alt flow: none — the pattern is fixed by this spec; DESIGN only picks markup details (wrapper vs direct role).
- Exception: `role="region"` proliferation is acceptable (six named regions inside one dialog is standard); adding `aria-controls` linking nav item → pane id is optional polish, not required by the AC.
- Rules: no keyboard-interaction change (buttons stay Tab-stops, no roving tabindex — that's the rejected tablist's contract); panes stay `<div hidden>` when inactive (`hidden` + `role="region"` is correct — hidden removes it from the a11y tree). The `'true'`→`'page'` upgrade must also update the mobile active-state selector `UniversalPanelBottomNav.module.css:55-56` — `.navItem[aria-current="true"]` → `[aria-current="page"]` or presence `[aria-current]` — because the nav item is a `Button` with no `.active` fallback; a stale selector silently kills the active tint (N2/AC-6 visual regression). Do **not** touch `NavItem.module.css`'s `"true"` branches — other consumers still emit `'true'` (`Navigation.tsx:76`, `PosVariantNav`, `QueueSidebar`, `DictionaryPanelView` chips). Sibling spec `up-mobile-chrome.md:42` cites `aria-current="true"` as a precondition — flagged stale, re-sync when this lands.
- Postcondition: both nav surfaces = labelled landmarks with `aria-current="page"` on the active item; every pane carries an accessible name.
- NFR refs: NFR-5

REQ-5: Custom study-mode cards join a `radiogroup`

- Actor: Screen-reader user picking a study mode
- Goal: Custom mode cards announce group membership and position ("radio, 2 of 4, Custom modes") like presets already do.
- Preconditions: presets wrap in `role="radiogroup"` (`StudyModesTab.tsx:132-136`); customs wrap in `role="group"` (`:163`) while every `ModeCard` emits `role="radio"` (`:244`) — orphaned radios outside a group.
- Basic flow:
  1. actor changes the customs wrapper `role="group"` → `role="radiogroup"` (aria-label already present, `:163`)
  2. system announces each custom card with its group and position
- Alt flow: none — one-attribute fix; `ModeCard`'s `role="radio"` + `aria-checked` contract unchanged.
- Exception: empty customs list → no group rendered (existing `store.customModes.length > 0` guard holds).
- Rules: custom cards' edit/delete kebab stays a separate interactive (it is not a radio; nested-interactive caveat — kebab is a sibling in `modeCardWrapper`, not a child of the radio element, so the radiogroup stays clean).
- Postcondition: presets and customs each sit in their own labelled `radiogroup`; no `role="radio"` exists outside a `radiogroup` in the tab.
- NFR refs: NFR-5

REQ-6: Advanced disclosure announces its controlled region (switch keeps its role)

- Actor: Screen-reader user
- Goal: The Advanced control announces that toggling reveals a section, and names that section — without relying on `aria-expanded` on `role="switch"` (legal — ARIA 1.2 `switch` inherits `checkbox`, which supports `aria-expanded` — but AT-inconsistent and absent from the APG pattern; the intent's accepted-risk conservative option).
- Decision (recorded): keep `role="switch"` — it persists visibility like a setting (`advancedOpen` persisted state; mental model = settings switch that happens to reveal a section) — and add `aria-controls` + `aria-describedby`. Rejected alternative: Accordion/`aria-expanded` swap — changes the control's announced contract; deferred to DESIGN only if review shows the switch pattern reads worse in real AT.
- Preconditions: `Toggle` at `StudyModesTab.tsx:329-337` gates `data-tihoka-id="advanced-settings"` (`:336-338`) with no disclosure semantics.
- Basic flow:
  1. actor gives the revealed `VStack` a stable `id` (e.g. `advanced-settings-region`) + `role="region"` + `aria-label`/`aria-labelledby` naming it ("Advanced settings")
  2. actor extends `Toggle` (shared atom) with optional `ariaControls`/`ariaDescribedby` passthrough props — additive, default-preserving; sets `aria-controls="advanced-settings-region"` on the Advanced instance and `aria-describedby` to a localized hint (e.g. "Shows or hides advanced settings below")
  3. system announces "Advanced settings, switch, off — shows or hides advanced settings below"; on toggle, the controlled region appears and is reachable by name
- Alt flow: the region is unmounted when closed (current `{open && ...}`) — `aria-controls` pointing at a non-existent element is legal (IDREF to hidden/absent element is ignored by AT); if preferring strictness, keep the region mounted + `hidden` — either satisfies the AC; DELIVER picks.
- Exception: none.
- Rules: `aria-checked` stays the state carrier; new hint text goes through `t()` with en+vi keys (i18n rule); do **not** add `aria-expanded` to `role="switch"` — if a future reviewer wants disclosure-expanded semantics, the control must become a button (out of scope). The announced contract is `aria-checked` on/off + the describedby hint, not a literal "expanded" — recorded accepted deviation from intent TO-BE-4/S7's "expanded" wording; revisit if real-AT testing (AC-11) reads poorly.
- Postcondition: AT can discover that the switch controls a named region and find that region by name when open.
- NFR refs: NFR-5, NFR-6

REQ-7: Single `role="status"` announces playlist status changes once

- Actor: Screen-reader user monitoring playlist processing
- Goal: Status transitions (processing → ready/failed) announce **once** as a summary; per-card `aria-live` noise is gone.
- Preconditions: every `Card role="listitem"` carries `aria-live="polite"` (`PlaylistTab.tsx:199`), so each `CONDENSE_AUDIO_EVENT` → `refresh()` re-render re-announces entire card contents including button names.
- Basic flow:
  1. actor removes `aria-live="polite"` from the card element (`:199`)
  2. actor adds one `role="status"` region in the playlist tab (visually hidden or a status line — DESIGN picks; `role="status"` implies `aria-live="polite"` + `aria-atomic="true"`)
  3. on `refresh()` the system computes a transition summary — count + state of recordings that changed (e.g. "3 recordings ready", "1 recording failed") — and writes it into the status region only when the summary differs from the last announced
- Alt flow: no state change on refresh → region content unchanged (writing identical text does not re-announce; still guard to avoid redundant updates).
- Exception: recording transitions observed while the playlist tab isn't mounted → no announcement (correct — the user isn't monitoring; the count is visible on entry).
- Rules: summary text localized via `t()` with pluralization-aware keys (en+vi); exactly one `role="status"`/`aria-live` region in the playlist tab; cards remain `role="listitem"` without live semantics.
- Postcondition: a processing→ready transition announces exactly one summary message; card content is never re-announced on re-render.
- NFR refs: NFR-5, NFR-6

REQ-8: Coarse-pointer verification — the 44px claim is measured, not inferred

- Actor: Maintainer + Playwright e2e harness
- Goal: Re-run the audit measurement under a real emulated coarse pointer and produce a zero-violation artifact; the fine-pointer pass stays green at 40px.
- Preconditions: `e2e/stage2/universal-panel-ux-audit.spec.ts` collects `touchTargetViolations` (`:202-279`) but derives the threshold from `innerWidth ≤ 839` (`:203-204`) — a fine-pointer 390px run asserts 44px while `--touch-target` actually resolves 40px (the `@media (pointer: coarse)` alias never matched). The audit spec has no touch emulation today (M-10).
- Basic flow:
  1. actor adds a coarse-pointer project/context to the audit spec (or a scoped derivative spec): Chromium device descriptor with `isMobile: true` + `hasTouch: true` (e.g. `devices['Pixel 5']`-class), **or** CDP `Emulation.setEmulatedMedia` with `pointer: coarse`. **`hasTouch: true` alone is not sufficient** — without `isMobile`/device emulation Chromium does not evaluate `(pointer: coarse)` as matching.
  2. actor makes the threshold honest: derive it from `page.evaluate(() => matchMedia('(pointer: coarse)').matches)` inside the page — `true` → 44px floor, `false` → 40px — not from viewport width; add a hard assertion that the coarse run's `matchMedia` result is `true` so the emulation can't silently fall back to fine.
  3. system runs the measurement across all six tabs; `touchTargetViolations` must be empty — the collector must compare **both** dimensions (`Math.min(rect.width, rect.height) < touchTargetMin`, or flag on either dim); today `universal-panel-ux-audit.spec.ts:261-263` filters `it.height < touchTargetMin` only, so a control tall enough but too narrow passes undetected — REQ-1's "in both width and height" applies to verification too. The run also checks interactive-rect intersection (no grown hit box swallows a neighbor, REQ-1 exception rule) — either in-spec or as a recorded manual check.
  4. fine-pointer pass (existing desktop viewports) re-confirms the 40px floor.
- Alt flow: derivative spec is permitted (a focused `up-a11y-hit-targets` e2e over the same collector) if wiring a coarse project into the audit spec's viewport matrix is heavier than a dedicated run; either way the artifact names the emulation mechanism.
- Exception: second-wave violations beyond the audited list (M-10 predicts them) → in scope by definition ("every interactive element"); they go back through the REQ-1 queue until the list is empty.
- Rules: measurement reads computed rects inside the shadow root (existing `collectMetrics` pattern at `:207-260`); evidence = the violation list output + emulation assertion, committed under the task's report/evidence path.
- Postcondition: `matchMedia('(pointer: coarse)') === true` under emulation, `touchTargetViolations` empty at 44px, fine pass empty at 40px, no intersecting hit rects.
- NFR refs: NFR-1, NFR-2

### Non-functional (NFR)

| ID | Requirement | Class | Target |
|---|---|---|---|
| NFR-1 | Pointer target floor per STANDARD §10.3 / WCAG 2.5.8 | U / R | 44px coarse, 40px fine — every interactive element, measured under real emulation |
| NFR-2 | No visual restyle — hit growth is invisible or token-bound | R | Dense-row metrics preserved; glyph/pill visuals unchanged unless a REQ-1 site row says otherwise |
| NFR-3 | No hit-box interference | R | Zero intersecting interactive rects in the panel |
| NFR-4 | Shadow-DOM correctness + WCAG 2.1.2/2.4.3 | R / S | All focus ops via `getRootNode()`; DOM order = visual order; focus never escapes `aria-modal` |
| NFR-5 | WCAG 4.1.2 / 4.1.3 semantics | U | Named regions, group membership, single status region — verified by role/attribute assertions |
| NFR-6 | i18n for new announced strings | U | en + vi keys via `t()`; no hardcoded aria-label/describedby text |
| NFR-7 | Smallest-diff discipline | resource | No new components; shared-atom edits additive + default-preserving; no `tokens.json` value changes without ask-first |

## Flows / States

**Focus on open (sequence):**
```
open=true → trap effect runs (getRootNode, record activeElement)
  → initial pick = first focusable FILTERED visible        [was: unfiltered → display:none nav btn]
  → (dictionary tab) 250ms self-focus refines to search input — visible, in-dialog
Tab at last → wrap to first; Shift+Tab at first → wrap to last
close → cleanup → previouslyFocused.focus()
```

**DOM/visual order before→after (state):**
```
BEFORE  DOM: [bottomNav, sidebar, body]   ≤839px column-reverse → visual: [body, bottomNav]  ✗ inverted
AFTER   DOM: [sidebar, body, bottomNav]   ≤839px column         → visual: [body, bottomNav]  ✓ matched
        desktop ≥840px: sidebar left / body right (row), bottomNav display:none — unchanged
```

**Playlist announce (state):**
```
idle --CONDENSE_AUDIO_EVENT→ refreshing --refresh()→ diff records
  Δ>0 → status region = localized summary (announce once) → idle
  Δ=0 → no write → idle
```

## Function ↔ Feature Map

| Function (what the system does) | Features (tools supporting it) |
|---|---|
| Present an operable pointer target on every control | `--touch-target` bindings via min-*/padding/conditional `::before` across the REQ-1 site inventory |
| Contain and place modal focus | `useFocusTrap` initial-pick visibility filter (REQ-2); BottomNav DOM reorder (REQ-3); `getRootNode()` root reads (existing) |
| Announce navigation structure | Nav landmarks + `aria-current="page"` + named pane regions (REQ-4) |
| Announce grouped mode choices | `radiogroup` on customs wrapper (REQ-5) |
| Announce the Advanced disclosure | `aria-controls` + `aria-describedby` on the persisted switch; named region (REQ-6) |
| Announce playlist status once | Single `role="status"` summary region; per-card `aria-live` removal (REQ-7) |
| Prove the floor | Coarse-pointer emulated e2e + honest threshold + rect-intersection check (REQ-8) |

## Data

| Entity | Key fields | Lives in | Retention |
|---|---|---|---|
| `--touch-target` token | mobile 44px / desktop 40px | `tokens.json:554-557`; adaptive alias injected `themeTokens.ts:59-61` | unchanged — read-only consumer |
| `advancedOpen` persisted flag | open/closed | existing study-modes store | unchanged |
| Playlist status summary | count + state per transition | derived at `refresh()` from `records`; announced text in `role="status"` region | ephemeral — last announced value only |
| i18n keys | status summary (pluralized), advanced hint, pane labels (reuse tab labels) | `en.json` / `vi.json` | new keys |

No new persisted entities.

## Traceability

| Need (intent ID) | REQ | AC (Success Criteria line) |
|---|---|---|
| N1 (floor on every element) | REQ-1 | AC-1, AC-2, AC-3 |
| N2 (no visual restyle / no overlap) | REQ-1 | AC-3, AC-4 |
| N3 (initial focus visible + contained) | REQ-2 | AC-5 |
| N4 (mobile DOM = visual order) | REQ-3 | AC-6 |
| N5 (coherent tab-strip semantics, recorded) | REQ-4 | AC-7 |
| N6 (customs in radiogroup) | REQ-5 | AC-8 |
| N7 (Advanced disclosure) | REQ-6 | AC-9 |
| N8 (single status announcer) | REQ-7 | AC-10 |
| N9 (coarse-pointer verification) | REQ-8 | AC-1, AC-11 |

| Journey step | REQ |
|---|---|
| AS-IS 1–2 (missed taps on toggles/rename/badge) | REQ-1 |
| AS-IS 3 (focus escapes `aria-modal`) | REQ-2 |
| AS-IS 4 (inverted mobile tab order) | REQ-3 |
| AS-IS 5 (flat buttons, silent disclosure, noise) | REQ-4, REQ-5, REQ-6, REQ-7 |
| TO-BE 6 (measured floor) | REQ-8 |
| Stories S1–S8 | REQ-1/8, REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7 respectively |

## Boundaries

- Always: bind `--touch-target` (token, never a px literal); prefer `min-*`/padding inside the element's own box; `::before` bleed only where the grown direction has no interactive neighbor and never horizontally inside action clusters; keep `data-tihoka-id`s; new announced strings via `t()` en+vi; verify on real Chrome before commit; `npm run typecheck && npm run test:unit && npm run build` green.
- Ask first: any `tokens.json` value change (e.g. raising `element-md`, `iconbutton-size-*`, `profile-flag-size` globally — cross-surface blast radius); new dependency; `manifest.json` touch; edits reaching subtitle split-view/panel files (`subtitleSplitView.ts`, `mountSubtitle.tsx`, `SubtitlePanel*.tsx` — would trigger the `docs/specs/subtitle-split-view-ac.md` re-verify clause); a visual restyle that creeps into item 33's scope.
- Never: edit generated `tokens.css`/`tokens.ts`; add `aria-expanded` to `role="switch"`; remove `aria-modal`/`role="dialog"`; keep `column-reverse` after the DOM move (atomic pair, REQ-3); grow a hit box into a sibling interactive's rect; hardcode English in aria-labels/status text.

## Success Criteria

- [ ] **AC-1** Under emulated coarse pointer — device descriptor with `isMobile: true` + `hasTouch: true` (e.g. `devices['Pixel 5']`-class) **or** CDP `Emulation.setEmulatedMedia` `pointer: coarse`; `hasTouch` alone is insufficient — `matchMedia('(pointer: coarse)')` evaluates `true` inside the page **and** `touchTargetViolations` is empty at the 44px floor across all six tabs.
- [ ] **AC-2** Under fine pointer (existing desktop viewports), `touchTargetViolations` is empty at the 40px floor.
- [ ] **AC-3** Every enumerated REQ-1 site measures ≥ the active floor: Toggle xs/sm, dict-link name/edit/delete/drag, HintIcon, xs/sm circle buttons (kebab, vocab actions, dict toolbar), profile flag, `.statusBadge`, MobileSheet `.handle`, BottomSheet close, dict-popup tabs, audio-tester, inputs/selects — while each control's visual stays compact per its site's mechanism.
- [ ] **AC-4** No grown hit box intersects another interactive element's rect (rect-intersection check recorded in the verification pass).
- [ ] **AC-5** Opening the panel on each of the six tabs moves focus to a visible element inside `[data-tihoka-id="universal-panel"]`; no `display:none` element receives focus; Tab/Shift+Tab cycle within the dialog; close restores focus to the pre-open element.
- [ ] **AC-6** At ≤839px the bottom nav is the last focusable element and still renders at the bottom (visual parity screenshot); DOM order = sidebar → body → bottomNav.
- [ ] **AC-7** Both nav surfaces are labelled navigation landmarks; the active item carries `aria-current="page"`; every pane (including recap) is a named region; the nav-rail-over-tablist decision is recorded (this spec).
- [ ] **AC-8** Custom mode cards sit inside `role="radiogroup"` with the group's label; no `role="radio"` exists outside a `radiogroup` in StudyModesTab.
- [ ] **AC-9** The Advanced switch exposes `aria-controls` → a stable region id and `aria-describedby` hint; the region carries a name; `aria-checked` remains the state carrier; no `aria-expanded` on `role="switch"`.
- [ ] **AC-10** Playlist status announcements satisfy the DOM-level contract — Playwright asserts attributes/guards, not AT announcement counts (not directly testable): exactly one `role="status"` region in the playlist tab, zero `aria-live` on cards, and a dedupe guard so an identical summary is never written twice (a processing→ready transition therefore produces exactly one localized summary announcement).
- [ ] **AC-11** Verification evidence committed: coarse-pointer run output (emulation mechanism + `matchMedia` assertion + empty violation list), fine-pointer run, focus-order and semantic assertions — plus before/after evidence (screenshots or pixel/rect capture) for the grown hit areas per AGENTS.md.

## Definition of Done

- [ ] All Success Criteria pass
- [ ] `npm run typecheck && npm run lint && npm run test:unit && npm run build` green (build catches Vite-level issues tsc misses)
- [ ] Coarse-pointer e2e re-measure clean (AC-1) + fine pass (AC-2) — the deliverable evidence, not an afterthought
- [ ] Before/after evidence per AGENTS.md for hit-area growth (new hit-area = new interaction geometry → image or pixel-scan evidence required, not DOM-rect assertions alone)
- [ ] Real-Chrome smoke: panel opens, every tab keyboard-navigable, mobile nav last, AT spot-check on nav/cards/switch/status
- [ ] Canon docs updated: `docs/2-architechture-system.md` (focus trap, DOM order, semantic contract), `docs/0-wiki.md` if docs index changes; nav-rail + switch-disclosure decisions durable in this spec (ADR not required — component-level, recorded here)
- [ ] Unit tests for non-trivial logic where added (visibility-filter pick, status-summary diffing)

## Open Questions / Accepted Risks

- Input/select visual height policy (visible 40/44px field vs shorter visual + grown hit) — DESIGN decision; `ui_surface: yes` declared for exactly this metrics shift.
- `Toggle` track visual size vs grown hit box — DESIGN decides whether xs/sm visuals stay small inside the grown label.
- Accordion swap for the Advanced control — deferred to DESIGN per intent's accepted risk; spec defaults to switch + `aria-controls`/`aria-describedby`.
- Playlist summary exact wording/plural keys — DELIVER writes the `t()` copy ("N recordings ready/failed" shape).
- Second-wave violations under true coarse emulation (M-10) — expected; in scope by definition.
- Sibling items 28/29/31/33 touch the same files — this item ships first (31/33 depend on it); no coordination protocol needed beyond the pipeline `owner` rules.
