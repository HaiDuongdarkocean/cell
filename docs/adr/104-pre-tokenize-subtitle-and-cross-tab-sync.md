# ADR-104: Pre-tokenize Subtitle and Cross-Tab Word-Status Sync

## Context

Người dùng muốn mở subtitle panel mà không thấy tokenize "nhấp nháy" và không phải chờ từng câu được tokenize khi tua. Hơn nữa, khi mở hai tab cùng video, đánh dấu từ ở tab A phải tự động đổi màu ở tab B.

Trước đây `subtitleTokenizeController` chỉ tokenize 1–2 câu quanh câu đang phát. `CueList` tự tạo token map rồi mới resolve metadata sau → panel hiện tokens không màu trước, rồi đổi sang có màu. Cross-tab thì mỗi tab tự lấy metadata, status thay đổi ở tab này không báo tab kia.

## Decision

1. **Pre-tokenize toàn bộ subtitle video theo tầng ưu tiên.**
   - Tạo `VideoTokenMap` là SSOT trong mỗi tab.
   - `VideoTokenPreloader` dùng `TokenizeScheduler` để tokenize dần: viewport trước (rAF 16ms), buffer tiếp theo, idle xử lý còn lại.
   - Metadata (status + frequency) tra theo chunk nhỏ (100–200 terms), tránh message quá lớn.

2. **Không share toàn bộ token map giữa các tab.**
   - Mỗi tab tự tokenize text — rẻ và không phụ thuộc storage.
   - Chỉ share **term-level metadata** qua background IndexedDB và broadcast.

3. **Cross-tab word-status sync qua background broadcast.**
   - Thêm message `WORD_STATUS_CHANGED` (bg→cs).
   - Background lưu xong thì gửi `WORD_STATUS_CHANGED` đến các tab khác.
   - Content script nhận và áp dụng vào `VideoTokenMap` của tab đó.

4. **Panel và overlay subscribe map thay vì tự tính.**
   - `CueList` giữ nguyên cơ chế cũ cho phiên bản này nhưng overlay rebind khi map emit update.
   - `subtitleTokenizeController` bind active cue và rebind khi metadata/status đổi.

## Consequences

- **Panel mở ra gần như có sẵn tokens đã màu**, không còn nhấp nháy rõ.
- **Máy yếu vẫn mượt** nhờ viewport-first + idle chunking.
- **Hai tab cùng video đồng bộ status real-time** mà không cần reload.
- **Tốn thêm một chút RAM/CPU ở tab nền** vì mỗi tab tự tokenize; đã giảm bằng scheduler + pause/resume.
- **Không lưu toàn bộ map** nên tab mở sau vẫn phải tính lại, nhưng metadata lấy từ kho chung nhanh.

## Implementation

- `src/features/tokenize/logic/videoTokenMap.ts` — map cue → tokens, term → cues, emit updates.
- `src/features/tokenize/logic/videoTokenPreloader.ts` — scheduler-driven incremental tokenization + chunked metadata.
- `src/features/tokenize/controller/subtitleTokenizeController.ts` — bind active cue, rebind on update, apply cross-tab events.
- `src/entrypoints/background/handlers/wordStatus.ts` — `WORD_STATUS_CHANGED` broadcast.
- `src/features/dictionary/services/wordStatusCrossTab.ts` — content script listener.
- `src/entrypoints/content/content-script.ts` — register cross-tab listener.
- Message contract: `src/shared/config/messages.ts`, `src/entities/message/types.ts`, `src/entities/message/dictionarySchemas.ts`, `src/entities/message/registry.ts`.

## References

- `docs/specs/pre-tokenize-subtitle.md`
- `tasks/plan-pre-tokenize-subtitle.md`
