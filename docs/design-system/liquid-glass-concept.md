# Liquid Glass Concept — Cell Design Language

> Tuyên ngôn cảm hứng thiết kế giao diện Cell theo ngôn ngữ **Liquid Glass**.
> Nguồn: phân tích 29 ảnh reference (ShareX 2026-08) + phụ đề WWDC session *"Liquid Glass"* (`api_-_timedtext.en.srt`).
> Áp dụng: toàn bộ trang web / extension Cell, bắt đầu từ design-system showcase sau đó tích hợp vào popup / sidepanel / options.

---

## 1. Manifesto

Cell sinh ra từ nước, lớn lên dưới ánh mặt trời, và lấy màu từ bầu trời xanh, tán lá xanh, sỏi xám, đất nâu, nước trong suốt.  
**Liquid Glass** là cách chúng ta kể câu chuyện đó trên giao diện: những lớp kính lỏng trong suốt, mềm mại, phản chiếu ánh sáng, phản ứng với cảm ứng, và luôn để nội dung của người dùng chiếm trung tâm.

Không phải glassmorphism 3D cổ điển. Không phải Material Design.  
Đây là **meta-material kỹ thuật số**: một lớp vật liệu số bẻ cong, gom và phân tán ánh sáng theo thời gian thực — để người dùng cảm nhận được chiều sâu, sự nhẹ nhàng, và phản hồi tức thì.

---

## 2. Core Principles (nguyên lý cốt lõi)

| # | Principle | Mô tả |
|---|---|---|
| P1 | **Lensing — kính lúp ánh sáng** | UI bẻ cong ánh sáng, tạo caustic highlight ở rìa, cho phép nội dung bên dưới lấp lánh qua. Không che phủ, mà làm nổi bật. |
| P2 | **Organic form — hình thái hữu cơ** | Toàn bộ góc cạnh là bo tròn sâu (pill, circle, squircle). Không góc vuông. Hình dạng liên quan đến ngón tay, động tác chạm. |
| P3 | **Floating layer — lớp nổi phía trên nội dung** | Navigation, controls, modals, sheets nổi trên content layer bằng blur + shadow mềm. Glass không nằm trong content list. |
| P4 | **Light responsivity — phản ứng theo ánh sáng** | Rìa sáng, bóng, saturation và độ tối của glass thay đổi theo nền phía sau và độ sáng theme. |
| P5 | **Touch alive — sống khi chạm** | Nhấn, kéo, trượt khiến glass co giãn, phát sáng từ điểm chạm, lan ra xung quanh, rồi trở lại trạng thái nghỉ êm ả. |
| P6 | **Content-first — nội dung là trung tâm** | Glass chỉ dùng cho navigation/control layer. Không dùng glass trên glass, không làm mờ nội dung quá mức. |
| P7 | **Nature palette — bảng màu thiên nhiên** | Xanh dương bầu trời, xanh lá, xám sỏi, nâu đất, vàng mặt trời — pha trộn qua transparent layer, không dùng màu bão hòa rời rạc. |

---

## 3. Từ tuyên ngôn Apple Liquid Glass — rút gọn

Từ phụ đề WWDC session:

> *"Liquid Glass is a new digital meta-material that dynamically bends and shapes light... behaves and moves organically in a manner that feels more like a lightweight liquid, responding to both the fluidity of touch and the dynamism of modern apps."*

> *"Instead of fading, Liquid Glass objects materialize in and out by gradually modulating the light bending and lensing."*

> *"From its foundation, both the visuals AND motion of Liquid Glass were designed as one."*

> *"It is best reserved for the navigation layer that floats above the content of your app."*

> *"Avoid glass on glass. Stacking Liquid Glass elements on top of each other can quickly make the interface feel cluttered and confusing."*

> *"Regular vs Clear: Regular is the most versatile — adaptive, legible everywhere. Clear is permanently more transparent and needs a dimming layer; only use over media-rich content, with bold/bright content on top."*

> *"As text scrolls underneath, shadows become more prominent to create additional separation. The amount of tint and the dynamic range shift to always ensure buttons remain legible."*

> *"Reduced Transparency makes Liquid Glass frostier. Increased Contrast makes elements predominantly black or white. Reduced Motion disables elastic properties."*

---

## 4. Palette — Bảng màu Cell Liquid Glass

