# Spec Review: Subtitle Navigation Control Cluster

> **Model**: Kimi 2.7 (initial) → Opus 4.8 (re-review after patch)
> **Date**: 2026-07-02
> **Spec**: `docs/specs/spec-subtitle-navigation-control.md`
> **Intent**: `docs/intent/intent-subtitle-navigation-control.md`
> **Reviewer**: spec-reviewer skill (subagent)
> **Review type**: Initial BLOCKED → patched → re-review APPROVED

## Status

**APPROVED** (after patch — initial review was BLOCKED)

## Re-Review Checklist Results (Opus 4.8)

| Section | Pass | Fail | NA | Items |
|---------|------|------|-----|-------|
| Feasibility (Tech Lead) | 4/4 | 0/4 | 0/4 | F1-F4 |
| Testability (QA) | 3/3 | 0/3 | 0/3 | T1-T3 |
| Scope (Product) | 3/3 | 0/3 | 0/3 | S1-S3 |
| **Total** | 10/10 | 0/10 | 0/10 | |

## Previous Risk Resolution

| # | Prev Severity | Section | Status | Evidence |
|---|--------------|---------|--------|----------|
| 1 | HIGH | F1 | RESOLVED | Dependencies & Fallbacks table — 7 deps with owner/available/fallback |
| 2 | HIGH | F4 | RESOLVED | Rollback & Migration Failure Strategy — atomic, no-retry, clamp, forward-compat |
| 3 | CRITICAL | T1 | RESOLVED | Acceptance A1-A15 table with Precondition/Steps/Expected/Verify/Selector; F/NF mapped |
| 4 | HIGH | T2 | RESOLVED | Edge Cases — 8 subsections, each ≥2 cases |
| 5 | HIGH | T3 | RESOLVED | Error States & Recovery — 9 scenarios |
| 6 | HIGH | S1 | RESOLVED | Objective problem-first + Proposed Solution separate |
| 7 | MEDIUM | Feasibility | RESOLVED | cue fields start/end (0 startMs/endMs remaining) |
| 8 | MEDIUM | Feasibility | RESOLVED | Keyboard State Machine + fixed parallel shortcuts (ShortcutAction not expanded) |
| 9 | MEDIUM | Feasibility | RESOLVED | Cue Source Decision — target primary, native fallback, not merged bilingual |

**All 9 previous risks: RESOLVED.**

## Remaining Risk (LOW, non-blocking)

| # | Severity | Section | Question | Suggested Fix |
|---|----------|---------|----------|---------------|
| 1 | LOW | Settings Schema vs prose | Naming: `NavClusterSettings.enabled` (interface) vs `navClusterEnabled` (prose F11/A9/Rollback/Data Flow). | Align naming at G2 Plan — pick flat `navClusterEnabled` or nested `navCluster.enabled`. |

## Decision

- [x] **APPROVED** — proceed to G2 Plan

---

## Initial Review (BLOCKED — superseded by re-review above)

> Kept for audit trail. The initial review flagged 1 CRITICAL + 5 HIGH + 3 MEDIUM risks, all resolved in patch commit `0e40020`.

### Initial Checklist Results (Kimi 2.7)

| Section | Pass | Fail | NA | Items |
|---------|------|------|-----|-------|
| Feasibility (Tech Lead) | 2/4 | 2/4 | 0/4 | F1-F4 |
| Testability (QA) | 0/3 | 3/3 | 0/3 | T1-T3 |
| Scope (Product) | 2/3 | 1/3 | 0/3 | S1-S3 |
| **Total** | 4/10 | 6/10 | 0/10 | |

### Initial Risks (all RESOLVED in patch)

| # | Severity | Section | Question | Suggested Fix |
|---|----------|---------|----------|---------------|
| 1 | HIGH | F1 | Runtime/verification dependencies lack owner + timeline + fallback. | Add Dependencies & Fallbacks table. |
| 2 | HIGH | F4 | Stateful settings/schema changes have no rollback or migration failure behavior. | Add rollback section. |
| 3 | CRITICAL | T1 | Acceptance criteria lack concrete verify methods. | Convert to verification table with selectors. |
| 4 | HIGH | T2 | Edge cases are not documented at ≥2 per feature/story. | Add Edge Cases subsection per feature. |
| 5 | HIGH | T3 | Error states are undefined. | Add Error States & Recovery section. |
| 6 | HIGH | S1 | Objective/problem statement is solution-first. | Rewrite Objective problem-first + Proposed Solution. |
| 7 | MEDIUM | Feasibility | Spec uses cue fields `startMs`/`endMs`, but current code uses `start`/`end`. | Replace with `start`/`end`. |
| 8 | MEDIUM | Feasibility | Keyboard hold-to-repeat and seek shortcuts underspecified. | Add Keyboard State Machine + schema decision. |
| 9 | MEDIUM | Feasibility | Prev/next cue source conflict with content controller. | Add Cue Source Decision. |

