# ADR-085: Typography System for "Quiet Confidence" Foundation

## Status

Accepted — build verification passed; foundation tokens shipped in tokens.css.

## Context

Typography là công cụ hierarchy và readability. Cell hiện dùng `Figtree` với scale `4xs → 5xl` và leading/tracking cơ bản. Vấn đề:
- Scale dùng tên `4xs`, `3xs`, `2xs` không có semantic meaning — dev phải đoán dùng `2xl` hay `3xl` cho heading.
- Không có phân biệt display/body/label rõ ràng.
- Tracking không được điều chỉnh theo size — display quá lỏng, caption quá chặt.
- Không có `font-feature-settings` để tạo bản sắc.

Brand cần: **calm, focused, learnable, đơn giản, thanh lịch**. Typography phải "quiet" — đọc được lâu không mệt, hierarchy rõ ràng mà không hét.

## Decision

### 1. Typeface: Inter Variable làm primary, system font stack làm fallback

**Quyết định:** dùng `Inter` làm primary typeface, fallback `SF Pro Text`, `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `Roboto`, `sans-serif`.

**Lý do:**
- Inter được thiết kế cho màn hình máy tính, x-height cao, giúp đọc text nhỏ và mixed-case tốt hơn ([rsms.me/inter](https://rsms.me/inter/)).
- Inter là variable font, hỗ trợ weight tùy ý trong range 100-900; nhưng Cell chỉ dùng 4 weight chuẩn (400, 500, 600, 700). Weight 510 đã thử nghiệm nhưng bị loại để giữ bộ font file đơn giản và type scale rõ ràng.
- Inter đã được Figma, GitLab, NASA, Unity, và nhiều productivity tools dùng — chứng minh độ ổn định.
- Figtree (hiện tại) có vẻ "light-hearted" quá, gần với consumer app hơn là "focused learning tool".
- Geist (Vercel) quá "developer tool / Swiss minimal", không có sự ấm áp cần cho app học ngôn ngữ.

**Rejected:**
- **Figtree**: friendly nhưng thiếu engineered feel, display sizes mềm hơn cần.
- **Geist**: quá lạnh, quá dev-centric.
- **Custom font**: tốn kém, tải chậm, không cần thiết cho MVP foundation.

### 2. 5 text roles theo Material 3 + Apple HIG

Dùng 5 roles: **Display, Headline, Title, Body, Label**. Mỗi role có các size. Giúp designer/dev chọn đúng mục đích.

| Role | Mục đích | Ví dụ trong Cell |
|------|----------|------------------|
| Display | Hero, marketing, lớn nhất | Landing page, empty state headline |
| Headline | Section title, page title | "Settings", "Subtitle Manager" |
| Title | Card title, dialog title, list group | Card header, dialog header |
| Body | Paragraph, description, main content | Settings description, subtitle text |
| Label | Button, input, caption, metadata | Button text, caption, tab label |

Tham khảo:
- Material 3: 5 type roles — display, headline, title, body, label ([nguồn](https://m3.material.io/styles/typography/overview)).
- Apple HIG: `largeTitle`, `title`, `headline`, `body`, `callout`, `footnote`, `caption` ([nguồn](https://blakecrosley.com/blog/sf-pro-typography-system)).

### 3. Type scale — 14px UI base, 16px long-form body

Các giá trị dưới đây là mục tiêu; SSOT chi tiết là `tokens.json` `static.font.sizes` và `composite`.

| Role | Size | Weight | Line Height | Tracking | Usage |
|------|------|--------|-------------|----------|-------|
| `display-3xl` | 56px | 600 | 1.05 | -0.03em | Rare hero |
| `display-2xl` | 40px | 600 | 1.10 | -0.03em | Page hero |
| `display-xl` | 32px | 600 | 1.15 | -0.03em | Dialog title large |
| `headline-lg` | 28px | 600 | 1.20 | -0.015em | Page title |
| `headline-md` | 24px | 600 | 1.25 | -0.015em | Section title |
| `headline-sm` | 20px | 600 | 1.30 | -0.015em | Sub-section |
| `title-lg` | 18px | 500 | 1.35 | 0 | Card title |
| `title-md` | 16px | 500 | 1.35 | 0 | List group header |
| `title-sm` | 14px | 500 | 1.35 | 0 | Metadata title |
| `body-lg` | 18px | 400 | 1.55 | 0 | Lead paragraph |
| `body-md` | 16px | 400 | 1.50 | 0 | Default long-form body |
| `body-sm` | 14px | 400 | 1.50 | 0 | Secondary body |
| `body-xs` | 12px | 400 | 1.50 | 0 | Caption body (tối thiểu 12px) |
| `label-lg` | 16px | 500 | 1.25 | 0 | Large button |
| `label-md` | 14px | 500 | 1.20 | 0 | Default button, tab |
| `label-sm` | 12px | 500 | 1.20 | 0.03em | Small button, badge |
| `label-xs` | 12px | 500 | 1.20 | 0.03em | Caption, tag (không nhỏ hơn 12px) |

**Nguyên lý:**
- `body-md` (long-form body) phải là 16px.
- UI/control text mặc định là 14px (`--font-size-sm` hoặc `--font-size-base`).
- Caption/metadata tối thiểu 12px; không dùng 11px/10px cho text cần đọc.
- Display càng lớn, tracking âm càng nhiều — tạo sự chặt chẽ.
- Body giữ tracking gần 0 để đọc dài.
- Line-height body 1.5 là chuẩn WCAG readability.

### 4. Font stack & loading

```css
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
--font-mono: 'SF Mono', 'SFMono-Regular', ui-monospace, Menlo, Consolas, monospace;
```

- Primary: **Inter Variable**, self-hosted trong `public/fonts/`, subset Latin + Vietnamese.
- `font-display: swap` bắt buộc.
- Không dùng Google Fonts CDN trong MV3 vì CSP.
- System font stack là fallback cho CJK và khi Inter chưa load.

### 5. OpenType features (optional, apply khi có font tự host)

Linear dùng `cv01` (single-story 'a') và `ss03` (geometric alternates) để biến Inter thành "technical instrument" ([nguồn](https://github.com/soulcore-dev/soul-design-md/blob/main/designs/linear/DESIGN.md)).

Với Cell, đề xuất giữ mặc định Inter trước. Khi cần "geometric feel" hơn, enable:
```css
font-feature-settings: "cv01" 1, "ss03" 1;
```

### 6. Dynamic Type / accessibility

Hỗ trợ user font-size preferences bằng `rem` unit. Base `1rem = 16px`. Type scale dùng `rem` hoặc `px`? Vì extension UI nhỏ, dùng `px` cho predictability, nhưng vẫn có thể scale bằng `calc()` hoặc `rem` nếu cần a11y.

**Quyết định:** Dùng `px` cho font-size trong tokens để giữ pixel-perfect trên màn hình nhỏ, nhưng expose `rem` variants hoặc support `font-size` base scaling qua `html { font-size: var(--font-size-base) }`.

## Consequences

**Positive:**
- Clearer hierarchy: display/headline/title/body/label rõ vai trò.
- Better readability: x-height cao, line-height 1.5, tracking điều chỉnh theo size.
- More "engineered" feel với negative tracking display + weight 500 labels.
- Inter free, open source, wide language support.

**Negative / Risks:**
- Cần tải Inter vào bundle hoặc public/fonts.
- Component cũ dùng `font-size: var(--font-size-2xl)` phải map sang style mới.

## Rejected Alternatives

| Alternative | Reason Rejected |
|-------------|-----------------|
| Giữ Figtree | Quá friendly/consumer, thiếu engineered feel cho productivity/learning tool. |
| Dùng Geist | Quá lạnh/dev-centric, không phù hợp "hứng thú học tập". |
| Dùng custom font | Tải chậm, license phức tạp, không cần thiết. |
| Giữ scale `4xs → 5xl` | Thiếu semantic, khó mapping vai trò. |

## References

- [Inter — rsms.me](https://rsms.me/inter/)
- [Figtree — Google Fonts](https://fonts.google.com/specimen/Figtree)
- [Geist — Vercel](https://vercel.com/font)
- [Linear Typography — getdesign.md](https://getdesign.md/design-md/linear.app/preview)
- [Apple HIG — Typography](https://developer.apple.com/design/human-interface-guidelines/typography/)
- [SF Pro Typography — blakecrosley.com](https://blakecrosley.com/blog/sf-pro-typography-system)
- [Material 3 Typography](https://m3.material.io/styles/typography/overview)
