# Todo: Audio Settings — Pipeline

## Phase 1: Foundation (parallel)

- [x] Task 1: Output mode engine mapping + status helpers
- [x] Task 2: `AudioPipeline` horizontal pipeline component
- [x] Task 3: `SourceDetailPanel` detail pane per engine

## Checkpoint 1

- [x] `npx tsc --noEmit` passes
- [x] Foundation unit tests pass

## Phase 2: Core Audio Panel

- [x] Task 4: `AudioPanel` main component
- [x] Task 5: Integrate `AudioPanel` into `SettingsDialogContent`

## Checkpoint 2

- [x] `npx tsc --noEmit` passes
- [x] `npx jest --selectProjects unit --testPathPatterns "audio|SettingsDialogContent"` passes
- [x] `npm run build` passes

## Phase 3: Tests, Build, Mockup

- [x] Task 6: Update mockup and final build verification
- [x] Task 7: i18n key stubs (optional)

## Checkpoint 3

- [x] All acceptance criteria met
- [x] Build, typecheck, unit tests pass
- [x] Quality review subagent: PASS WITH NOTES
