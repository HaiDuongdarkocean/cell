# ADR-089: Iconography for "Quiet Confidence" Foundation

## Status

Proposed — awaiting build + showcase prototype before final acceptance.

## Context

Icon là ngôn ngữ thị giác. Cell đã có `ICON_CATALOG` với convention: 24×24 canvas, 1.5px stroke, round caps, round joins, currentColor, fill none. Đây là nền tảng tốt, nhưng cần củng cố thành quyết định design có lý do.

## Decision

### 1. Style: outlined, stroke-based, round, minimal

**Quyết định:** giữ style icon hiện tại:
- **Canvas**: 24×24 với 2px padding (20×20 live area).
- **Stroke**: 1.5px unified.
- **Caps/joins**: round.
- **Color**: `currentColor` (kế thừa từ text color).
- **Fill**: `none` (outline style), trừ một số icon cần fill rõ (play, pause, check, status dots).

**Lý do:**
- 1.5px stroke vừa đủ nổi trên màn hình nhỏ (popup 320px), vừa không dày gây nặng nề.
- Round caps/joins tạo cảm giác thân thiện, approachable — phù hợp "calm" và "hứng thú học tập".
- Outline style (không fill) giữ sự tinh gọn, không chói trên dense UI.
- `currentColor` giúp icon tự động đổi theo text color (primary, secondary, disabled, accent).

### 2. Size scale

| Token | Size | Usage |
|-------|------|-------|
| `--icon-size-xs` | 12px | Inline text, caption metadata |
| `--icon-size-sm` | 16px | Small buttons, labels, badges |
| `--icon-size-md` | 20px | Default icon inside buttons, inputs |
| `--icon-size-lg` | 24px | Default standalone icon, nav items |
| `--icon-size-xl` | 32px | Feature illustrations, empty state |

**Lý do:**
- 24px là default theo Material/Apple/Fluent.
- 20px phù hợp dense UI của extension (button nhỏ hơn web app).
- 16px cho inline icon trong text.

### 3. Naming convention

| Bad | Good |
|-----|------|
| `x`, `arrow-down`, `green-check` | `close`, `chevronDown`, `success` |

Semantic naming theo vai trò UI, không theo hình dạng hoặc màu. Đã có trong `AGENTS.md` và `src/shared/icons/index.ts`.

### 4. Icon + text pairing

- Icon + label: gap `space-1-5` (6px) hoặc `space-2` (8px).
- Icon-only button: min touch target 40/44px.
- Icon trong input: màu `color-text-tertiary`, hover `color-text-secondary`.

### 5. Icon set philosophy

- **Hạn chế số lượng**: không tạo icon mới nếu catalog đã có tương đương.
- **Consistency**: tất cả icon phải cùng 1 style — không mix filled + outlined.
- **Clarity over cleverness**: icon phải nhận ra ngay, không cần giải thích.

## Consequences

**Positive:**
- Giữ convention tốt hiện tại, không cần vẽ lại hết.
- Consistent icon style giúp UI gọn gàng.

**Negative:**
- Có thể cần vẽ lại vài icon cũ không tuân thủ 1.5px/round caps.

## Rejected Alternatives

| Alternative | Reason Rejected |
|-------------|-----------------|
| Filled icon style | Quá nặng, dễ gây clutter trên dense UI. |
| 2px stroke | Quá dày trên icon 16px. |
| Square caps/joins | Quá cứng, thiếu friendliness. |

## References

- `src/shared/icons/index.ts` — ICON_CATALOG convention
- [Apple SF Symbols](https://developer.apple.com/sf-symbols/)
- [Material 3 — Icons](https://m3.material.io/styles/icons/overview)
