# Spec Review — up-a11y-hit-targets

Single-pass BA/PO/TL review of `docs/specs/up-a11y-hit-targets.md` against intent `docs/intent/up-a11y-hit-targets.md` + analyze-gate review. Spot-verified ~25 code citations; nearly all held: `useFocusTrap.ts:29-41` (unfiltered initial pick vs filtered cycle, `getRootNode()` reads — spec's fix preserves shadow-DOM behavior), `UniversalPanel.tsx:207-211,275-290,287` (BottomNav DOM-first, `<div hidden>` panes, recap without `.tabPane` wrapper — all exact), `UniversalPanel.module.css:10-16` (`.panel` plain `display:flex` row → ≤839px rule *must* still set `column`; spec :85 states this correctly), `:80-84` `column-reverse`, `UniversalPanelBottomNav.module.css:5,15-19`, `tokens.json:554-557/733-734/765/639/452/431`, `themeTokens.ts:59-61`, `STANDARD.md:311-315`, `PlaylistTab.tsx:199`, `StudyModesTab.tsx:134/163/244/329-338`, `VocabularyTab.module.css:101-108/112-129`, `DictLinksManager.tsx:143/179-191/197-217`, `MobileSheet.module.css:54-67`, `DictionaryToolbar.tsx:45-51`, `AudioPanel.tsx:220-229`, `BottomSheet.tsx` (sm close :108-116; returns null when closed → DOM-last postcondition holds; overlay `position:fixed` → DOM move inert, claim verified).

## Blockers

- none.

## Major

1. [REQ-4 / AC-7, N2] [TL]: `aria-current` `'true'`→`'page'` upgrade silently breaks the mobile active-tab indicator — `UniversalPanelBottomNav.module.css:55-56` styles the active nav `Button` *only* via `.navItem[aria-current="true"]` (Button has no `.active` class fallback, unlike NavItem which pairs `.item.active` at `NavItem.module.css:43-44`). Post-change the tint dies → visual regression under N2 + AC-6 visual-parity screenshot. Fix: REQ-4 basic flow must add updating `UniversalPanelBottomNav.module.css:55-56` to `[aria-current="page"]` or presence selector `[aria-current]`; do NOT touch `NavItem.module.css`'s `"true"` branches (other consumers — `Navigation.tsx:76`, `PosVariantNav`, `QueueSidebar`, `DictionaryPanelView` chips — still emit `'true'`). Downstream: sibling spec `up-mobile-chrome.md:42` cites `aria-current="true"` as a precondition — flag for re-sync.
2. [REQ-1 / REQ-8 / AC-3] [TL/PO]: floor is specified "in both width and height" but the verification harness measures **height only** — `universal-panel-ux-audit.spec.ts:261-263` filters `it.height < touchTargetMin`; width is never compared. Real counterexample already in the inventory: `Toggle` xs `--toggle-w: var(--space-9)` = 36px < 40px fine / 44px coarse — a width-blind collector can ship AC-1 green while Toggle xs still fails on width. Fix: REQ-8 step 2/3 must require extending the collector to check `Math.min(rect.width, rect.height)` (or both dims) plus the already-promised rect-intersection check.

## Minor

1. [REQ-6] [TL]: rationale "`switch` supports `aria-checked`, not `aria-expanded`" overstates — ARIA 1.2 `switch` inherits `checkbox`, whose supported props include `aria-expanded`; it's legal, just AT-inconsistent and absent from APG. Decision itself (switch + `aria-controls`/`aria-describedby`, expanded rejected) is defensible and matches intent's accepted-risk conservative arm — fix the justification wording only.
2. [REQ-6 / N7] [BA]: chosen arm does not literally announce expanded/collapsed — `aria-checked` on/off + describedby hint is the contract, not "expanded". Spec records this deviation (rejected alternative + DESIGN deferral); acceptable, but note intent TO-BE-4/S7 promise an "expanded" announcement — revisit if real-AT testing reads poorly.
3. [REQ-3] [TL]: citation slip — profile `Dialog` (`:246-262`) sits between *sidebar and `.body`*, not "between nav and sidebar"; postcondition's "DOM order = sidebar, body, bottomNav" is fine since the dialog is conditional + `position:fixed`, but fix the precondition wording.
4. [REQ-4] [TL]: `CollapsibleSidebar` already supports `as="nav"` (`:35,49`) — simplest navigation-landmark mechanism; spec's "aside gains role=navigation or wrap in `<nav>`" works but misses the cheapest option. DESIGN-level, one-line note suffices.
5. [REQ-1] [TL]: two site-row clarifications — (a) `.toggle` label growth grows the track too (`.input` is `height:100%` at `Toggle.module.css:47`); "track stays 20px visual" requires separately constraining `.input`, not just the label. (b) `.statusBadge` has a non-interactive `statusBadgeStatic` variant (`VocabularyTab.module.css:131`) — bind only the interactive variant. Both are arguably covered by "DESIGN calls visual policy"; making it explicit avoids a wrong first pass.
6. [AC-10] [PO]: "announces exactly once" isn't directly testable in Playwright (no AT); the assertable contract is DOM-level — exactly one `role="status"` region, zero `aria-live` on cards, dedupe guard on identical summaries. REQ-7 rules imply it; make AC-10 state the DOM assertions explicitly.

## Nhận xét theo role

- BA: Opens on the problem (measured sub-floor targets, focus escaping `aria-modal`, broken semantics), personas explicit, non-goals fenced hard against items 28/29/31/32/33 — no scope creep detected; N1–N9 → REQ → AC traceability is complete and correct.
- PO: Every REQ carries actor/goal/basic/alt/exception + postcondition; AC-1..AC-11 are concrete and measurable (px thresholds, aria attributes, `matchMedia` assertion); failure paths present (empty-pane focus, no-visible-focusable, second-wave violations).
- TL: Strongest spec qualities — honest mechanism ladder (min-*/padding/`::before` bleed gated on no-interactive-neighbor), REQ-3 atomic pair correctly insists `column` must remain, AC-1's hard `matchMedia` assertion + correct "hasTouch alone insufficient" caveat is verifiably sound (CDP `Emulation.setEmulatedMedia` `features:[{name:'pointer',value:'coarse'}]` and `isMobile`+`hasTouch` descriptors both flip `pointer: coarse` in Chromium; `isMobile` is Chromium-only, spec already says "Chromium device descriptor"); 44/40/24 numbers match STANDARD §10.3 + WCAG 2.5.8. Two seams missed: the `[aria-current="true"]` CSS coupling and the height-only collector.

## Action items

1. REQ-4: add rule — update `UniversalPanelBottomNav.module.css:55-56` selector to `[aria-current="page"]`/presence form; leave `NavItem.module.css` `"true"` branches for non-panel consumers; flag `up-mobile-chrome.md:42` precondition staleness — REQ-4.
2. REQ-8: require width+height (or min-of-both) measurement in the collector, alongside the intersection check — REQ-8 basic flow.
3. REQ-6: fix "not supported" claim → "AT-inconsistent"; optionally note the on/off-vs-expanded announcement gap — REQ-6.
4. REQ-3: correct "between nav and sidebar" → "between sidebar and `.body`" — REQ-3 rules.
5. REQ-1: clarify Toggle track needs separate visual constraint; scope `.statusBadge` binding to the non-static variant — REQ-1 table.
6. AC-10: state the DOM-level assertion contract — Success Criteria.

## Risks chấp nhận

- Switch disclosure announces "on/off + hint" rather than literal "expanded" — revisit khi real-AT spot-check (AC-11 DoD) reads poorly.
- Second-wave coarse-pointer violations beyond the audited 13-row inventory — expected per M-10, in scope by definition.
- `aria-controls` IDREF pointing at unmounted region when closed — legal, ignored by AT; DELIVER picks mounted+hidden vs conditional.

VERDICT: APPROVE_WITH_CHANGES

## Applied fixes

1. REQ-4 Rules — added the `UniversalPanelBottomNav.module.css:55-56` selector update (`[aria-current="true"]` → `"page"`/presence), with the no-`.active`-fallback reason, the `NavItem.module.css` hands-off note, and the `up-mobile-chrome.md:42` staleness flag.
2. REQ-8 basic flow step 3 — collector must compare both dimensions (`Math.min(rect.width, rect.height)` or flag on either); noted `universal-panel-ux-audit.spec.ts:261-263` currently filters height only.
3. REQ-6 Goal + Rules — corrected the rationale: `aria-expanded` is legal on `role="switch"` (ARIA 1.2 `checkbox` inheritance) but AT-inconsistent/absent from APG; recorded the on/off-vs-"expanded" announcement gap as an accepted deviation.
4. REQ-3 Rules — corrected "between nav and sidebar" → "between sidebar and `.body`" for the profile `Dialog` at `UniversalPanel.tsx:246-262`.
5. REQ-1 table — Toggle xs row now states `.input` is `width/height:100%` so label growth grows the track (separate `.input` constraint needed for a 20px visual); `.statusBadge` row now scopes the binding to the interactive variant, excluding `statusBadgeStatic`.
6. AC-10 — restated as the DOM-level assertion contract: exactly one `role="status"` region, zero `aria-live` on cards, dedupe guard on identical summaries (AT counts not Playwright-testable).
