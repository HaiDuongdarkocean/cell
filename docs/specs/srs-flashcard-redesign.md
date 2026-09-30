# Spec: srs-flashcard-redesign

Intent: `docs/intent/srs-flashcard-redesign.md` · uiSurface: yes · Reference: 4 user-supplied screenshots (Migaku-style review). Structure must match the reference; colors come from Cell tokens only — no hardcoded hex for layout surfaces.

## Requirements

### REQ-1 — Review stage chrome (both faces)

Full-viewport stage on `--color-background`. Fixed corner chrome, independent of card content:

- Top-left: circular close button (icon `x`) → ends the session, returns to the home/stats view.
- Top-center: 3 circular step indicators for the learning path (sound / meaning / spelling), active = current `componentType`, `aria-current="step"`.
- Top-right: `{dueNow} new` counter from `stats.dueNow`.
- Bottom-left: circular `repeat` button (mark current component study-again) and `layers` button (open Manage view; ends the session).
- Bottom-right: circular `trash` button (delete current card, confirm) and `pencil` button (open Edit card).
- Bottom-center: two large circular grade buttons — ✗ `forget` (`surface-elevated`), ✓ `remember` (warning→error gradient, existing style preserved).

### REQ-2 — Card front

- Centered card, `surface` background, `radius-card`, max-width ~30rem, min-height ~60vh.
- Status pill overlapping the card's top edge ("New" when `card.createdAt` component `exploreCount === 0`, else hidden per component progress — the badge reflects "new" state only).
- Word (`note.targetWord`) large, centered.
- Stimulus fields centered: sentence with the target phrase bolded; remaining stimulus values under it (text/image/audio rendered as today but centered).
- Spelling component keeps the type-the-word input; Enter checks the answer.
- Flip to back via ✓ button, Enter, or clicking the card body (not on inputs/buttons).

### REQ-3 — Card back

Same chrome. Inside the card, top→bottom:

1. `targetWord` heading centered.
2. Sentence with bold target.
3. Audio row: circular buttons for sentence audio and word audio (present only when the asset exists).
4. "See translation" pill (`secondary` button, uppercase); when translation field exists it is hidden behind this button; pressing reveals it in place (button replaced by the translation text). When no translation exists, no button.
5. `Separator` divider.
6. Definition block: header row `targetWord (ipa) ★` (star × frequency if data exists — keep existing single ★ if no freq data), then the definition text.
7. Image (blob from `imageCache`), `radius-lg`.
8. Notes block: `--color-primary-subtle` background, `radius-lg`, centered, "NOTES" caption + content.
9. Grade buttons live in the stage chrome (REQ-1), not inside the card.

The existing Study again / Reset component / Reset card actions move: study-again → bottom-left `repeat` button; reset component + reset card → rows inside the Edit card panel (REQ-4).

### REQ-4 — Edit card panel

New `SrsEditCardPanel` (opens from the pencil button; replaces the card on the stage while open):

- Header: `settings` icon left, "Edit card" title centered, `wrench` icon right.
- "Card type" select → notetype name (notetypes of the collection; changing is out of scope → render disabled/select shows current).
- "Deck" select → all decks of the collection (`getDecksByCollection`); saving moves note + card (`putNote` with new `deckId`, `putCard` with matching `deckId`).
- Preview block: word + sentence (like card front).
- One labeled row per notetype field (order from `notetype.fields`):
  - `text` / `translation` / `context` → `Textarea`.
  - `list` → `Textarea`, one item per line.
  - `audio` → row with play button + source label; "Add" via file picker writes `putAudioAsset` (id = `audioAssetId`), "Remove" clears the field value.
  - `image` → thumbnail + "Add" via file picker writes `putImageAsset`, "Remove" clears.
- `DELETE CARD` destructive full-width button → confirm → `deleteCardCascade`, close panel, advance session.
- Secondary destructive rows: Reset component, Reset card (existing provider calls).
- Footer metadata: Created (date), Last pos (last `remember` review component + date), Last fail (last `forget`), from `getReviewEventsByCard`.
- Save bar: primary "Save" persists via `putNote`; cancel discards. After save the in-session note refreshes (`updateCurrentNote`).

### REQ-5 — Provider additions

`SrsStudyProvider` exposes `endSession()` (clears session → home), `updateCurrentNote(note)` (putNote + refresh session note), `deleteCurrentCard()` (confirm at call site → deleteCardCascade + selectNextReview advance or finished).

## Acceptance criteria

- SC-1: Front matches reference layout: corner chrome positions, centered card, overlapping "New" pill, centered word/sentence, ✗/✓ bottom-center.
- SC-2: Back matches reference: audio row, see-translation toggle, divider, def line, image, tinted notes block.
- SC-3: See-translation reveals translation in place; hidden when no translation field.
- SC-4: Edit card panel renders all notetype fields in order; saving text fields, deck move, and asset add/remove persist and reflect in the session.
- SC-5: Delete card / reset actions behave as before (confirm dialogs preserved).
- SC-6: No hardcoded colors; all values are tokens. i18n for every new string (en + vi).
- SC-7: `npm run typecheck && npm run lint && npm run test:unit && npm run build` green; visual verify on real Chrome with before/after screenshots.

## Traceability

| REQ | Screens | Verification |
|---|---|---|
| REQ-1..3 | SrsReviewCard/App chrome | SC-1..3, SC-7 browser gate |
| REQ-4 | SrsEditCardPanel | SC-4..6 |
| REQ-5 | SrsStudyProvider | unit tests + SC-4/5 |
