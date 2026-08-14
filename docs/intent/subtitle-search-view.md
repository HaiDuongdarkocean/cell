# Intent — Subtitle Search View (tách khỏi main panel)

> Confirmed 2026-08-13. Source: interview-me session.

## Outcome

Search subtitle là **view riêng** chiếm toàn bộ panel (như Customize appearance), có nút Back/Apply để quay main view. Không nằm chung với Target/Native sections.

## User

Người xem phim muốn tìm subtitle phù hợp từ SubDL/OpenSubtitles, xem trước nội dung, load lên overlay để kiểm tra khớp với video.

## Flow

1. **Main view** có nút vào search (giống "Customize appearance" ở footer)
2. **Search view**: form + results + preview cues — toàn bộ panel, Target/Native/footer ẩn
3. Bấm **"Load as Target"** / **"Load as Native"** → subtitle load **ngay lên overlay** (user xem trên video có khớp không), view search **không đóng**
4. User chọn cả target + native, xem khớp trên video
5. Bấm **Apply** / **Back** / **đóng popup (X)** → commit (đóng search view, quay main view, subtitle đã load giữ nguyên)

## Persistence

**Session-only** — subtitle đã load hiện trong danh sách track (Target/Native) với tag nguồn (opensubtitles/subdl), đóng trang thì mất. Không persist vào settings.

## Apply = Back = đóng popup

Cùng 1 hành động: đóng search view, quay main view. Subtitle đã load lên overlay rồi thì giữ nguyên. Không có uncommitted state, không confirm dialog.

## Out of scope

- Persist subtitle choice vào settings cho lần sau
- Auto-search theo video title
- Download subtitle file về máy
