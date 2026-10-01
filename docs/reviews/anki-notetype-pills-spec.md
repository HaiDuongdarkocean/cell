# Spec Review — anki-notetype-pills

Reviewer: spec-reviewer subagent (fresh context, BA/PO/TL lenses, one pass)

Verified spec claims against `ImportWizard.tsx` (nt-from-sample at L489, `advRow` L593–623, `selectedNt`/`cardCountByNt`/`ntIds` L125–172), `Chip` (`as="button"` → `aria-pressed`), `Popover` (portal, `triggerRef` anchor, no focus trap), `BottomSheet` (Esc/outside-click + `useFocusTrap`), `useIsMobile`, `useDismissOnScroll`/`pushEscapeLayer`, SpeedPill dismissal pattern. CSS: `mapLayout` collapses to 1 column ≤860px.

Blockers: none — spec is implementable; component and state claims match code.

## Major findings

1. [REQ-4/AC-6 vs Intent N4] [BA]: focus conflict — intent records "focus moves to its pill"; spec keeps focus on the toggle inside the manage surface. Technically correct (focus-trapped surface) but undocumented deviation → state explicitly.
2. [Traceability] [BA]: N5→AC-8 wrong (AC-8 is keyboard a11y, not viewport adaptivity); REQ-5 row missing; AC-9/AC-10 unmapped.
3. [Missing REQ] [PO]: no failure path for "all notetypes disabled → Start still enabled, imports zero notetypes silently" — `canContinue` ignores `ntIds`.
4. [NFR-3/REQ-3] [TL]: Popover portals outside Dialog's `useFocusTrap` — Tab past last row escapes the `aria-modal` dialog; keyboard containment underspecified.
5. [TL]: no alternatives-considered section (rubric requires ≥2 rejected alternatives — they exist in the analyze review).

## Minor findings

1. BottomSheet has no drag-to-dismiss (handle is visual-only) — fix wording.
2. Name the constant — `useIsMobile(BREAKPOINTS.expanded)` (default is 600px).
3. `selectedNtId` called both "explicit state" and "maintained by derivation" — clarify stored raw + derived effective.
4. Per-notetype sample cap unspecified — current code caps 4 notes/nt.
5. Manage list source should be `data.notetypes.filter(!isCloze)`, not the card-filtered prop.
6. REQ-1 precondition conflicts cosmetically with the zero-qualify alt flow.

VERDICT: APPROVE_WITH_CHANGES

## Applied fixes

1. REQ-4: documented focus-stays-on-toggle as deliberate deviation from intent N4 (selection moves to next nt; DOM focus can't cross focus-trapped surface).
2. Traceability remapped: N5→AC-4/AC-9, added REQ-5 row, AC-8/AC-9/AC-10/AC-11 mapped.
3. Added REQ-6 + AC-11: Start import disabled when enabled∩cards≥1 is empty (`canContinue` extended).
4. Added `## Alternatives considered` citing analyze review decisions.
5. REQ-3 specifies popover keyboard containment (Tab wraps rows, Esc closes + restores icon focus) since Popover portals outside Dialog's trap.
6. Wording fixes: BottomSheet dismissal = Esc/outside/header close (no drag claim), `useIsMobile(BREAKPOINTS.expanded)`, selectedNtId stored-vs-derived clarified, sample cap (≤4/nt) carried over, manage list source = `data.notetypes.filter(!isCloze)`, REQ-1 precondition reworded.
