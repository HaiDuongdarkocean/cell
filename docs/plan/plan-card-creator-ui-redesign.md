# Plan — Card Creator UI redesign

> Implementation plan for `docs/specs/spec-card-creator-ui-redesign.md`.
> Intent: `docs/intent/intent-card-creator-ui-redesign.md`
> Mockup: `docs/mockups/anki-card-mockup.html`

## Overview

Redesign Card Creator UI in vertical slices: preview block, selector redesign, media list redesign, drag-and-drop/reorder, then integrate into desktop Dialog and mobile BottomSheet. Each milestone is independently testable.

## Milestones

### M1 — Preview block (foundation)

- Create `PreviewBlock.tsx` + `PreviewBlock.module.css`.
- Implement `highlightOccurrences` helper (pure, testable).
- Add unit tests for preview text and highlighting.
- Wire into `CardCreatorDialogContent` above the Fields section.
- **Verify:** `npm run test:unit`; browser mockup visual match.

### M2 — Field mapping selector redesign

- Update `FieldRow.tsx` to render a label-style selector (no background/border, small chevron, fit-to-content).
- Update `FieldRow.module.css`.
- Add `FieldRow.test.tsx` for selector style and callback.
- **Verify:** unit tests pass; visual QA.

### M3 — Section/card layout cleanup

- Update `CardCreatorDialog.module.css` to remove bordered section boxes, switch to section titles + gap spacing.
- Update alert style to left-bordered notice.
- Update `CardCreatorDialogContent` markup to drop `section` bordered wrappers.
- **Verify:** `npm run test:unit` (existing `CardCreatorDialog.test.tsx` may need snapshot updates).

### M4 — Image media gallery

- Refactor `MediaList` to branch by `kind`: `kind='image'` renders horizontal gallery.
- Update `MediaList.module.css` for gallery, thumbnail (120px height, remove button top-right, add button at end).
- Keep existing audio list behavior for `kind='audio'`.
- Add tests for image gallery rendering and remove callback.
- **Verify:** unit tests; mockup visual match.

### M5 — Audio media list redesign

- Update `MediaList` audio row style: waveform icon, filename, remove, list layout.
- Update `MediaList.module.css`.
- Add tests for audio list rendering and play/remove callbacks.
- **Verify:** unit tests; mockup visual match.

### M6 — Drag-and-drop file add

- Add `onDragOver`/`onDrop` handlers on media zone.
- Filter files by `kind` and append via `useCardCreatorState` (or `CardCreatorDialogContent` state update).
- Add `onFilesDrop` callback to `MediaList`/`SortableMediaList`.
- **Verify:** unit tests with `fireEvent.drop`; manual browser QA.

### M7 — Drag-to-reorder

- Implement `SortableMediaList.tsx` using native HTML5 drag-and-drop for desktop.
- Implement mobile long-press drag with touch events.
- Add `onReorder` callback to `MediaList` (or replace `MediaList` with `SortableMediaList` in `CardCreatorDialogContent`).
- Update `useCardCreatorState` only if needed (prefer state update in `CardCreatorDialogContent`).
- **Verify:** unit tests for reorder callback; manual browser QA on desktop + mobile.

### M8 — Mobile bottom sheet integration

- Ensure `CardCreatorDialogContent` with `variant='mobile'` renders the redesigned layout correctly.
- Update `CardCreatorBottomSheet`/`BottomSheet` CSS if needed.
- **Verify:** browser MCP mobile viewport.

### M9 — Final visual verification and cleanup

- Run full test suite: `npm run test:unit`, `npm run lint`, `npm run typecheck`.
- Browser MCP verify desktop Dialog + mobile BottomSheet against mockup.
- Update `docs/2-architechture-system.md` if new files added.
- Update `docs/0-wiki.md` if new docs created.
- **Verify:** all success criteria in spec pass.

## Dependency graph

```
M1 Preview block
  |
M2 Field selector
  |
M3 Section layout
  |
M4 Image gallery ---- M6 D&D add
  |                    |
M5 Audio list      M7 Reorder
  |                    |
  +--------------------+--> M8 Mobile integration
                              |
                            M9 Final verify
```

## Risks and mitigation

| Risk | Mitigation |
|------|------------|
| Native HTML5 drag-and-drop not reliable inside content-script overlay | Use `draggable` on elements inside `Dialog`/`BottomSheet` which have `pointer-events: auto`; test in real Chrome. |
| Mobile long-press interferes with scroll | Require 400ms press before drag; cancel if `touchmove` exceeds 10px. |
| Image preview aspect ratio breaks layout | `object-fit: contain` + `height: 120px` + `width: auto` + `max-width: 200px`. |
| Yomitan still cannot scan preview block | Preview block is plain text in `color-surface` container with `pointer-events: auto`; no `user-select: none` or `pointer-events: none`. Verify with Yomitan installed. |
| `Select` custom dropdown overflows in small mobile bottom sheet | Use `menuMaxHeight` and ensure `BottomSheet` body scrolls. |

## Parallel work

- M1, M2, M3 can be done in parallel (different components, no conflicts).
- M4 and M5 can be done in parallel after M3.
- M6 and M7 depend on M4/M5 but can be split between image and audio.

## Verification checkpoints

- After M3: UI structure matches mockup layout.
- After M5: image + audio media layouts match mockup.
- After M7: D&D and reorder work on desktop and mobile.
- After M9: all spec success criteria met.
