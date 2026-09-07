# Implementation Plan: Audio Settings — Pipeline (fnc_audio-settings-pipeline)

## Overview

Gộp 3 section `Pronunciation`, `Local Pronunciation`, `TTS Voices` trong Settings thành một card `Audio` duy nhất, theo Concept H (Audio Pipeline) trong mockup. Mục tiêu giảm cognitive load, giữ nguyên runtime contract, reuse tối đa code hiện có.

## Architecture Decisions

1. **New feature module `src/features/audio/`**: Tập trung logic/output mode, pipeline, detail pane. Tách audio UI khỏi settings shell.
2. **Reuse existing sub-panels**: `PronunciationSettingsPanel`, `LocalPronunciationSettingsPanel`, `TtsVoiceManagerPanel`, `TtsLanguagePanel` được render bên trong `SourceDetailPanel` thay vì viết lại.
3. **Output mode as UI-only abstraction**: `fallbackEngines` vẫn là persisted state; mode chỉ là preset UI, có thể override trong detail pane.
4. **One sidebar item `audio`**: thay thế `pronunciation`, `localPronunciation`, `tts`. Không cần schema migration vì đây là UI nav id.
5. **CSS Modules**: `AudioPanel.module.css` dùng design tokens, mobile-first, container queries.

## Task List

### Phase 1: Foundation (parallel)

- [ ] **Task 1**: Output mode engine mapping + status helpers
  - Acceptance:
    - `src/features/audio/lib/outputMode.ts` exports `OutputMode`, `OUTPUT_MODES`, `getOutputModeChain()`, `getEngineStatus()`.
    - Mapping `Auto/Natural/Fast/Offline/Minimal` → `AudioEngineKind[]`.
    - `getEngineStatus()` returns `ready` / `missing` / `disabled` based on `PronunciationSettings` + `TtsSettings`.
  - Verify: `npx tsc --noEmit` passes, unit test `outputMode.test.ts` passes.
  - Files: `src/features/audio/lib/outputMode.ts`, `src/features/audio/lib/outputMode.test.ts`.
  - Dependencies: None.
  - Scope: Small.

- [ ] **Task 2**: `AudioPipeline` component
  - Acceptance:
    - `src/features/audio/ui/AudioPipeline.tsx` renders horizontal pipeline with status dots.
    - Props: `engines`, `selectedEngine`, `onSelect`, `getEngineStatus`.
    - Tapping a step calls `onSelect(engine)`.
    - Disabled/missing states are visualized.
  - Verify: Component renders in `AudioPanel.test.tsx`.
  - Files: `src/features/audio/ui/AudioPipeline.tsx`, `src/features/audio/ui/AudioPipeline.module.css`.
  - Dependencies: Task 1 (status helper constants).
  - Scope: Small.

- [ ] **Task 3**: `SourceDetailPanel` component
  - Acceptance:
    - `src/features/audio/ui/SourceDetailPanel.tsx` renders detail pane for selected engine.
    - `localFile` → `LocalPronunciationSettingsPanel`.
    - `native` → brief info (no config).
    - `supertonic` → `TtsLanguagePanel`.
    - `browserTts` → `TtsVoiceManagerPanel`.
    - `espeak` → eSpeak data toggle.
  - Verify: Render test for each engine type.
  - Files: `src/features/audio/ui/SourceDetailPanel.tsx`, `src/features/audio/ui/SourceDetailPanel.module.css`.
  - Dependencies: None (import existing panels).
  - Scope: Medium.

### Checkpoint 1: Foundation

- [ ] `npx tsc --noEmit` passes.
- [ ] Foundation unit tests pass.
- [ ] Review with human before continuing.

### Phase 2: Core Audio Panel

