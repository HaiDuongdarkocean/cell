# ADR-103: Queue Lazy Dictionary Lookup

## Context

Khi người dùng nhấn **Send to Card** hoặc **Quick Add** từ subtitle overlay hoặc popup dictionary, hệ thống trước đây tokenize cả câu, lấy word status, rồi `Promise.all` lookup **toàn bộ** unknown/tracking words trước khi mở universal panel. Với khoảng 10 từ unknown, UI chỉ hiển thị trạng thái "recording" trong thời gian dài, gây cảm giác chậm và không kiểm soát được.

## Decision

Chuyển flow sang mô hình **lazy queue**:

1. Nhấn **Send to Card** / **Quick Add** → mở universal panel **ngay lập tức** với queue chứa candidate terms và status (`unknown`/`tracking`).
2. Queue **không chứa definitions** và không kích hoạt dictionary lookup.
3. Người dùng click một term trong queue → **Dictionary tab** mới lookup term đó.
4. Từ Dictionary, nút **Send to Card** đẩy lookup result sang **Card Creator** form; nút **Quick Add** đẩy kết quả với `initialAction: 'quick-add'` để Card Creator tự động submit khi dữ liệu sẵn sàng.
5. Cả subtitle overlay, popup dictionary, và integrated Dictionary đều dùng chung một kiến trúc: queue → Dictionary lookup → Card Creator/Anki.

## Consequences

- **Mở panel nhanh hơn** vì không còn `Promise.all` lookup hàng loạt.
- **Người dùng kiểm soát** term nào được lookup và gửi vào card.
- **Kiến trúc thống nhất** giữa subtitle overlay và popup dictionary.
- **Quick Add không còn batch direct add** từ popup — nó cũng đi qua queue + Dictionary.
- **E2E cũ** về queue selection cần cập nhật vì click queue item không còn điền form ngay lập tức.

## Implementation

- `buildSubtitleQueue` trong `src/features/subtitle/actions/cardActions.ts` chỉ trả về `{ term, status }[]`.
- `handlePopupCardCreatorAction` trong `src/features/dictionaryPopup/controller/webTextDictionaryController.ts` build queue từ `contextSentence`/`cue.targetText` và gọi `sendToCard(context, action, prefill)`.
- `DictionaryTab` quản lý `prefill` và `searchTerm`; `onQueueTermSelect` cập nhật `searchTerm` để `Dictionary` lookup.
- `CardCreatorPanel` nhận `initialAction` để auto-submit khi Quick Add.
- `webTextDictionaryController.sendToCard` chuẩn hóa `DictionaryPanelPrefill` với `queue`, `initialAction`, và `term` rỗng khi có queue.

## References

- `docs/specs/queue-lazy-lookup.md`
- `docs/intent/queue-lazy-lookup.md`
- `e2e/stage2/queue-lazy-lookup.spec.ts`
