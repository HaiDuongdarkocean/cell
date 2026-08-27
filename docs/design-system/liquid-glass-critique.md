# Liquid Glass Concept — Critical Decision Brief

> Output của `inquiry-creativity` skill: nghiên cứu + phản biện `liquid-glass-concept.md` từ codebase và internet.
> Date: 2026-08-30
> Scope: đánh giá concept Liquid Glass cho toàn bộ UI Cell, tìm gap, chọn hướng triển khai tốt nhất.

---

## 1. 5W1H Scope

| Question | Answer |
|---|---|
| **What** | Review và phản biện `docs/design-system/liquid-glass-concept.md` vừa viết. |
| **Why** | Đảm bảo concept đúng với Apple Liquid Glass, khả thi trong MV3 extension, tuân thủ design system Cell, và không gây regression hiệu năng / accessibility. |
| **Where** | Áp dụng cho toàn bộ UI Cell (popup, sidepanel, options, content-script overlay). |
| **When** | Trước khi bắt đầu implement phase 1. |
| **Who** | Design/dev team và agent implement. |
| **How** | Critical Decision Brief: sources → gaps → options → weighted matrix → 5 Whys → first-principles → verdict. |

**Bloom target:** **Evaluate + Create** — chấm điểm concept và đề xuất cải tiến cụ thể.

---

## 2. Sources (SIFTed)

### 2.1 Codebase sources

| Source | Authority | Key claim | Path |
|---|---|---|---|
| `liquid-glass-concept.md` | high (SSOT mới viết) | 7 principles, palette, shape, motion, anti-patterns, token mapping | `docs/design-system/liquid-glass-concept.md` |
| `DESIGN.md` | high | Agent UI SSOT: no M3, no hardcode, reuse `src/shared/ui/`, token from `tokens.css` | `docs/design-system/DESIGN.md` |
| `STANDARD.md` | high | Quiet confidence, neutral-first, content-first, surface lift, accessible by default | `src/shared/styles/STANDARD.md` |
| `tokens.json` | high | Đã có `color-button-liquid-*`, `color-glass-*`, liquid tokens | `src/shared/styles/tokens.json` |
| `Button.module.css` | high | Đã triển khai liquid glass button: 12px blur, saturate 150%, multi-layer inset shadow, caustic pseudo-elements, ripple | `src/shared/ui/Button.module.css` |
| `IconButton.module.css` | high | Đã triển khai glass icon button với backdrop blur, caustic highlights | `src/shared/ui/IconButton.module.css` |
| `Card.module.css` | high | `.glass` variant dùng `backdrop-filter: blur(var(--blur-xl)) saturate(160%)` | `src/shared/ui/Card.module.css` |
| `Tabs.module.css` | high | Tabs hiện tại **chưa glass** — line-style bottom border, transparent background | `src/shared/ui/Tabs.module.css` |
| `Toggle.module.css` | high | Toggle hiện tại **chưa glass** — solid `color-border` track, solid white thumb | `src/shared/ui/Toggle.module.css` |
| `Slider.module.css` | high | Slider hiện tại **chưa glass** — solid primary track, solid thumb | `src/shared/ui/Slider.module.css` |
| `BottomSheet.module.css` | high | Bottom sheet hiện tại **chưa glass** — solid `color-background`, không có blur/dimming | `src/shared/ui/BottomSheet.module.css` |
| `AGENTS.md` | high | MV3 constraints: SW ephemeral, no DOM, cross-browser Chrome/Edge/Brave, RAM >= 1GB, benchmark >= 200k | `AGENTS.md` |

### 2.2 External sources

