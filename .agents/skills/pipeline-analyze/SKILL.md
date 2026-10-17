---
name: pipeline-analyze
description: ANALYZE stage of the agentic SDLC — business analysis that produces a confirmed intent doc (needs, journeys, scope, go/no-go decision) or kills the item early. Use for any new feature/backlog item before specification. Absorbs elicitation, interview-me, idea-refine.
---

# Pipeline ANALYZE

> Backlog row / user statement → business analysis → `docs/intent/<slug>.md` → review gate → `transition → specify` (or `→ dropped` on no-go).

## Overview

ANALYZE answers one question: **should this exist, and if yes — what need does it serve, bounded how?** It is not a question-list exercise. The agent performs real business analysis on available evidence (backlog row, user statement, codebase, domain docs), presents a **hypothesis**, and asks only the questions the analysis cannot answer itself.

The stage ends in exactly one of three ways:
- **go** → `transition <slug> --to specify`
- **no-go** → `transition <slug> --to dropped` (kill early, before spending on spec/design/build)
- **defer** → stays in `analyze`, documented in `## Decision`

## When to Use

- New backlog item picked (idea-pick-off calls this first)
- User describes a want loosely: "I want X", "nên có Y"
- A need is suspected but never validated
- Re-analysis after a backward transition (loops < 3)

## When NOT to Use

- Bug/regression → `debugging-and-error-recovery`
- Spec already exists and confirmed → `pipeline-specify` (or `seed` if mid-flight)
- Non-feature work (refactor, debt, docs) → no pipeline, work directly
- UI-touching bugfix → `debugging-and-error-recovery` (lighter component/token check, not full DESIGN)

## Modes

| | interactive | `all` |
|---|---|---|
| Elicitation | Hypothesis presentation → user confirms/corrects | Self-interrogation: infer from Pain/Source/codebase, cite `file:line` or tag `[assumption]` |
| Gate | User approval record → `docs/reviews/<slug>-analyze.md` | `subagent_explore` fresh-context audit → same artifact |
| `awaiting` | `set awaiting=user-approval:intent` while waiting for user | Never set — conservative option + accepted risk |
| Decision | User can force no-go/defer | Agent may conclude no-go — still drops |

## Stage Contract

```
in:   backlog row {Slug, Pain, Cost, Value, Infra, Deps, Source} | user statement
out:  docs/intent/<slug>.md   (schema → references/intent-template.md)
      docs/reviews/<slug>-analyze.md  (ends with `VERDICT: <token>`)
exit: transition --to specify  (requires Decision=go + complete Journey + fresh review)
      transition --to dropped  (requires Decision=no-go + reason)
```

## State Steps

```bash
node scripts/pipeline-state.mjs init <slug> --mode <interactive|all>   # once — refuse if another item active
node scripts/pipeline-state.mjs set <slug> uiSurface=<yes|no>          # as soon as surface known
node scripts/pipeline-state.mjs set <slug> awaiting=user-approval:intent   # interactive only, while waiting
node scripts/pipeline-state.mjs set <slug> confidence=<high|medium|low>
node scripts/pipeline-state.mjs transition <slug> --to specify         # or --to dropped
```

`set uiSurface=unknown` blocks `specify → design|deliver` later — decide it here (check `ui_surface` field in the intent doc). Loop-cap escalation: `set awaiting=flagged:loop-cap` → human `resolve <slug> --note`.

## The Analysis — 3 phases

### Phase 1 — The four first BA tasks

**1. Business case (BACCM inference).** Infer all six concepts from evidence before asking anything: Need (problem+opportunity — never the desired solution), Change (current→future delta), Solution (direction, not features), Value (worth to stakeholder, not just measurable), Stakeholder, Context. `"quản lý project chặt và đúng hẹn"` is a **value** statement, not a need — the need is the pain underneath. Method: `references/baccm-and-hypothesis.md`.

**2. Stakeholders.** Every group with a relationship to the change: the **team** (can we build it — capability, time, resources?), the customer, suppliers/dependencies, the organization, regulators (licensing, legal, policy, compliance). Missing stakeholder info → explicit assumption or persona, never silent.

**3. Root cause + risk.** Pain → underlying need (5-whys or evidence chain). Risk register across: human, operational, internal, external; rare-but-high-impact hidden factors; legal/regulatory; and the team's ability to respond if the risk fires.

**4. Go / no-go / defer.** Synthesize 1–3 into `## Decision`. Killing a bad item here is the cheapest win in the pipeline.

### Phase 2 — Business-level functional requirements

