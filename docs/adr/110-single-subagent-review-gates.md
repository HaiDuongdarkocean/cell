# ADR-110: One subagent, one pass per pipeline review gate

## Status

Accepted — decided 2026-09-28.

## Context

Two review gates existed in the stage pipeline, both kept:

- ANALYZE: `subagent_explore` audits `docs/intent/<slug>.md` (already a single subagent).
- SPECIFY: `spec-reviewer` audited `docs/specs/<slug>.md` — but the agent was an **orchestrator** that spawned `spec-reviewer-swe`/`spec-reviewer-glm` children in parallel, then merged. Each spec review cost ≥2 subagent contexts plus a synthesis pass.

`idea-pick-off` already documented "SPECIFY's spec-reviewer is the only human-proxy gate"; the orchestrator fan-out was leftover machinery from a multi-model-diversity design that no longer existed (all children ran `model: swe` anyway, so there was no actual model diversity).

## Decision

- `spec-reviewer` is a **single agent, single pass**: reads the spec + same-slug intent doc, applies all three BA/PO/TL lenses from `review-lenses.md` in one pass, emits one report ending `VERDICT:`.
- `spec-reviewer-swe` and `spec-reviewer-glm` profiles deleted; all references repointed to `spec-reviewer`.
- Both gates keep the **one-pass-per-version** rule: `APPROVE_WITH_CHANGES` → apply fixes → append `## Applied fixes` to the artifact (refreshes mtime) → transition; `REJECT` → backward edge to `analyze`, and the rewritten doc is a new version that gets its own one pass. `pipeline-state.mjs` unchanged — mtime staleness + verdict parsing already enforce this.

## Consequences

- ~3× fewer subagent contexts per spec review; latency and token cost drop accordingly.
- Quality preserved by: three lenses kept as one rubric (coverage unchanged), fresh-context reviewer (generation ≠ review), deterministic transition checks (verdict parse, mtime staleness, journey/decision structure), and intent-traceability checks inside the BA lens.
- Lost: parallel-reviewer diversity. Accepted — the lenses encode the diversity of viewpoint; a second same-model pass added latency without new signal.
