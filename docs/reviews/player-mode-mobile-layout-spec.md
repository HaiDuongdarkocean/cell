# Spec Review — player-mode-mobile-layout

> Reviewer: spec-reviewer subagent (fresh context, single pass, BA/PO/TL lenses) · 2026-10-05
> Artifact: `docs/specs/player-mode-mobile-layout.md`

Spec is well-traced (every REQ ↔ need/journey, all intent needs covered) and correctly reuses existing ids/handlers. But several feasibility-critical mechanisms were left open or contradicted hard constraints.

## Blockers

none — every gap has a viable fallback, but the Majors below had to be resolved before design.

## Major findings (as reported)

1. [REQ-4] [TL]: Pill repositioning was an unresolved "hoặc" between (a) PM mutates foreign-owned `.js-Tihoka-comprehension-pill-host` (inline styles lost on remount, no restore contract) vs (b) PM-owned anchor + marker. → pick mechanism, owner, remount/restore contract.
2. [REQ-3] [TL]: `cue-filter-fab` is owned by `SubtitlePanel` internals (`cueListWrap` + lastGood/practiceMode/panelBlurred state), not the dock — rail reuse needs hoist-state (deep refactor) or CSS-slot; also fab behavior in `active` mode undefined.
3. [C5 vs AC-13] [PO/TL]: `tools-toggle-btn`/`subtitle-tools-extra`/`player-mode-actions`/`panel-toggle-btn` intentionally dissolved on mobile → AC-13 untestable without branch-scoped table.
4. [REQ-1/5/6] [PO]: mobile cueRegion chrome (panel header + StudyModeActionBar) and ⋯ inventory undefined; mode-select + speed can't trivially be MenuItems.
5. [States] [PO]: uncovered — `practiceMode≠'off'` (e2e exists: `subtitle-panel-practice.spec.ts`), `cueListOpen=false`, active-mode no-current-cue.
6. [NFR-4/AC-14] [TL]: REQ-6 storage subscribe contradicted "no new listeners".
7. [NFR-3/AC-7] [PO]: mockup asset not committed/cited — no diff artifact for QA.

## Minor findings

- `trackLabel` prop plumbing absent; caption bilingual ambiguity.
- Two list-toggles collide semantically (`panel-toggle` session hide vs active-mode override).
- REQ-8 "vùng trống đủ" unquantified; child-iframe badge nuance (only mounts in child fullscreen).
- Missing Preconditions on REQ-3/4/5/6; REQ-9 lacked alt/exception/postcondition; REQ-2 exception cited wrong handler.
- Esc semantics (menu → cuelist → exit) unstated.
- `resolvePlayerModeLayout` mobile dock-height input unspecified.
- Rail container id unnamed.

## Lens notes

- BA: problem-first objective, tight scope, two-way traceability — strongest part; vague terms flagged.
- PO: ACs mostly testable but AC-13 self-contradicted design; state coverage gaps.
- TL: reuse-maximal direction right; two cross-boundary mechanisms (pill host, in-panel fab) were the biggest feasibility risks — now decided (CSS `:host-context` marker; portal slot).

## Applied fixes

Applied to spec v2 (all items):

1. REQ-4: decided pill mechanism — PM sets `data-tihoka-player-mode-mobile` + `--pm-anchor-bottom` on `document.documentElement`; `ComprehensionPill.module.css` reads via `:host-context()` → remount-safe, auto-restore, zero changes to `mountComprehensionPill`.
2. REQ-3: decided fab mechanism — portal slot (`pm-fab-slot`): PM owns slot div in rail, SubtitlePanel `createPortal`s `cueFilterFab` into it; state stays in panel; fab hidden in `active` mode; slot collapses without gap.
3. C5 contract rewritten as branch-scoped table (≥600px vs <600px): preserved ids enumerated, `player-mode-actions` reused as rail wrapper, `nav-cluster` kept on transport group, `tools-toggle-btn`/`subtitle-tools-extra` explicitly dropped on mobile only, new ids listed (`pm-bottom-bar`, `pm-anchor-row`, `pm-more-btn`, `pm-more-menu`, `pm-fab-slot`, `pm-cue-active-card`).
4. REQ-7: mobile cueRegion = barebones — panel header + StudyModeActionBar/PracticeOptions hidden; ⋯ menu inventory enumerated (rewind/forward-conditional, cue-list toggle, OCR, study-mode radios, speed radios, practice).
5. Flows/States: added `cueListOpen=false` (region collapses, video fills), `practiceMode≠'off'` (SubtitlePracticeSession in region), active-mode no-current-cue (next-upcoming dimmed → EmptyState), Esc chain semantics.
6. NFR-4/AC-14 reworded: no new layout/resize listeners; scoped `chrome.storage.onChanged` subscription allowed with cleanup.
7. Mockup committed at `docs/mockups/player-mode-mobile-layout.png` + current-state `player-mode-mobile-current.png`; cited in spec header + NFR-3/AC-7; `trackLabel` prop added (REQ-4 + Data).
8. Minors: Preconditions added to REQ-3/4/5/6; REQ-9 alt/exception/postcondition added; REQ-2 exception example corrected; REQ-8 quantified (badge size + `--space-2` clearance, iframe nuance); mobile dock-height rule stated in REQ-1 (compact bar constants in `playerModeGeometry`).

All 7 majors + minors applied to spec v2; ready for DESIGN.

VERDICT: APPROVE_WITH_CHANGES
