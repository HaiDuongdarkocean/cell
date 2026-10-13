# Intent: Labeled Settings Sub-Navigation

> Slug: `up-settings-subnav` · Mode: all · Source: backlog row `docs/ideas/product-backlog.md` #32 (`ux-audit-20261006`, findings V-8 + M-7)
> ui_surface: yes
> confidence: high

## Business Case

BACCM inference — every Tihoka cites evidence (`file:line`) or `[assumption]` + confidence.

| Concept | Statement | Evidence | Confidence |
|---|---|---|---|
| Need | Users cannot identify which of the 13 settings sections an icon leads to without trial-and-error: labels exist in the DOM but are hidden in horizontal mode, and the only naming affordance is a `title` tooltip that never fires on touch. Discoverability — not a new feature — is the gap. | `NavItem.module.css:119-121` (`.horizontal .label{display:none}`), `SettingsDialogContent.tsx:196` (`tooltip={item.label}` → `title` attr at `NavItem.tsx:48`), `20261006-universal-panel-ux-audit.md:41` (V-8/M-7), `:16` (root cause 5) | high |
| Change | Settings sub-nav goes from an unlabeled 13-icon strip (clipping mid-glyph at edges) to labeled navigation whose overflow is designed (scroll with edge affordance or menu), while section anchors and scroll-sync stay identical. | `SettingsTab.tsx:79` (`navMode="horizontal"`), `Navigation.module.css:34-39` (strip already `overflow-x:auto` but clips silently), `Navigation.tsx:85-121,123-156` (scroll-sync machinery to preserve) | high |
| Solution | Reuse the shared labeled-nav direction: labeled items (icon + short label) rendered by the existing `Navigation`/`NavItem` stack or `Tabs`, plus one overflow mechanism — the repo already has both ingredient classes (`Tabs.tsx`, `StudyModeActionBar.tsx:108,153` scroll-arrow pattern). | `Tabs.tsx:53-80` (tablist + arrow-key nav; `Tabs.module.css` carries no overflow rules → must be extended or bypassed), `StudyModeActionBar.tsx` (existing horizontal overflow precedent) | medium — exact component choice is a DESIGN decision |
| Value | Settings becomes navigable on first encounter for the full persona range (5–80, any device, AGENTS.md); touch users gain a capability they currently lack entirely; clears audit P1 findings V-8/M-7; unblocks convergence item 33 (`product-backlog.md:68` dep list). | `20261006-universal-panel-ux-audit.md:41,72` | high |
| Stakeholder | Primary: extension end users opening Settings inside the universal panel (all viewports) or the standalone settings dialog. Secondary: maintainers who need one canonical labeled-nav pattern. | `SettingsTab.tsx:75-80`, `SettingsDialog.tsx:22-25`, `mountSettingsDialog.ts` | high |
| Context | Container-width responsive inside a shadow-DOM panel (`ResizeObserver` at `SettingsDialogContent.tsx:124-137`); same `SettingsDialogContent` serves two surfaces; labels already localized (`settings.nav.*` in `en.json:7,402-413`, `vi.json:7,402-413`); `Navigation` scroll-sync is shared infrastructure that must not regress. | cited files above | high |

## Stakeholders

