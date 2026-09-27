# Design Review: User data sync

> Reviews `docs/intent/user-data-sync-design-brief.md` + `docs/intent/user-data-sync-component-mapping.md` against `docs/specs/user-data-sync.md`. Interactive-mode approval gate — owner decision recorded.

## What was reviewed

- Three divergent concepts (Beacon / Watershed / Passport) built as an interactive mockup at `src/entrypoints/mockup-user-data-sync/` — distinct IA, interaction grammar and stylesheets, no shared presentation primitives.
- Real-Chrome audit via `chrome-devtools` MCP: 132 scenario cells (11 scenarios × 3 concepts × {mobile, desktop} × {light, dark}) — 0 horizontal scroll, 0 real overflow, 0 axe violations; dialog focus trap/restore, roving tabs, connect/rebind/migration/disconnect flows verified with trusted input. Evidence: `tmp/user-data-sync-mcp-audit/` (report.md + 33 captures).
- Two real bugs found and fixed during that audit (render-phase trigger capture; detached-trigger restore fallback).

## Owner decision

All three concepts **rejected** as implementation bases — metaphor surfaces are not reasonable carriers for this spec's function set. The audit nevertheless validated the interaction contract (state language, single recovery action, progressive disclosure, privacy notice, responsive/empty/overflow behavior), which carries over as binding requirements in the brief.

Approved direction: **spec-derived Settings section** composed of existing `src/shared/ui` components per `user-data-sync-component-mapping.md`. This matches the spec's Function ↔ Feature Map one-to-one, keeps persona range 5–80, and avoids shipping a bespoke visual system for a settings surface.

## Residual requirements carried to DELIVER

- Every non-healthy scope/connection state shows exactly one labeled action (REQ-14).
- Rebind shows copy-before-switch progress; delete-old-copy is a separate post-verification decision; keep is default (REQ-5/6, SC-26).
- Privacy notice names subtitle API keys and lives adjacent to the connect action (SC-19).
- Google connect button follows branding guidelines (bundled G mark, exempt from icon catalog).
- Empty and overflow layouts stay inside the Responsive Contract; no broken empty structures.

## Risks accepted

- Spec-derived UI is less visually distinctive — accepted: correctness and clarity outrank novelty for a sync settings surface.
- Mockup dir `src/entrypoints/mockup-user-data-sync/` is retained until ship step, then deleted per DELIVER contract.

Concepts rejected by owner; proceed with the component-mapped spec-derived Settings surface.

VERDICT: APPROVE_WITH_CHANGES
