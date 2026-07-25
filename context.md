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
- Decide fate of uncommitted redesign implementation and skill directories

### Active Tasks
- None