Cell đã có hệ token glass. Chúng ta tận dụng và mở rộng, không tạo mới tùy tiện.

### 4.1 Màu nền & môi trường (environment)

| Cảm hứng tự nhiên | Token hiện có | Ý nghĩa |
|---|---|---|
| Bầu trời xanh nhạt | `--color-primary` / `--color-tint-blue-*` | Màu chủ đạo, glow, hover |
| Tán lá xanh | `--color-leaf` / `--color-tint-green-*` | Success, positive feedback |
| Nước trong suốt | `--color-water` / `--color-glass-surface` | Glass surface, blur layer |
| Sỏi xám | `--color-pebble` / `--color-text-secondary` | Muted text, secondary chrome |
| Đất nâu | `--color-earth` / `--color-tint-orange-*` | Warning, warm accent |
| Mặt trời vàng | `--color-sun` / `--color-tint-yellow-*` | Shimmer, highlight, active glow |

### 4.2 Glass variants

| Variant | Light mode | Dark mode | Khi nào dùng |
|---|---|---|---|
| **Regular** | `var(--color-glass-surface)` `rgba(255,255,255,0.85)` | `rgba(24,25,26,0.85)` | Mặc định cho nav, controls, buttons. Adaptive, legible. |
| **Regular hover** | `var(--color-glass-surface-hover)` | `rgba(34,35,37,0.92)` | Hover / selected. |
| **Clear** | `color-mix(in srgb, var(--color-glass-surface) 42%, transparent)` | tương tự với dark | Trên media/video/photo, khi nội dung dưới cần lộ rõ. Cần dimming layer. |
| **Popover/Sheet** | `var(--color-glass-surface-popover)` | `rgba(24,25,26,0.95)` | Modal, bottom sheet, menu bubble. Độ đục cao hơn để đọc text. |

### 4.3 Caustic & specular

| Tác dụng | Token hiện có | Ghi chú |
|---|---|---|
| Rìa sáng trên cùng trái | `--color-button-liquid-specular` `rgba(255,255,255,0.65)` light / `0.30` dark | Highlight cong ở rìa glass, không phải border. |
| Caustic (tán sáng qua rìa) | `--color-button-liquid-caustic` `rgba(255,255,255,0.45)` light / `0.20` dark | Mờ hơn specular, ở mép. |
| Inner shadow | `--color-button-liquid-inner-shadow` | Tạo chiều sâu lõm nhẹ. |
| Contact shadow | `--color-button-liquid-contact-shadow` | Bóng tiếp xúc dưới control. |
| Ripple | `--color-button-liquid-ripple-*` | Phát sáng từ điểm chạm. |

### 4.4 Tinting — màu nhấn

- Dùng tinting **có chọn lọc** cho primary action hoặc state active.
- Không tint tất cả mọi element — sẽ mất hierarchy.
- Màu tint phải phản ứng với nền: đậm hơn khi nền sáng, nhạt hơn khi nền tối.
- Cơ chế: `color-mix(in srgb, var(--color-primary) N%, transparent)` + `backdrop-filter: saturate(150%)`.

---

## 5. Shape Language — Ngôn ngữ hình dạng

### 5.1 Đơn vị hình học cơ bản

| Shape | Tỷ lệ | Radius | Dùng cho |
|---|---|---|---|
| **Pill / Stadium** | Dài gấp 3-6 lần cao | `--radius-pill` (9999px) | Button, input, search bar, tab, segmented control, slider track. |
| **Circle** | 1:1 | `50%` / `--radius-full` | IconButton, FAB, play/pause, avatar, toggle thumb. |
| **Squircle / Superellipse** | 1:1 hoặc 4:3 | `--radius-2xl`/`3xl` (16-24px) | Card, tile, sheet, menu panel, bottom nav item. |
| **Rounded-rect** | Tùy | `--radius-xl`/`2xl` | Dialog, bottom sheet, sidebar, large panels. |

### 5.2 Quy tắc

- **Không có góc vuông**. Nếu phải dùng `radius-none`, đặt câu hỏi lại thiết kế.
- **Concentric radius**: bán kính trong = `max(0, outerRadius - padding)`.
- **Khoảng cách đều**: tiles trong grid cách nhau `--space-3` (12px) desktop, `--space-2` (8px) mobile.
- **Touch target**: mobile 44px, desktop 40px — đã có `--touchTarget-mobile` / `--touchTarget-desktop`.