## Checklist Details

### Feasibility (Tech Lead)

| Item | Question | Status | Severity | Note |
|------|----------|--------|----------|------|
| F1 | Dependencies have owner + timeline + fallback? | FAIL | HIGH | Spec relies on native Pointer Events, `findCurrentLine`, `chrome.storage`, Edge MCP, host pages, and fullscreen behavior, but does not document owner + availability + fallback. |
| F2 | Architecture considerations section exists? | PASS | MEDIUM | Spec has Project Structure, Data Flow, Settings Schema, and references ADR-013/ADR-015. Architecture map confirms current FSD target and subtitle controller location. |
| F3 | Technical constraints reviewed? | PASS | HIGH | Spec lists MV3, vanilla DOM content-script, TS/Vite/Jest constraints, no new dependency, browser verify, schema migration, touch target, performance, and ARIA constraints. |
| F4 | Rollback strategy for stateful changes? | FAIL | HIGH | Spec changes persistent settings and schema version v1→v2 but only defines forward migration, not rollback/failure behavior if migration/save fails. |

### Testability (QA)

| Item | Question | Status | Severity | Note |
|------|----------|--------|----------|------|
| T1 | Every acceptance criterion has concrete verify method? | FAIL | CRITICAL | Strict fail: F1-F15 and NF1-NF9 do not have per-criterion verify methods. A1-A15 are labeled browser verify but lack explicit steps, selectors/probes, expected values, and automation/manual method per item. |
| T2 | Edge cases ≥2 per user story? | FAIL | HIGH | Spec includes some edge-like behavior, but lacks ≥2 edge cases per feature/story. Missing: first/last cue, cue gaps, seek clamp, storage failure, pointer cancel/lost capture, fullscreen unavailable, collapsed restore after resize. |
| T3 | Error states defined? | FAIL | HIGH | Spec does not define error behavior for storage load/save/migration failure, invalid settings, cue mismatch, unknown duration, fullscreen detection failure, unavailable host pages/Edge MCP, or pointer capture loss. |

### Scope (Product)

| Item | Question | Status | Severity | Note |
|------|----------|--------|----------|------|
| S1 | Problem statement doesn't mention solution? | FAIL | HIGH | Objective is solution-first (“Build a floating control cluster…”). Intent has cleaner problem-first language. |
| S2 | Out-of-scope ≥3 tempting extensions? | PASS | HIGH | Out of Scope lists 8 tempting extensions/rejections: CC1/CC2, A-B tap, two layouts, click-count, long-press prev/next seek, auto-hide, no-sub A-B repeat, dragging outside video bounds. |
| S3 | Success metrics are measurable? | PASS | CRITICAL | Success bullets are mostly concrete and verifiable: button count/layout, reset coordinates, collapse threshold, hold duration, seek seconds, persistence, shortcuts, unit/browser verify. |

## Risks

| # | Severity | Section | Question | Suggested Fix |
|---|----------|---------|----------|---------------|
| 1 | HIGH | F1 | Runtime/verification dependencies lack owner + timeline + fallback. | Add a “Dependencies & Fallbacks” table covering `findCurrentLine`, Pointer Events, `chrome.storage.local`, Edge MCP, lordflix/kisskh test pages, fullscreen container detection, settings UI owner. |
| 2 | HIGH | F4 | Stateful settings/schema changes have no rollback or migration failure behavior. | Add rollback section: if v2 migration fails, preserve raw v1 settings, merge nav defaults at runtime, warn non-blocking, never persist partial v2. |
| 3 | CRITICAL | T1 | Acceptance criteria lack concrete verify methods. | Convert/augment criteria with `ID`, `Precondition`, `Steps`, `Expected`, `Verify method`, `Selector/Probe`; map F/NF to A rows. |
| 4 | HIGH | T2 | Edge cases are not documented at ≥2 per feature/story. | Add “Edge Cases” subsection per feature: layout/no-sub, drag/collapse, prev/next, repeat, seek, settings/persistence, shortcuts, fullscreen. |
| 5 | HIGH | T3 | Error states are undefined. | Add “Error States & Recovery” for storage/migration, invalid settings, missing cues, `findCurrentLine = -1`, unknown duration, fullscreen unavailable, pointercancel/lost capture, host shortcut capture, browser verify unavailable. |
| 6 | HIGH | S1 | Objective/problem statement is solution-first. | Rewrite Objective into problem-first language and move chosen implementation to “Proposed Solution”. |
| 7 | MEDIUM | Feasibility | Spec uses cue fields `startMs`/`endMs`, but current code uses `start`/`end`. | Replace `cues[index].startMs/1000` with `cues[index].start / 1000`, and `cue.endMs` with `cue.end`. |
| 8 | MEDIUM | Feasibility | Keyboard hold-to-repeat and seek shortcuts are underspecified relative to existing shortcut infrastructure. | Specify keydown+keyup state machine and whether `KeyboardShortcut`/`ShortcutAction` schema expands. Current action union lacks seek and repeat-hold actions. |
| 9 | MEDIUM | Feasibility | Prev/next implementation semantics conflict with current content controller behavior. | Decide whether cluster operates on target cues, native cues, or merged bilingual cues. Existing controller shortcuts use `bilingualCues`, while spec says `findCurrentLine(cues)` index ±1. |

