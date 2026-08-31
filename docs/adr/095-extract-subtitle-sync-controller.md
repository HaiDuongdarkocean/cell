# ADR-095: Extract Subtitle Sync State from `contentScriptController`

## Status

Accepted

## Date

2026-09-01

## Context

`src/features/subtitle/ui/contentScriptController.ts` is 1972 lines. It is the largest module in the subtitle island and mixes multiple responsibilities:

- Chrome runtime/content-script lifecycle (`onMessage`, `onStorageChanged`, window event listeners, cleanup).
- Overlay creation and teardown via `ReactSubtitleController`.
- **Subtitle sync state management**: tracking active target/native sources (`auto`/`imported`/`searched`/`translated`/`ocr`), managing `latestTargetCues`/`latestNativeCues`, virtual slots (`translatedNativeSlot`, `ocrTargetSlot`, `ocrNativeSlot`), panel item selection, and cue merge/refresh.
- Search, import, download, generate-native, and OCR orchestration.

The sync state is self-contained but deeply embedded in the controller. It is hard to unit test in isolation because it requires the full `init` closure and the `ReactSubtitleController`. The debt audit identified this as the next seam to pay down after the study-mode/style extractions in `ReactSubtitleController`.

## Decision

Introduce a new `SubtitleSyncController` in `src/features/subtitle/ui/subtitleSyncController.ts` that owns the runtime subtitle source/cue state. `contentScriptController.ts` will become a thin coordinator: it creates the `SubtitleSyncController`, forwards user actions and background messages, and the sync controller decides which cues to load into `ReactSubtitleController` and which manager panel items to refresh.

### What `SubtitleSyncController` owns

- Active source tracking (`activeTargetSource`, `activeNativeSource`).
- Latest target/native cue arrays (`latestTargetCues`, `latestNativeCues`).
- Virtual replacement slots (`translatedNativeSlot`, `ocrTargetSlot`, `ocrNativeSlot`, `preOcrSources`).
- Panel item state derived from `auto`, `imported`, `searched`, `translated`, `ocr` sources.
- Source selection logic (`selectAuto`, `selectImport`, `selectSearched`, `selectOcr`, `selectTranslated`, `selectOff`).
- Cue load side effects via callbacks into `contentScriptController` (`loadBilingualCues`, `loadCues`, `showOverlay`, `syncSidePanel`).

### What stays in `contentScriptController`

- Chrome runtime lifecycle and message routing.
- Window/document event listeners and cleanup.
- Creating/destroying `ReactSubtitleController` and `SubtitleSyncController`.
- Calling `blockController.loadBilingualCues` / `blockController.loadCues` / `blockController.clearCues` based on the sync controller's decisions.
- Search/import/download/OCR message orchestration.

### Strategy

**Branch by Abstraction**:

1. Define a `SubtitleSyncController` class and a small interface for callbacks.
2. Move source tracking, cue arrays, virtual slots, and selection logic into the new class.
3. Replace the inline state in `contentScriptController` with a `SubtitleSyncController` instance.
4. Remove the old inline logic only after the new class and its characterization tests pass.

## Alternatives Considered

### Alternative 1: Extract a broader `SubtitleContentController`

- **Pros**: Single extraction covers all non-UI logic.
- **Cons**: Too large a change; would need to move message handling and web-text dictionary integration, increasing risk.
- **Rejected because**: it would become a second monolith.

### Alternative 2: Move sync state into the existing `ReactSubtitleController`

- **Pros**: Fewer files.
- **Cons**: `ReactSubtitleController` is already focused on the React overlay; adding content-script source tracking would re-entangle it.
- **Rejected because**: it would blur the boundary between overlay and content-script state.

### Alternative 3: Keep state inline and only add tests

- **Pros**: No behavior change.
- **Cons**: Does not pay down the debt; file stays at ~1972 lines and still has multiple responsibilities.
- **Rejected because**: the audit explicitly calls for extracting the sync seam.

## Temporary Abstractions

- `SubtitleSyncController` will be introduced in `src/features/subtitle/ui/subtitleSyncController.ts`. It can be split further once the initial extraction stabilizes.
- Tracking task: `tasks/todo-debt-remediation.md` Task 8.

## Consequences

- `contentScriptController.ts` is expected to drop by several hundred lines.
- Subtitle source/cue logic becomes unit-testable without instantiating the full content-script `init`.
- `contentScriptController` still owns the side-effect boundary (runtime messages, video container, React controller).
- Risk of regression is mitigated by the existing `contentScriptController.test.ts` characterization tests and by adding focused tests for `SubtitleSyncController`.
- Rollback: the change is additive until the old code is removed, so reverting is one commit away.