---

## 6. Elevation & Material — Chiều sâu & vật liệu

### 6.1 Lớp glass

Một element Liquid Glass tối thiểu có 4 lớp:

```text
1. Background layer (nội dung/video/gradient)
2. Backdrop blur + dimming (nếu Clear)
3. Glass surface (translucent color)
4. Specular + caustic highlight (rìa trên trái)
5. Icon / text / glyph
6. Contact shadow (dưới cùng)
```

### 6.2 Elevation scale

| Mức | Bóng | Blur | Ví dụ |
|---|---|---|---|
| 0 — Resting | `none` hoặc `var(--shadow-sm)` | none | Inline text, content layer. |
| 1 — Floating | `0 4px 12px rgba(0,0,0,0.08)` | `var(--blur-md)` | Button, IconButton, chip. |
| 2 — Raised | `0 8px 24px -4px rgba(0,0,0,0.10)` | `var(--blur-lg)` | Card, tile, selected item. |
| 3 — Overlay | `0 12px 40px -8px rgba(0,0,0,0.18)` | `var(--blur-xl)` | Sheet, dialog, bottom sheet, popover. |

### 6.3 Lensing trên web

Web không render ray-traced caustic. Tái tạo bằng:

- `backdrop-filter: blur(Npx) saturate(150%);`
- `background: linear-gradient(135deg, var(--color-button-liquid-specular) 0%, transparent 35%, transparent 65%, var(--color-button-liquid-inner-shadow) 100%);`
- Border caustic: `box-shadow: inset 1px 1px 0 var(--color-button-liquid-caustic), inset -1px -1px 0 var(--color-button-liquid-inner-shadow);`
- Mỗi component có thể thêm lớp pseudo-element `::before` cho rim light, `::after` cho inner shadow.

---

## 7. Typography — Chữ trong glass

### 7.1 Font stack

Cell đã dùng Inter + SF Pro. Giữ nguyên:

```css
font-family: var(--font-family); /* Inter, -apple-system, BlinkMacSystemFont, 'SF Pro Text', ... */
```

### 7.2 Vai trò chữ

| Vai trò | Size | Weight | Tracking | Dùng |
|---|---|---|---|---|
| Display | `var(--font-size-4xl)` / `5xl` | `var(--font-weight-semibold)` | `var(--tracking-tight)` | Tiêu đề hero, dashboard title. |
| Title | `var(--font-size-2xl)` / `3xl` | `var(--font-weight-semibold)` | `var(--tracking-snug)` | Panel title, section header. |
| Headline | `var(--font-size-lg)` / `xl` | `var(--font-weight-medium)` | `var(--tracking-normal)` | Card title, tile label. |
| Body | `var(--font-size-base)` | `var(--font-weight-regular)` | `var(--tracking-normal)` | Mô tả, paragraph. |
| Label | `var(--font-size-sm)` | `var(--font-weight-medium)` | `var(--tracking-wide)` | Button label, nav label. |
| Caption | `var(--font-size-xs)` | `var(--font-weight-medium)` | `var(--tracking-wide)` | Metadata, hint. |

### 7.3 Quy tắc

- **Trên glass**: text trắng/trắng mờ trên dark, đen/xám đậm trên light.
- **Icon-first**: nhiều control chỉ cần icon, label là phụ.
- **Không dùng quá 2 weight** trên cùng một màn hình.
- **Text shadow nhẹ** cho độ tương phản trên nền lấp lánh: `var(--color-button-liquid-text-shadow)`.

---

## 8. Iconography

- Dùng `ICON_CATALOG` hiện có (`src/shared/icons/index.ts`) theo hệ thống Nucleus: 24×24, stroke 1.5, round caps, geometric.
- Màu icon: `var(--color-text-primary)` hoặc `var(--color-text-inverse)` tùy nền.
- Trên glass: icon thường là **line icon** mảnh, không fill nặng.
- Kích thước:
  - In pill button: 16-20px.
  - In circle IconButton: 20-24px.
  - In tile: 24-28px.

---

## 9. Layout & Composition

### 9.1 Layer hierarchy

