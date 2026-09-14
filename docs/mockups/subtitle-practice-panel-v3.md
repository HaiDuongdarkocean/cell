# Mockup — Subtitle Practice Panel v3

## 1. Top action bar

### Desktop (≥360px)

```
┌─────────────────────────────────────────────┐
│ [−] [ 1.0x ] [+]  [◉] [◇] [✎] [✎] [✎] [✎]  │
└─────────────────────────────────────────────┘
         ▲
         └── nhấn mở popover
```

- Bên trái: **speed stepper** `− | 1.0x | +`, cố định, không cuộn.
- Bên phải: **mode tablist** cuộn ngang. Nếu tràn, hiện `⟨` `⟩` nằm **ngoài track**, không absolute.

### Mobile / narrow (<360px)

```
┌─────────────────────────────┐
│ [−] [1.0x] [+]  [◉] [◇] [✎] │ ← vuốt mode qua trái/phải
└─────────────────────────────┘
```

- Speed thu nhỏ vẫn là `− 1.0x +` (có thể ẩn chữ `x` nếu quá hẹp).
- Mode tabs vuốt, không mũi tên.

## 2. Speed popover (khi nhấn giá trị)

```
        [−] [ 1.0x ] [+]
              │
              ▼
   ┌────────────────────────────────┐
   │ 0.5x  [1.0x]  1.5x  2.0x ...   │
   └────────────────────────────────┘
```

- List ngang, nằm dưới speed value.
- Các option: `0.5x, 1.0x, 1.5x, 2.0x, ..., 10.0x` (step 0.5, default 1.0).
- Option đang chọn highlight (primary), các option còn lại secondary.
- Popover có background `color-surface`, border, radius `radius-pill`, shadow.

## 3. Bottom footer

```
┌─────────────────────────────────────────────┐
│ Ctrl/⌘+R Phát lại   Enter Câu tiếp          │
│ Shift+Enter Câu trước   Shift+Space Tạm dừng │
├─────────────────────────────────────────────┤
│ <    ↻    [input               ]    >       │
└─────────────────────────────────────────────┘
```

- `shortcuts` là hàng flex, wrap khi hẹp.
- `inputRow` là hàng flex: `<` `↻` `input` `>`, input `flex: 1` fill khoảng trống.

## Interaction notes

- `−` / `+` step 0.5x; clamp `[0.5, 10.0]`.
- Nhấn giá trị giữa mở popover; nhấn option chọn ngay.
- Mode tablist: `overflow-x: auto`, `scroll-snap-type: x mandatory`, mỗi tab `scroll-snap-align: start`.
- Arrow `<` `>` chỉ hiện khi track overflow; nằm ngoài track, cuộn 1 page mỗi lần nhấn.
