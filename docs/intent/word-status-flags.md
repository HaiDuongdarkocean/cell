# Intent: Word-status flags — 3 base statuses + tracking/learning overlays, redesigned i+1

> Slug: `word-status-flags` · Mode: interactive · Source: user statement (2026-10-10, design interview)
> ui_surface: yes
> confidence: high

## Business Case

| Concept | Statement | Evidence | Confidence |
|---|---|---|---|
| Need | Người học không phân biệt được "từ tôi không biết" và "từ tôi đang theo dõi/đang học nhưng chưa biết" — 5 status ngang hàng làm mờ nghĩa i+1 và cho phép set `learning` tay dù từ chưa hề có thẻ SRS | user interview 2026-10-10; `popupTypes.ts:18` enum phẳng 5 giá trị; `statusKeyControls.ts:12` phím 5 set learning tay | high |
| Change | Status phẳng 5 giá trị → base 3 (`unknown/known/ignore`) + flag (`tracking`/`learning`) chỉ gắn lên unknown; learning chỉ sinh ra từ SRS card; i+1 = câu có đúng 1 từ chưa-biết (mọi nhánh) + hiển thị frequency pill | user interview; `comprehensionScore.ts:23-45` | high |
| Solution | Re-model semantics trên storage hiện có (giữ enum 5 giá trị, không migrate); đổi cycle/keys/UI/token rendering; hook SRS nội bộ ghi flag learning | `wordStatusStore.ts:157` single normalization point | high |
| Value | i+1 trở thành tín hiệu học thật (Krashen): câu đọc được trừ đúng 1 từ → từ đó đáng chú ý; freq pill cho quyết định "đáng học không" ngay tại chỗ | user interview | high |
| Stakeholder | Language learner dùng subtitle/web tokenize + dictionary popup + SRS | persona repo 5–80 tuổi | high |
| Context | i+1 gate đã tồn tại (`markIPlus1Tokens`); Anki sync đã ghi learning/known; SRS nội bộ chưa ghi status | `ankiStatusSync/lib/statusRules.ts:33-40`; `src/features/srs/` không import wordStatus | high |

## Stakeholders

| Group | Who | Their need re: this change | Capability/constraint |
|---|---|---|---|
| Team | maintainer (Anh) + agents | model đúng semantics, diff gọn, không migrate IDB | storage enum giữ nguyên — reuse |
| Customer | learner | biết từ nào chưa biết / đang theo dõi / đang học; thấy i+1 + freq để quyết định học | cần visual phân biệt 3 nhánh chưa-biết |
| Supplier/Dependency | Anki Connect (ankiStatusSync), SRS nội bộ, imported dictionaries | learning chỉ đến từ card state | Anki mature→known đã có rule |
| Organization | repo conventions | IDB schema không đổi, i18n cập nhật, AC spec cập nhật | none — internal |
| Regulator | none — local-first extension, không telemetry | — | — |

## Needs

| ID | Need | FURPS+ | Evidence | Confidence |
|---|---|---|---|---|
| N1 | Phân biệt 3 nhánh chưa-biết: `unknown`, `unknown+tracking`, `unknown+learning` | F | interview; `isNew()` gộp cả 3 `comprehensionScore.ts:23-25` | high |
| N2 | Status pill popup chỉ cycle `unknown → known → ignore`; tracking là badge riêng | U | interview + screenshot annotation; `CandidateView.tsx:275-283`, `STATUS_CYCLE` `popupTypes.ts:19` | high |
| N3 | Phím tắt remap `1=unknown, 2=known, 3=ignore, 4=tracking`; bỏ phím 5 | U | interview; `statusKeyControls.ts:7-13` | high |
| N4 | `learning` chỉ set khi từ có thẻ SRS (memory Cell hoặc Anki); không set tay; view SRS read-only trong popup | F | interview; `statusKeyControls.ts:12` phím 5 hiện cho set tay | high |
| N5 | Xóa/mất thẻ SRS → từ về `unknown` thuần (không giữ tracking) | F | interview | high |
| N6 | i+1: câu đúng 1 từ chưa-biết (đếm cả 3 nhánh) → gap word hiển thị status + frequency pill background; câu khác không đánh dấu | F | interview; `markIPlus1Tokens` `comprehensionScore.ts:35-45` | high |
| N7 | Token underline thể hiện status bằng gradient: unknown màu riêng; +tracking = gradient unknown+tracking; +learning = gradient unknown+learning | U | interview + screenshot `msedge_s9kr1mxR1X` | high |
| N8 | Auto-mark tracking khi lookup/save từ giữ nguyên | F | `vocabularySource.ts:157` `nextMarkedStatus` | high |
| N9 | Aggregate POS giữ rank `unknown < tracking < learning < known` | F | `wordStatusStore.ts:85-87` | high |
| N10 | `ignore`/`known` không mang flag; từ ignore có thẻ SRS thì ignore thắng | F | assumption từ model (flags ⊆ unknown) | medium |

## Scope

- **In:** re-model WordStatus semantics; popup status pill + tracking badge + view-SRS; status keys remap; SRS nội bộ ghi/xóa flag learning; token underline gradient 3 nhánh; i+1 + freq pill trên mọi tokenize surface (subtitle overlay, cue list, web); comprehension score giữ semantics hiện tại (tracking/learning vẫn tính nửa điểm "tracking" bucket) trừ khi spec đổi; i18n keys mới/đổi.
- **Out:** migrate IDB schema; đổi Anki sync protocol; redesign Vocabulary tab grouping (chỉ mapping nhãn nếu cần); card creator internals.
- **Non-goals:** không thêm status thứ 6; không đổi định nghĩa "sentence" (dùng `sentenceIndex` + splitter hiện có); không đổi frequency source/rank.

