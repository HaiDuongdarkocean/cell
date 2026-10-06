# Spec Review — up-settings-subnav

Single-pass BA/PO/TL audit vs `docs/intent/up-settings-subnav.md` + analyze review. All file:line cites spot-checked against source — held (`NavItem.module.css:119-121`, `SettingsDialogContent.tsx:56,116,122-140,153-167,177,195-197`, `Navigation.tsx:42-163`, `Navigation.module.css:26-45`, `Sidebar.module.css:56-79`, `StudyModeActionBar.tsx:27-62,101-159`, `en.json/vi.json:7,402-413,927-928`, `SettingsDialog.module.css:180`).

## Blockers

- none.

## Major

1. [REQ-1 Rules / NavItem.module.css:110-121] [TL]: spec removes `.horizontal .label{display:none}` but its "keeps" list omits `.horizontal { padding:0; gap:0 }` (:115-116) — both tuned for the icon-only state. Literal implementation yields label glued to icon, zero inline padding. Fix: REQ-1 Rules must state that `.horizontal` regains inter-node spacing (gap + inline padding tokens) when `.label` unhides; DESIGN owns the values, spec must own the requirement.
2. [REQ-6 vs NavItem.module.css:141-149] [PO/TL]: `.label` ships `overflow:hidden; text-overflow:ellipsis` — "labels never truncate" holds only while the item is unconstrained (`width:auto`+`flex-shrink:0` in the scroll track). Fix: REQ-6 should note the ellipsis rule stays dormant in `.horizontal` (or scope it to `.vertical`) so a future squeeze can't silently violate AC-6.

## Minor

1. [REQ-3 / Navigation.tsx:176-180] [TL]: affordance implies a new wrapper root around `<nav>`; spec doesn't pin semantics — `<nav>` keeps `aria-label`, wrapper needs `min-width:0` inside `[data-orientation="horizontal"] .body` (Sidebar.module.css:72-79). Fix: one line in Rules.
2. [REQ-5] [PO]: no actor/precondition/alt/exception — thinnest REQ; acceptable for a pure visual rule but below the section's own template bar.
3. [REQ-2 Flows diagram] [BA]: `sidebarExpanded` expression "stays" per Rules — correct, since `vertical` ⇒ `≥768` ⇒ expanded makes the collapsed rail unreachable; confirmed unreachable in product. No change needed; noted as verified, not a defect.

## Verified author decisions

- REQ-1 blast radius correct: `orientation="horizontal"` Navigation/NavItem consumed only by `SettingsDialogContent` in product; showcases/tests don't ship; bottom nav uses `Button`.
- REQ-2 cutoff fix correct: `<SIDEBAR_LABEL_MIN_WIDTH` (768) closes the 600–767 collapsed-rail band; `BREAKPOINTS.medium=600` still governs `mainCol` @container padding — untouched, no conflict.
- REQ-3 precedent verified (observer+scroll state machine, ±0.75 paging, chevron Button recipe, i18n key pattern `studyModes.actionBar.scrollLeft/Right` → `settings.nav.scrollLeft/Right` consistent); Tabs rejection sound — no `contentRef`/`sectionRefs`/`scrollNavToId`/`clickScrollingRef` machinery.
- REQ-4 auto-center reads live `offsetLeft/offsetWidth` (:50-51) — labeled widths genuinely safe.
- Traceability N1–N6→REQ-1..7→AC-1..7 complete, no orphan REQ; scope discipline solid (items 30/31/33 excluded, tablist deferred, collapsed CSS kept).

## Nhận xét theo role

- BA: opens on the discoverability problem, persona + non-goals explicit, every REQ traces to a need and journey step.
- PO: ACs testable — 4 widths × 2 surfaces × 2 locales, edge-state affordance matrix, scroll-spy parity; exception flows present (no-RO fallback, no-overflow, missing sectionRef).
- TL: mechanism-level accuracy is high; the only real miss is the `.horizontal` gap/padding + dormant `.label` ellipsis interplay.

## Action items

1. REQ-1 Rules: require restoring gap/padding on `.horizontal` when label unhides — §Requirements/REQ-1.
2. REQ-6 Rules: clarify `.label`'s `text-overflow:ellipsis` is dormant in horizontal (or scope to `.vertical`) — §Requirements/REQ-6.
3. REQ-3 Rules: pin wrapper semantics (`<nav>` keeps aria-label; wrapper `min-width:0` in horizontal sidebar body) — §Requirements/REQ-3.

## Risks chấp nhận

- vi labels are widest expected but unmeasured — revisit when DESIGN/DELIVER captures 600–767px vi screenshots (AC-6 already forces evidence).
- Arrow mount/unmount on edge state changes Tab order dynamically — matches `StudyModeActionBar` precedent; revisit if UX review flags focus loss.

VERDICT: APPROVE_WITH_CHANGES

## Applied fixes

1. REQ-1 Rules: added that `.horizontal { padding:0; gap:0 }` (`NavItem.module.css:115-116`) was tuned for icon-only and must regain inter-node spacing (gap + inline padding from tokens) when `.label` unhides — DESIGN owns the values, spec owns the requirement.
2. REQ-6 Rules: added that `.label`'s `overflow:hidden; text-overflow:ellipsis` (`NavItem.module.css:141-149`) stays dormant in `.horizontal` (items are `width:auto` + `flex-shrink:0` in the scroll track) or is scoped to `.vertical`, so a future squeeze can't silently violate no-truncate.
3. REQ-3 Rules: pinned wrapper semantics — `<nav>` keeps `aria-label` and remains the landmark; the new arrows wrapper needs `min-width:0` inside `[data-orientation="horizontal"] .body` (`Sidebar.module.css:72-79`).
