# Comprehension Score — Spec Review Record

> Phạm vi: `docs/specs/comprehension-score.md`, `docs/intent/comprehension-score.md`.
> Hai pass: (1) stakeholder 3-lens BA/PO/TL in-session, (2) doubt-driven fresh-context adversarial reviewer trên claims nền khoa học + kiến trúc.

## Verdict

APPROVE WITH CHANGES — tất cả findings đã reconcile vào spec trước khi implement (revision history trong spec).

## Pass 1 — Stakeholder (BA/PO/TL)

| # | Lens | Finding | Resolution |
|---|------|---------|-----------|
| M1 | BA/PO | New-user baseline rỗng → mọi token unknown → 0% "Quá khó" misleading | Rule "không có baseline/status map rỗng → không hiện score"; fail-open + `console.warn` một lần; AC thêm |
| M2 | TL | Spec thiếu Alternatives | Thêm section Alternatives (UniversalPanel vs floating pill; reuse `resolveCueListTokenMetadata` vs lean status-only pass; hoist tokenMap vs callback) |
| M3 | TL | Race: `onWordStatusChanged` trong lúc `await getWordStatuses` → snapshot cũ đè status mới | Buffer status events trong lúc resolve, replay sau khi tracker built (pattern `statusVersionCounter` của webTokenizeController); AC thêm |
| M4 | PO | Failure path `getWordStatuses` reject/timeout undefined | Fail-open: không pill, warn; AC thêm |
| m5 | PO | Thiếu user story | Thêm 1 dòng "As a learner…" |
| m6 | TL | Reader sách lớn có thể >3s | Chunked tokenize 200 paragraphs/tick + yield; cancelable khi đổi sách |
| m7 | BA | "compute nhẹ" mơ hồ | Quantify: không DOM writes, O(n) tokenize + batched lookup |
| m8 | TL | `langCode` correctness cho cues | `subtitleOverlayTargetLanguage` là SSOT; `baseLangCode()` normalize BCP-47 |

## Pass 2 — Doubt-driven (fresh-context adversarial)

| # | Finding | Severity | Resolution |
|---|---------|----------|-----------|
| D1 | `WORD_STATUSES_GET` zod schema cap 1000 terms/request + term ≤200 chars; client fail → empty Map → all-unknown giả | Blocker | `fetchTermStatuses` chunk 1000, filter term >200 chars; empty batch → empty Map = fail-open |
| D2 | `langCode` schema `length(2)` — `zh-hans`/`zh-hant` reject | Major | `baseLangCode()` normalize trước mọi call |
| D3 | zh granularity: `segmentFMM` với `hasTerm:()=>false` → single chars, statuses lưu headword → score structurally sai | Blocker | zh-family suppressed v1 (honest > fake 0%); upgrade path: dictionary-backed `hasTerm` probe |
| D4 | Reader/local-player không có cross-tab relay `WORD_STATUS_CHANGED`; reader's own DictionaryPanelView không emit | Major | v1: score đúng on-open; wire `onStatusChange`→`emitWordStatusChanged` trong reader (same-context live) |
| D5 | Web-text `blocks` private trong WebTokenizeController | Major | Controller API mới: `getBlocks()`/`getAllTokens()` (prepare-no-bind) + `onBlocksChanged` option |
| D6 | Pure-numeric tokens ("2024") deflate coverage | Minor | `isScorableToken` exclude numeric (research đếm "words") |
| D7 | Lemma/surface mismatch (went/go) | Accepted | Hệ thống key theo surface term — documented system ceiling |
| D8 | Sidepanel score staleness | Accepted | Cross-context relay giới hạn — documented |

## Accepted ceilings (explicit trade-offs)

- zh score off v1 cho tới khi `hasTerm` dictionary-backed.
- Lemma aggregation không làm — giữ consistent với wordStatus model.
- Status freshness trong reader/local-player = same-context only.
