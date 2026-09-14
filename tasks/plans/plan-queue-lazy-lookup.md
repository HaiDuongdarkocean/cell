# Implementation Plan: Queue Lazy Dictionary Lookup

## Overview

Chuyển flow **Send to Card** và **Quick Add** từ "bulk lookup toàn bộ unknown words trước khi mở panel" sang "mở Queue ngay lập tức, chỉ lookup khi user click từ trong Queue". Tất cả kết quả vẫn chảy qua **Dictionary → Card Creator/Anki**. Áp dụng cho cả subtitle overlay và popup dictionary.

## Architecture Decisions

1. **Lazy lookup:** Queue chỉ chứa `term` + `status`. Lookup xảy ra trong `Dictionary` component khi `initialTerm` thay đổi.
2. **`DictionaryTab` owns prefill term:** `CardCreatorPanel` báo lên `onQueueTermSelect(term)`; `DictionaryTab` cập nhật `prefill.term` để `Dictionary` lookup.
3. **Reuse `buildSubtitleQueue`:** Tách thành `buildQueueFromSentence` (term+status) và `lookupQueueTerm` (single lookup). Giữ tên `buildSubtitleQueue` cho backward compat.
4. **Popup dictionary cùng flow:** Popup `Send to Card` / `Quick Add` build queue từ `contextSentence` và gọi `sendToCard`.

## Task List

### Phase 1: Foundation — Queue without definitions
- [ ] Task 1: Tách `buildSubtitleQueue` thành queue không definitions
- [ ] Task 2: Sửa `useCardCreatorState` khởi tạo form từ queue rỗng

### Checkpoint: Foundation
- [ ] `buildSubtitleQueue` unit test pass
- [ ] Queue mở với `definitions` rỗng

### Phase 2: Queue → Dictionary hookup
- [ ] Task 3: Thêm `onQueueTermSelect` callback vào `CardCreatorPanel` + Queue UI
- [ ] Task 4: Sửa `DictionaryTab` cập nhật `prefill.term` khi chọn queue item

### Checkpoint: Core flow
- [ ] Click queue item → Dictionary lookup
- [ ] Dictionary "Send to Card" điền Card Creator form

### Phase 3: Popup dictionary + Quick Add
- [ ] Task 5: Sửa popup dictionary `sendToCard` / `quickAdd` để build queue
- [ ] Task 6: Cập nhật unit tests

### Checkpoint: Popup + tests
- [ ] Popup Send to Card / Quick Add mở Queue
- [ ] Unit tests pass

### Phase 4: E2E + Verification
- [ ] Task 7: Cập nhật E2E `card-creator-queue-select.spec.ts`
- [ ] Task 8: Chạy full verification (`typecheck`, `test:unit`, `build`)

### Checkpoint: Complete
- [ ] All acceptance criteria met
- [ ] Build clean

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| E2E cũ fail do behavior click queue item thay đổi | Med | Cập nhật E2E theo flow mới |
| `CardCreatorPanel` không còn tự điền definitions khi select | Med | Đảm bảo Dictionary lookup trước khi gửi |
| Popup dictionary Quick Add cần refactor lớn | Med | Tách queue build, dùng `sendToCard` với `initialAction: 'quick-add'` |
| Standalone dialog fallback thiếu Dictionary | Low | Ghi nhận accepted risk trong spec |

## Open Questions

- Standalone Card Creator dialog fallback (không có universal panel) chưa xử lý trong lần này.