| Source | Authority | Key claim | URL |
|---|---|---|---|
| Apple Developer — Adopting Liquid Glass | **high** (official) | Liquid Glass là navigation/control layer; test với reduced transparency/motion; reduce custom backgrounds; standard components adapt automatically | https://developer.apple.com/documentation/TechnologyOverviews/adopting-liquid-glass |
| LogRocket — Liquid Glass with CSS and SVG | medium | Web cần SVG filters (`feDisplacementMap`, `feSpecularLighting`) để tái tạo refraction + reflection; có performance + browser support trade-offs | https://blog.logrocket.com/how-create-liquid-glass-effects-css-and-svg/ |
| PixCode — Glassmorphism in 2025 | medium | `backdrop-filter` GPU-expensive; >16px blur là luxury; -webkit prefix bắt buộc Safari; mobile frame drop real; dùng matte fallback | https://pixcode.io/en/blog/css-glassmorphism-2025/ |
| Kawa Articles — backdrop-filter performance | medium | `backdrop-filter` composes backdrop mỗi frame; sticky + scroll + nhiều glass layer = jank; dùng compact toolbar, lower radius mobile, solid fallback | https://kawagame.com/en/blog/glassmorphism-css-backdrop-filter/ |
| GitHub — archisvaze/liquid-glass | medium | SVG `feDisplacementMap` + `backdrop-filter` chỉ hoạt động tốt Chromium; WebGL fallback cho cross-browser | https://github.com/archisvaze/liquid-glass |
| GitHub — W3C csswg issue #12316 | high (spec discussion) | CSS chưa có native refraction; cần `offset()` hoặc low-level filter; hiện tại web chưa thể làm true Liquid Glass mà không dùng SVG/WebGL | https://github.com/w3c/csswg-drafts/issues/12316 |

### 2.3 Conflicts resolved

