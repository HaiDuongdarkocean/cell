# Task Breakdown — Card Creator UI Redesign

> Discrete, implementable tasks for `docs/plan/plan-card-creator-ui-redesign.md`. Each task fits in one focused session.

## Task 1: Create the new mockup HTML

**Description:**
Rewrite `docs/mockups/anki-card-mockup.html` using the design direction in `docs/specs/spec-card-creator-ui-redesign.md`. The mockup must be the single source of truth for the implementation.

**Acceptance criteria:**
- [ ] Desktop workspace (video player + subtitle block + Card Creator panel) renders cleanly.
- [ ] All 10 fields are shown with the new label-row + mapping-select style.
- [ ] Media lists (image, sentence audio, word audio) show compact rows with thumbnail, filename, and remove.
- [ ] Alert uses the `Notice` style (left border, icon, subtle background).
- [ ] Footer has update mode on the left and Cancel/Add/Update buttons on the right.
- [ ] Settings connection card is updated with the clean status indicator.
- [ ] Dark/light theme toggle works.
- [ ] File uses only design-system tokens (or `px` for content-script lengths).

**Verification:**
- [ ] Open `docs/mockups/anki-card-mockup.html` in Chrome and do a 10-second visual scan.
- [ ] Confirm no horizontal scroll, no broken alignment, no clipped text.

**Dependencies:** None

**Files touched:**
- `docs/mockups/anki-card-mockup.html`

**Estimated scope:** Medium (3–5 files conceptually, one HTML file physically)

---

## Task 2: Align spec and wiki

**Description:**
Update the relevant docs so the new design is discoverable and the old spec does not contradict it.

**Acceptance criteria:**
- [ ] `docs/specs/spec-card-creator.md` UI section references the new mockup and updated styles.
- [ ] `docs/0-wiki.md` lists the new `spec-card-creator-ui-redesign.md`, `plan-card-creator-ui-redesign.md`, and `task-card-creator-ui-redesign.md` in the index.
- [ ] Any new tokens are documented in `docs/design-system/design-system.md` (component layer only).

**Verification:**
- [ ] `grep` confirms the new spec and plan filenames appear in `docs/0-wiki.md`.
- [ ] `docs/specs/spec-card-creator.md` no longer says the old mockup must be matched exactly (or it points to the new mockup).

**Dependencies:** Task 1

**Files touched:**
- `docs/specs/spec-card-creator.md`
- `docs/0-wiki.md`
- `docs/design-system/design-system.md` (optional)

**Estimated scope:** Small (1–2 files)

---

## Task 3: Update CardCreatorDialog CSS

**Description:**
Update `src/features/cardCreator/ui/CardCreatorDialog.module.css` to match the mockup layout: alert, sections, pair-row, footer, and mobile stacking.

**Acceptance criteria:**
- [ ] Alert uses `Notice` style with `var(--color-warning-subtle)` and left border.
- [ ] Sections are separated by whitespace, not boxed borders.
- [ ] Section titles are `font-size-sm` semibold, not uppercase.
- [ ] `pair-row` has two columns on desktop, one on mobile.
- [ ] Footer has update mode on the left and action buttons on the right.
- [ ] Mobile `.mobile` overrides still stack the footer and pair-row.

**Verification:**
- [ ] `npm run test:unit` passes.
- [ ] `npm run build` passes.
- [ ] Manual: open the Card Creator dialog in the test page and compare to the mockup.

**Dependencies:** Task 1, Task 2

**Files touched:**
- `src/features/cardCreator/ui/CardCreatorDialog.module.css`

**Estimated scope:** Small (1–2 files)

---

## Task 4: Update FieldRow CSS

**Description:**
Update `src/features/cardCreator/ui/FieldRow.module.css` to match the new label row, mapping select, input, and textarea styles.

**Acceptance criteria:**
- [ ] Label row is `justify-content: space-between` with the mapping select on the right.
- [ ] Mapping select is small (20px height, subtle border, muted text).
- [ ] Inputs and textareas have the correct border, background, and focus ring.
- [ ] Spacing between fields is consistent (`--space-4`).
- [ ] `Textarea` resize is vertical only and min-height is correct.

**Verification:**
- [ ] `npm run test:unit` passes.
- [ ] `npm run build` passes.
- [ ] Manual: each field row in the test dialog looks like the mockup.

**Dependencies:** Task 3

**Files touched:**
- `src/features/cardCreator/ui/FieldRow.module.css`

**Estimated scope:** Small (1–2 files)

---

## Task 5: Update MediaList CSS and component

**Description:**
Update `src/features/cardCreator/ui/MediaList.module.css` and `MediaList.tsx` to match the new compact media row design.

**Acceptance criteria:**
- [ ] Media row is a horizontal flex row with thumbnail, filename, and remove.
- [ ] Image thumbnail shows a small image icon or a real preview; audio thumbnail shows a play/waveform icon.
- [ ] Remove button is a small ghost icon (16px `×`).
- [ ] Add button is a small ghost/link `+ Add {kind}`.
- [ ] Empty state is a muted text line, not a dashed box.

**Verification:**
- [ ] `npm run test:unit` passes.
- [ ] `npm run build` passes.
- [ ] Manual: image and audio media lists look like the mockup.

**Dependencies:** Task 4

**Files touched:**
- `src/features/cardCreator/ui/MediaList.module.css`
- `src/features/cardCreator/ui/MediaList.tsx`

**Estimated scope:** Small (2 files)

---

## Task 6: Update CardCreatorDialogContent structure

**Description:**
Adjust `CardCreatorDialogContent.tsx` markup if the new CSS needs different DOM structure (e.g. the alert icon, section wrappers, or footer order).

**Acceptance criteria:**
- [ ] Alert renders as a `Notice` with icon and text.
- [ ] Section titles are `h3` with the correct class.
- [ ] Footer uses the same button order as the mockup.
- [ ] No `data-testid` attributes are removed.
- [ ] Mobile `variant="mobile"` still applies the `mobile` class.

**Verification:**
- [ ] `npm run test:unit` passes.
- [ ] `npm run build` passes.
- [ ] Manual: dialog content matches the mockup DOM structure.

**Dependencies:** Task 5

**Files touched:**
- `src/features/cardCreator/ui/CardCreatorDialogContent.tsx`

**Estimated scope:** Small (1–2 files)

---

## Task 7: Verify desktop and mobile in the browser

**Description:**
Run the extension on a real page and verify the redesign does not break layout, spacing, or interaction.

**Acceptance criteria:**
- [ ] Card Creator opens from the subtitle block buttons.
- [ ] All fields are visible and editable.
- [ ] Media add/remove works.
- [ ] Footer buttons are clickable and correctly aligned.
- [ ] Mobile bottom sheet stacks fields and footer correctly.
- [ ] No `rem` scaling issues on YouTube (dialog width is stable).

**Verification:**
- [ ] Manual test on YouTube at default and 10px `html` font-size.
- [ ] `npm run test:unit` and `npm run build` pass.

**Dependencies:** Task 6

**Files touched:**
- None (verification only; may surface new files to touch).

**Estimated scope:** Small (verification only)

---

## Checkpoint: Complete

- [ ] Mockup approved and matches the spec.
- [ ] All unit tests pass.
- [ ] `npm run build` passes.
- [ ] Manual browser check passes.
- [ ] `docs/0-wiki.md` is updated.
- [ ] PR committed and ready for review.
