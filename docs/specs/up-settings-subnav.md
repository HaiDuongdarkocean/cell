# Spec: up-settings-subnav — Labeled settings sub-navigation

> Intent: `docs/intent/up-settings-subnav.md` · ui_surface: yes · Mode: all

## Objective

Make the settings sub-navigation identifiable without hover or memorization: every one of the 13 `NavItem`s renders icon + text label in horizontal mode (`NavItem.module.css:119-121` currently hides `.label`), the standalone dialog's 600–767px band stops rendering the icon-only collapsed rail (`SettingsDialogContent.tsx:139-140,177`), and the horizontal strip gains a designed overflow affordance so off-screen destinations are signaled and reachable instead of clipping mid-glyph. All of this on the existing `Navigation`/`NavItem` stack — scroll-sync machinery (`Navigation.tsx:42-156`), section anchors, `aria-current`, and the expanded vertical sidebar stay untouched. Scope: the subnav strip only — no settings content redesign, no bottom-nav work (item 31), no hit-target/tablist work (item 30).

## Actor ↔ System Boundary

| Actor | Triggers | Inputs | Receives/Views |
|---|---|---|---|
| End user (persona 5–80, mouse/touch/keyboard, desktop/tablet/phone) | Opens Settings (universal panel tab or standalone dialog); activates a nav item; scrolls the content column; resizes the container | Click/tap/keypress on a nav item or scroll arrow; scroll gestures on strip or content | Labeled nav strip, active-item indication, edge overflow affordance, content scrolled to the chosen section |
| Host surface | Mounts `SettingsDialogContent` | `navMode` prop (`"horizontal"` forced at `SettingsTab.tsx:79`; `'auto'` default at `SettingsDialogContent.tsx:116`) | — |
| Locale bundle | Ships `settings.nav.*` strings | `en.json:7,402-413`, `vi.json:7,402-413` | — |

System-internal processing never includes human behavior. "The user picks a section" is modeled as actor input (item activation); the system reacts (mark active, scroll section into view).

## Requirements

### Functional

REQ-1: Labeled items in horizontal nav mode
- Actor: End user
- Goal: Identify each of the 13 settings destinations by a readable name — no hover, no memorization.
- Preconditions: A settings surface is rendered with `navOrientation === 'horizontal'` (always in the universal panel `SettingsTab`; container width `<768px` in the dialog after REQ-2).
- Basic flow:
  1. actor opens Settings
  2. system renders the `Navigation` strip of 13 `NavItem`s, each showing `icon` + a visible `.label` resolved from `settings.nav.*`
  3. actor views every destination's name inline