- **Classify needs FURPS+**: Functional / Usability / Reliability / Performance / Supportability, plus security, privacy, infrastructure, financial, resource where relevant.
- **User stories at business level**: `"I want X so that Y — done when Z."` **Story ≠ task**: "transfer money" is a story; "choose bank / enter amount / enter OTP" are tasks *inside* it. Brain-dump → cluster/group → stories. Prioritize **complete journeys** over isolated features.
- **Business process as narrative first**: actors + sequence + milestones + start/end — *kể chuyện bằng lời trước, vẽ sau*. Any diagram is secondary (15-second readability rule, notation flexible). Only describe the process the product touches. Cover all three interaction types: person↔person, person↔device, system↔system.
- **`## Journey` is mandatory — complete AS-IS *and* TO-BE**, begin→middle→end, edge cases included. The transition enforces it structurally (markers + ≥3 steps each). No bullet-point "journeys".

### Phase 3 — Logic analysis

Read every story and the process A→Z and hunt contradictions through these lenses: legal/compliance, practical convenience, user comfort and delight, privacy, excessively strict requirements, excessive ambition, environment/equipment/policy fit. There is no universally best design — pick what is most reasonable *for this context* and say why.

## Elicitation = hypothesis presentation

Never open with a question template. Sequence:

1. Analyze available info via BACCM (phases 1–3 above)
2. Identify stakeholders and each stakeholder's needs
3. Draft a solution direction
4. **Present the hypothesis** — business case, stakeholders, draft needs, journey sketch, decision lean
5. Ask **only** the questions resolving real analysis gaps (`references/questioning.md`)
6. User confirms or corrects → update doc → approval record

`all` mode runs the identical loop against itself: infer, cite evidence (`file:line`) or tag `[assumption]`, pick the conservative option, record accepted risks. See `references/baccm-and-hypothesis.md` for the self-interrogation checklist.

## Review gate

- **interactive**: user approval of the intent doc → write `docs/reviews/<slug>-analyze.md` (approval record, ends `VERDICT: APPROVE`).
- **`all`**: `subagent_explore` fresh-context audit — every need cites real evidence, scope bounded, journey complete — write the report to the same artifact, ending `VERDICT: APPROVE|APPROVE_WITH_CHANGES|REJECT`. **One subagent, one pass per doc version** — no fix→re-review on the same version: `APPROVE_WITH_CHANGES` → apply fixes to the intent doc, append `## Applied fixes` to the artifact (refreshes mtime) → transition.
- Review artifact must be **newer than the intent doc** (stale review = refused by transition).
- Rejected → fix → re-review (a rewritten doc is a new version; bounded by loops=3 via backward transitions).

## Output

`docs/intent/<slug>.md` — schema enforced by `references/intent-template.md`: `## Business Case` (BACCM), `## Stakeholders`, needs list (id + statement + evidence/`[assumption]` + confidence% + FURPS+ class), scope boundary (in/out/non-goals), `## Workflow` narrative, `## Journey` (AS-IS+TO-BE), `## Stories`, risk register, `## Decision`, draft need-level ACs, `ui_surface:` field.

## Anti-patterns

| Don't | Why |
|---|---|
| Open with a question list | Elicitation is hypothesis presentation — questions serve the analysis, not vice versa |
| Accept "I want X" as the need | That's a solution; Need is the pain/opportunity underneath |
| Value statement as need | "quản lý chặt và đúng hẹn" = value; find the need below it |
| Journey as bullet fragment | Complete begin→end AS-IS + TO-BE is structurally enforced |
| Build-everything assumption | `## Decision` exists so bad items die here, not at ship time |
| Stories that name buttons/screens | Business level only — UI belongs to DESIGN |
| Skip team/regulator stakeholders | Capability and compliance are stakeholder questions too |

## Verification

- [ ] `pipeline-state.mjs get <slug>` shows `stage=analyze`, correct `mode`, `uiSurface` decided
- [ ] Intent doc has every required section incl. `## Journey` (AS-IS+TO-BE, ≥3 steps each) and `## Decision`
- [ ] Every need cites evidence or `[assumption]` + confidence
- [ ] Review artifact exists, ends `VERDICT: <token>`, newer than intent doc
- [ ] Hard-to-change decisions surfaced during analysis are listed in the intent doc as ADR candidates
- [ ] Decision go → `transition --to specify` exits 0; no-go → `--to dropped` and backlog shows `dropped`
- [ ] `all` mode: zero user questions; audit artifact is fresh-context, not self-audit

## Router boomerang

Task đổi → `/using-agent-skills` re-route. Spec unclear → `pipeline-specify`. Bug → `debugging-and-error-recovery`. UI question post-spec → `pipeline-design`.
