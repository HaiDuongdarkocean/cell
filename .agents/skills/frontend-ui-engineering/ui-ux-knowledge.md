# Responsive Design

## Ideal Screen Size

Design Mobile-First

- Good: Bắt đầu từ màn hình nhỏ (320px → 480px → 768px → 1024px → 1280px), đảm bảo tính tối ưu cho người dùng di động trước -> màn hình to.

- Bad: Thiết kế cho màn hình lớn trước rồi thu nhỏ xuống mobile (1280px → 1024px → 768px → 480px → 320px), dễ gây lỗi hiển thị.

Responsive in Web Design Know Your Breakpoints

- Good: 320px, 480px, 768px, 1024px, 1280px.

- Bad: Không đặt breakpoint hợp lý khiến layout bị méo mó khi hiển thị trên các thiết bị khác nhau.

Create Fluid Designs

- Good: Sử dụng đơn vị % và max-width để layout co giãn linh hoạt theo viewport.

- Bad: Dùng fixed layout (px cố định) khiến nội dung bị bó cứng, dễ vỡ khi chuyển sang màn hình khác.

Decrease Friction

- Good: Thiết kế đơn giản, dễ thao tác trên màn hình nhỏ; các thành phần UI được sắp xếp gọn gàng để tránh chồng chéo.

câu hỏi: tiêu chuẩn nào là sắp xếp gọn gàng khi thiết kế giao diện hệ thống từ mobile -> desktop?

- Bad: Nhồi nhét quá nhiều yếu tố trên màn hình nhỏ, gây khó khăn cho người dùng khi thao tác.

More Functionality, Less Typing

- Good: Tận dụng tính năng thiết bị như GPS, QR code, biometrics; thêm nút gọi, email, chia sẻ để giảm thao tác nhập liệu.

- Bad: Bắt buộc người dùng nhập nhiều thông tin trên mobile, gây bất tiện và dễ bỏ cuộc.

Use Meta Viewport Tag

- Good: Thêm <meta name="viewport" content="width=device-width, initial-scale=1.0"> để trang web tự động điều chỉnh theo kích thước màn hình thiết bị.

- Bad: Bỏ qua thẻ viewport khiến trang hiển thị sai tỷ lệ trên mobile, phải zoom thủ công.

Apply Flexible Grid Layouts

- Good: Dùng CSS Grid hoặc Flexbox với đơn vị phần trăm (%) để layout co giãn linh hoạt.

- Bad: Dùng fixed width (px) cho toàn bộ layout, gây vỡ giao diện trên màn hình nhỏ.

Use Relative Units for Text and Elements

- Good: Áp dụng em, rem, % thay vì px để font chữ và thành phần UI tự động điều chỉnh.

- Bad: Cố định font-size bằng px khiến chữ quá to hoặc quá nhỏ trên các thiết bị khác nhau.

Optimize Images for Responsiveness

- Good: Dùng max-width: 100% và height: auto để hình ảnh co giãn theo container.

- Bad: Đặt kích thước ảnh cố định, khiến ảnh tràn ra ngoài màn hình nhỏ.

Test Across Devices and Browsers

- Good: Kiểm tra trên nhiều thiết bị (mobile, tablet, desktop) và trình duyệt để đảm bảo tính nhất quán.

- Bad: Chỉ test trên một màn hình lớn, bỏ qua trải nghiệm thực tế của người dùng di động.

## Button & Touch Target Size (WCAG + Material + Apple HIG)

### Tiêu chuẩn quốc tế

| Standard | Min Size | Level | Unit |
|----------|----------|-------|------|
| WCAG 2.5.8 | 24×24 CSS px | AA (bắt buộc) | CSS px |
| WCAG 2.5.5 | 44×44 CSS px | AAA (khuyến nghị) | CSS px |
| Apple HIG | 44×44 pt | Platform guideline | pt |
| Material Design 2 | 36dp visual / 48dp touch | Platform guideline | dp |
| Material Design 3 | 40dp visual / 48dp touch | Platform guideline | dp |