```text
Z-4: Toast / tooltip        (var(--z-toast))
Z-3: Modal / dialog / sheet  (var(--z-modal))
Z-2: Popover / menu          (var(--z-popover))
Z-1: Navigation / controls   (sidebar, tab bar, nav cluster)
Z-0: Content                 (video, text, list)
```

### 9.2 Screen patterns

| Pattern | Mô tả | Ví dụ trong Cell |
|---|---|---|
| **Launcher / Dashboard** | Grid tiles lớn, icon + label, search bar phía trên, user bar dưới. | Sidepanel home, options page. |
| **Control Center** | Grid 2-3 cột các toggle, slider, quick actions, media widget. | Popup quick actions, subtitle overlay. |
| **Bottom Sheet** | Sheet kính trượt lên từ dưới, blur nền. | Settings, language profile, subtitle list. |
| **Context Menu** | Menu bubble gần trigger, squircle, list icon + text. | Right-click / long-press menu. |
| **Floating Action Bar** | Bar kính nổi ở bottom với 3-5 icon buttons. | Nav cluster trên video, player controls. |

### 9.3 Responsive behavior

| Viewport | Grid | Padding | Tiles |
|---|---|---|---|
| 320px | 1-2 cột | `--space-3` | 64-72px, label dưới icon |
| 768px | 2-3 cột | `--space-4` | 80-96px |
| 1280px | 3-4 cột | `--space-5` | 96-120px |
| 1920px | 4-6 cột | `--space-6` | 120-144px |

---

## 10. Component Patterns

### 10.1 Button (pill)

| State | Diễn giải |
|---|---|
| Default | Glass surface + specular rim + contact shadow. Nền xuyên thấu. |
| Hover | Sáng hơn (`--color-glass-surface-hover`), caustic đậm hơn, shadow nâng cao. Chỉ trên `@media (hover: hover) and (pointer: fine)`. |
| Pressed | Co scale nhẹ (`--press-scale` `0.985`), inner shadow sâu, ripple phát sáng từ điểm chạm. |
| Loading | Shimmer chạy dọc theo pill (`--shimmer-duration` 1200ms). |

### 10.2 IconButton (circle)

- Hình tròn, glass trong, icon trắng/đen.
- Khi active/selected: background tint bằng `--color-primary-subtle` hoặc `--color-tint-*-background`.
- Trên nav cluster / video overlay: dark glass với icon trắng.

### 10.3 Card / Tile (squircle)

- Bo góc `--radius-2xl` hoặc `--radius-3xl`.
- Frosted surface, shadow mềm.
- Có thể chứa icon lớn + label hoặc ảnh thumbnail.
- Hover: nâng nhẹ, sáng hơn, không dịch chuyển quá nhiều.

### 10.4 Input / Search (pill)

- Pill dài, placeholder mờ, icon trái hoặc phải.
- Background `var(--color-glass-input-bg)` `rgba(255,255,255,0.60)`.
- Focus: viền sáng nhẹ, inner glow.

### 10.5 Bottom Sheet / Dialog

- Bo góc trên (top-radius 24-32px cho sheet).
- Backdrop blur + dim.
- Nội dung bên trong dùng fill/vibrancy, **không** dùng glass trên glass.

### 10.6 Slider / Toggle

- Track pill, thumb circle.
- Thumb kính nổi, khi drag có ánh sáng lan từ thumb.
- Toggle active: thumb trượt, track tint primary.

---

## 11. Animation & Interaction

### 11.1 Nguyên tắc chuyển động

- **Materialize, don't fade**: xuất hiện bằng cách điều chỉnh blur, opacity, scale, highlight — không chỉ là opacity fade.
- **Spring, not ease-in**: dùng `cubic-bezier(0.175, 0.885, 0.32, 1.275)` (`--ease-spring`) cho pop, press, release.
- **Light travels**: caustic highlight di chuyển theo động tác hoặc device orientation (nếu có thể).
- **Immediate feedback**: 80-120ms cho press; 200-300ms cho hover/transition; 500-700ms cho ripple.

### 11.2 Motion catalog

