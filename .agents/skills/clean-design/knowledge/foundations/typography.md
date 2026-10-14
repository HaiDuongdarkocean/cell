# Foundation — Typography

> Luật WHY: L-TEXT (`why/philosophy.md`). Giá trị: `tokens.json` (`static.font.sizes`, weights, leading, tracking).

## Typeface

- **Inter Variable**, self-hosted, subset Latin + Vietnamese; `font-display: swap` bắt buộc.
- Fallback: `-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif`; CJK xuống system font.
- Không CDN font trong MV3.

## Scale — vai trò, không phải giá trị

| Token | Dùng cho |
|---|---|
| `--font-size-3xs` (8) | Chỉ số cực nhỏ — KHÔNG text đọc |
| `--font-size-2xs` (10) | Rất hiếm |
| `--font-size-xs` (12) | Caption, label nhỏ, metadata — **sàn của text đọc** |
| `--font-size-sm` (14) | UI text, control, button, list row |
| `--font-size-base` | UI text mặc định |
| `--font-size-md` (16) | Long-form body — **sàn của đoạn văn** |
| `--font-size-lg` (18) → `--font-size-5xl` (40) | Title lớn → display (hiếm) |

## Semantic roles → component

Role sống trong composite `--text-*` mà `Text`/`Heading` consume. Dùng variant của `Text`/`Heading`, không tự ghép primitive khi có role.

| Role | Kích thước | Dùng |
|---|---|---|
| `body-md` | `md` (16) | Long-form paragraph |
| `body-sm` | `sm` (14) | Body ngắn trong UI |
| `body-xs` | `xs` (12) | Caption, helper — không nhỏ hơn 12 |
| `label-md` | `sm` (14) | Form/control label |
| `label-sm` | `xs` (12) | Caption label |
| `title-md` | `md` (16) | Card/section title |
| `title-sm` | `sm` (14) | List item title |
| `headline-md` | `lg`+ | Heading lớn |
| `display-*` | responsive | Marketing/empty state — dùng ít |

**Sàn cứng:** long-form ≥16 · UI/control ≥14 · caption ≥12. Không 10/11px cho text cần đọc.

## Weights

| Token | Dùng |
|---|---|
| `normal` (400) | Body |
| `medium` (500) | UI control, label, button |
| `semibold` (600) | Title, headline, emphasized |
| `bold` (700) | Rất hiếm |

Không weight 510; cần nặng hơn → `semibold` hoặc tăng size. Dark mode không gầy hơn light (halation — L-HOST).

## Line-height / tracking

| Token | Giá trị | Dùng |
|---|---|---|
| `leading-tight` | 1.2 | Headline, title |
| `leading-snug` | 1.3 | Compact UI |
| `leading-normal` | 1.5 | Body |
| `leading-relaxed` | 1.6 | Long-form |
| `tracking-tight` | −0.03em | Display/headline lớn |
| `tracking-snug` | −0.015em | Title |
| `tracking-normal` | 0 | Mặc định |
| `tracking-wide` | 0.03em | Caption/uppercase |

## Rules

- Weight phân biệt hierarchy; size hiếm khi nhảy trong cùng component.
- Mỗi vai (label/value/hint/caption) = 1 recipe xuyên suốt các màn.
- Truncation phải có strategy khai báo (ellipsis/wrap) — không để overflow đẩy sibling.
- Status/ý nghĩa qua icon+text kèm màu; hierarchy text = contrast với nền (L-TEXT), không thêm màu.