### Nguyên tắc cốt lõi

- Touch target ≠ visual size: touch target là toàn bộ hit area (bao gồm padding), không phải kích thước nhìn thấy. Icon 20px + padding 12px mỗi bên = touch target 44×44px → pass.
- Fitts's Law: target càng lớn, thời gian hit càng giảm, lỗi tap sai giảm cho tất cả users.
- Vị trí trên màn hình (Steven Hoober, Touch Design for Mobile Interfaces):
  - Top edge: 11mm (~42px) — khó hit nhất.
  - Bottom edge: 12mm (~46px) — khó hit nhất (thumb reach).
  - Center: 7mm (~27px) — hit dễ nhất.
- Spacing: nếu target < 44px, cần ≥ 24px clear space giữa các interactive elements liền kề.
- Desktop cho phép giảm vì mouse/trackpad có độ chính xác cao hơn finger (Material Design: "When mouse and keyboard are the primary input methods, button measurements can be slightly reduced").

### Áp dụng theo breakpoints

#### Viewport-based (media queries — cho full-page UI)

| Breakpoint | Device | Visual height | Touch target | Min width | Padding mỗi bên |
|------------|--------|---------------|--------------|-----------|-----------------|
| 320–479px | Phone portrait | 36–40px | 48×48px | 88px | 12px |
| 480–767px | Phone landscape / phablet | 36–40px | 48×48px | 88px | 12px |
| 768–1023px | Tablet portrait | 36–40px | 44×44px | 88px | 10px |
| 1024–1279px | Tablet landscape / small laptop | 32–36px | 40×40px | 80px | 8px |
| ≥1280px | Desktop | 32–36px | 40×40px | 64px | 8px |

#### Container-based (container queries — cho popup/overlay UI)

Popup dictionary dùng container queries (popup width = container width). 4 tiers:

| Container tier | Popup width | Maps to | Touch target | Button visual | Base font |
|---------------|-------------|---------|--------------|---------------|-----------|
| compact | <380px | Phone portrait | 44px (--touch-target-mobile) | 44px | 14px (--font-size-base) |
| narrow | 380–479px | Phone landscape | 44px (--touch-target-mobile) | 44px | 14px |
| default | 480–767px | Tablet | 44px (--touch-target-mobile) | 44px | 15px (--font-size-md) |
| wide | ≥768px | Desktop | 40px (--touch-target-desktop) | 40px | 16px (--font-size-lg) |

> Popup dùng 44px (không 48px) vì popup là overlay density-tight — 44px vẫn pass WCAG AAA. Tokens: `--touch-target-mobile: 44px`, `--touch-target-desktop: 40px` trong tokens.json.

## Font Size (Typography Scale)

### Nguyên tắc cốt lõi

- Body text minimum: 16px (1rem) — browser default, proven floor cho readable text.
- Sweet spot: 16–18px cho body. Trên 20px bắt đầu feel oversized trên desktop.
- Dùng rem (không px) — respects user's browser font-size setting, satisfies WCAG 1.4.4 (Resize Text 200%).
- Type scale ratio: nhân base lên theo ratio nhất quán:
  - 1.2 (minor third) — dense dashboard UI.
  - 1.25 (major third) — content sites (khuyến nghị mặc định).
  - 1.333 (perfect fourth) — strong headline contrast.
- Fluid typography với clamp(MIN, PREFERRED, MAX) — scale mượt giữa breakpoints, không jump.
- Line height: tight 1.1 (headings), normal 1.5 (body mobile), relaxed 1.625 (body desktop).
- Max line length: 45–65ch (mobile), 65–80ch (tablet/desktop) — readability tối ưu.

### Type Scale (ratio 1.25, base 16px)

