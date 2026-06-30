# Spec Review: <feature-name>

> **Model**: <Opus 4.8 / Kimi 2.7>
> **Date**: <date>
> **Spec**: `docs/specs/spec-<feature>.md`
> **Intent**: `docs/intent/idea-<feature>.md`
> **Reviewer**: spec-reviewer skill (subagent)

## Status

**APPROVED / APPROVED_WITH_CONDITIONS / BLOCKED**

## Checklist Results

| Section | Pass | Fail | NA | Items |
|---------|------|------|-----|-------|
| Feasibility (Tech Lead) | _/4 | _/4 | _/4 | F1-F4 |
| Testability (QA) | _/3 | _/3 | _/3 | T1-T3 |
| Scope (Product) | _/3 | _/3 | _/3 | S1-S3 |
| **Total** | _/10 | _/10 | _/10 | |

## Checklist Details

### Feasibility (Tech Lead)

| Item | Question | Status | Severity | Note |
|------|----------|--------|----------|------|
| F1 | Dependencies have owner + timeline + fallback? | PASS/FAIL/NA | HIGH | |
| F2 | Architecture considerations section exists? | PASS/FAIL/NA | MEDIUM | |
| F3 | Technical constraints reviewed? | PASS/FAIL/NA | HIGH | |
| F4 | Rollback strategy for stateful changes? | PASS/FAIL/NA | HIGH | |

### Testability (QA)

| Item | Question | Status | Severity | Note |
|------|----------|--------|----------|------|
| T1 | Every acceptance criterion has concrete verify method? | PASS/FAIL/NA | CRITICAL | |
| T2 | Edge cases ≥2 per user story? | PASS/FAIL/NA | HIGH | |
| T3 | Error states defined? | PASS/FAIL/NA | HIGH | |

### Scope (Product)

| Item | Question | Status | Severity | Note |
|------|----------|--------|----------|------|
| S1 | Problem statement doesn't mention solution? | PASS/FAIL/NA | HIGH | |
| S2 | Out-of-scope ≥3 tempting extensions? | PASS/FAIL/NA | HIGH | |
| S3 | Success metrics are measurable? | PASS/FAIL/NA | CRITICAL | |

## Risks

| # | Severity | Section | Question | Suggested Fix |
|---|----------|---------|----------|---------------|
| 1 | CRITICAL/HIGH/MEDIUM | F/T/S | <question> | <fix> |

## Open Questions

1. <question for user — must answer before G2 if BLOCKED or APPROVED_WITH_CONDITIONS>
2. <question>

## Suggested Spec Updates

1. <concrete edit suggestion — section + what to add/change>
2. <suggestion>

## Decision

- [ ] **APPROVED** — proceed to G2 Plan
- [ ] **APPROVED_WITH_CONDITIONS** — answer open questions, then proceed to G2
- [ ] **BLOCKED** — fix CRITICAL risks, re-run spec-reviewer
