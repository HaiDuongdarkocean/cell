# Testability Checklist — QA Perspective

> Run against the spec. Mark PASS / FAIL / NA for each item.
> Source: Delfy PRD validation, Ranorex testable requirements, AltexSoft acceptance criteria.

## Items

### T1 — Every acceptance criterion has a concrete verify method
- [ ] **PASS / FAIL / NA**: Each acceptance criterion (B1-Bn, C1-Cn, etc.) has a "Verify" column with a specific method
- **PASS**: "Verify: Browser MCP — inspect panel, check 3 elements present"
- **FAIL**: "Verify: manual testing" (no specific method — can't write automated test)
- **FAIL**: No verify column at all
- **Severity**: CRITICAL

### T2 — Edge cases ≥2 per user story (or per feature section)
- [ ] **PASS / FAIL / NA**: Each feature/user story has at least 2 edge cases documented
- **PASS**: "Multi-file import: 1 file target, 1 file native, 1 file neither, 2 files same lang, 2+ files"
- **FAIL**: "Import subtitle" with no edge cases (empty file, wrong format, huge file, same lang)
- **Severity**: HIGH

### T3 — Error states defined
- [ ] **PASS / FAIL / NA**: Spec defines what happens on error (fetch fail, parse fail, detect lang fail, file empty)
- **PASS**: "detect lang = neither → fallback assign target + toast ghi lang detected"
- **FAIL**: "import file → parse → load" with no error path
- **Severity**: HIGH

## Summary

| Item | Status | Severity |
|------|--------|----------|
| T1 — Verify method | PASS / FAIL / NA | CRITICAL |
| T2 — Edge cases | PASS / FAIL / NA | HIGH |
| T3 — Error states | PASS / FAIL / NA | HIGH |