| Element | rem | px (320–767) | px (768–1279) | px (≥1280) |
|---------|-----|--------------|---------------|------------|
| H1 | 2.44rem | ~31px | ~36px | ~39px |
| H2 | 1.95rem | ~25px | ~28px | ~31px |
| H3 | 1.56rem | ~22px | ~24px | ~25px |
| H4 / lead | 1.25rem | ~18px | ~19px | ~20px |
| Body | 1rem | 16px | 17px | 18px |
| Small / caption | 0.875rem | 14px | 14px | 14px |
| Button text | 0.875rem | 14px | 14px | 15px |

### Áp dụng theo breakpoints

| Breakpoint | Base font | Ratio | Line height | Max line length |
|------------|-----------|-------|-------------|-----------------|
| 320–479px | 16px (1rem) | 1.2 | 1.5 | 45–65ch |
| 480–767px | 16px (1rem) | 1.2 | 1.5 | 45–65ch |
| 768–1023px | 17px (1.0625rem) | 1.25 | 1.6 | 65–75ch |
| 1024–1279px | 17px (1.0625rem) | 1.25 | 1.6 | 65–80ch |
| ≥1280px | 18px (1.125rem) | 1.333 | 1.625 | 65–80ch |

> Tại sao ratio tăng trên desktop? Màn hình lớn có nhiều không gian → headings cần contrast mạnh hơn với body. Trên mobile, ít elements cạnh tranh → ratio nhỏ hơn giữ hierarchy subtle.

### Nguồn

- WCAG 2.5.8 Target Size (Minimum) — 24×24 CSS px (AA)
- WCAG 2.5.5 Target Size (Enhanced) — 44×44 CSS px (AAA)
- Apple HIG — Buttons — 44×44 pt
- Material Design 2 — Buttons — 36dp visual / 48dp touch
- Smashing Magazine — Accessible Target Sizes (Steven Hoober: 11mm top, 12mm bottom, 7mm center)
- Madegood Designs — Web Font Size Guide (16px minimum, type scale 1.25)
- Modern CSS Tools — Fluid Typography with clamp() (clamp(MIN, PREFERRED, MAX) pattern)
- DeveloperUX — Best Practices for Responsive Typography (rem + clamp + modular scale)

## Footer & Navigation Bar Design (ZaloPay / iOS HIG / Material 3)

### Specs reference

| Spec | Height | Icon | Label | Gap icon→label |
|------|--------|------|-------|----------------|
| iOS HIG UITabBar | 49pt (regular), 32pt (compact landscape) | 25×25pt regular, 18×18pt compact | SF 10pt Medium | tight |
| Material 3 NavigationBar | 80px default, 64px compact, 96px comfortable (incl. safe-area) | 24px | label-medium | 4dp (IndicatorToLabelPadding) |
| Material 3 NavigationBarItem | — | 24px | — | item horizontal padding 8dp |

### Nguyên tắc cốt lõi

1. **Footer height = content height** — KHÔNG thêm padding container top/bottom. Để button atom tự quyết định padding nội bộ. Padding container tạo khoảng trống giữa button và separator, mất cảm giác "dính" vào footer.

2. **Button variant: ghost, không outline** — Navigation/footer button dùng ghost (transparent, no border). Outline tạo "card feel" — button trông như object nổi, không phải nav slot. ZaloPay/iOS/Material 3 đều không border quanh nav item. Exception: primary action (CTA) dùng primarySubtle (bold text, no bg) hoặc primary (filled) — vẫn không outline.

3. **Button flat — không bo góc** — Footer nav button `border-radius: var(--radius-none)` ở MỌI breakpoint, kể cả desktop. Bo góc tạo khoảng trống视觉 giữa buttons, phá edge-to-edge continuity. iOS UITabBar + Material 3 NavigationBar đều flat.

4. **Label luôn hiển thị** — KHÔNG ẩn label bằng media query `display: none` ở màn hình nhỏ. Icon-only button mất accessibility — screen reader + user không nhận biết function. iOS HIG + Material 3 require label cho navigation item. Nếu footer quá cao, giảm padding/icon size thay vì ẩn label.

