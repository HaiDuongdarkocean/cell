# Intent: Ocean Language Acquisition SRS

> Elicitation result — confirmed by user.

---

## 8-field frame

| Field | Confirmed value |
|---|---|
| **Problem** | SRS/flashcard thông thường tối ưu cho card completion, không phải language acquisition. Coi một từ là một trạng thái nhớ duy nhất, dựa nhiều vào native translation, khiến learner không xây dựng liên kết trực tiếp với target language. |
| **User** | Người học ngoại ngữ trên Cell, 10–25 chính, hỗ trợ 5–80, MV3, desktop/tablet/Android. |
| **Current workflow** | Gặp từ mới → tra dictionary popup / reader / video → lưu vào deck. Nếu Anki: một card = một state, 4 rating. Nếu biết nghĩa nhưng không phát âm được, thẻ vẫn "Again". |
| **Pain point** | Một learning object có thể meaning giỏi, sound yếu, spelling khá; app không phân biệt. Progress không hiển thị theo component. Offline review phụ thuộc AI/cloud. |
| **Evidence** | `Ocean_Language_Acquisition_SRS_Intent.md` v1.0: 41 phần + 9 design test cases A–I + 20 non-negotiable rules. |
| **Desired outcome** | Mỗi Learning Object có 3 Memory Component (Meaning, Sound, Spelling) độc lập. Scheduler chọn component cần reinforce, chọn stimulus/template, Front/Back, binary Forget/Remember, progress per component, offline-first. |
| **Constraint** | Offline-first; no AI; target language primary, native translation reference only; binary judgment; separation of concerns; O(n) max; MV3/Liquid Glass; không phá vỡ existing features; IndexedDB/storage.local. |
| **Scope** | **MVP V1:** 3 component + FSRS per component, Learning Path, binary judgment, Notetype/Deck CRUD, Note/Card creation, Scheduler, Review UI, Study Again/Reset, Explore mode, Maintenance mode, default notetype seed. **Out:** conversation/essay, AI content, pronunciation scoring, sync. **Method:** elicitation → doubt-driven → spec → review → plan. |

---

## Doubt-driven stress-test findings

| # | Assumption | Risk | Mitigation / accepted risk |
|---|---|---|---|
| 1 | FSRS per component | No existing FSRS in Cell | `ts-fsrs` or internal port; keep FSRS as scheduler boundary only. |
| 2 | Exact match spelling | Inflection may fail | V1 minimal normalization; revisit for non-English. |
| 3 | Template system | Combinatorial explosion | Default templates per component; user can add but not required. |
| 4 | Audio offline | Audio may not be pre-downloaded | Reuse Pronunciation Engine fallback; non-audio Sound template. |
| 5 | Binary judgment | Loses nuance | Accepted; complexity in scheduler, not UI. |
| 6 | Explore all components | May overload learner | Default explore sequence Sound→Meaning→Spelling, minExplores=1. |

---

## Open questions

1. `ts-fsrs` bundle/compat → T0 spike.
2. Storage: IndexedDB vs `chrome.storage.local`.
3. Card source: manual vs dictionary/reader import.
4. Android IME for spelling.
5. Multi-device sync out of V1.

---

## Decisions made

- 3 Memory Component: Meaning, Sound, Spelling.
- Progress separate from FSRS Retrievability.
- Front = stimulus/activation; Back = verification surface.
- Scheduler decides what/when/how; Template decides how rendered.
- Binary Forget/Remember V1.
- Offline-first, no AI.
- Target language primary; native translation reference/fallback.
