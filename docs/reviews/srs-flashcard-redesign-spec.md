# Spec review: srs-flashcard-redesign

VERDICT: APPROVE_WITH_CHANGES

Reviewed `docs/specs/srs-flashcard-redesign.md` against `docs/intent/srs-flashcard-redesign.md` and the 4 reference screenshots.

- BA lens: scope (review + edit panel) matches the confirmed user answer; non-goals explicit. OK.
- PO lens: REQ-4 "Add" for audio/image implemented as local file picker — honest substitution for Migaku's CREATE/SEARCH services; acceptable because Tihoka has no remote media search. Grade buttons duplicated in chrome on both faces mirrors the reference.
- TL lens: REQ-5 provider additions are minimal; deck move writes note + card deckId, consistent with sync-scope capture in `putNote` (prev-scope delete captured automatically). `audioAssetId`/`imageAssetId` helpers reused.
- Change applied during review: badge rule clarified (show "New" when the current component has `exploreCount === 0`); reset actions relocated into the edit panel instead of being dropped.