5. **Label font-weight regular (400)** — Navigation/footer label mặc định regular, không in đậm. Nếu mọi button đều bold, không có hierarchy — primary action không nổi bật. Bold dành cho PRIMARY action only (filled button, CTA, featured nav). Medium (500) dành cho data/metadata.

6. **Separator: shadow nhẹ thay border cứng** — Separator giữa footer/body dùng `box-shadow` hướng lên (upward) thay `border-top`. Shadow tản dần tạo gradient → chuyển tiếp mềm. Border là đường gạch rõ ràng — "cắt" visual. Pattern: `box-shadow: 0 calc(-1 * var(--space-0-5)) var(--space-1) calc(-1 * var(--space-0-5)) var(--color-border)`.

7. **Giá trị 0 phải dùng token** — `gap: 0`, `padding: 0`, `border-radius: 0` phải dùng `var(--space-0)`, `var(--radius-none)`. Hardcode `0` là convention violation — phá SSOT, review audit bắt cùng loại với `padding: 16px` hardcoded.

### Mobile-first padding compact specs

| Region | Mobile (≤479px) | Desktop (≥480px) | Spec reference |
|--------|-----------------|-------------------|----------------|
| Header/nav bar | 40-44px | 44-48px | HIG nav bar 44pt |
| Tab trigger | 36px | 40px | M3 compact |
| Tab content padding | 4px 8px | 8px 12px | — |
| List row (two-line) | 56-64px | 64-72px | M3 two-line 72px |
| List gap | 2px | 4px | compact |
| Footer/tab bar | 49-50px | 50-56px | HIG tab bar 49pt |
| Touch target | 44px minimum | 44px minimum | WCAG AAA |

### Anti-patterns

| Sai | Đúng | Lý do |
|-----|------|-------|
| Footer padding 20px top + 22px bottom | Footer padding 0 — height = button content | 42px lãng phí trên mobile |
| Footer button `variant="outline"` | Footer button `variant="ghost"` | Outline = card feel, không phải nav slot |
| Footer button `border-radius: pill` desktop | Footer button `border-radius: none` mọi breakpoint | Bo góc phá edge-to-edge |
| `@media (max-width: 359px) { .label { display: none } }` | Label luôn hiển thị | Mất accessibility + affordance |
| Label `font-weight: medium (500)` | Label `font-weight: regular (400)` | Bold = visual noise, mất hierarchy |
| `border-top: 1px solid var(--color-border)` | `box-shadow: 0 -2px 4px -2px var(--color-border)` | Border cứng, shadow mềm |
| `gap: 0`, `padding: 0` | `gap: var(--space-0)`, `padding: var(--space-0)` | Hardcode 0 = convention violation |

### Guard

- Footer CSS không có `padding` top/bottom (chỉ `padding: var(--space-0)`)
- Footer button không có `border-radius` khác `var(--radius-none)`
- Footer CSS không có `border-top` — dùng `box-shadow` upward
- Không có media query `display: none` cho label
- Button label `font-weight: var(--font-weight-regular)` (không medium/bold)
- Không có giá trị `0` hardcoded — dùng token

### Loop back

- Vision-reader screenshot → estimate footer height → so sánh với spec 49-50px mobile
- Grep CSS: `padding: 0`, `gap: 0`, `border-radius: 0`, `border-top` trong footer → refactor
- Grep `font-weight` trong footer button → verify regular

### Nguồn

- Apple Human Interface Guidelines — Tab Bars (UITabBar 49pt, icon 25×25pt, label SF 10pt)
- Material 3 — NavigationBar specs (80px height, 24px icon, 4dp gap, 8dp item padding)
- Material 3 — NavigationBarItem (alwaysShowLabel, active item always shows label)
- ZaloPay footer pattern (5 evenly divided slots, icon-on-top, pale-blue active, flat white bg, no dividers)
- WCAG 2.5.5 Target Size (Enhanced) — 44×44 CSS px (AAA)