# Plan: srs-flashcard-redesign

Spec: `docs/specs/srs-flashcard-redesign.md` · mode: interactive · uiSurface: yes
Design authority: user-supplied screenshots. Clone structure, Cell tokens only.

| # | Slice | Delivers | AC | Depends |
|---|---|---|---|---|
| S1 | Provider + i18n — `endSession`, `updateCurrentNote`, `deleteCurrentCard` in SrsStudyProvider; all new `srs.review.*`/`srs.edit.*` keys in en+vi | REQ-5 | SC-5 | — |
| S2 | Stage chrome + card front/back restructure — `SrsReviewCard.tsx` owns stage chrome (close, 3 step icons, due counter, corner buttons, ✗/✓); `SrsReviewCardFront` (badge pill, centered word/sentence w/ bold target, card-click flip, spelling input); `SrsReviewCardBack` (audio row, see-translation toggle, separator, def line, image, notes block); CSS rewrite | REQ-1..3 | SC-1..3 | S1 |
| S3 | `SrsEditCardPanel` + `.module.css` — header, card type/deck selects, preview, per-field editors (text/list/translation textarea, audio/image rows w/ add-remove via file picker), DELETE CARD, reset rows, meta footer, Save/Cancel; wire into SrsReviewCard pencil button | REQ-4 | SC-4, SC-5 | S1 |
| S4 | Gates + verify — typecheck · lint · test:unit · build; real-Chrome screenshots front/back/edit vs reference; `docs/reviews/srs-flashcard-redesign-verify.md` | DoD | SC-6, SC-7 | S3 |
