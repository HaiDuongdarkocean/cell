# Foundation — Motion

> Giá trị: `tokens.json` (`duration-*`, `ease-*`). Nguyên tắc: motion là feedback, không phải decoration.

## Duration

| Token | Dùng |
|---|---|
| `duration-instant` | 0 — không transition |
| `duration-100` | Micro feedback (press, check) |
| `duration-fast` (120) | Hover, small state |
| `duration-normal` (200) | Transition UI chuẩn |
| `duration-slow` (300) | Enter/exit lớn (dialog, sheet) |
| `duration-1000/1500/2000` | Animation dài — **không** cho transition UI |

## Easing

| Token | Curve | Dùng |
|---|---|---|
| `ease-default` | cubic-bezier(0.4,0,0.2,1) | Mặc định |
| `ease-out` | cubic-bezier(0,0,0.2,1) | Enter, xuất hiện |
| `ease-spring` | cubic-bezier(0.175,0.885,0.32,1.275) | Playful pop — dùng có chủ đích |

## Rules

- Animate **transform / opacity / color** only — không width/height/top/left (layout jank).
- Direction khớp intent: mở = chevron xoay / nội dung mọc, không phải recolor.
- `prefers-reduced-motion`: global reset trong `tokens.css` về 0.01ms — không override; thông tin không bao giờ chỉ mang bởi animation.
- Press/hover/ripple không đổi geometry: `overflow: clip` không phải `hidden` (hidden trên flex/grid child zero min-size → row collapse); ripple/wash render **dưới** text (`isolation:isolate` + pseudo `z-index:-1`).
