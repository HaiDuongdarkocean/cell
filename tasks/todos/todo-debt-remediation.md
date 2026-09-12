# Debt Remediation Todo

## Phase 1: Quick Wins

- [x] Task 1: Fix Vite `__dirname` warning (all vite*.config.ts)
- [x] Task 2: Add `type="module"` cho `options.html`
- [x] Task 3: Remove `console.log` trong `phraseMatchBenchmark.test.ts`
- [x] Task 4: Viết test cho `mountSettingsDialog.ts` / `mountSettingsDialogLegacy.ts`

## Checkpoint 1

- [x] `npx tsc --noEmit` pass
- [x] `npm run lint` pass
- [x] `npm run build` warnings giảm
- [x] `npm run test:unit` pass, coverage không giảm
- [x] `pre-commit-gate` pass

## Phase 2: Subtitle Island

- [x] Task 5: Characterization tests `reactSubtitleController`
- [x] Task 6: Extract `StudyModeController` (`SubtitleStudyModeController` extracted; `reactSubtitleController.ts` còn 881 dòng, cần Task 6b để xuống < 800)
- [x] Task 6b: Tách manager/style state để `reactSubtitleController.ts` < 800 dòng
- [x] Task 7: Characterization tests `contentScriptController`
- [x] Task 8: Tách `subtitleSyncController`

## Phase 3: Build & Dependency

- [x] Task 9: Sửa `INEFFECTIVE_DYNAMIC_IMPORT`
- [x] Task 10: Upgrade dependencies