| Interaction | Animation | Token/Duration |
|---|---|---|
| Hover (fine pointer) | brighten + scale(1.02) + shadow nâng | `--duration-slow` 300ms `--ease-out` |
| Press | scale(`--press-scale` 0.985) + inner shadow + glow | `--press-duration` 80ms |
| Release | spring về scale 1, ripple expand | `--release-duration` 180ms, `--ripple-duration` 700ms |
| Pop in | scale(0.95) → 1 + opacity + blur | `--duration-slow` 300ms `--ease-spring` |
| Slide up sheet | translateY(100%) → 0 + backdrop blur fade | `--duration-slower` 500ms `--ease-out` |
| Toggle | thumb translateX spring | `--duration-normal` 200ms `--ease-spring` |
| Scroll edge | content fade/dissolve dưới glass header | theo scroll position |

### 11.3 Accessibility

- Tôn trọng `prefers-reduced-motion`: giảm elastic, tắt ripple lan, chuyển về opacity/translate đơn giản.
- `prefers-reduced-transparency`: tăng opacity surface (`--color-glass-surface` → `0.95`).
- `prefers-contrast: more`: viền đậm, icon/text đen trắng rõ ràng.

---

## 12. Anti-Patterns (KHÔNG làm)

| # | Anti-pattern | Tại sao |
|---|---|---|
| A1 | Glass trên glass | Làm mất hierarchy, giao diện bẩn. |
| A2 | Tint tất cả mọi thứ | Không có focal point, rối mắt. |
| A3 | Góc vuông hoặc radius nhỏ | Phá vỡ ngôn ngữ liquid. |
| A4 | Bóng quá đậm / quá nhiều | Glass phải nhẹ, bay bổng, không nặng nề. |
| A5 | Content layer cũng làm glass | Table/list nên là solid/fill, không blur. |
| A6 | Quá nhiều animation cùng lúc | Gây mệt, mất focus. Mỗi tương tác chỉ 1-2 motion chính. |
| A7 | Hardcode px / color | Phải dùng token. Không hardcode shadow, radius, màu. |

---

## 13. Token Mapping — mapping concept vào tokens.json hiện có

| Khái niệm concept | Token (đã có hoặc cần mở rộng) |
|---|---|
| Glass surface | `--color-glass-surface`, `--color-glass-surface-hover`, `--color-glass-surface-popover` |
| Glass border | `--color-glass-border`, `--color-glass-border-subtle` |
| Blur | `--blur-sm`, `--blur-md`, `--blur-lg`, `--blur-xl` |
| Button liquid surface | `--color-button-liquid-surface`, `--color-button-liquid-surface-hover`, `--color-button-liquid-surface-active` |
| Specular / caustic | `--color-button-liquid-specular`, `--color-button-liquid-caustic` |
| Inner shadow | `--color-button-liquid-inner-shadow` |
| Contact shadow | `--color-button-liquid-contact-shadow` |
| Ripple | `--color-button-liquid-ripple-*` |
| Press / release | `--press-scale`, `--press-duration`, `--release-duration` |
| Shape | `--radius-pill`, `--radius-full`, `--radius-2xl`, `--radius-3xl` |
| Elevation | `--shadow-sm`, `--shadow-md`, `--shadow-lg`, `--shadow-modal` |
| Motion | `--duration-*`, `--ease-out`, `--ease-spring` |
| Tint/Primary | `--color-primary`, `--color-primary-subtle`, `--color-tint-*` |

### Cần bổ sung token (đề xuất)

Để tái tạo đúng Liquid Glass trên web, cần thêm các token sau vào `tokens.json`:

| Token mới | Giá trị đề xuất | Mục đích |
|---|---|---|
| `--shadow-liquid-sm` | `0 2px 8px -2px rgba(0,0,0,0.06), 0 1px 0 0 var(--color-button-liquid-caustic) inset` | Bóng mềm + rim light cho floating controls. |
| `--shadow-liquid-md` | `0 6px 20px -4px rgba(0,0,0,0.08), 0 1px 0 0 var(--color-button-liquid-caustic) inset` | Cho cards/tiles. |
| `--shadow-liquid-lg` | `0 12px 40px -8px rgba(0,0,0,0.12), 0 1px 0 0 var(--color-button-liquid-caustic) inset` | Cho sheet/dialog. |
| `--color-glass-clear-dimming` | `rgba(0,0,0,0.20)` light / `rgba(0,0,0,0.35)` dark | Dimming layer cho Clear variant trên media. |
| `--color-glass-ambient-spill` | `color-mix(in srgb, var(--color-primary) 15%, transparent)` | Ánh sáng từ nội dung màu chiếu lên glass. |

