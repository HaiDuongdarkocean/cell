# Spec Review: Refactor System Architecture — Worktree cho Orca Platform

> **Model**: Claude Opus 4.8 (spec-reviewer subagent)
> **Date**: 2026-06-30
> **Spec**: `docs/specs/spec-refactor-system-architecture.md`
> **Intent**: `docs/intent/intent-refactor-system-architecture.md`
> **Reviewer**: spec-reviewer skill (subagent) — 3 perspectives (Tech Lead / QA / Product), refactor lens
> **Codebase verification**: performed against `src/`, `tests/`, `public/manifest.json`, `vite.config.ts` (re-verified by main agent)

## Status

**APPROVED_WITH_CONDITIONS**

Not BLOCKED: every source file the spec claims to *move* actually exists at the stated path. The conditions are (a) one CRITICAL completeness gap — a manifest-referenced entrypoint that the spec never accounts for, (b) inaccurate file counts that mis-size milestones, and (c) confirmation of the 5 deferred Open Questions. None require a rewrite; all are bounded edits.

## Checklist Results

| Section | Pass | Fail | NA | Items |
|---------|------|------|-----|-------|
| Feasibility (Tech Lead) | 4/4 | 0/4 | 0/4 | F1-F4 |
| Testability (QA) | 3/3 | 0/3 | 0/3 | T1-T3 |
| Scope (Product) | 2/3 | 1/3 | 0/3 | S1-S3 |
| **Total** | **9/10** | **1/10** | **0/10** | |

## Checklist Details

### Feasibility (Tech Lead)

| Item | Question | Status | Severity | Note |
|------|----------|--------|----------|------|
| F1 | Dependencies have owner + timeline + fallback? | **PASS** | HIGH | All deps installed (React 19, Zustand 5, Vite 8, crxjs, mux.js 6, Jest 30, Playwright). No new deps. Build framework fallback explicit (keep crxjs, no WXT). |
| F2 | Architecture considerations section exists? | **PASS** | MEDIUM | Target Structure tree + Dependency Rules + move/wrap/create lists + planned ADR-016. Exceeds bar. |
| F3 | Technical constraints reviewed? | **PASS** | HIGH | MV3 surfaces, crxjs build, Windows/PowerShell, no-new-dep, manifest + vite input constraints listed. |
| F4 | Rollback strategy for stateful changes? | **PASS** | HIGH | Per-cluster commit + git revert. chrome.storage.session restore key addressed in Edge Case 10. |

### Testability (QA — refactor lens = can we prove behavior preserved?)

| Item | Question | Status | Severity | Note |
|------|----------|--------|----------|------|
| T1 | Every acceptance criterion has concrete verify method? | **PASS** | CRITICAL | F1-F6 / NF1-NF6 / P1-P3 each carry concrete method. But sufficiency of existing suite asserted, not measured → Risk #1. |
| T2 | Edge cases ≥2 per section? | **PASS** | HIGH | 10 documented edge cases. Well above bar. |
| T3 | Error states defined? | **PASS** | HIGH | Risks + Mitigation table + edge-case mitigations cover build break, circular dep, drift, adapter bug, runtime-only bugs. |

### Scope (Product)

| Item | Question | Status | Severity | Note |
|------|----------|--------|----------|------|
| S1 | Problem statement doesn't mention solution? | **FAIL** | HIGH | Objective leads with chosen solution (FSD + Screaming Architecture) not the problem. Mitigated: FSD is user-confirmed input (Q2:A). Still fails the test → Risk entry. |
| S2 | Out-of-scope ≥3 tempting extensions? | **PASS** | HIGH | 11 items, several genuinely tempting (wrap all chrome.*, split Zustand now, app/ layer, eslint-plugin-boundaries, WXT, Orca features). Excellent. |
| S3 | Success metrics measurable? | **PASS** | CRITICAL | F1-F6 binary/measurable; NF1/NF3 grep-verified; NF2 "≤3 steps" concrete; P1-P3 measurable. |

## Risks