- Alt flow: none — labeling is unconditional in horizontal mode.
- Exception: an item rendered without `label` prop → icon-only fallback is a defect, not a supported state; `SettingsDialogContent` always passes `label` (`:195`) and `aria-label` (`:197`) — DELIVER must keep both populated.
- Rules: the hiding rule is `.horizontal .label { display: none }` at `NavItem.module.css:119-121` — remove it (or scope it away); `.horizontal` also sets `padding:0; gap:0` (`:115-116`), tuned for icon-only — when `.label` unhides it must regain inter-node spacing (gap + inline padding from tokens; DESIGN owns the values, spec owns the requirement); the horizontal item keeps `flex-direction: row`, `nowrap`, `--touch-target` min-height, pill + icon + label structure (`NavItem.tsx:47-52`); `.vertical` and both `@container` collapsed rules (`:151-176`) stay byte-identical — blast radius verified: `orientation="horizontal"` `Navigation`/`NavItem` is consumed only by `SettingsDialogContent` in product code (bottom nav uses `Button`, `UniversalPanelBottomNav.tsx:56-69`; showcases don't ship); strip height must still fit `Sidebar.module.css:63` `max-height: calc(var(--touch-target) + var(--space-2) * 2)` — if a labeled row exceeds it, the budget is re-derived in DESIGN, not by shrinking type below `--font-size-xs`.
- Postcondition: every horizontal nav item shows icon + label at all widths.
- NFR refs: NFR-1

REQ-2: Horizontal cutoff extended to `<768px` in `navMode='auto'`
- Actor: Host surface (container width); End user (views result)
- Goal: The standalone dialog never renders the icon-only collapsed rail; the 600–767px band gets the labeled horizontal strip.
- Preconditions: `SettingsDialogContent` mounted with default `navMode='auto'` (`:116`); `ResizeObserver` updates `containerWidth` (`:124-137`); `SIDEBAR_LABEL_MIN_WIDTH = 768` (`:56`); `BREAKPOINTS.medium = 600` (`tokens.ts:118`).
- Basic flow:
  1. system observes wrapper `contentRect.width` via `ResizeObserver`
  2. system computes `navOrientation` — `containerWidth < SIDEBAR_LABEL_MIN_WIDTH` → `'horizontal'`; `>= 768` → `'vertical'`
  3. system renders labeled horizontal strip below 768px, expanded labeled sidebar at/above it
- Alt flow: `navMode='horizontal'` prop (panel) → horizontal regardless of width — unchanged.
- Exception: `ResizeObserver` unavailable → `containerWidth` keeps initial 1280 → vertical expanded (existing fallback preserved, `:127-128`).
- Rules: the exact change is at `SettingsDialogContent.tsx:139`: `containerWidth < BREAKPOINTS.medium` → `containerWidth < SIDEBAR_LABEL_MIN_WIDTH` (SSOT — do not introduce a second literal `768`); `sidebarExpanded` (`:140`) and `collapsed` (`:177`) expressions stay — after the change `vertical` implies `>=768` implies expanded, so the collapsed rail becomes unreachable in product code; `NavItem`/`Sidebar` collapsed CSS is NOT deleted (non-goal, other consumers/tests exist); `BREAKPOINTS.medium` still governs unrelated layout (`SettingsDialog.module.css:180` `@container (min-width:600px)` mainCol padding — untouched).
- Postcondition: no container width produces an icon-only nav in either surface.
- NFR refs: NFR-1

REQ-3: Designed overflow affordance on the horizontal strip
- Actor: End user
- Goal: Discover and reach off-screen destinations; never see a silently clipped glyph.
- Preconditions: Horizontal strip rendered; total item width exceeds `clientWidth` (true for 13 labeled items at narrow widths — verified assumption, see Risks).
- Basic flow:
  1. system measures `scrollWidth`/`clientWidth`/`scrollLeft` on the nav element via `ResizeObserver` + `scroll` listener (`StudyModeActionBar.tsx:35-55` precedent)
  2. system renders the affordance per edge state (see Flows): chevron `Button` (`size="sm" shape="circle" variant="secondary"`, `Icon` `chevronLeft`/`chevronRight`) + edge fade mask on the strip
  3. actor activates an arrow → system `scrollBy(±0.75 * clientWidth, behavior:'smooth')` on the nav element (`StudyModeActionBar.tsx:57-62`)
  4. system hides each arrow/fade when its edge is reached (`scrollLeft <= 0` / `scrollLeft >= scrollWidth - clientWidth - 1`)
- Alt flow: actor pans the strip directly (touch `pan-x`, wheel, keyboard-focus auto-scroll) — native `overflow-x: auto` (`Navigation.module.css:34`) stays; affordance state updates live on `scroll` events.
- Exception: strip fits (no overflow) → zero arrows, zero fades, layout identical to a non-overflowing strip; an item wider than the viewport → arrows still page through it, no special-casing.
- Rules: mechanism = **extend `Navigation`'s horizontal variant** (arrows render outside the scroll track, inside `Navigation`'s wrapper; edge fade via CSS mask/gradient on the strip). Do NOT rebase onto `Tabs` — `Tabs` has no `contentRef`/`sectionRefs`/`scrollNavToId`/`clickScrollingRef` machinery (`Navigation.tsx:42-156`) and `Tabs.module.css` carries no overflow rules; adopting it duplicates the entire scroll-sync stack for zero gain. Arrows scroll only the nav strip — never `contentRef`. Arrows get localized `aria-label` via new keys `settings.nav.scrollLeft`/`settings.nav.scrollRight` (added to both `en.json` and `vi.json` — precedent `studyModes.actionBar.scrollLeft/Right`, `en.json:927-928`) and `data-tihoka-id="settings-nav-scroll-left|right"` hooks for e2e. Arrow visibility is reactive to both overflow and scroll position; no arrow when its direction is at the bound. The affordance adds a wrapper root around `<nav>`: `<nav>` keeps `aria-label` and remains the landmark; the wrapper carries the arrows and needs `min-width:0` inside the horizontal sidebar body (`Sidebar.module.css:72-79`, `[data-orientation="horizontal"] .body`) so it can shrink within the flex row.
- Postcondition: all 13 items reachable and discoverable at any container width; no mid-glyph clipping without a cue.
- NFR refs: NFR-2, NFR-5