---

## 14. Implementation Notes

- **Dùng `backdrop-filter` có chừng mực**: performance trên low-end Android có thể kém. Cung cấp fallback `background-color` solid khi `prefers-reduced-transparency`.
- **Không blur toàn màn hình**: blur chỉ áp dụng cho glass layer, không cho nền content.
- **GPU acceleration**: dùng `transform` và `opacity` cho animation, tránh `top/left/width/height`.
- **Layer promotion**: `will-change: transform` trên element đang animate; xóa sau animation.
- **Bundle size**: không thêm thư viện nếu có thể. CSS `backdrop-filter`, `box-shadow`, `color-mix` là đủ.
- **Shadow DOM**: dictionary popup inject `tokens.css` bằng raw import; đảm bảo `:host` reset `font-size`.

---

## 15. Verification Checklist (trước khi merge)

- [ ] Tất cả component mới reuse `src/shared/ui/*` hoặc được thêm vào đó.
- [ ] Không hardcode px / color / radius.
- [ ] `npm run build` pass (regenerate tokens).
- [ ] `npm run typecheck` pass.
- [ ] Playwright showcase tests pass.
- [ ] Không có glass trên glass trong prototype.
- [ ] `prefers-reduced-motion` và `prefers-reduced-transparency` được tôn trọng.
- [ ] Touch target đạt 44px mobile / 40px desktop.

---

## 16. References

### Images (ShareX 2026-08)

- `msedge_ae8vaXpCXe.png` — Windows Start Menu: launcher reference với category tiles, search bar, user bar.
- `msedge_W74LG9aaG5.png`, `msedge_nHMSPpcHmX.png`, `msedge_XGWFCwSQ6Z.png`, `msedge_dhw4QYjk78.png`, `msedge_gpOh62Uj3u.png`, `msedge_x5ZKzsHGL3.png`, `msedge_HD8O3sqmQo.png`, `msedge_ABjRlRipK6.png`, `msedge_Zvih2MNKBU.png`, `msedge_xaT6qfhKFM.png` — UI kits, hero buttons, controls, AI inputs, swipe affordances.
- `Photos_3EvA2sKLVo.png`, `Photos_xvVeHZaY2Y.png` — light/dark glass pill, circle + pill pair.
- `msedge_lUcqvkddOo.png` — Control Center before/after.
- `msedge_iezZyre6hM.png` — iPad edit dashboard.
- `msedge_yqU5XXypqY.png`, `msedge_Pk97LUEAaS.png` — context menus.
- `msedge_MPTTgSt29O.png` — 5-button glass tab bar.
- `msedge_1Z4rJYqHgM.png` — Focus pill + circular actions.
- `msedge_7pjrTnRw6E.png` — Weather app with bottom sheet.
- `msedge_fSdeG0HLZY.png` — Media controls over photo (tint adaptivity).
- `msedge_YIX6tlqcTo.png` — Circular play control on fabric.
- `msedge_DxMavtPkP8.png` — Press/squish interaction detail.
- `msedge_z1cUOY2SUN.png` — Pill handle/slot.
- `msedge_xaP6hXJjGE.png` — Draggable glass sheet.
- `msedge_LBQFJoR6cX.png`, `msedge_cvdz2jae19.png` — floating action bar bottom.
- `msedge_DZyaUZqFKI.png` — frosted bottom sheet over product grid.
- `msedge_s5yQBGjOjO.png` — 3D isometric glass controls.
- `msedge_xaP6hXJjGE.png`, `msedge_LBQFJoR6cX.png`, `msedge_cvdz2jae19.png`, `msedge_DZyaUZqFKI.png`, `msedge_s5yQBGjOjO.png` — bottom sheets, action bars, 3D glass.

### Transcript

- `C:\Users\The0cean\Downloads\api_-_timedtext.en.srt` — WWDC Liquid Glass session transcript.

### Project context

- `docs/context/project-context.md` — persona, constraints, design story.
- `src/shared/styles/tokens.json` — canonical token SSOT.
- `src/shared/styles/README.md` — component inventory + token usage rules.
- `docs/design-system/DESIGN.md` — agent UI implementation checklist.

---

*Generated with [Devin](https://devin.ai) — nỗ lực cao, 100% đọc reference images + transcript.*