| # | Severity | Section | Question | Suggested Fix |
|---|----------|---------|----------|---------------|
| 1 | **HIGH** | T1 / Testing Strategy | "No behavior change" rests on existing suite + characterization tests, but no coverage baseline or gap analysis. With 99 source / 85 test files moving, which behaviors are untested and unprotected during the move? | Add pre-flight (Milestone 0): run `npm run test:coverage`, record per-cluster coverage for subtitle (M7) + transmux (M6), list behaviors needing characterization tests before those moves. Make "characterization gap closed" a milestone exit gate. |
| 2 | **CRITICAL** | Project Structure / Milestone 9 | `public/manifest.json` declares a second content-script entry `src/content/fetchInterceptor.iife.ts` (MAIN world, `run_at: document_start`) — not mentioned anywhere in spec. `src/content/themeTokens.ts` also unaccounted. Missing a manifest entrypoint breaks build/runtime. | Add `fetchInterceptor.iife.ts` + `themeTokens.ts` to Milestone 9 with target paths; update manifest `content_scripts[1].js` in same commit. Verify `npm run build` + browser load. |
| 3 | **HIGH** | Project Structure (M2 vs M6) | `assToSrt.ts`, `vttToSrt.ts`, `srtNormalizer.ts` live in `src/lib/converters/` but Target Structure places them under `shared/lib/parsers/`. No milestone moves them — M2 moves `src/lib/parsers/` (excludes them), M6 transmux enumerates files and excludes them. Fall through cracks. | Add these 3 files to Milestone 2 move list explicitly. Make move list file-complete (`Get-ChildItem -Recurse src` diff against move list = 0 unaccounted). |
| 4 | **MEDIUM** | Objective / Why now / Scope table | File-count claims wrong: actual `subtitle*.ts` = 17 (spec ~20); `parallel*.ts` = 8, full transmux cluster = 16 (spec "~15 parallel*"); total src ≈ 99 (spec ~75). Mis-sizes milestones. | Correct counts (subtitle 17, transmux ~16 of which 8 parallel*, src ~99). Re-label M6 "move ~16", M7 "move 17". |
| 5 | **MEDIUM** | Scope table header | Three domain counts: Objective "~15", header "17 UC groups", table numbered 1-23. Ambiguous. | Reconcile: "23 feature domains across 17 UC groups". Update Objective + header. |
| 6 | **MEDIUM** | Migration Strategy (M9) | Build verified "after each milestone" but M9 = 2-3 commits moving 5 entrypoint groups + rewriting manifest + vite config. Intermediate commits may leave system unbuildable. | Within M9: each entrypoint move + its manifest/vite path update = single commit; `npm run build` passes per commit (not just per milestone). |
| 7 | **MEDIUM** | Subtitle target mapping (M7) | `features/subtitle/` tree maps ~13 modules but cluster has 17. `subtitleManagerPanel.ts`, `subtitleNaming.ts`, `subtitleToast.ts` (and `subtitleUI.ts` → `overlayLayer.ts`) not explicitly placed. | Add explicit target paths for all 17 subtitle files. |
| 8 | **LOW/MEDIUM** | Edge Cases | Edge Case 1 cites `src/popup/main.tsx` as manifest entry; manifest references `src/popup/index.html`. Vite edge case mentions only offscreen input but vite.config also has `sidepanel` entry. | Correct manifest ref to `index.html`; add `sidepanel` to vite-input update note. |

## Open Questions

