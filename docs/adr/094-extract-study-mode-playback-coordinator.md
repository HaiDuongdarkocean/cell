# ADR-094: Extract Study-Mode Playback Coordinator from `ReactSubtitleController`

## Status

Proposed

## Date

2026-09-01

## Context

`src/features/subtitle/ui/reactSubtitleController.ts` is 889 lines and is the largest controller in the subtitle island. It owns several responsibilities:

- Subtitle mount/overlay lifecycle (`mountSubtitle`, `SubtitleCueEngine`).
- Manager panel state and navigation.
- Player-mode geometry and split view.
- **Study-mode playback orchestration** (`applyStudyMode`, `onStudyModeTimeUpdate`, `applyPlaybackActions`, play/pause `continue` flow).

The study-mode code is self-contained but embedded in the controller. This creates the following debt:

- `ReactSubtitleController` knows the details of the study-mode state machine (`StudyModePlaybackController`) and how to translate `PlaybackAction` into side effects on the video element and subtitle overlay.
- The study-mode code is hard to unit test in isolation because it requires a full `ReactSubtitleController` instance.
- A `src/features/studyModes/content/studyModeController.ts` already exists, but it only manages global active-mode state for the content script. The runtime playback-orchestration logic is still in `reactSubtitleController.ts`.

The debt audit identified this as the first seam to pay down in the subtitle island, with the acceptance criterion that `reactSubtitleController.ts` should drop below 800 lines while preserving behavior.

## Decision

Introduce a new `SubtitleStudyModeController` in `src/features/studyModes/lib/subtitleStudyModeController.ts` that owns the runtime study-mode playback orchestration. `ReactSubtitleController` will become a thin coordinator: it creates the new controller, forwards `applyStudyMode` calls, and the new controller emits `PlaybackAction`s back for the outer controller to apply.

### Why this name and location?

- `StudyModeController` is already taken by `src/features/studyModes/content/studyModeController.ts`, which is a content-script global-state manager.
- The new class is specifically the **subtitle-player-facing** playback coordinator, so the prefix `Subtitle` and location under `features/studyModes/lib` make the scope obvious.

### What it owns

- `applyStudyMode(activeMode, advanced)` — create/reset the `StudyModePlaybackController` and prepare the overlay.
- `onTimeUpdate()` — observe active cue index and time, drive the state machine.
- `continue()` — resume after auto-pause.
- `setCues()` and `setOffset()` — update the state machine when cues or offset change.
- `destroy()` — clean up references.

### What stays in `ReactSubtitleController`

- Creating and owning the `SubtitleStudyModeController` instance.
- Forwarding video `timeupdate`, `play`, `pause` events and cue changes to the coordinator.
- Applying `PlaybackAction` side effects (`setSubtitle` → overlay styles, `setSpeed`, `seek`, `pause`, `play`).
- Keeping the public `applyStudyMode` method for callers, but delegating to the new controller.

### Strategy

**Branch by Abstraction**:

1. Add `SubtitleStudyModeController` behind a small interface (`StudyModePlaybackCoordinator`).
2. Move `applyStudyMode`, `onStudyModeTimeUpdate`, and helper fields into the new class.
3. Update `ReactSubtitleController` to call the abstraction.
4. Remove the old embedded logic only after characterization/contract tests pass.

## Alternatives Considered

### Alternative 1: Move logic into a `useSubtitleStudyModePlayback` React hook

- **Pros**: Fits React patterns, can use hooks for state.
- **Cons**: `ReactSubtitleController` is an imperative class, not a React component, so a hook would force a large structural change and re-render lifecycle. Too much churn for a debt task.
- **Rejected because**: it would change the architecture rather than just the shape.

### Alternative 2: Rename the existing `StudyModeController` and reuse the name

- **Pros**: Cleaner name.
- **Cons**: `StudyModeController` already has a clear public surface (`getActiveStudyMode`, `subscribeToStudyMode`) used by other modules. Renaming it would cascade across the content script and sidepanel code.
- **Rejected because**: it expands the change surface with no behavioral benefit.

### Alternative 3: Inline `StudyModePlaybackController` logic directly into the new class

- **Pros**: Fewer files.
- **Cons**: `StudyModePlaybackController` is a pure state machine with its own unit tests. Folding it into the orchestrator would re-mingle concerns.
- **Rejected because**: it would undo the existing separation and make testing harder.

## Temporary Abstractions

- `SubtitleStudyModeController` will be introduced in `src/features/studyModes/lib/subtitleStudyModeController.ts`. It can be removed or renamed once the larger subtitle controller refactor is complete and the interface is no longer needed.
- Tracking task: `tasks/todo-debt-remediation.md` Task 6.

## Consequences

- `reactSubtitleController.ts` is expected to drop below 800 lines.
- Study-mode playback becomes unit-testable without instantiating the full subtitle UI controller.
- `ReactSubtitleController` still owns the side-effect boundary (video element, overlay), keeping the change focused.
- Risk of regression is mitigated by the existing `reactSubtitleController.test.ts` characterization tests and by adding focused tests for `SubtitleStudyModeController`.
- Rollback: the change is additive until the old code is removed, so reverting to the old inline implementation is one commit away.
