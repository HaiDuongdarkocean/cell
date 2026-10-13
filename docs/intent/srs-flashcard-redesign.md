# Intent: srs-flashcard-redesign

ui_surface: yes · mode: interactive · owner: devin-srs-redesign

## Need

The SRS study screen (`src/entrypoints/srs-study/`) currently renders an ad-hoc card: a flat box with an inline "Show answer" button and text buttons for Study again / Reset / Reset card. Anh yêu supplied 4 reference screenshots (Migaku-style review UI) and directed: **clone the structure exactly; only the colors differ (keep Tihoka design tokens)**.

Reference structure (from supplied screenshots):

1. **Card front** — full-viewport stage; close button top-left; 3 step circles top-center (learning-path components); "{n} new" count top-right; centered card with a status pill ("New") overlapping its top edge; word + sentence (bold target) centered; bottom row of corner actions (left: study-again, manage; right: delete, edit); centered pair of circular grade buttons (✗ forget / ✓ remember).
2. **Card back** — same chrome; inside card: word, sentence, audio buttons row (sentence + word audio), "See translation" pill that reveals the translation, divider, definition line (word + IPA + frequency stars + gloss), image, and a tinted NOTES block.
3. **Edit card** — sheet/panel with title row, Card type + Deck selects, one labeled row per notetype field (text fields editable; audio/image rows show current asset + add/remove), DELETE CARD destructive button, and a footer with card metadata (created / last positive / last fail).

## Journey

As-is:
- User opens the study page and starts a session from a small stats card.
- The review card is a single padded box; the front shows a generic stimulus dump plus a "Show answer" button.
- The back stacks fields vertically with small text buttons for study-again / reset component / reset card; no delete, no edit, no session exit.
- There is no way to edit a note's fields or move it between decks outside the Manage panel's list-only view.

To-be:
- User reviews on a distraction-free stage: card centered, session chrome at the corners (exit, step progress, due count, study-again/manage/delete/edit).
- Flip the card by pressing ✓ or clicking the card; grade with ✗/✓ circles like the reference.
- The back shows the reference layout: audio row, see-translation toggle, divider, definition line, image, notes block.
- The pencil button opens an Edit card panel matching the reference: deck select, per-field editors, delete card, and card metadata footer; saving updates the in-session note.

## Scope

- Restyle `SrsReviewCard` front/back + `App` stage chrome to the reference structure using existing tokens/components/icons only.
- New `SrsEditCardPanel` in the same entrypoint (replaces the pencil action target); editing writes through `putNote` (deck move supported), `deleteCardCascade` for delete, asset repositories for audio/image add/remove.
- Provider additions: `endSession`, `updateCurrentNote`, `deleteCurrentCard`.
- Non-goals: audio/image *search* services (reference has CREATE/SEARCH buttons backed by Migaku services — Tihoka has no equivalent; rows get a local file "+ Add" instead), undo stack, card template editing.

## Decision

go — user-supplied reference screenshots are the approved design authority; interactive interview condensed to one scope question (answered: review + edit card, keep Tihoka tokens).