REQ-4: Scroll-sync and click navigation preserved under labeled widths
- Actor: End user
- Goal: Tap a label → land on its section; scroll content → the active label tracks; active item auto-centers — identical to today.
- Preconditions: Labeled strip rendered; `sectionRefs`/`mainColRef` wired (`SettingsDialogContent.tsx:185-188,204`).
- Basic flow:
  1. actor activates an item → system `setActiveId`, sets `clickScrollingRef`, `scrollIntoView({block:'start'})` on the section, centers the item in the strip (`Navigation.tsx:123-156`)
  2. actor scrolls the content column → system's rAF-throttled listener picks the section nearest the top → sets active id → auto-centers the item (`:85-121`, `:49-53`)
  3. strip releases the guard after `scrollTop` is stable 3 frames
- Alt flow: activation while a click-scroll is in flight → `clickScrollingRef` suppresses the spy until settled (existing guard).
- Exception: missing `sectionRef` for an id → system still sets active + centers the nav item (`:129-131` fallback, unchanged).
- Rules: `Navigation.tsx` internals keep current behavior — the auto-centering math reads live `offsetLeft`/`offsetWidth` (`:50-51`), so wider labeled items center correctly with no change; click delegation on `[data-section-id]` (`:158-163`) unaffected since labels live inside the same button; `scroll-padding`, `scroll-behavior:smooth`, `touch-action:pan-x`, `prefers-reduced-motion` (`Navigation.module.css:37-45`) preserved; scroll-arrow clicks must not interact with `clickScrollingRef` (they scroll the strip, not the content).
- Postcondition: two-way sync behaves exactly as before; active item stays centered/visible.
- NFR refs: NFR-3

REQ-5: Active state legible in labeled presentation
- Actor: End user
- Goal: See which section is active at a glance.
- Basic flow: system applies `.horizontal[aria-current="true"]` recipe — primary-color text/icon + centered underline pill (`NavItem.module.css:60-74,95-103`) — to the active labeled item; actor views the marked item.
- Rules: reuse the existing recipe, do not invent a new selected-state (canonical recipe convergence is item 33); verify the centered underline pill reads correctly under a wider item (icon + label) — pill is `width: --space-5` centered (`:99-102`), still valid; `aria-current` wiring (`Navigation.tsx:73-83`) unchanged.
- Postcondition: active item is visually distinguished in every labeled render.
- NFR refs: NFR-1, NFR-4

REQ-6: i18n labels, one overflow rule
- Actor: Locale bundle (supplies strings); End user (views)
- Goal: Strip holds each locale's labels under one consistent width rule.
- Basic flow: system resolves labels via `t('settings.nav.*')` (`SettingsDialogContent.tsx:153-167`); labels render `nowrap`, never truncate mid-label — excess width flows into the REQ-3 scroll mechanism.
- Rules: **one rule**: labels never wrap, never ellipsis — overflow is handled exclusively by the strip's scroll affordance (a per-label max-width would hide the very words that provide discoverability); `.label`'s `overflow:hidden; text-overflow:ellipsis` (`NavItem.module.css:141-149`) stays dormant in `.horizontal` — items are `width:auto` + `flex-shrink:0` in the scroll track — or the ellipsis rule is scoped to `.vertical`, so a future squeeze can't silently violate the no-truncate rule; the 13 label keys already exist in both shipped locales — no new label strings; only the two arrow `aria-label` keys are added (REQ-3); worst-case locale fit is verified empirically (vi labels e.g. "Hồ sơ ngôn ngữ", "Trình phát video", "Badge từ vựng" — `vi.json:402-413` — are the widest expected; both locales captured in evidence).
- Postcondition: en + vi strips render all labels under the same no-wrap/no-truncate rule.
- NFR refs: NFR-1, NFR-4

REQ-7: Accessibility and semantics preserved
- Actor: End user (keyboard/AT)
- Goal: Keyboard and assistive-tech operability at least at current level.
- Rules: `nav` keeps `aria-label={t('settings.sidebar.navAria')}`; active item keeps `aria-current="true"`; every item remains a focusable `<button>` with the `:focus-visible` ring (`NavItem.module.css:38-41`); scroll arrows are regular `Button`s (Tab-reachable, localized `aria-label`, `type="button"`); `title` tooltip (`SettingsDialogContent.tsx:196`) may remain as supplemental — no name depends on it; NO `tablist`/`tab`/`tabpanel` or roving-tabindex adoption — that upgrade is owned by item 30 (F-8), per intent N6.
- Postcondition: no a11y regression; naming no longer depends on hover.
- NFR refs: NFR-4

### Non-functional (NFR)

