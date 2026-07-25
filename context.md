# Cell Technical Debt Cleanup — Context Memory

## Session 2026-01-26 (previous)
Status: COMPLETED
Summary: Completed full DISCOVER -> PLAN -> DO -> VERIFY -> LEARNING -> REFINE loop. Committed f049cb5.

### Completed Tasks
- P0 real bugs: removed broken import in webTokenizeController, fixed setStorage arity in createOrbitalBadge, coerced isHandle to boolean in popupShell.
- P1 tests: updated schemaVersion expectations 17->18 in 5 test files, fixed TtsVoiceManagerPanel async error handling to prevent test crashes.
- P2 lint: removed unused vars/imports, let->const, empty interface -> type alias, regex escape, non-null assertion fixes.
- P2a eslint config: added ignores for assets, prototype, seed, extension-phu-tro, and MAIN-world IIFE override with browser globals.
- P3 types: fixed DictionaryPopupSettings -> Record cast via unknown.
- P4 housekeeping: added prototype/seed to .gitignore, removed stale technical-debt-audit.md ref from docs/0-wiki.md.
- REFINE: fixed SettingsDialog.tsx exhaustive-deps warning.
- LEARNING: added 3 experience atoms, fixed async-debounce JSON syntax and added caret-point to index; validate.cjs passes.

### Quality Gates (all pass)
- npx tsc --noEmit: exit 0
- npm run lint: exit 0, 6 remaining any warnings in tests/integration/subtitleManagerPanel.integration.test.ts
- npx jest --selectProjects unit: exit 0, 237 suites pass, 3615 tests pass
- npm run build: exit 0, dist/manifest.json produced

### Backlog carried forward
- 6 warnings any in tests/integration/subtitleManagerPanel.integration.test.ts
- console.log debug statements in webTokenizeController.ts hot paths (onEnter, bindVisibleBlock)
- webTextDictionaryController.ts receives getNativeCues but no longer uses it (optional dep ignored)
- src/features/dictionaryPopup/badgePointer/gestureDetector.test.ts and gestureDetector.ts are modified branch work (not committed, not debt)

## Session 2026-01-26 (current)
Status: IN PROGRESS — DISCOVER
Summary: Starting new loop per user request. Will re-scan codebase for remaining/new technical debt and update this file continuously.

### Active Tasks
- DISCOVER: scan codebase for TODO/FIXME, typecheck, lint, test, build, stale docs, unused code, debug logs

### Discover Findings
- All quality gates pass: typecheck exit 0, lint exit 0 (6 any warnings), unit tests 237 suites pass, build exit 0.
- Grep markers: src/shared/icons/Icon.tsx and src/shared/ui/Spinner.tsx have FIXME comments, but these are intentional conventions/placeholders, not actionable.
- src/features/dictionaryPopup/ui/popupShell.test.ts:503 uses eslint-disable no-explicit-any for navigator mock.
- tests/integration/subtitleManagerPanel.integration.test.ts has 6 any warnings for global.chrome mock.
- webTextDictionaryController.ts defines getNativeCues in WebTextDictionaryVideoConfig and Deps interfaces but never reads it; contentScriptController.ts still passes it at line 704, creating dead wiring.
- Untracked files/dirs not in .gitignore: .agents/skills/animation-vocabulary, apple-design, emil-design-eng, find-animation-opportunities, improve-animations, pick-ui-library, review-animations; docs/specs/ui-ux-system-wide-redesign.md; docs/0-wiki.md and skills-lock.json were modified to reference these. These are pending human review (spec says Draft pending human review before implementation) and should NOT be implemented/committed as debt cleanup.

### Plan
- Slice 1 (P4): remove dead getNativeCues wiring from webTextDictionaryController.ts and contentScriptController.ts.
- Slice 2 (P2): replace any with typed mock in popupShell.test.ts:503.
- Slice 3 (P4): commit context.md memory file at end of session.
- Backlog for next loop: integration test any warnings, console.log debug in webTokenizeController.ts, decide fate of untracked skill dirs/spec.