- **Concept vs. codebase:** Concept đề xuất glass toàn bộ control layer; codebase hiện chỉ Button/IconButton/Card có glass — Tabs/Toggle/Slider/BottomSheet chưa. → Cần component migration priority.
- **Concept vs. Apple:** Apple nhấn mạnh refraction (Snell's Law) và material tiers (Regular/Clear/Thick/Thin); concept chỉ có Regular/Clear/Popover. → Cần bổ sung material tiers hoặc giải thích tại sao không cần.
- **Concept vs. web reality:** True refraction không thể bằng CSS `backdrop-filter` thuần; cần SVG filter hoặc WebGL, nhưng đắt và khó trong MV3 Shadow DOM. → Nên dùng CSS-only approximation làm default, SVG/WebGL là progressive enhancement.

---

## 3. Distilled Knowledge — 10 Key Facts

1. **Apple Liquid Glass là layer tách biệt:** chỉ dùng cho navigation/control, **không** dùng trên content lists/tables.
2. **Material tiers:** Apple có `.regular` (default), `.clear` (media + dimming + bold content), `.thick`, `.thin`, `.ultraThin` (sidebar, popover, sheet, toolbar). Web hiện chỉ cần 2-3 tiers.
3. **Refraction là cốt lõi:** bẻ cong ánh sáng ở rìa convex. CSS `backdrop-filter: blur()` là frosted glass, **không** tạo refraction.
4. **Web true Liquid Glass cần SVG filters** (`feDisplacementMap` + `feSpecularLighting`) hoặc WebGL/GLSL. SVG filter chỉ hoạt động tốt trên Chromium; Firefox/Safari hỗ trợ kém hoặc không.
5. **Performance cost:** `backdrop-filter` blur 12-16px trên mid-range Android có thể drop từ 60fps xuống 40fps; nhiều layer glass cộng dồn.
6. **Cross-browser:** `-webkit-backdrop-filter` bắt buộc cho Safari; Firefox bỏ qua `backdrop-filter` (trước v103) — cần solid fallback.
7. **Accessibility:** `prefers-reduced-transparency` → frosted hơn; `prefers-reduced-motion` → tắt elastic; `prefers-contrast: more` → viền đậm, text rõ.
8. **Cell constraints:** MV3, RAM >= 1GB, benchmark >= 200k, cross-browser Chrome/Edge/Brave/Android, **không thêm dep nếu không kiểm bundle size**.
9. **Codebase state:** Button/IconButton/Card đã có glass; Tabs/Toggle/Slider/BottomSheet/Dialog chưa. Token glass đã có sẵn.
10. **Anti-pattern:** glass trên glass, tint tất cả, góc vuông, bóng quá đậm, content layer glass.

---

## 4. Concept Gaps (ranked by severity)

| # | Gap | Severity | Why it matters |
|---|---|---|---|
| G1 | **Thiếu material tiers** (Regular/Clear/Thick/Thin/Ultra-thin). Chỉ có Regular/Clear/Popover. | MEDIUM | Apple dùng tiers để xử lý sidebar, popover, sheet, toolbar khác nhau. Thiếu tiers sẽ làm mất hierarchy hoặc legibility. |
| G2 | **Chưa có true refraction.** Concept nói "lensing" nhưng implementation plan chỉ dùng `backdrop-filter` + inset shadow. | HIGH | Apple Liquid Glass khác biệt ở refraction. Nếu chỉ blur, đây là glassmorphism 2.0, không phải Liquid Glass. |
| G3 | **Chưa xử lý cross-browser MV3 constraints.** Không đề cập Safari/Firefox fallback, Shadow DOM, content-script performance. | HIGH | Cell là extension MV3 cross-browser. Nếu không fallback, UI sẽ bị vỡ trên Safari/Firefox hoặc chậm trên low-end. |
| G4 | **Chưa có performance budget cụ thể.** Không giới hạn blur radius, số glass layer, animation scope. | HIGH | Dễ gây frame drop trên Android/benchmark 200k. |
| G5 | **Thiếu component migration priority.** Không chỉ rõ component nào glass hóa trước. | MEDIUM | Tabs/Toggle/Slider/BottomSheet cần redesign để khớp concept. Không có priority sẽ rối. |
| G6 | **Chưa định nghĩa strict criteria cho Clear variant.** Apple yêu cầu: over media-rich content + dimming layer + bold/bright foreground. | MEDIUM | Nếu dùng Clear sai chỗ, text sẽ không đọc được. |
| G7 | **Thiếu "glass on glass" detection rule.** Có anti-pattern nhưng không có cách detect/measure. | LOW | Dễ tái phạm khi nhiều team implement. |
| G8 | **Caustic highlight là static.** Apple specular highlight đáp ứng ánh sáng/device orientation/pointer; concept chưa đề cập. | LOW | Nice-to-have, không phải MVP. |
| G9 | **Token mới chưa thêm vào `tokens.json`.** `shadow-liquid-*`, `color-glass-clear-dimming`, `color-glass-ambient-spill` chỉ nằm trong concept. | MEDIUM | Block implement nếu không sync tokens. |
| G10 | **Thiếu "content intersection" handling chi tiết.** Apple nói tránh intersection content-glass khi scroll; concept đề cập dynamic shadow nhưng chưa cụ thể. | LOW | Cần khi implement scrollable dashboard. |

---

## 5. Options

### Option A — Approve concept as-is
Triển khai theo `liquid-glass-concept.md` nguyên bản. Bổ sung token và implement dần.

### Option B — Tighten concept + phased rollout
Cập nhật concept: thêm material tiers, strict Clear criteria, component migration priority, performance budget. Triển khai theo 3 phase (tokens → Button/IconButton/Card → sheets/controls).

### Option C — Add true refraction via SVG filters
Nâng cấp concept để bao gồm SVG `feDisplacementMap` / WebGL cho hero/buttons tròn; CSS `backdrop-filter` cho controls thường. Phức tạp hơn, cross-browser kém hơn.

### Option D — Hybrid CSS-only Liquid Glass with progressive refraction
Giữ concept hiện tại làm **Regular** material. Bổ sung **Clear** variant với dimming + bold content. Dùng **CSS-only glass** (`backdrop-filter` + inset highlights + caustic pseudo-elements) làm default. Để **SVG filter/WebGL refraction** làm **progressive enhancement** cho hero/special media controls, với feature detection. Phù hợp MV3, nhanh ship, vẫn có lộ trình tiến tới true Liquid Glass.

---

## 6. Must-Haves

1. Build/typecheck/test pass.
2. No hardcode — dùng `tokens.json`.
3. MV3 cross-browser (Chrome/Edge/Brave desktop + Android; Safari/Firefox graceful fallback).
4. WCAG 2.2 AA (contrast, focus, touch target, reduced-motion/reduced-transparency).
5. Không thêm dependency mới trừ khi bundle size được kiểm soát.
6. Performance ổn định trên low-end (benchmark >= 200k, không drop frame scroll).
7. Content-first: glass chỉ trên nav/control, không trên content list.
8. SSOT: mọi quyết định ghi vào concept hoặc ADR.

---

## 7. Weighted Trade-Off Matrix

| Criterion | Weight | A | B | C | D |
|---|---:|---:|---:|---:|---:|
| Correctness to Apple Liquid Glass | 20% | 6 (1.20) | 8 (1.60) | 9 (1.80) | 8 (1.60) |
| Performance / low-end friendliness | 20% | 7 (1.40) | 8 (1.60) | 5 (1.00) | 9 (1.80) |
| MV3 / cross-browser feasibility | 20% | 8 (1.60) | 8 (1.60) | 5 (1.00) | 9 (1.80) |
| Maintainability / SSOT / token feasibility | 15% | 9 (1.35) | 8 (1.20) | 5 (0.75) | 9 (1.35) |
| Accessibility | 15% | 7 (1.05) | 9 (1.35) | 6 (0.90) | 8 (1.20) |
| Time to ship / incremental value | 10% | 9 (0.90) | 7 (0.70) | 4 (0.40) | 8 (0.80) |
| **Weighted score** | **100%** | **7.50** | **8.05** | **5.85** | **8.55** |

**D wins.**

---

## 8. 5 Whys Stress-Test on Option D

1. **Why is D the best fit?**
   → D đạt correctness cao (8) mà không hy sinh performance/cross-browser (9). Nó cho phép ship CSS-only sớm, sau đó thêm SVG/WebGL refraction nếu cần.

2. **Why not a hybrid of B and C?**
   → B thiếu refraction plan; C quá đắt. D kết hợp: concept chặt chẽ (như B) + refraction progressive (có thể mượn từ C sau).

3. **Why can't we defer refraction entirely?**
   → Có thể. Apple Liquid Glass vẫn "sống" nhờ motion + caustic highlight + tint adaptivity mà không cần true refraction. Refraction là differentiator, không phải MVP.

4. **Why will this still work in 6 months?**
   → Token SSOT, CSS-only core, progressive enhancement. Khi W3C hỗ trợ native refraction (csswg #12316), ta chỉ cần bổ sung `backdrop-filter` offset mà không phải rewrite.

5. **Why would a senior engineer disagree?**
   → Họ có thể muốn true refraction ngay hoặc bảo thủ "chỉ là glassmorphism". Counter: true refraction vi phạm must-have performance/cross-browser; pure glassmorphism thiếu material tiers và motion language.

---

## 9. First-Principles / Unconstrained Best Practice

> **If we remove all project constraints, what is the best solution?**

- **Ideal:** WebGL/GLSL shader với Snell's Law + real-time refraction + dynamic specular theo pointer/device orientation, tích hợp vào extension popup/sidepanel dưới dạng `<canvas>` overlay.
- **Why ideal:** Tái tạo Liquid Glass chính xác nhất.
- **Re-scored with relaxed local constraints:** Correctness 10, Performance 4, Cross-browser 4, Maintainability 3, Accessibility 5, Time 2 → **5.20**.
- **Comparison to D (8.55):** Ideal thua xa vì constraints là **real** (MV3, low-end, no new deps, cross-browser). Constraints are not artificial here.
- **Conclusion:** D is correct. The ideal is a research spike for v2, not MVP.

---

## 10. Verdict

**Chọn Option D: Hybrid CSS-only Liquid Glass with progressive refraction.**

**Fit:** 8.55/10 — cao nhất, đáp ứng tất cả must-haves.

**Main risk:** Có thể bị chê là "chỉ là glassmorphism" nếu không đủ caustic/motion. Giảm rủi ro bằng: (a) caustic pseudo-elements mạnh hơn, (b) spring press/release/ripple, (c) tint adaptivity, (d) material tiers, (e) roadmap cho true refraction.

---

## 11. Concrete Recommendations for `liquid-glass-concept.md`

### 11.1 Addendums cần thêm vào concept

1. **§4.5 Material Tiers (bổ sung sau 4.2)**
   - `Regular` (default nav/controls)
   - `Clear` (media + dimming + bold content)
   - `Thick` (sidebar, large panels — đục hơn Regular)
   - `Thin` (popover, tooltip — trong hơn)
   - Map vào token hiện có.

2. **§6.1 Refraction Reality Check**
   - True refraction cần SVG `feDisplacementMap` hoặc WebGL.
   - CSS-only approximation: caustic highlights + blur + saturate + inset shadows.
   - Progressive enhancement path: CSS-only → SVG filter (Chromium) → WebGL (research v2).

3. **§6.2 Performance Budget**
   - Blur radius: `8px` mobile, `12px` tablet, `16px` desktop max.
   - Max 3 glass layers trên màn hình.
   - Không animating `backdrop-filter`; chỉ animate `transform`/`opacity`.
   - `@supports` fallback: nếu không có `backdrop-filter`, dùng solid `color-glass-surface`.

4. **§10.5 Component Migration Priority**
   - P1: Button, IconButton, Card (đã xong → tinh chỉnh)
   - P2: BottomSheet, Dialog, Popover, NavItem
   - P3: Tabs, Toggle, Slider, SearchField
   - P4: Input, Select, Textarea (cẩn thận legibility)

5. **§12.3 Clear Variant Criteria (bổ sung)**
   - Chỉ dùng khi:
     1. Element nổi trên media/photo/video.
     2. Có dimming layer hoặc scrim.
     3. Foreground text/icon là bold/bright (`color-text-inverse`, font-weight >= 600).

6. **§13.2 Token Additions (bổ sung)**
   Thêm vào `tokens.json`:
   - `--shadow-liquid-sm`, `--shadow-liquid-md`, `--shadow-liquid-lg`
   - `--color-glass-clear-dimming`
   - `--color-glass-ambient-spill`

7. **§14.3 Accessibility Tests**
   - `prefers-reduced-transparency`: `--color-glass-surface` → opacity 0.92.
   - `prefers-reduced-motion`: tắt ripple/spring, giữ opacity/translate.
   - `prefers-contrast: more`: thêm viền 1.5px `color-text-primary` hoặc `color-text-inverse`.

### 11.2 Chỉnh sửa nhỏ

- Sửa typo "rìa" đồng nhất; một số chỗ dùng "rìa sáng", một số chỗ "caustic highlight".
- Định nghĩa "squircle" rõ hơn (superellipse radius curve hoặc `border-radius: 24px` với `clamp`).
- Thêm reference ảnh `msedge_7pjrTnRw6E.png` (Weather app bottom sheet) vào §10.5.

---

## 12. Next Actions

1. **Approve Option D** — em sẽ cập nhật `liquid-glass-concept.md` với các addendums trên.
2. **Thêm token mới** vào `tokens.json` và regenerate `tokens.css`.
3. **Tạo prototype launcher dashboard** trong design-system showcase để verify Regular/Clear/Thick tiers.
4. **Migrate component theo priority** — bắt đầu từ BottomSheet/Dialog vì chúng cần glass nhiều nhất.
5. **Research spike:** đánh giá SVG `feDisplacementMap` trong extension shadow DOM cho v2.

---

*Generated with [Devin](https://devin.ai) using `inquiry-creativity` skill — Socratic review, Bloom taxonomy, 4-step knowledge distillation, and critical thinking loop.*
