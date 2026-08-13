# Subtitle UI mockups

## Subtitle Manager redesign

Mở `subtitle-manager-redesign.html` để xem concept **Sync journey** — bản tiến hóa từ Quiet List:

- Câu chuyện: chọn track → import nếu thiếu → chỉnh cho hai dòng gặp nhau → tự lưu.
- Bỏ `Apply`: offset tự áp dụng khi input mất focus, có trạng thái `Saving…`/`Saved`.
- Đưa `Import` lên section header của đúng Target/Native group, gần object mà action tác động.
- Tách section toggle và Import thành hai button sibling, không lồng button trong button.
- Bỏ card lồng trong card; subtitle trở thành continuous list với divider.
- Active track dùng `primary-subtle` + accent rail trái, không dùng border/nền xanh nặng.
- Timing offset là một control chung vì codebase áp dụng cùng một offset cho cả Target và Native.

Mockup dùng token thật từ `src/shared/styles/tokens.css`, có dark/light và frame width 320/360/420px. Đây là phase design trước khi sửa TSX/CSS.

## Cue item redesign

> 3 biến thể cue item mới cho `CueList` (sidepanel + Player Mode).
> Xem trực tiếp: mở `cue-item-redesign.html` trong browser (dùng token thật từ `tokens.css`).

## Vấn đề hiện tại

File: `src/entrypoints/sidepanel/components/CueList.tsx` + `CueList.module.css`

- **Layout**: timestamp `display:block` ở trên, cue text ở dưới → stacked. Anh muốn timestamp trái, cue text phải.
- **Format `00:01:28.270`**: luôn `HH:MM:SS.mmm`.
  - Leading zeros che giấu độ lớn — người dùng không biết đang 1 phút hay 1 giờ.
  - Millisecond `.270` là noise kỹ thuật, persona 5-80 tuổi (đa số 10-25) không hiểu các số biểu tượng cho gì.

## Quyết định format timestamp (human-friendly)

YouTube-style adaptive — bỏ leading zeros + bỏ millis ở display (giữ nội bộ cho seek precision):

| Duration | Format | Ví dụ |
|----------|--------|-------|
| `< 1h` | `M:SS` | `1:28`, `12:03` |
| `≥ 1h` | `H:MM:SS` | `1:28:27` |

Lý do chọn:
- Mental model YouTube — persona 10-25 đã quen, không cần học lại.
- Bỏ millis: giảm noise, người dùng nhận biết độ lớn ngay.
- `font-variant-numeric: tabular-nums` + `font-family-mono`: cột timestamp căn thẳng, không "nhảy" khi số đổi.

## 3 biến thể

| Biến thể | Đặc trưng | Current cue | Ưu điểm | Trade-off |
|----------|-----------|-------------|---------|-----------|
| **A · YouTube Row** | Timestamp cột cố định căn phải + cue text phải | primary-subtle bg + thanh accent 3px trái | Quen thuộc nhất, minimal, dễ scan | Không cho sense of vị trí trong video |
| **B · Timeline Rail** | Rail dọc + dot mỗi cue | dot phình to + primary + halo | Sense of progression (hợp học ngoại ngữ — "còn bao lâu") | Tốn ~14px ngang, thêm 1 element/cue |
| **C · Compact Chip** | Timestamp là pill clickable (radius-pill) | chip thành primary solid + on-primary | Touch-friendly nhất, hit area lớn, "app-like" | Chip nổi bật hơn text, có thể gây nhiễu nếu cue ngắn |

## Token dùng (SSOT — không hardcoded)

Tất cả biến thể dùng token từ `tokens.css`:
- Text: `--color-text`, `--color-text-secondary`, `--color-primary`
- Bg: `--color-surface`, `--color-surface-hover`, `--color-primary-subtle`, `--color-primary`
- Border: `--color-border-subtle`, `--color-border`
- Radius: `--radius-pill` (chip), `--radius-card` (frame), `--radius-full` (dot)
- Type: `--font-family-mono`, `--font-size-sm`, `--font-size-xs`, `--font-size-base`, `--font-weight-semibold`
- Motion: `--transition`, `prefers-reduced-motion`

## Data-attributes giữ nguyên

Mockup giữ `data-cell-id` (`cue-timestamp`, `cue-target-text`) và `data-current` để test selector không vỡ khi implement.

## Khi implement

- Đổi `formatTimestamp` trong `CueList.tsx` → adaptive `M:SS` / `H:MM:SS` (bỏ millis display).
- Đổi `.cue` sang `display:flex` (left/right), `.timestamp` sang `flex-shrink:0` cột trái.
- Chọn 1 trong 3 biến thể (hoặc kết hợp A+C) trước khi sửa `CueList.module.css`.
- Post-code: `npm run build` + verify bằng MCP `stealth-chrome-devtools` trên YouTube test URL.