| ID | Requirement | Class | Target |
|---|---|---|---|
| NFR-1 | Usability — every destination named at every supported viewport | U | Visible text label on all 13 items in both surfaces at 320/390/600–767/768+ |
| NFR-2 | Usability — overflow discoverable + reachable | U | Edge cue present iff overflowing; arrows page ±0.75 viewport; no silent mid-glyph clip |
| NFR-3 | Reliability — scroll-sync parity | R | Click→scroll, spy, auto-center, `clickScrollingRef` guard behave as `Navigation.tsx:42-156` today |
| NFR-4 | A11y floor — preserve, don't regress | U | `aria-current`, nav `aria-label`, focus ring, Tab reachability; no tablist adoption (item 30) |
| NFR-5 | Resource/perf — no new deps, observer-based affordance | resource | `ResizeObserver` + passive `scroll` + rAF only; shared atoms (`Button`, `Icon`); token-based styling |

## Flows / States

**Orientation by container width (`navMode='auto'`, after REQ-2):**

```
containerWidth < 768   --(ResizeObserver)-->  horizontal labeled strip (+ overflow affordance)
containerWidth >= 768  --(ResizeObserver)-->  vertical expanded sidebar (labels always on)
   collapsed rail (64px icon-only): UNREACHABLE in product — CSS kept, never entered
```

**Edge-affordance state (per side, live):**

```
scrollLeft <= 0                              → left arrow + left fade hidden
scrollLeft > 0                               → left arrow + left fade shown
scrollLeft >= scrollWidth - clientWidth - 1  → right arrow + right fade hidden
scrollWidth <= clientWidth                   → no overflow → all affordances hidden
```

## Function ↔ Feature Map

| Function (what the system does) | Features (tools supporting it) |
|---|---|
| Identify each destination | Labeled `NavItem` (icon + `.label` visible in `.horizontal`) — REQ-1 |
| Orient the nav by container | `navMode` prop + `ResizeObserver` `containerWidth` + `<SIDEBAR_LABEL_MIN_WIDTH` cutoff — REQ-2 |
| Route to a section | `data-section-id` click delegation → `scrollIntoView` on `sectionRefs` — REQ-4 |
| Track reading position | rAF scroll-spy on `mainColRef` + auto-centering `scrollNavToId` — REQ-4 |
| Reveal off-screen destinations | `overflow-x:auto` strip + edge fade + chevron arrow `Button`s — REQ-3 |
| Mark the active destination | `aria-current` + horizontal active recipe (primary text + underline pill) — REQ-5 |
| Name destinations per locale | `settings.nav.*` keys via `t()` + no-wrap/no-truncate overflow rule — REQ-6 |

## Data

| Entity | Key fields | Lives in | Retention |
|---|---|---|---|
| `sidebarItems` (13) | `id`, `label` (resolved), `icon` | Render-time array, `SettingsDialogContent.tsx:153-167` | None — derived each render |
| `activeSection` | section `id` string | `useState`, `SettingsDialogContent.tsx:117` | Session (unmounted state) |
| `containerWidth` | px number | `useState` + `ResizeObserver`, `:122-137` | Session |
| `sectionRefs` / `mainColRef` | `HTMLElement` refs | `useRef`, `:118-119,204` | Session |
| Overflow state (new) | `showLeft`, `showRight` booleans | `useState` inside `Navigation` (horizontal) — StudyModeActionBar `:27-28` precedent | Session |
| Label strings | `settings.nav.*` ×13 + `settings.nav.scrollLeft/Right` (new) | `en.json`, `vi.json` | Shipped bundle |

No storage keys, no persistence, no schema migration.

## Traceability

| Need (intent ID) | REQ | AC (Success Criteria line) |
|---|---|---|
| N1 (label at every viewport) | REQ-1, REQ-2 | AC-1, AC-2 |
| N2 (overflow signaled + reachable) | REQ-3 | AC-3 |
| N3 (anchors + scroll-sync identical) | REQ-4 | AC-4 |
| N4 (active state distinguished) | REQ-5 | AC-5 |
| N5 (i18n keys + one width rule) | REQ-6 | AC-6 |
| N6 (a11y floor preserved) | REQ-7 | AC-7 |

| Journey step (TO-BE) | REQ |
|---|---|
| 1. Strip shows label beside every icon | REQ-1, REQ-2 |
| 2. Off-screen items signaled and revealed intact | REQ-3 |
| 3. Activation marks item + scrolls section | REQ-4, REQ-5 |
| 4. Scroll keeps active label tracking + centered | REQ-4 |
| 5. Locale labels held under one rule | REQ-6 |

## Boundaries

