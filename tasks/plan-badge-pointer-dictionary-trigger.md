# Implementation Plan: Orbital Badge Dictionary Trigger

## Overview

Add a floating orbital badge trigger for dictionary lookup on small screens and fullscreen video. The badge collapses as a crescent on the right edge, expands to a circle on drag, and orbits a pointer that selects text for lookup.

## Architecture Decisions

1. **New feature sub-folder**: `src/features/dictionaryPopup/badgePointer/` keeps the new trigger isolated from existing click/hover triggers.
2. **Always on top**: badge host and pointer use the maximum valid `z-index` (`2147483647`) and render above all page layers, including fullscreen overlays and the existing tokenize FAB.
3. **Settings nested in `DictionaryPopupSettings`**: add `badgePointerTrigger: { enabled, position }` inside the existing `dictionaryPopup` slice; bump settings schema from v15 to v16.
4. **Pointer preset persistence**: the preset is stored inside `DictionaryPopupSettings` and persisted/restored by the existing settings pipeline.
5. **Lookup wiring**: the badge controller resolves the word under the pointer tip and calls `WebTextDictionaryController.handleLookup()`. No change to the lookup pipeline.
6. **Fullscreen lifecycle**: the badge host is appended to `document.fullscreenElement` when present, otherwise `document.body`. Listen to `fullscreenchange` to move the host.
7. **Pure logic split**: geometry (`pointerPosition.ts`) and gesture detection (`gestureDetector.ts`) are pure TS modules with unit tests.

## Task List

### Phase 1: Settings foundation

- **T1**: Extend `DictionaryPopupSettings` type, default config, and settings migration (v15 → v16).
- **T2**: Add toggle + preset select to `DictionaryPopupSettingsPanel`.

### Checkpoint: Foundation

- `npx tsc --noEmit` clean
- Settings panel renders without error
- Existing tests still pass

### Phase 2: Core orbital badge

- **T3**: Implement pure geometry + gesture modules with unit tests.
- **T4**: Implement Shadow DOM CSS (`orbitalBadgeCss.ts`) for crescent, circle, pointer, and theme.
- **T5**: Implement badge controller (`createOrbitalBadge.ts`) with drag, expand/collapse, double/triple tap, and preset persistence.

### Checkpoint: Core badge

- Unit tests for gesture and geometry pass
- Manual drag/expand/tap works in a minimal HTML page

### Phase 3: Lookup + fullscreen wiring

- **T6**: Implement pointer tip text resolution (`elementFromPoint` → text node → word extraction).
- **T7**: Wire `createOrbitalBadge` into `content-script.ts`; enable/disable on settings change; handle fullscreen lifecycle.

### Checkpoint: Lookup integration

- Manual test on a text article
- Manual test in fullscreen YouTube/Netflix subtitle

### Phase 4: Docs + verification

- **T8**: Write ADR and update `docs/2-architechture-system.md`.
- **T9**: Final build, tests, and manual verification.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Double/triple tap ambiguity | Medium | 300 ms tap window; reset on `pointerup`; unit test all tap sequences. |
| `document.elementFromPoint` blocked by badge | High | Badge uses max `z-index`; use `document.elementsFromPoint`, skip badge-owned elements, take first non-badge element. |
| Fullscreen SPA resets host | High | Listen to `fullscreenchange`; re-append host to the fullscreen element. |
| Drag conflicts with page scroll | Medium | `touch-action: none` on the badge host; `preventDefault` on `touchstart`. |
| Settings migration break | Medium | Add additive v15 → v16 migration; merge with defaults. |

## Open Questions

1. Center preset hit-test: resolved in spec — use `elementsFromPoint` and skip badge-owned elements.
2. Animation duration: 200 ms.
3. Pointer offset from badge center: 18 px (`--space-4` + `--space-0-5`).