## Workflow

Learner xem subtitle/web có tokenize → mỗi token mang status → câu được đánh giá gap-count → nếu đúng 1 từ chưa-biết, từ đó hiện pill tần suất → learner nhìn freq quyết định "đáng học không" → lookup popup: pill cycle 3 status, badge tracking hiện nếu đang theo dõi, icon SRS mở xem thẻ nếu đang học → tạo thẻ SRS → từ chuyển `unknown+learning` → mature/xóa thẻ → `known` hoặc `unknown`. System↔system: Anki sync đọc card state → ghi learning/known; SRS nội bộ ghi learning khi tạo thẻ, xóa flag khi mất thẻ.

## Journey

### AS-IS
1. Learner thấy token có 1 trong 5 status phẳng — không phân biệt "đang học" vs "chưa biết" về mặt ngữ nghĩa.
2. Popup pill cycle qua cả 5 status — có thể set `learning` tay dù từ không có thẻ.
3. Phím 5 set learning tay → trạng thái nói dối (không thẻ SRS thật).
4. SRS nội bộ tạo thẻ nhưng không ghi status → từ có thẻ vẫn hiển thị unknown/tracking.
5. i+1 đếm mọi non-known/ignore là gap nhưng UI không phân biệt nhánh → learner không biết gap là "mới tinh" hay "đang học dở".

### TO-BE
1. Learner thấy token với underline gradient: unknown / +tracking / +learning phân biệt ngay bằng màu.
2. Câu i+1 (đúng 1 gap) → gap word hiện status + frequency pill → learner đánh giá độ phổ biến, quyết định học hay bỏ qua.
3. Popup pill chỉ cycle 3 base status; badge tracking hiển thị riêng; icon SRS mở view thẻ read-only.
4. Phím 1-4 map `unknown/known/ignore/tracking` — không còn cách nào set learning tay.
5. Tạo thẻ SRS (memory/Anki) → từ tự thành `unknown+learning`; mất thẻ → về `unknown`; mature → `known`.

## Stories

- S1: Là learner, tôi muốn phân biệt từ chưa-biết mới tinh vs đang-theo-dõi vs đang-học trên mọi tokenize surface — done khi 3 nhánh có visual riêng (gradient underline) và nhất quán subtitle/web/cue list.
- S2: Là learner, tôi muốn câu i+1 chỉ rõ từ gap kèm độ phổ biến — done khi câu đúng 1 từ chưa-biết thì từ đó hiện freq pill + status, câu khác không.
- S3: Là learner, tôi muốn trạng thái "đang học" luôn đúng với thực tế thẻ — done khi learning chỉ xuất hiện khi có SRS card và biến mất khi thẻ mất.
- S4: Là learner, tôi muốn đổi mức-biết nhanh không lẫn với trạng thái theo dõi — done khi pill/keys chỉ điều khiển 3 base status + tracking riêng.

## Risks

| Risk | Type | Impact | Team's ability to respond |
|---|---|---|---|
| Data cũ có `learning`/`tracking` không-thẻ-SRS → hiển thị flag sai thực tế | internal | medium | một lần reconcile: enum giữ nguyên, flag vẫn đọc được; SRS reconcile pass quét lại khi cần |
| Gradient underline khó đọc trên host page nền lạ | operational | medium | token color đã pin palette; gradient test trên mock + real page |
| Xóa thẻ Anki ngoài extension → flag learning lưu stale | external | low | sync pass kế tiếp sửa; chấp nhận lag 1 sync |
| Phím remap phá muscle memory user cũ | human | low | changelog + keys hint trong popup |
| `aggregatePosStatus`/sessionRecap/vocabulary group theo enum cũ đổi nhãn | internal | low | mapping table, test cũ cập nhật |

## Decision

go — model hiện tại sai semantics (engagement ngang hàng với knowledge) và cho phép trạng thái ảo (learning không thẻ); điều kiện cần (sentence segmentation + i+1 counter) đã có sẵn, diff tập trung semantics/UI/keys.

## Draft Acceptance Criteria

- [ ] Tokenize surfaces render underline gradient phân biệt `unknown` / `+tracking` / `+learning`; known/ignore không đổi visual hiện có.
- [ ] Câu đúng 1 từ chưa-biết (bất kể nhánh) → gap word hiện freq pill + status; 0 hoặc ≥2 gap → plain.
- [ ] Popup status pill cycle đúng `unknown → known → ignore`; badge tracking hiển thị khi từ mang flag; icon SRS mở view thẻ read-only.
- [ ] Keys `1/2/3/4` = `unknown/known/ignore/tracking`; không phím nào set learning.
- [ ] Tạo thẻ SRS nội bộ hoặc Anki sync thấy card → status thành `unknown+learning`; mất thẻ → `unknown`; Anki mature → `known`.
- [ ] Không migrate IDB; rows `tracking`/`learning` cũ vẫn đọc đúng semantics mới.
- [ ] `aggregatePosStatus` rank `unknown < tracking < learning < known` giữ nguyên; ignore thắng khi conflict.