- Always: `npm run typecheck && npm run lint && npm run test:unit && npm run build` green before commit; tokens/`shared/ui` atoms only (no new dependency); screenshot evidence of BOTH surfaces (universal panel `SettingsTab` + standalone `SettingsDialog`) at 320px, 390px, a 600–767px width (e.g. 700px), and ≥768px, per AGENTS.md UI-evidence rule; preserve `Navigation.tsx` scroll-sync internals; verify `NavItem` vertical/collapsed variants visually unchanged.
- Ask first: any change to `NavItem` `.vertical` or `@container` collapsed rules; any change to `UniversalPanelBottomNav`; adopting `tablist`/`tab`/`tabpanel` semantics (item 30); hit-target resizing (item 30); a new shared component beyond the `Navigation`-internal affordance.
- Never: rename/reorder/re-count the 13 sections or their `id`s; touch settings section content; hardcode label strings (existing `settings.nav.*` keys only); make `title` tooltip a required naming path; edit generated `tokens.css`/`tokens.ts` instead of `tokens.json`; absorb item 31 (bottom-nav) or item 33 (recipe convergence) scope.

## Success Criteria

- [ ] AC-1 (N1/REQ-1): All 13 nav items render a visible text label beside the icon at 320px, 390px, 600–767px, and ≥768px container widths in BOTH surfaces — screenshot evidence each; zero icon-only states.
- [ ] AC-2 (N1/REQ-2): Standalone `SettingsDialog` at container width 600–767px renders the labeled horizontal strip (no collapsed 64px icon rail); at ≥768px renders the expanded labeled sidebar; verified by capture at e.g. 700px and 900px.
- [ ] AC-3 (N2/REQ-3): When items overflow, an edge affordance (arrow + fade) is visible exactly on overflowing sides; activating an arrow scrolls the strip ~0.75 viewport and reveals items intact; affordances hide at scroll bounds and when the strip fits; no mid-glyph clipping without a cue at any tested width.
- [ ] AC-4 (N3/REQ-4): Activating a labeled item scrolls its section to the top and marks it active; scrolling the content column updates the active item to the nearest-top section; the active item auto-centers in the overflowing strip — behavior identical to pre-change `Navigation` (verified by manual/e2e scroll-sync check in both surfaces).
- [ ] AC-5 (N4/REQ-5): The active item is visually distinguished (primary color + underline pill) in the labeled presentation at every tested width.
- [ ] AC-6 (N5/REQ-6): Labels resolve from existing `settings.nav.*` keys; both `en` and `vi` locales verified at all four widths; labels never wrap and never truncate — excess width goes to REQ-3 overflow; `settings.nav.scrollLeft/Right` aria keys exist in both locales.
- [ ] AC-7 (N6/REQ-7): Keyboard operability preserved — every item Tab-reachable with `:focus-visible` ring, `aria-current="true"` on the active item, nav `aria-label` intact, arrow buttons have localized `aria-label`s; no `tablist`/`tab` roles introduced.

## Definition of Done

- [ ] All Success Criteria pass with screenshot evidence in `tmp/up-settings-subnav/` (referenced in the report, not committed)
- [ ] `npm run typecheck && npm run lint && npm run test:unit && npm run build` green (build catches Vite/CSS issues tsc misses)
- [ ] Unit coverage updated: `Navigation.test.tsx` gains overflow-affordance cases; `SettingsDialogContent.test.tsx` orientation expectation updated for the <768px cutoff
- [ ] `check-design-system-css` (prebuild) clean — no raw values introduced in touched CSS
- [ ] Real-Chromium verification (Playwright persistent context per `testing-extension-browser`) in both surfaces at the four widths, both locales
- [ ] `docs/2-architechture-system.md` updated for the `Navigation` overflow affordance + cutoff change; `docs/0-wiki.md` if docs changed
- [ ] `docs/specs/subtitle-split-view-ac.md` N/A — this item does not touch subtitle surfaces (no AC re-verify needed)

## Open Questions / Accepted Risks

- Strip-height budget: labeled item height must fit `Sidebar.module.css:63` `max-height` — expected to fit (label line-height < touch-target), but if not, DESIGN re-derives the height; recorded as risk, not a blocker.
- i18n worst-case assumed `vi` ≈/`>` `en` width from shipped strings (`vi.json:402-413`); if a future locale overflows far worse, the same one-rule overflow applies — no special-casing.
- Arrow placement (inside `Navigation` wrapper vs flanking the `Sidebar`) is pinned to `Navigation` per REQ-3 so the affordance ships with the canonical labeled-nav pattern (item-33-ready); exact visual polish (fade width, arrow chrome) is DESIGN's call.