### Completed Tasks (this session)
- Slice 1: removed dead getNativeCues from WebTextDictionaryDeps, WebTextDictionaryVideoConfig, and contentScriptController configureVideo call.
- Slice 2: replaced any with typed navigator.keyboard mock in popupShell.test.ts, removed eslint-disable.
- VERIFY: typecheck pass, lint pass (0 errors, 6 any warnings remain in tests/integration/subtitleManagerPanel.integration.test.ts), test:unit pass (237 suites, 3618 tests), build pass (dist/manifest.json produced).
- Slice 3: committed context.md + code fixes as a0d1490.

### Status
Session COMPLETED.

### New Discoveries Requiring User Decision (not debt)
- A large batch of files were modified/added during or before this session that appear to implement docs/specs/ui-ux-system-wide-redesign.md (tokens.json, tokens.css, many *.module.css, icon-gallery.html, docs/0-wiki.md, skills-lock.json, plus untracked .agents/skills/* design/animation skills and the spec file itself).
- The spec explicitly states Status: Draft pending human review before implementation. These changes are NOT committed. They look like feature work or auto-generated redesign output, not technical debt.

### Backlog for Next Loop
- 6 any warnings in tests/integration/subtitleManagerPanel.integration.test.ts
- console.log / console.warn debug noise in webTokenizeController.ts, downloader.ts, parallelCoordinator.ts, subtitleAutoLoad.ts, youtubeInnertube.ts, etc.

### Active Tasks
- None

## Session 2026-01-26 (next)
Status: COMPLETED
Summary: User confirmed redesign batch is a separate task and grants full decision authority; ignore it and continue debt loop.

### Completed Tasks (this session)
- Re-typed global.chrome mock in tests/integration/subtitleManagerPanel.integration.test.ts to remove 6 any warnings; corrected mock shape (onChanged at storage level, not local level) after test failure.
- Lint: pass, 0 errors, 0 warnings.
- Integration tests: pass (6 suites, 22 tests).
- Unit tests: pass (237 suites, 3618 tests).
- Build: pass (dist/manifest.json produced).
- Commit: 0a50d32 Clear technical debt: type integration-test chrome mock.

### Backlog for Next Loop
- console.log / console.warn debug noise in production code
- revisit any remaining lint/type/test issues after current slice

## Session 2026-01-26 (autonomous)
Status: IN PROGRESS
Summary: User directed agent to stop asking and run loop autonomously. Focus expanded to safety, speed, maintainability, extensibility, and UI/system bottlenecks/blockers.

### Discover Findings
- console.log debug noise found in content-script entrypoints and offscreen runner (diagnostic messages on every page load/subtitle detection/conversion step).
- 95 setTimeout/setInterval usages across src; some may leak if not cleared on detach/unmount (to be audited later).
- Several files >1000 lines (contentScriptController.ts 1810, popupDictionaryController.ts 1491, downloader.ts 1233, popupShell.ts 1162, subtitleBlockCss.ts 1104) — maintainability risk but large refactor.
- 158 `.catch(` instances in src; unhandled promise risk requires per-case audit.

### Plan
- Slice 1 (performance + maintainability): remove production console.log debug statements from content-script.ts, youtube-main-world.iife.ts, netflix-main-world.iife.ts, iqiyi-main-world.iife.ts, offscreen/ffmpegRunner.ts. Keep console.warn/error for real failures.
- Slice 2 (safety): audit setTimeout/setInterval cleanup in high-usage controllers.

### Completed Tasks (this session)
- Slice 1: removed production console.log from iqiyi-main-world.iife.ts and offscreen/ffmpegRunner.ts. Content-script.ts, youtube-main-world.iife.ts, and netflix-main-world.iife.ts were already clean in commit 6250037.
- Quality gates: typecheck pass, lint pass, build pass.
- Commit: 1103a9c refactor: remove production console.log debug from iqiyi + offscreen runner.
- Slice 2: removed production console.log from youtubeInnertube.ts, webTokenizeController.ts, autoEnablement.ts, parallelFallback.ts, parallelCoordinator.ts, parallelCancellation.ts, parallelTransmuxer.ts, tsTransmuxer.ts.
- Quality gates: typecheck pass, lint pass, unit tests pass (237 suites), build pass.

### Active Tasks
- Slice 3: remove production console.log from downloader.ts (15 logs) and conversionTimer.ts (logSummary method/test cleanup)
