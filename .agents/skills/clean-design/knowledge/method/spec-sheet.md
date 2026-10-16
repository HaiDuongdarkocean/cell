# Method — B4 Spec Sheet

> Spec sheet = bản thiết kế đo được + test sheet. Không có spec → không bắt được lỗi khi verify.
> Nguyên tắc: mọi con số trong spec phải có **provenance** — không có con số "vì nhìn đẹp".

## Lookup chain — con số lấy từ đâu (bắt buộc theo thứ tự)

```
① tokens.json — component-token layer (dialog.padding, button.*, size-element-*)
   → có sẵn thì dùng, chấm hết. Source: `token`
② Component code thật — đo trong src/shared/ui/*.module.css
   → token layer chưa có. Source: `measured` (ghi file đo)
③ Decision ladder trong knowledge/foundations/*
   → design mới, chưa có code. Source: `decision: <luật>` (vd "tier between-groups")
```

Số không qua được chuỗi này = không được vào spec.

## Format — 3 lớp

### Lớp 1: ASCII anatomy

```
┌─────────────────────────────────────┐  ← panel: inset space-6, radius-xl
│ ┌────┐  Title          ← gap space-3│
│ │ ⚠  │  Description    ← gap space-1│
│ │40px│                              │
│ └────┘                              │
│ ─── divider ───  ← margin space-4   │
│        [Cancel] [Delete] ← gap space-3, pad-block space-3
└─────────────────────────────────────┘
```

### Lớp 2: Bảng slot

| Slot | Giá trị | Token | Source | Vì sao |
|---|---|---|---|---|
| panel inset | 24 | `--dialog-padding`→`space-6` | token | tier page-frame trong dialog |
| icon box | 40×40 | `size-element-lg` | measured (`Dialog.module.css`) | element-size ladder |
| icon | 18 | `ICON_SIZE_PX` | token | icon canon |
| icon→title | 12 | `space-3` | measured | same-group tier |
| title→desc | 4 | `space-1` | measured | same-block tier (min stack) |
| body→footer | 16 | `space-4` | measured | between-groups tier |
| footer pad-block | 12 | `space-3` | measured | nút không dính mép |
| btn↔btn | 12 | `space-3` | decision: same-group | actions cùng nhóm |
| divider | 1px hairline | `color-divider` | token | separator cấu trúc (L-BORDER ngoại lệ) |

### Lớp 3: ☐ Test sheet — asserts đo được (R-SPEC-ASSERT)

Token-có-source là điều kiện cần, **không đủ** — spec phải ghi assert hình học/typo mà reviewer đo được trên build thật:

```
[ ] Mọi số có source token/measured/decision
[ ] Ladder đọc được: icon→title(12) > title→desc(4) < body→footer(16) < inset(24)
[ ] R-UNIFORM: ∀ row trong group cùng offsetHeight; rail controls cùng height, width ≥ floor khai báo
[ ] R-HEADING-EARN: mọi group label có ≥2 items + thêm nghĩa (nêu lý do trong spec)
[ ] R-TYPO-PAIR: mỗi cặp heading/item khác ≥2 kênh (size·weight·color)
[ ] R-TIER-READABLE: dãy gap kèm ratio liền kề ≥1.5× (vd 8→16→24)
[ ] Target size: nút ≥40 visual; hit ≥40 (tách visual vs hit)
[ ] Worst-case content: email 60 chars + i18n ×1.3 không vỡ
[ ] 320 + 1280, light + dark, zoom 200%
[ ] Focus ring trên mọi interactive; Escape đóng
[ ] Trạng thái đủ: rest/hover/focus/pressed/disabled/loading
```

## Ladder check — test nhanh nhất

Viết dãy số gap theo chiều ra ngoài. Phải đọc được: **outer > inner** VÀ ratio liền kề **≥1.5×** (R-TIER-READABLE).

```
icon→title   title→desc   body→footer   panel inset
   12     >       4     <      16      <      24     ✓ đọc được cấu trúc
```

Dãy có số lạc (14, 18, 22 không trong scale) → flag: hoặc map sai token, hoặc tier hiểu sai.

## Chú ý

- **Visual size ≠ hit size** — control 40px visual vẫn phải có hit ≥40/44 (inflate bằng padding trong suốt). Spec ghi cả hai nếu khác nhau.
- **Platform constants** (status bar 44, home indicator 34) ngoại lệ hợp lệ — ghi source `platform`, không ép vào scale.
- Spec ghi "as-is" (đo component có sẵn) vs "to-be" (quyết định mới) — trộn lẫn = doc tả UI lý tưởng trong khi code khác.