## Open Questions

1. **CRITICAL / T1**: Which criteria set is authoritative for G2/G4 verification: Functional F1-F15 + NF1-NF9, Acceptance A1-A15, or a consolidated table?
2. For prev/next/repeat, should the cluster operate on target cues only, native cues only, or merged bilingual cues?
3. Should `SrtCue` field names in the spec be corrected to `start`/`end`, or is there a planned entity change to introduce `startMs`/`endMs`?
4. If settings migration v1→v2 fails or `chrome.storage` is unavailable, should the cluster be disabled, shown with defaults without persistence, or hidden with a user-visible error?
5. Are ArrowLeft/ArrowRight intended to replace existing a/d subtitle shortcuts, be additional fixed shortcuts, or become configurable in the existing `keyboardShortcuts` settings model?
6. What is the required fallback if lordflix/kisskh or Edge MCP is unavailable during G5 browser verification?

## Suggested Spec Updates

1. **Rewrite `## Objective`**: use problem-first wording from intent, then add a separate `## Proposed Solution` section for the floating cluster.
2. **Add `## Dependencies & Fallbacks`** after Tech Stack with owner/available/fallback for `findCurrentLine`, Pointer Events, `chrome.storage.local`, Edge MCP, host pages, fullscreen container, settings UI.
3. **Add `## Rollback & Migration Failure Strategy`** after Settings Schema: atomic caller perspective, preserve v1 raw settings, merge defaults at runtime on failure, validate/clamp nav fields, never persist partial v2.
4. **Replace cue field names**: `startMs`/`endMs` → `start`/`end` everywhere.
5. **Convert Acceptance to concrete verification table** with columns `ID | Precondition | Steps | Expected | Verify method | Selector/Probe`.
6. **Map Functional/NF to acceptance verifies**: append “Verify: see A#” or unit/browser method for each F/NF item.
7. **Add `## Edge Cases`** with at least two cases per feature/story.
8. **Add `## Error States & Recovery`** covering storage, migration, invalid settings, missing cues/gaps, seek bounds, pointer capture, fullscreen, host shortcut capture, verification fallback.
9. **Add `## Keyboard State Machine`** for pointer/keyboard repeat hold: keydown start, ignore repeat keydown, keyup release, blur/visibilitychange cancel, editable target guard, configurable/fixed shortcut decision.
10. **Add `## Cue Source Decision`**: target/native/merged bilingual cue source for prev/next/repeat and gap handling.

## Files Reviewed

- `docs/intent/intent-subtitle-navigation-control.md`
- `docs/specs/spec-subtitle-navigation-control.md`
- `docs/2-architechture-system.md`
- `src/features/subtitle/ui/subtitleOverlay.ts`
- `src/features/subtitle/logic/subtitleSync.ts`
- `src/features/subtitle/ui/subtitleShortcuts.ts`
- `src/features/subtitle/ui/subtitlePanel.ts`
- `src/entities/settings/types.ts`
- `src/shared/lib/storage/settingsStore.ts`
- `src/shared/config/config.ts`
- `src/features/subtitle/ui/contentScriptController.ts`

## Decision

- [ ] **APPROVED** — proceed to G2 Plan
- [ ] **APPROVED_WITH_CONDITIONS** — answer open questions, then proceed to G2
- [x] **BLOCKED** — fix CRITICAL risks, re-run spec-reviewer
