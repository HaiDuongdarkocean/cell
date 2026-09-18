# Intent Doc Template — `docs/intent/<slug>.md`

> Contract enforced by `pipeline-state.mjs transition analyze→specify`: `## Journey` must exist with as-is + to-be markers and ≥3 step lines each, and `## Decision` must read `go`. Everything else is reviewed by the gate, not the parser — write it as if the auditor will check each cell against evidence.

```markdown
# Intent: <title>

> Slug: `<slug>` · Mode: <interactive|all> · Source: <backlog row | user statement>
> ui_surface: <yes|no>          ← consumed by specify→design|deliver routing
> confidence: <high|medium|low> ← overall analysis confidence

## Business Case

BACCM inference — every cell cites evidence (`file:line`) or `[assumption]` + confidence.

| Concept | Statement | Evidence | Confidence |
|---|---|---|---|
| Need | <problem/opportunity — NOT a solution> | | |
| Change | <current → future delta> | | |
| Solution | <direction only — no feature list> | | |
| Value | <worth to stakeholder, in context> | | |
| Stakeholder | <primary persona> | | |
| Context | <binding circumstances> | | |

## Stakeholders

| Group | Who | Their need re: this change | Capability/constraint |
|---|---|---|---|
| Team | <builders> | <can we build it — time, skill, resources> | |
| Customer | <persona> | | |
| Supplier/Dependency | <apis, data, platform> | | |
| Organization | <maintainers, future contributors> | | |
| Regulator | <licensing, legal, store policy> | | |

Empty cell → write "none — <why>", never leave silent.

## Needs

| ID | Need (statement) | FURPS+ | Evidence/`[assumption]` | Confidence |
|---|---|---|---|---|
| N1 | | F / U / R / P / S / +<security|privacy|infra|financial|resource> | | |

## Scope

- **In:** <what the change includes>
- **Out:** <explicitly excluded>
- **Non-goals:** <what a reader might assume but is not this work>

## Workflow

Narrative first — tell the story: actors, sequence, milestones, start, end.
Cover person↔person / person↔device / system↔system as relevant.
Any diagram after the narrative (15-second readability rule).

## Journey

### AS-IS
1. <step>
2. <step>
3. <step>
...edge cases welcome

### TO-BE
1. <step>
2. <step>
3. <step>
...must end where the promised value lands

## Stories

Business-level only — "I want X so that Y, done when Z." Story ≠ task
(no buttons, screens, or implementation functions here).

- S1: As <persona>, I want <X> so that <Y> — done when <Z>.

## Risks

| Risk | Type (human/operational/internal/external/legal/hidden) | Impact | Team's ability to respond |
|---|---|---|---|

## Decision

<go | no-go | defer> — <one-line reason>

## Draft Acceptance Criteria

Need-level ACs (system ACs are derived in SPECIFY → `## Success Criteria`).

- [ ] <verifiable condition>
```

## Gate checklist (what the reviewer verifies)

- Every `## Journey` part ≥3 steps, TO-BE ends at the value
- No need is secretly a solution or a value
- `ui_surface` consistent with journey steps (any user-visible step → `yes`)
- Decision reason supported by the risk register
- Confidence tags honest — a wall of `high` on a thin evidence base is a flag
