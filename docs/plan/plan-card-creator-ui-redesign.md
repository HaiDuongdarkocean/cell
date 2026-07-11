# Implementation Plan — Card Creator UI Redesign

> Plan for turning `docs/specs/spec-card-creator-ui-redesign.md` into working code. Follows the LOOP model: design → align → implement → verify → ship.

## 1. Overview

Redesign the Card Creator dialog and settings connection card to be cleaner, more minimalist, and better aligned with the Cell design system. The work is UI-only: no data-flow, AnkiConnect, or media-extraction changes.

## 2. Architecture decisions

- **Design-first:** The updated `docs/mockups/anki-card-mockup.html` is the source of truth. Code is updated to match the mockup, not the other way around.
- **Token-only:** No new primitive colors. Any new visual concept (e.g. the `Notice` alert) is expressed as a semantic/component token alias in `themeTokens.ts`.
- **Content-script safe:** All sizes in the content-script CSS remain `px` (no `rem`) per `design-system.md` §6.
- **Incremental:** Update the mockup first, then the shared CSS modules, then the React components, then verify. This keeps the system buildable after each checkpoint.

## 3. Phases

### Phase 1 — Design mockup

Produce the new visual design in `docs/mockups/anki-card-mockup.html`.

- Rewrite the mockup HTML/CSS with the spec design.
- Keep the video player + subtitle block context and the settings page.
- Include dark/light theme toggle and all form states.

**Checkpoint:** Open the mockup in a browser and confirm it matches the spec visually.

### Phase 2 — Align documentation

- Update `docs/specs/spec-card-creator.md` UI section to reference the new mockup and design tokens.
- Update `docs/0-wiki.md` index if new files are added.
- If any new tokens are introduced, add them to `docs/design-system/design-system.md` §2.3 component tokens.

**Checkpoint:** Docs are consistent and the spec has no unaddressed open questions.

### Phase 3 — Implement mockup CSS

Update the CSS modules in `src/features/cardCreator/ui` to match the mockup.

- `CardCreatorDialog.module.css` — layout, alert, sections, footer.
- `FieldRow.module.css` — label row, mapping select, inputs/textareas.
- `MediaList.module.css` — media row, thumbnail, remove, add button.

**Checkpoint:** `npm run test:unit` passes; `npm run build` passes.

### Phase 4 — Implement React structure

Adjust JSX only if the CSS changes require different DOM (e.g. the notice icon, media row structure).

- `CardCreatorDialogContent.tsx` — alert markup, section wrappers, footer.
- `FieldRow.tsx` — mapping select wrapper.
- `MediaList.tsx` — row structure, thumbnail button, empty state.

**Checkpoint:** `npm run test:unit` passes; `npm run build` passes.

### Phase 5 — Verify and ship

- Manual browser check on YouTube (load unpacked extension, open Card Creator).
- Run `npm run test:unit` and `npm run build`.
- Review diff, commit, and update PR.

**Checkpoint:** Visual review passes, no regressions, and the feature is in `master`.

## 4. Risks and mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| The new mockup is still perceived as cluttered | Medium | Review with the designer/user after the first mockup checkpoint before touching code. |
| `rem` vs `px` leaks into content-script CSS | Low | Verify all lengths in touched `.module.css` files are `px` or `var(--space-*)` that resolve to `px` in the content script. |
| Button/Select shared components need changes | Low | Try to express the design with existing `Button`/`Select` variants. Ask before modifying shared components. |
| Tests rely on CSS class names or test ids | Low | Keep existing `data-testid` attributes; only change class names if tests break, then update tests. |
| Mobile bottom sheet not updated consistently | Medium | Include mobile layout in the mockup and test the `BottomSheet` render after CSS changes. |

## 5. Open questions

(See `docs/specs/spec-card-creator-ui-redesign.md` §9.)
