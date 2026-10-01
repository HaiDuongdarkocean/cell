# Review: anki-notetype-pills — ANALYZE

Reviewer: Anh yêu (interactive mode — hypothesis presented, gap questions answered)

Intent doc: `docs/intent/anki-notetype-pills.md`

## User decisions on open questions

- Preview dots cycle **only the selected notetype's notes** — mental model: one pill = one notetype's fields + preview.
- Manage surface on desktop = **anchored Popover** at the ghost icon button (not centered Dialog); mobile = sheet.
- "Advanced options" disclosure **removed entirely** — its only content (notetype checkboxes) moves to the manage surface; the ghost icon replaces it.
- Notetypes with **0 importable cards are hidden from pills** but still listed in the manage surface.

VERDICT: APPROVE
