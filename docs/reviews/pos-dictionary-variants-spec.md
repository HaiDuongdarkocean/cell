# Spec Review — pos-dictionary-variants

Artifact: `docs/specs/pos-dictionary-variants.md` · Reviewer: spec-reviewer subagent (fresh context, one pass, BA/PO/TL lenses)

## Findings (original report)

**Blockers:** none.

**Major:**
1. [REQ-9] Aggregate status rule mâu thuẫn postcondition: chỉ đếm pos rows materialized → variant chưa mark không tính → vi phạm "phản ánh còn usage chưa biết".
2. [REQ-8/Data] Composite key `term␟pos` mechanics chưa chốt: row.term phải chứa literal composite; helper API (prefix scan, batch, split cho display consumers) chưa định nghĩa.
3. [REQ-5] Rule variant `''`/`other` tự mâu thuẫn — draft self-argument sót trong spec.
4. Thiếu Alternatives section (rubric yêu cầu ≥2 options + lý do loại).

**Minor:**
1. REQ-4: `'json-frequency'` chưa khai báo vào `ImportFormat` union + detection order.
2. REQ-5: `partsOfSpeech = variants.map(pos)` đổi semantics raw→normalized — compat risk.
3. REQ-5: `frequencyStars best` chưa định nghĩa — invariant singleton = first-wins.
4. REQ-8: term-part composite key dùng form nào chưa chốt.
5. REQ-6: image refetch on swap chưa nêu.
6. REQ-3: adapter match qua sound links — record thiếu audio → skip (data loss).
7. REQ-7: accent-persist xếp nhầm Exception thay vì Rules.

VERDICT: APPROVE_WITH_CHANGES

## Applied fixes

1. REQ-9 + Flows: aggregate = least-learned trên resolved status của toàn bộ variant set (status pos-rows ∪ dict pos khi caller truyền); helper API `getPosStatusRows`/`getPosStatuses` (prefix range scan, batch, split-on-␟ cho display); hot-path approximation ghi rõ ở Alt flow; SC-15 cover cả hai case.
2. REQ-8 + Data: chốt `row.term` = literal composite `term␟pos`, `pos` = convenience field, term-part = surfaceTerm form hiện có (no extra normalization).
3. REQ-5: rule `other` variant viết lại một chiều — variant bình thường trong bar, cuối list, label i18n; `partsOfSpeech` giữ raw-dedup semantics (compat); SC-14 added.
4. Alternatives considered section added (status key scheme / variant materialization / homograph rows / pos-less senses).
5. REQ-4: `'json-frequency'` khai báo vào `ImportFormat` union + detection order (sau looksLikeJsonEntries, trước extension fallback).
6. REQ-6: image refetch on swap với query mới; REQ-3: match-condition fallback (UK/US label+IPA pattern khi record thiếu audio ref).
7. REQ-5: `frequencyStars` → first-wins theo invariant; REQ-7: accent-persist dời sang Rules.
