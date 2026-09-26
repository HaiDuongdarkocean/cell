# Design review — dict-links-manager

Date: 2026-10-03 · Reviewer: user (interactive gate) · Mockup: `src/entrypoints/mockup-dict-links-manager/`

## Decision

User selected **Concept A — Resource rows** on the rendered mockup, with two
directives applied to the selected direction:

1. **Follow the existing Resources-manager grammar** (`ResourceCard`/`ResourcesPanel`):
   `Card` rows, left `DragHandle` (pointer + keyboard reorder), click-name inline
   rename, ghost icon actions, `Dialog`-based confirms — implemented in the mockup
   with the real shared components.
2. **Edit covers name + URL** — the pencil opens a shared `Dialog` with both fields;
   "Add link" reuses the same dialog empty.
3. **Surface tabs** — the Dictionary Popup settings section shows a `tablist`
   mirroring the popup toolbar (audio / image / translate / external dictionary);
   the external-dictionary tab hosts the link manager.

## Verified

- `node scripts/check-design-brief.mjs dict-links-manager` → PASS (14 tokens,
  7 components).
- Mockup live on Vite dev server (`:5173`), page + modules return 200; all CRUD +
  drag interactions functional.
- 40px control pin honored (`.aGrip`, `.aIconBtn` → `component.iconbutton.size-md`);
  surface tabs mirror the popup's 32px toolbar size.
- Component mapping traces every element to REQ-1..8.

VERDICT: APPROVE
