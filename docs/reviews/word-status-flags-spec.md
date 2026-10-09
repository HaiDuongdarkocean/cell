# Spec review: word-status-flags

`spec-reviewer` subagent report (fresh context, one pass, BA/PO/TL lenses).

## Findings

### Major
1. [REQ-3/REQ-4][TL] User-clear flag trên term có card sống: internal SRS event-driven, không reconcile → flag lệch vĩnh viễn, phá invariant "learning = card exists". Fix: behavior quyết trong spec + reconcile/restore cho internal SRS.
2. [REQ-4/AC-6][TL] Hai writer của flag thiếu ownership: "no card → clear" áp mọi term sẽ wipe learning của internal-SRS words không có Anki card; internal deletion có thể đè known/ignore. Fix: clear chỉ khi không card ở cả hai nguồn + chỉ khi current = learning.
3. [REQ-2/AC-3][PO/TL] "SRS icon opens card view" — chưa rõ surface có sẵn hay mới.
4. [REQ-2/REQ-3][BA/PO] Write paths enumerate chỉ keys+pill — các surface khác write status không cover; cần store-level guard.
5. [Spec-wide][TL] Thiếu alternatives section.

### Minor
1. Freq pill không chỉ rõ source field.
2. N10 không có AC.
3. Số phận phím 5 không nêu.
4. Score weighting không ghi "unchanged".
5. Badge interaction (touch persona không có keys).

VERDICT: APPROVE_WITH_CHANGES

## Applied fixes

- REQ-1: thêm store-level guard — `'learning'` chỉ writable qua system writers (`setWordStatusFromSync` + internal-SRS writer); public writers reject; thêm write-path inventory (keys, useCandidate, vocabularySource, SrsDeckDetail, background handler, sync writers).
- REQ-2: badge click toggles tracking (key-4 semantics, no-op on learning) — fix touch-persona gap; SRS icon cite `openSrsStudyPage`/deck detail là surface có sẵn, không UI mới.
- REQ-3: ghi rõ key `5` unbound.
- REQ-4: ownership rule — flag clear chỉ khi không card ở cả 2 nguồn (internal `hasSrsCard` + Anki snapshot) và current = `'learning'`; explicit base-write wins, flag có thể re-apply qua card event/reconcile trong unknown family.
- REQ-4b mới: reconcile pass — card + unknown-family → restore flag; learning + 0 cards → unknown; known/ignore không đụng.
- REQ-5: freq source = resolved `FrequencyEntry.rank` (tokenListMetadata), scoring unchanged note.
- Alternatives considered: thêm bảng 4 option bị loại.
- AC mới: AC-4b (guard), AC-7 (sửa: chỉ clear khi 0 card cả 2 nguồn), AC-7b (reconcile), AC-8 (freq rank value), AC-12 (N10 — known/ignore không gain flag).