| Group | Who | Their need re: this change | Capability/constraint |
|---|---|---|---|
| Team | Extension maintainers (this project) | Ship a small (cost: S) labeled-nav change reusing `shared/ui` atoms; no new dependencies | `Tabs`, `NavItem`, `Menu`, `Navigation` all exist; `Tabs` lacks overflow today — extension is in-scope but bounded |
| Customer | Persona 5–80, desktop + tablet + phone, mouse and touch | Recognize and reach any of the 13 settings sections without memorizing glyphs or needing hover | Touch users have zero naming today (tooltips can't fire); non-English users need labels that survive i18n width variance |
| Supplier/Dependency | Chrome MV3 platform, shadow-DOM mount | None new — change is pure DOM/CSS inside existing surfaces | `title` tooltips remain unreliable on touch regardless of platform; no API dependency |
| Organization | Future contributors, item 33 (`up-visual-system-convergence`) | One canonical labeled-nav pattern rather than a second bespoke strip | AGENTS.md: exemplar patterns belong in `shared/ui`, not re-implemented per feature |
| Regulator | Chrome Web Store policy, WCAG norms | None specific — no permission, policy, or licensing impact | Adjacent to WCAG 2.5.8/AA concerns owned by item 30 (`up-a11y-hit-targets`); this item must not regress current aria semantics (`aria-current`, nav `aria-label`) |

## Needs

| ID | Need (statement) | FURPS+ | Evidence/`[assumption]` | Confidence |
|---|---|---|---|---|
| N1 | Every settings destination is identifiable by a visible text label at every supported viewport — icon-only presentation is unacceptable for 13 destinations. | U | `NavItem.module.css:119-121`; M-7 `20261006-universal-panel-ux-audit.md:41` | high |
| N2 | Off-screen destinations are reachable and their existence is signaled — no silent mid-glyph clipping at strip edges. | U | M-7 `20261006-universal-panel-ux-audit.md:41` ("edges clip mid-glyph"); `Navigation.module.css:34` (`overflow-x:auto` already, but no affordance) | high |
| N3 | Section anchors and two-way scroll-sync behave exactly as today: tapping an item scrolls the section into view; scrolling content updates the active item; active item auto-centers in the strip. | R | `Navigation.tsx:85-121` (scroll listener), `Navigation.tsx:123-156` (click → `scrollIntoView` + `clickScrollingRef` guard), `Navigation.tsx:49-53` (horizontal centering) | high |
| N4 | The active section remains visually distinguished — a labeled equivalent of the current accent underline. | U | `NavItem.module.css:60-74,95-103` (`.horizontal` active = primary color + underline pill) | high |
| N5 | Labels come from the existing `settings.nav.*` i18n keys and survive locale width variance — truncate or overflow per one rule, never wrap mid-label or break the strip. | S | `SettingsDialogContent.tsx:153-167`; `en.json:7,402-413`, `vi.json:7,402-413` — keys already exist for both locales; V-8 `20261006-universal-panel-ux-audit.md:41` | medium — longest-locale fit unverified at every width |
| N6 | Keyboard and assistive-tech operability is preserved at minimum at current level (`aria-current`, `aria-label`, focus-visible); upgrading to `tablist` semantics is a plus only if free, otherwise deferred to item 30 (F-8). | U | `Navigation.tsx:73-83` (`aria-current`), `NavItem.module.css:38-41` (focus ring); F-8 ownership `20261006-universal-panel-ux-audit.md:57,70` | medium |

## Scope

- **In:** The horizontal settings sub-navigation in both consuming surfaces — universal panel `SettingsTab` (forced `navMode="horizontal"` at all widths, `SettingsTab.tsx:79`) and standalone `SettingsDialog` (auto mode → horizontal below 600px container, `SettingsDialogContent.tsx:116,139`, `tokens.ts:118`). Labeled items (icon + short label), one designed overflow behavior (`Menu`-based overflow or edge-signaled scroll — DESIGN picks, `StudyModeActionBar` scroll-arrow pattern is an in-repo precedent). Preserve anchors/scroll-sync.
- **Out:** Settings section content redesign (labels/cards stay as-is); bottom-nav label clipping (item 31 `up-mobile-chrome`, `product-backlog.md:66`); hit-target sizing and `tablist`/`tabpanel` semantics (item 30 `up-a11y-hit-targets`); canonical selected-state recipe across the app (item 33); the vertical sidebar mode — already labeled at ≥768px (`SettingsDialogContent.tsx:140`, `SIDEBAR_LABEL_MIN_WIDTH`).
- **Non-goals:** Renaming/reordering/counting the 13 sections; changing `NavItem` vertical or collapsed-container behavior (`NavItem.module.css:151-176`); making bottom-nav use this pattern; any change to what the sections contain. Boundary note: `navMode='auto'` at container width 600–767px currently renders `vertical`+`collapsed` (`SettingsDialogContent.tsx:139-140,177`) → labels hidden by `NavItem`'s `@container (width <= 64px)` — the same icon-only defect N1 bans — so the design commits to labeling that band by extending the horizontal cutoff to `<768px` in `SettingsDialogContent` (in-scope); `NavItem`'s own collapsed rules stay untouched.

## Workflow

Narrative: an end user opens Settings — inside the universal panel over a video page, or the standalone dialog. The system renders a navigation strip of 13 sections plus a scrollable content column of cards. The user reads the strip, picks the section by name, and activates it (click/tap/keyboard); the system marks the item active and smooth-scrolls the matching card into view. As the user then scrolls content freely, the system keeps the active marker on whichever section is nearest the top, centering that item in the strip when it overflows. When the strip is narrower than its content, the overflow edge signals more items (fade/menu/arrow) instead of clipping a glyph mid-shape. Start: user opens Settings. End: user lands on the intended section on first attempt. Person↔device only; no person↔person or system↔system step.

## Journey

### AS-IS

1. User opens the Settings tab in the universal panel (desktop) or on a phone — a horizontal strip of ~13 unlabeled icons appears under the header, with the first/last items clipped mid-glyph and no edge cue (`SettingsTab.tsx:79`, `NavItem.module.css:119`, M-7 `20261006-universal-panel-ux-audit.md:41`).
2. Wanting e.g. Sync or Audio settings, the user cannot tell which glyph maps to which section; the desktop user begins hovering icons one by one waiting for `title` tooltips (`SettingsDialogContent.tsx:196` → `NavItem.tsx:48`).
3. The touch user gets nothing — `title` never fires on tap — so they tap icons blind; each tap scrolls the content column but shows no name confirming the destination (M-7 `20261006-universal-panel-ux-audit.md:41`).
4. The desktop user either memorizes glyph positions over repeated visits or abandons the strip and brute-force scrolls the whole settings column hunting the card.
5. Edge case: even after finding the section, the only "where am I" feedback is a blue underline (`NavItem.module.css:95-103`) on a glyph the user still can't name — scroll-sync updates it silently as content scrolls.

### TO-BE

1. User opens Settings on any viewport and sees a navigation strip where every destination carries a short text label beside its icon — "General", "Sync", "Audio", "Theme" — readable without any hover or memorization (N1).
2. User scans the labels and recognizes the target section at a glance; if it sits beyond the strip edge, an explicit overflow affordance (edge fade/scroll cue or overflow menu) signals more items and reveals them intact — never a glyph clipped mid-shape (N2).
3. User taps/clicks the labeled item; the system marks it active with the labeled equivalent of today's accent treatment and smooth-scrolls the matching section into view — identical anchor behavior to today (N3, N4).
4. User scrolls the content column freely; the active label tracks the section nearest the top and auto-centers itself in the strip, exactly as the current scroll-sync does (N3).
5. A user in a non-English locale sees the same strip in their language; a longer label truncates or flows into the overflow mechanism per one consistent rule without breaking layout (N5) — landing the promised value: first-attempt navigation to any of the 13 sections on any device.

## Stories

Business-level only — "I want X so that Y, done when Z." Story ≠ task.

- S1: As a panel user on any device, I want each settings section identified by a readable name so that I can jump straight to it — done when all 13 destinations show a visible label at every supported viewport.
- S2: As a touch user, I want section names available without hovering so that the nav is usable on my device — done when no naming depends on `title`/hover.
- S3: As a user on a narrow container, I want to discover and reach off-screen sections — done when overflow is reachable and visibly signaled, with no silent mid-glyph clipping.
- S4: As a returning user, I want to keep my bearings while scrolling — done when the active section stays visually marked and two-way scroll-sync behaves as today.
- S5: As a non-English user, I want the strip to hold my locale's labels — done when long labels degrade via one consistent truncation/overflow rule without breaking the strip.

## Risks

| Risk | Type (human/operational/internal/external/legal/hidden) | Impact | Team's ability to respond |
|---|---|---|---|
| 13 labeled items will not fit even the widest panel (~1099px — [assumption]; `20261006-universal-panel-ux-audit.md` cites no figure) — overflow design is mandatory, not optional; `Tabs` has no overflow mechanism today (`Tabs.module.css` carries none) | internal | High — shapes the whole design | High — `Menu`/`MenuItem` mandated by AGENTS.md for overflow lists; `StudyModeActionBar` edge-scroll precedent in-repo; edge-fade is CSS-only |
| i18n label width variance pushes chips past budget in some locale; truncation may hide the very words that provide discoverability | external (locale data) | Medium | Medium — labels are short by design today; mitigate with ellipsis + overflow rule; accepted risk: [assumption] current `settings.nav.*` strings are short enough that truncation is rare |
| `Navigation`/`NavItem` are shared atoms — a careless change to `.horizontal` could hit other consumers | internal | Medium | High — blast radius verified: `orientation="horizontal"` `Navigation` is consumed only by `SettingsDialogContent` in product code (bottom nav uses `Button orientation="vertical"`, `UniversalPanelBottomNav.tsx:56-69`); showcase files unaffected in production |
| Scroll-sync regression (active item desync, jitter during click-scroll) — the machinery (`clickScrollingRef` guard, rAF throttle) is subtle | operational | Medium | High — preserve `Navigation` internals untouched where possible; N3 AC makes regression detectable |
| Two surfaces consume `SettingsDialogContent` (panel forced-horizontal; dialog auto<600px) — a fix tested only in the panel could ship broken in the dialog | hidden | Medium | High — ACs require verification in both surfaces |
| Scope creep into item 31 (bottom-nav) or item 30 (a11y/tablist) — adjacent findings share the same files | operational | Low | High — scope boundary explicit above; touch-target sizes deferred to item 30 |
| Chosen overflow direction (menu vs fade-scroll) proves awkward at 600–839px hybrid band | human/design | Low | Medium — M-13 band ownership is item 31's; this item only needs the strip itself to behave at every width |

## Decision

go — verified P1 discoverability/a11y defect on a primary navigation surface, cost S, all ingredients (`NavItem` label slot, `Tabs`, `Menu`, scroll-sync infra, existing i18n strings) already in-repo; the only real unknown (overflow shape) is a DESIGN-stage choice, not a feasibility question. Accepted risks: i18n fit unverified per-locale, overflow mechanism undecided until design.

## Draft Acceptance Criteria

Need-level ACs (system ACs are derived in SPECIFY → `## Success Criteria`).

- [ ] All 13 settings destinations render a visible text label at every supported viewport in both consuming surfaces (universal panel `SettingsTab`, standalone `SettingsDialog`); no icon-only state remains for this nav.
- [ ] No destination name depends on hover/`title` tooltip to be known.
- [ ] When items exceed strip width, overflow is reachable and visually signaled (edge fade, scroll cue, or overflow menu); no item is clipped mid-glyph without a cue.
- [ ] Activating an item scrolls its section into view and marks the item active; scrolling content updates the active item; the active item auto-centers in the strip when overflowing — behavior identical to current `Navigation` scroll-sync.
- [ ] The active item is visually distinguished in the labeled presentation.
- [ ] Labels render from existing `settings.nav.*` i18n keys in all shipped locales; long labels follow one truncation/overflow rule without breaking layout or wrapping mid-label.
- [ ] Keyboard operability and current aria semantics (`aria-current`, nav `aria-label`, focus-visible) are preserved.