1. **(Risk #2 — CRITICAL)** `src/content/fetchInterceptor.iife.ts` is a MAIN-world content-script entry in manifest but absent from spec. Where does it move (likely `src/entrypoints/content/`), and will its manifest path update be in the same Milestone 9 commit? Must answer before G2.
2. **(Risk #1)** Current test coverage for subtitle + transmux clusters? Do you accept adding a coverage-baseline + characterization-gap step before M6/M7?
3. The 5 spec Open Questions (chrome.* wrap scope, Zustand slice, app/ layer, ESLint enforcement, entities/ vs features/types) default to YAGNI "lean" answers, gate only M11/deferred — not core moves M1-M10. Confirm "yes to all 5 defaults" to unblock G2? (Assessment: safely deferrable.)
4. Should the 3 stray converter files (`assToSrt`, `vttToSrt`, `srtNormalizer`) move in Milestone 2 (shared/parsers) per the target tree? (Risk #3.)

## Suggested Spec Updates

1. **Project Structure + Milestone 9**: add `fetchInterceptor.iife.ts` → `src/entrypoints/content/` and `themeTokens.ts` → target; note `content_scripts[1].js` manifest update in same commit. (Closes Risk #2.)
2. **Migration Strategy M2**: explicitly list `assToSrt.ts`, `vttToSrt.ts`, `srtNormalizer.ts` moving to `shared/lib/parsers/`. (Closes Risk #3.)
3. **Testing Strategy / new Milestone 0**: add coverage baseline + characterization tests for uncovered behavior before M6/M7 as exit gate. (Closes Risk #1.)
4. **Objective / Why now / Scope header**: correct counts (subtitle 17, transmux ~16, src ~99); reconcile "15/17/23 domains". (Closes Risks #4, #5.)
5. **Objective**: re-frame opening around problem (navigability / Big-Ball-of-Mud / future flat-folder explosion); move FSD adoption into "Chosen approach (confirmed Q2:A)" clause. (Addresses S1 FAIL.)
6. **Milestone 9**: "one entrypoint group + its manifest/vite path update per commit; `npm run build` passes per commit." (Closes Risk #6.)
7. **`features/subtitle/` target tree**: add explicit target paths for `subtitleManagerPanel`, `subtitleNaming`, `subtitleToast`; confirm `subtitleUI` → `overlayLayer`. (Closes Risk #7.)
8. **Edge Case 1 / 2**: fix `src/popup/main.tsx` → `src/popup/index.html`; add `sidepanel` to vite-input note. (Closes Risk #8.)

## Verification summary (codebase facts established — re-verified by main agent)

- **All spec-referenced source files exist** → no BLOCKED-on-nonexistent-files. Verified `src/content/subtitle*.ts`, `src/lib/converters/{parallel*,segment*,...}.ts`, `src/background/*`, `src/lib/{detectors,parsers,selectors,storage,utils}/`, `src/types/`, `src/constants/`.
- **Counts (actual)**: `subtitle*.ts` = **17**; `parallel*.ts` = **8** (full transmux cluster = ~16); total src ≈ **99**; test files = **85**.
- **`public/manifest.json`** entry paths that WILL move: `src/background/index.ts`, `src/content/content-script.ts`, **`src/content/fetchInterceptor.iife.ts`** (unaccounted), `src/sidepanel/index.html`, `src/popup/index.html`. (Manifest at `public/manifest.json`, not repo root.)
- **`vite.config.ts`** `rollupOptions.input` references `src/offscreen/ffmpeg.html` **and** `src/sidepanel/index.html` — both need M9 update.
- **Unaccounted files** (exist but no milestone moves): `src/content/fetchInterceptor.iife.ts`, `src/content/themeTokens.ts`, `src/lib/converters/{assToSrt,vttToSrt,srtNormalizer}.ts`.

## Decision

- [x] **APPROVED** — proceed to G2 Plan (conditions cleared 2026-06-30: anh confirm Q1-Q4, 8 suggested edits applied to spec)
- [ ] **APPROVED_WITH_CONDITIONS** — answer open questions, then proceed to G2
- [ ] **BLOCKED** — fix CRITICAL risks, re-run spec-reviewer

## Post-review update (2026-06-30)

All 4 open questions answered (anh confirm "đồng ý"):
- Q1 (CRITICAL fetchInterceptor): move → `src/entrypoints/content/fetchInterceptor.iife.ts`, manifest update in M9.2.
- Q2 (HIGH coverage baseline): Milestone 0 added — `npm run test:coverage` + characterization gap close before M6/M7.
- Q3 (5 spec Open Questions): all 5 YAGNI defaults approved.
- Q4 (HIGH stray converters): move in M2 → `shared/lib/parsers/`.

All 8 suggested spec edits applied:
1. fetchInterceptor.iife.ts + themeTokens.ts added to entrypoints/content/ + M9.2.
2. assToSrt/vttToSrt/srtNormalizer added to M2 move list.
3. Milestone 0 (coverage baseline + characterization gap) added.
4. Counts corrected (subtitle 17, transmux ~16, src ~99, 23 domains / 17 UC groups).
5. Objective reframed around problem (Big-Ball-of-Mud + future flat-folder explosion), FSD moved to "Chosen approach".
6. M9 split into 5 sub-commits, `npm run build` per sub-commit.
7. subtitle target tree: 17 files explicitly mapped (managerPanel, naming, toast added; subtitleUI → overlayLayer confirmed).
8. Edge Case 1/2 fixed (popup/index.html not main.tsx; vite input includes sidepanel).

Spec status: **APPROVED → ready for G2 Plan**.
