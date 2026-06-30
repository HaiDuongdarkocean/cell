# Feasibility Checklist — Tech Lead Perspective

> Run against the spec. Mark PASS / FAIL / NA for each item.
> Source: spec-coding.dev, Anthropic "Building Effective Agents", OpenAI Codex best practices.

## Items

### F1 — Dependencies have owner + timeline + fallback
- [ ] **PASS / FAIL / NA**: Every external dependency mentioned in spec has:
  - Owner (who provides it — package, team, API)
  - Timeline (when available — now, Q3, unknown)
  - Fallback (what if it's not available)
- **PASS example**: "detectLanguage from languageDetector.ts (existing, available now, fallback: assign target)"
- **FAIL example**: "uses detectLanguage" (no fallback if detection fails)
- **Severity**: HIGH

### F2 — Architecture considerations section exists
- [ ] **PASS / FAIL / NA**: Spec has an architecture considerations section (or references an ADR)
- **PASS**: "Project Structure" section lists files + dependencies + data flow
- **FAIL**: No architecture section, jumps straight to acceptance criteria
- **Severity**: MEDIUM

### F3 — Technical constraints reviewed
- [ ] **PASS / FAIL / NA**: Spec lists technical constraints (platform, performance, security, compatibility)
- **PASS**: "Chrome Extension MV3", "content-script vanilla DOM", "system colors from theme.css"
- **FAIL**: No constraints mentioned, assumes generic web app
- **Severity**: HIGH

### F4 — Rollback strategy for stateful changes
- [ ] **PASS / FAIL / NA**: If spec changes state (storage, preferences, migrations) → rollback strategy defined
- **PASS**: "Reload ghi đè imported sub (ponytail — no persistence, no rollback needed)"
- **FAIL**: "Save preference to storage" with no rollback if migration fails
- **NA**: Spec is stateless (pure UI, no storage changes)
- **Severity**: HIGH

## Summary

| Item | Status | Severity |
|------|--------|----------|
| F1 — Dependencies | PASS / FAIL / NA | HIGH |
| F2 — Architecture | PASS / FAIL / NA | MEDIUM |
| F3 — Constraints | PASS / FAIL / NA | HIGH |
| F4 — Rollback | PASS / FAIL / NA | HIGH |
