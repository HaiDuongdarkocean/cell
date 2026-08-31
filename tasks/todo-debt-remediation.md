# Debt Remediation Todo

## Phase 1: Quick Wins

- [x] Task 1: Fix Vite `__dirname` warning (all vite*.config.ts)
- [ ] Task 2: Add `type="module"` cho `options.html`
- [ ] Task 3: Remove `console.log` trong `phraseMatchBenchmark.test.ts`
- [ ] Task 4: Viết test cho `mountSettingsDialog.ts` / `mountSettingsDialogLegacy.ts`

## Checkpoint 1

- [ ] `npx tsc --noEmit` pass
- [ ] `npm run lint` pass
- [ ] `npm run build` warnings giảm
- [ ] `npm run test:unit` pass, coverage không giảm
- [ ] `pre-commit-gate` pass

## Phase 2: Subtitle Island

- [ ] Task 5: Characterization tests `reactSubtitleController`
- [ ] Task 6: Extract `StudyModeController`
- [ ] Task 7: Characterization tests `contentScriptController`
- [ ] Task 8: Tách `subtitleSyncController`

## Phase 3: Build & Dependency

- [ ] Task 9: Sửa `INEFFECTIVE_DYNAMIC_IMPORT`
- [ ] Task 10: Upgrade dependencies
