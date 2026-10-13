# Design Approval — Resources import UX

Date: 2026-09-21 · Stage: DESIGN gate (interactive) · Mockup: `src/entrypoints/mockup-resources-import-ux/` (live at dev server `/src/entrypoints/mockup-resources-import-ux/index.html`)

## Presented

Three divergent presentations of per-file import jobs, exercised live on the mockup (real panel baseline + 3 concepts, mobile/desktop, light/dark):

- **A — Conveyor tray**: dedicated "Đang thêm" queue pinned under the dropzone; jobs live there, completed files teleport into the list. Download-manager model, closest to the Yomitan reference layout.
- **B — Water fill**: dropped files land inline as placeholder cards; `--color-primary-subtle` fill rises through the card with real `processed / total` entries; card solidifies into a resource row. The list IS the queue.
- **C — Ledger**: resources and jobs share one hairline ledger; thin accent underline as the progress channel. Most minimal, least card-grammar-consistent.

All three shared the same decisions already locked: six-dot grip reorder with lift animation, non-blocking dropzone, bounded concurrency, and an integrated lookup column right of the list.

## Decision

User picked **Concept B — Water fill** ("anh chọn b water fill. xong rồi đó làm đi"), with two explicit refinements confirmed against the Yomitan reference screenshot (`msedge_Mi8bmMwc65.png`):

- Grip = six-dot style; grabbing lifts the row (shadow + motion) — shared `DragHandle` component provides exactly this.
- Lookup column embeds the real `DictionaryPanelView` (`variant="integrated"`), not a simplified mock — so test lookups hit actual enabled dictionaries and frequency lists.

## Rationale captured

- Water fill keeps the job in the exact list position the resource will occupy — no tray→list teleport, least new chrome, strongest fit with Tihoka's water story.
- One card grammar covers pending / importing / done / error / duplicate / dragging states.
- Right-edge status cluster (spinner → % + fill → terminal icon) satisfies the "thanh tiến trình xoay ở bên phải ngoài cùng" requirement non-color-only.

## Follow-ups for DELIVER

- Exact per-format entry counting (txt lines, sqlite COUNT, term-bank sums, JSON pre-parse) feeds the `total` field that already exists in `RESOURCE_IMPORT_PROGRESS` plumbing; `BatchProcessor` gains total reporting.
- `ResourcesPanel` moves from single section `ImportState` to `jobId`-keyed job records + bounded-concurrency dispatcher.
- `ResourceCard`: `DragHandle` replaces up/down buttons; keyboard reorder preserved via the handle's arrow-key support; persist through `reorderResources`.
- `ResourceDetail`: remove "Thử tra từ" block; keep samples + profile assignment.
- `aria-live` `VisuallyHidden` announcements per section; `prefers-reduced-motion` support on fill/lift.
- Mockup directory deleted at ship.

VERDICT: APPROVE
