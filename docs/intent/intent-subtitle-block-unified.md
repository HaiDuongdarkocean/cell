# Intent — Subtitle Block Unified

> Confirmed 2026-07-10. Source: interview-me session.
> Next: mockup via design-driven-development (UI surface = content-script overlay + settings panel).

## Outcome

Gộp `target` + `native` + `nav cluster` thành 1 block duy nhất.
Cluster ở góc trên-trái, target ở trên, native ở dưới.
Block có pill ở trên để kéo trục Y. Vị trí Y của block là 1 giá trị duy nhất
(không còn vị trí riêng từng thành phần).

## User

Người dùng extension xem video — trải nghiệm xem phim chủ yếu
(fullscreen + mini player).

## Why now

Hiện tại 3 thành phần tách rời, cài đặt phức tạp, vị trí rời rạc.
Gộp giúp đơn giản hóa cả UI lẫn settings.

## Success

1 block duy nhất, kéo Y, tự scale theo video, settings gọn hơn,
không break người dùng hiện tại (migrate settings cũ).

## Constraint

- Phải migrate settings cũ:
  `target.yOffsetPercent`, `native.yOffsetPercent`, `cluster.position.x/y`
  → `block.yOffsetPercent` duy nhất.
- Bỏ collapsed cluster.
- Block theo video cả fullscreen (re-parent + giữ tỷ lệ Y).

## Auto-size

```
finalSize = baseFontSize × globalScale × (sqrt(w × h) / 1000) + clamp(min, max)
```

- `baseFontSize` (px) — cỡ chữ/nút ở kích thước reference, mỗi thành phần
  chỉnh riêng (target, native, button).
- `globalScale` (0.5–2x) — slider chung.
- `REFERENCE` = 1000px (hằng số cứng).
- `sqrt(w×h) / REFERENCE` — tỷ lệ video so với chuẩn.
- Clamp min/max giữ readability (mini player không quá nhỏ, 4K không quá to).
- Ẩn tạm khi video chưa có kích thước (w=0 hoặc h=0), fade-in khi ready.
- Cập nhật qua `ResizeObserver` khi video resize/fullscreen.

## Settings layout (rearranged)

- Section "block": `bgOpacity` (áp dụng toàn div), `globalScale`, `yOffsetPercent`.
- Section "cluster": `buttonSize` (base), `buttonOpacity`, `enabled` (toggle).
- Section "target": font, color, background, visible (giữ, bỏ `yOffsetPercent`).
- Section "native": font, color, background, visible (giữ, bỏ `yOffsetPercent`).

## Behavior

- **No-sub:** Block vẫn hiển thị, cluster chỉ 3 nút (rewind/repeat/forward),
  target/native rỗng/ẩn.
- **Native off (`visible=false`):** Target không dịch lên, native đơn giản
  ẩn/hiện, vị trí Y block không nhảy.
- **Fullscreen:** Block re-parent theo video, giữ tỷ lệ Y theo container
  fullscreen.
- **Drag:** Chỉ trục Y, pill ở trên block. Block neo trái (hoặc theo canh lề
  trong settings).

## Out of scope

- Import button (giữ riêng ngoài block).
- Collapsed cluster (bỏ).
- Vị trí X/Y riêng từng thành phần (bỏ).
- 3 slider scale riêng cho từng thành phần (chỉ 1 global scale).

## Mockup decision

yes — tạo mockup trước spec (thay đổi UI lớn, cần thấy layout block +
settings panel trước khi code).
