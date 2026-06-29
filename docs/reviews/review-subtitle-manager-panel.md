# Spec Review: Subtitle Manager Panel

> **Model**: subagent (default)
> **Date**: 2026-06-29
> **Spec**: `docs/specs/spec-subtitle-manager-panel.md`
> **Intent**: `docs/intent/idea-subtitle-manager-panel.md`
> **Reviewer**: spec-reviewer skill (subagent)

## Status

**APPROVED_WITH_CONDITIONS**

3 checklists mostly pass, but 3 HIGH risks found (detectLanguage label-vs-ISO mismatch, non-existent `isoToLanguageName` function, inaccurate bug #5 claim). Open questions must be answered + spec code samples corrected before G2 Plan.

## Checklist Results

| Section | Pass | Fail | NA | Items |
|---------|------|------|-----|-------|
| Feasibility (Tech Lead) | 3/4 | 1/4 | 0/4 | F1-F4 |
| Testability (QA) | 3/3 | 0/3 | 0/3 | T1-T3 |
| Scope (Product) | 3/3 | 0/3 | 0/3 | S1-S3 |
| **Total** | 9/10 | 1/10 | 0/10 | |

## Checklist Details

### Feasibility (Tech Lead)

| Item | Question | Status | Severity | Note |
|------|----------|--------|----------|------|
| F1 | Dependencies have owner + timeline + fallback? | FAIL | HIGH | `detectLanguage` exists (`src/lib/detectors/languageDetector.ts:612`) + fallback defined ("neither → assign target"). BUT `isoToLanguageName` referenced in `formatSubtitleName` (spec line 110) does NOT exist in codebase — actual function is `isoCodeToLabel` (`languageDetector.ts:480`). Code sample won't compile. Also `detectLanguage` returns a lowercase **label** ("english"), not ISO code — see Risk #1. |
| F2 | Architecture considerations section exists? | PASS | MEDIUM | "Project Structure" section (spec lines 60-92) lists all files + dependencies + data flow. References ADR-014. Architecture map (`docs/2-architechture-system.md`) cross-checked — all listed source files exist. |
| F3 | Technical constraints reviewed? | PASS | HIGH | "Tech Stack" (lines 42-48): Chrome Extension MV3, React 19, Zustand 5, TS 6, Vite 8, vanilla DOM content-script, theme.css tokens. "Boundaries" (lines 152-156): no hardcode color, aria-label, browser-verify stop-the-line. Constraints clear. |
| F4 | Rollback strategy for stateful changes? | PASS | HIGH | Spec explicitly chooses "reload ghi đè imported sub (ponytail — no persistence, no rollback needed)" (assumption #6, line 33; out-of-scope line 187). `subtitlePreference` already exists (`src/types/media.ts:380`) — no new storage key, no migration. No stateful rollback needed. |

### Testability (QA)

| Item | Question | Status | Severity | Note |
|------|----------|--------|----------|------|
| T1 | Every acceptance criterion has concrete verify method? | PASS | CRITICAL | Success Criteria table (lines 160-176): all 15 criteria (C1-C15) have "Verify" column with specific method — Browser MCP inspect/snapshot/click, or Unit test with named function. No "manual testing" vague entries. |
| T2 | Edge cases ≥2 per user story? | PASS | HIGH | Multi-file import has 6 cases (spec line 145, C7-C8): 1 target, 1 native, 1 neither, 2 target+native, 2 same lang, 2+ files. Naming edge cases: >20 chars truncate, extension strip. Bug #5 edge: chọn #2 → push → still #2. |
| T3 | Error states defined? | PASS | HIGH | detect lang = neither → fallback target + toast (assumption #5, line 32). Fetch/parse fail → toast "Auto-load target failed" (existing `subtitleAutoLoad.ts:218-223`). File empty → detectLanguage returns null (line 616). Parse fail → ParseResult success:false. Error paths covered. |

### Scope (Product)

| Item | Question | Status | Severity | Note |
|------|----------|--------|----------|------|
| S1 | Problem statement doesn't mention solution? | PASS | HIGH | Objective (lines 8-14) describes problem: "import flow tách rời dropdown", "active state không hiện", "auto-load push reset", "naming không convention". Solution (panel) introduced separately in assumptions. Problem-first. |
| S2 | Out-of-scope ≥3 tempting extensions? | PASS | HIGH | "Out of Scope" (lines 185-192): 6 items — save imported cues to storage, keyboard shortcut cycle, smart-merge timestamp, multi-tab sync, panel in Settings Dialog, hostname in naming. All tempting, all justified. |
| S3 | Success metrics are measurable? | PASS | CRITICAL | Success bullets (lines 17-24) + C1-C15 table all testable: "active chip visible", "import → appears in panel + set active + toast", "auto-load push → giữ activeIndex". No "improve"/"better" vague terms. |

## Risks

| # | Severity | Section | Question | Suggested Fix |
|---|----------|---------|----------|---------------|
| 1 | HIGH | Assumptions #5 + Code Style `assignImportRole` (line 120) | `detectLanguage` returns a lowercase **label** (e.g. `"english"`), NOT an ISO code (e.g. `"en"`) — verified at `languageDetector.ts:610,629,642,685`. But `assignImportRole` compares `f.detectedLang?.toLowerCase() === targetLang.toLowerCase()` where `targetLang` is an ISO code (e.g. `"en"`). `"english" === "en"` → always false → every file classified as "neither" → all imports fall to fallback (assign target). Multi-file auto-assign-by-language silently broken. | In `assignImportRole`, convert before comparing: either `labelToIsoCode(f.detectedLang) === targetLang` OR `f.detectedLang === isoCodeToLabel(targetLang)`. Add explicit conversion step in code sample. Update assumption #5 to note detectLanguage returns label, conversion required. |
| 2 | HIGH | Code Style `formatSubtitleName` (line 110) | `isoToLanguageName(language)` does NOT exist in codebase. Actual function is `isoCodeToLabel(code)` (`languageDetector.ts:480`, returns lowercase label or null). Code sample won't compile. | Replace `isoToLanguageName` → `isoCodeToLabel` in spec. Note it returns lowercase + may return null (need fallback). Alternatively define a new `isoToLanguageName` wrapper, but ponytail says reuse existing. |
| 3 | HIGH | Assumptions #7 + Code Style bug #5 fix (lines 34, 126-138) | Bug #5 claim is **inaccurate**. Current code at `content-script.ts:400-428` DOES destroy + re-create dropdown (true), but passes `activeTargetIndex` (preserved module-level `let` at line 145) to `createSubtitleDropdown` (line 414), NOT 0. The index is already preserved across re-renders. The "reset activeIndex=0" claim is false. The spec's fix introduces a `state` object that doesn't exist; current code already preserves index via closure variables. Real remaining issue: destroy+re-create causes visual flicker + stale index if matches array reorders. | Correct assumption #7: "destroy+re-create causes flicker; index already preserved via module-level vars but not resilient to matches-array reorder". Reframe fix as: avoid destroy+re-create (diff-render panel instead) OR clamp index to new matches length. Remove the `state.activeTargetIndex ?? 0` code sample (misrepresents current code). Verify with browser MCP whether reset-to-0 actually reproduces before claiming it. |
| 4 | MEDIUM | Intent line 95 vs Spec line 200 | Intent says `detectLanguage + labelToIsoCode: src/background/subtitleAutoLoad.ts` — this file is **MISSING**. Spec correctly references `src/lib/detectors/languageDetector.ts` (EXISTS). Intent has stale path. | Update intent line 95 to `src/lib/detectors/languageDetector.ts`. No spec change needed (spec already correct). |
| 5 | MEDIUM | Code Style `assignImportRole` (line 122) | `ignored = files.filter(f => f !== target && f !== native)` — if 2 files same lang, `files.find` returns the same object for both target and native queries only if targetLang === nativeLang (rare). But if 2 files both match targetLang, only first is `target`, second is NOT in `ignored` filter correctly (f !== target works, but f !== native where native is undefined → f !== undefined → true, so second file IS included in ignored). Logic OK but edge case C7 ("2 files cùng lang → assign cả 2 target") is NOT implemented by this code — it assigns only 1 to target, 1 to ignored. Spec C7 says "assign cả 2 target (hoặc native)". Mismatch. | Clarify C7: does "2 files same lang" mean both go to target section (2 entries) or 1 target + 1 ignored? Update `assignImportRole` to match. Add unit test case for this exact scenario. |
| 6 | MEDIUM | Testing Strategy + Project Structure | Spec lists test files in `tests/unit/` flat (e.g. `subtitleManagerPanel.test.ts`) but architecture map (`docs/2-architechture-system.md:175-187`) shows tests organized in subdirs (`tests/unit/content/`, `tests/unit/detectors/`). Path mismatch may cause confusion. | Align test paths with existing structure: `tests/unit/content/subtitleManagerPanel.test.ts`, etc. Or confirm flat placement is intentional. |

## Open Questions

1. **[R1] detectLanguage return type**: `detectLanguage` returns a label ("english"), not ISO code ("en"). Should `assignImportRole` convert via `labelToIsoCode` before comparing, or should targetLang/nativeLang be passed as labels? This must be resolved — the core multi-file import feature won't work as written.
2. **[R3] Bug #5 reproduction**: Does the "reset activeIndex=0" bug actually reproduce in browser? Current code (`content-script.ts:414`) passes preserved `activeTargetIndex`, not 0. Please browser-verify on themoviebox.org: choose #2 → wait for auto-load push → is active actually reset to #1? If not, bug #5 fix scope shrinks to "avoid flicker + handle matches reorder".
3. **[R5] C7 edge case**: "2 files cùng lang → assign cả 2 target (hoặc native)" — does this mean 2 entries in target section, or 1 target + 1 ignored? The `assignImportRole` code sample only assigns 1 per role.
4. **[Spec Q1-Q4]**: Section collapsed default, neither-lang fallback (target vs ask user), panel position (popover vs slide-in), active chip when no sub — all have recommendations but need confirmation before G2.

## Suggested Spec Updates

1. **[R1] Fix `assignImportRole` comparison** (Code Style, line 120): Replace `f.detectedLang?.toLowerCase() === targetLang.toLowerCase()` with `labelToIsoCode(f.detectedLang ?? '') === targetLang.toLowerCase()` (import `labelToIsoCode` from `languageDetector.ts`). Add comment: "detectLanguage returns label, convert to ISO before comparing".
2. **[R2] Fix `isoToLanguageName`** (Code Style, line 110): Replace `isoToLanguageName(language)` with `isoCodeToLabel(language)`. Add null-guard: `const langName = isoCodeToLabel(language) ?? language;` (fallback to raw code if unknown).
3. **[R3] Correct bug #5 description** (Assumption #7, line 34): Change to: "`onSubtitleMatches` destroy + re-create dropdown on each push. `activeTargetIndex`/`activeNativeIndex` are already preserved via module-level closure vars (`content-script.ts:145-146`), but destroy+re-create causes visual flicker and index may become stale if matches array reorders. Fix: diff-render panel (update list in-place) instead of destroy+re-create, + clamp preserved index to new matches length."
4. **[R4] Note intent path conflict** (Sources, after line 200): Add note: "Intent line 95 references `src/background/subtitleAutoLoad.ts` (stale — file does not exist). detectLanguage actually lives in `src/lib/detectors/languageDetector.ts`."
5. **[R5] Clarify C7** (Success Criteria, line 168): Specify whether "2 files cùng lang" → 2 entries in one section or 1 entry + 1 ignored. Update `assignImportRole` code to match.
6. **[R6] Align test paths** (Project Structure, lines 84-91): Move test files into `tests/unit/content/` subdir to match existing architecture, or explicitly note flat placement.
7. **Add `labelToIsoCode` to Project Structure** (line 74): `languageDetector.ts` comment should mention both `detectLanguage` + `labelToIsoCode` + `isoCodeToLabel` are reused (not just detectLanguage).

## Decision

- [ ] **APPROVED** — proceed to G2 Plan
- [x] **APPROVED_WITH_CONDITIONS** — answer open questions (especially R1 detectLanguage label-vs-ISO + R3 bug #5 reproduction), apply suggested spec updates to code samples, then proceed to G2
- [ ] **BLOCKED** — fix CRITICAL risks, re-run spec-reviewer
