# Spec Template — `docs/specs/<slug>.md`

> Contract: `## Success Criteria` is the canonical AC source DELIVER extracts verbatim. Traceability table is how reviewers catch scope leaks in both directions.

```markdown
# Spec: <title>

> Intent: `docs/intent/<slug>.md` · ui_surface: <yes|no> · Mode: <interactive|all>

## Objective

<What the system must do and why — one paragraph, traced to the business case.>

## Actor ↔ System Boundary

| Actor | Triggers | Inputs | Receives/Views |
|---|---|---|---|
| <external entity> | | | |

System-internal processing never includes human behavior. If a flow step
says "user decides", model it as actor input or a flow branch.

## Requirements

### Functional

REQ-1: <name>
- Actor: <who triggers>
- Goal: <what they achieve>
- Preconditions: <state before>
- Basic flow:
  1. actor <input>
  2. system <process>
  3. system <output to actor>
- Alt flow: <optional variations>
- Exception: <failure modes + response>
- Rules: <business rules>
- Postcondition: <state after>
- NFR refs: NFR-<ids>

### Non-functional (NFR)

| ID | Requirement | Class (U/R/P/S/+security/privacy/infra/financial/resource) | Target |
|---|---|---|---|
| NFR-1 | | | |

## Flows / States

<Only where behavior is complex. Text diagrams: activity branches, sequence
order, state transitions `state --event→ state`. 15-second readability.>

## Function ↔ Feature Map

| Function (what the system does) | Features (tools supporting it) |
|---|---|
| | |

Rules: no feature without a function; no function without ≥1 feature.
UI designs features only after functions are understood.

## Data

| Entity | Key fields | Lives in | Retention |
|---|---|---|---|

## Traceability

| Need (intent ID) | REQ | AC (Success Criteria line) |
|---|---|---|
| | | |

| Journey step | REQ |
|---|---|
| | |

## Boundaries

- Always: <e.g. run gates before commit, tokens only>
- Ask first: <e.g. new dependency, manifest change>
- Never: <e.g. commit secrets, edit generated files>

## Success Criteria

<Specific, testable, need-traced. This is the canonical AC source for DELIVER.>

- [ ] <verifiable condition>

## Definition of Done

- [ ] All Success Criteria pass
- [ ] `npm run typecheck && npm run lint && npm run test:unit && npm run build` green
- [ ] UI changes pass design-system check if touching TSX/CSS
- [ ] Feature-specific verification (browser smoke, migration test, …)
- [ ] One-way-door decisions → ADR at status Proposed in `docs/adr/`; canon docs updated (arch/wiki)

## Open Questions / Accepted Risks

<Anything unresolved; in `all` mode these are assumptions recorded as risks.>
```

## Review checklist (what `spec-reviewer` hunts)

- REQ fields complete; actor stays external in every flow step
- Alt/exception flows present, not just happy path
- Traceability both directions: need→REQ→AC and journey-step→REQ
- Function↔feature table has no orphans
- Success Criteria testable — "works well" is not a criterion
- `ui_surface` consistent with intent doc
