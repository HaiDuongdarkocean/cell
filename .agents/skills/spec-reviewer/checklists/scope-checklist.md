# Scope Checklist — Product Perspective

> Run against the spec. Mark PASS / FAIL / NA for each item.
> Source: Scriptonia PRD guide, DEV Community PRD checklist, Delfy PRD validation.

## Items

### S1 — Problem statement does not mention solution
- [ ] **PASS / FAIL / NA**: Problem statement / Objective describes the problem, not the solution
- **PASS**: "User doesn't know which subtitle is active without opening dropdown"
- **FAIL**: "We need a panel with 2 sections and radio buttons" (that's the solution)
- **Severity**: HIGH

### S2 — Out-of-scope list has ≥3 tempting extensions
- [ ] **PASS / FAIL / NA**: Out-of-scope section names at least 3 things a reasonable engineer might assume are included
- **PASS**: "Not doing: save imported cues to storage, keyboard shortcut cycle, smart-merge timestamp"
- **FAIL**: "Out of scope: none" or only 1-2 items
- **Severity**: HIGH

### S3 — Success metrics are measurable
- [ ] **PASS / FAIL / NA**: Success criteria have specific, testable conditions (not "improve" or "better")
- **PASS**: "User knows active sub without opening panel (active chip visible)"
- **FAIL**: "Better subtitle experience" (can't test)
- **Severity**: CRITICAL

## Summary

| Item | Status | Severity |
|------|--------|----------|
| S1 — Problem vs solution | PASS / FAIL / NA | HIGH |
| S2 — Out-of-scope | PASS / FAIL / NA | HIGH |
| S3 — Success measurable | PASS / FAIL / NA | CRITICAL |