- [ ] **Task 4**: `AudioPanel` component
  - Acceptance:
    - `src/features/audio/ui/AudioPanel.tsx` composes Enable toggle, Output mode segmented, Audio tester, Voice settings, Pipeline, Source detail panel.
    - Props: `pronunciation`, `tts`, `onPronunciationChange`, `onTtsChange`.
    - Output mode change updates `fallbackEngines` to preset chain.
    - Tapping pipeline step opens detail.
  - Verify: `AudioPanel.test.tsx` renders all sections.
  - Files: `src/features/audio/ui/AudioPanel.tsx`, `src/features/audio/ui/AudioPanel.module.css`.
  - Dependencies: Task 1, 2, 3.
  - Scope: Medium.

- [ ] **Task 5**: Integrate `AudioPanel` into `SettingsDialogContent`
  - Acceptance:
    - Replace 3 cards (`pronunciation`, `localPronunciation`, `tts`) with one card (`audio`).
    - Sidebar items updated to single `Audio` item.
    - `data-section="audio"` on new card.
    - Props wired correctly to settings handlers.
  - Verify: `SettingsDialogContent.test.tsx` updated and passes.
  - Files: `src/features/settings/ui/SettingsDialogContent.tsx`, `src/features/settings/ui/SettingsDialogContent.test.tsx`.
  - Dependencies: Task 4.
  - Scope: Medium.

### Checkpoint 2: Core Integration

- [ ] `npx tsc --noEmit` passes.
- [ ] `npx jest --selectProjects unit --testPathPatterns "audio|SettingsDialogContent"` passes.
- [ ] Build succeeds.

### Phase 3: Tests, Build, Mockup

- [x] **Task 6**: Update mockup and add final verification
  - Acceptance:
    - Update `src/entrypoints/mockup-audio/main.tsx` to keep only `real` and `h` (or keep g as alternative).
    - Ensure mockup build output still works.
    - Run `npm run build` end-to-end.
  - Verify: `npm run build` passes.
  - Files: `src/entrypoints/mockup-audio/main.tsx` (optional).
  - Dependencies: Task 5.
  - Scope: Small.

- [x] **Task 7**: Final verification + i18n key stub (optional)
  - Acceptance:
    - Add `settings.audio.*` keys to `en.json` / `vi.json` as stubs for follow-up.
    - Run full unit tests.
  - Verify: `npx jest --selectProjects unit` passes.
  - Files: `src/shared/i18n/messages/en.json`, `src/shared/i18n/messages/vi.json`.
  - Dependencies: Task 5.
  - Scope: Small.

### Checkpoint 3: Complete

- [ ] All acceptance criteria met.
- [ ] Build, typecheck, unit tests pass.
- [ ] Ready for `code-review-and-quality` subagent.

## Parallelization

| Parallel group | Tasks | Why |
|---|---|---|
| Group A | 1, 2, 3 | Independent foundation components; no shared files except constants. |
| Group B | 4, 5 | Sequential: panel depends on A; integration depends on panel. |
| Group C | 6, 7 | Independent polish tasks after core integration. |

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| `TtsVoiceManagerPanel` renders nested `Card`, causing double-card inside detail pane | High | Render `TtsVoiceManagerPanel` in a flat container and override its top-level `Card` styles, or create a prop to disable nested card. |
| Output mode mapping conflicts with user-customized priority chain | Medium | Treat mode as preset only; switching mode overwrites `fallbackEngines`. Document this behavior in UI hint. |
| Sidebar scroll-spy breaks when removing 3 section ids | Medium | Replace `sectionRefs.current.pronunciation/localPronunciation/tts` with `audio`; update `sidebarItems`. |
| Tests rely on old card labels | Medium | Update `SettingsDialogContent.test.tsx` to assert `Audio` label and removed cards. |

## Open Questions

1. Do we keep the old panels as standalone files or inline their logic into `SourceDetailPanel`? **Decision: keep as standalone, import into detail pane.**
2. Do we add i18n keys in this PR or follow-up? **Decision: follow-up, but stub keys optional.**
