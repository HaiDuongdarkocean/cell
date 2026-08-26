# Design System Learning Map

> Sources: Material Design 3, Refactoring UI, DesignSystems.one, W3C Design Token Community Group, Atomic Design (Brad Frost), WCAG 2.2
> Purpose: Fast-path learning track from zero to designing Cell's design system

---

## 1. Foundations — Learn These First

These constraints determine 80% of whether a UI looks coherent.

### 1.1 Color
- **Color models**: HSL, HCT (Hue-Chroma-Tone), RGB/HEX, OKLCH
  - Source: Material 3 uses HCT for perceptually uniform color — https://developer.android.com/design/ui/mobile/guides/styles/color
- **Color palette**: Grey scale, primary, secondary/tertiary, accent, semantic (success/warning/error/info)
  - Source: Refactoring UI — "You can't build anything with five hex codes"; 8-10 greys, 5-10 primary, 5-10 accent shades — https://refactoringui.com/previews/building-your-color-palette
- **Color system**: Tonal palette, color roles, light/dark scheme
  - Source: Material 3 theming — https://developer.android.com/codelabs/m3-design-theming

### 1.2 Typography
- **Type scale**: Display → Headline → Title → Body → Label
  - Source: Material 3 type-scale tokens — https://m3.material.io/styles/typography/type-scale-tokens
- **Type properties**: font-size, font-weight, line-height, letter-spacing/tracking
- **Readability & hierarchy**: line length (~60-75 chars), baseline alignment, visual hierarchy
  - Source: Refactoring UI — "Designing Text" chapter — https://refactoringui.com/

### 1.3 Spacing
- **Base unit**: 4px grid or 8pt grid
  - Source: DesignSystems.one foundations — https://www.designsystems.one/foundations
- **Spacing types**: padding, margin, gap
- **Spacing scale**: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64 px
  - Source: Material 3 spacing tokens — https://m3.material.io/styles/spacing/tokens

### 1.4 Layout
- **Grid system**: 12-column grid, container, gutter
- **Breakpoints**: mobile-first 320px → 768px → 1280px+
- **Layout patterns**: stack, flex, grid, sidebar, card, dialog
  - Cell reference: `docs/design-system/DESIGN.md` §4

### 1.5 Shape & Elevation
- **Border radius scale**: xs, sm, md, lg, full, pill
  - Cell tokens: `radius-pill`, `radius-card`, `radius-md`
- **Shadows/elevation**: use shadow to show depth, not decoration
  - Source: Refactoring UI — "Working with Shadows"

### 1.6 Motion
- **Duration**: fast (150ms), normal (250ms), slow (500ms)
- **Easing curves**: ease, ease-in-out, spring, cubic-bezier
- **Motion purpose**: feedback, hierarchy, continuity, reduced motion
  - Source: DesignSystems.one — "What motion is for"

### 1.7 Iconography
- **Icon style**: filled / outlined / rounded, stroke, corner radius
- **Icon sizes**: 16, 20, 24, 32, 48 px
  - Cell reference: `docs/design-system/DESIGN.md` §6

---

## 2. Tokens & Architecture

- **Design tokens**: W3C standard — https://www.w3.org/community/design-tokens/
  - Source: Lucky Graphics — "Start with tokens, not components" — https://lucky.graphics/learn/design-system-from-scratch-guide/
- **Token layers**:
  - Global tokens (raw values)
  - Alias tokens (semantic)
  - Component tokens (button-bg, card-radius, etc.)
- **Token types**: color, spacing, radius, shadow, typography, motion
- **Theming**: light/dark, brand, density
- **SSOT**: one source file generates CSS, TS, Figma variables
  - Cell reference: `src/shared/styles/README.md` — `tokens.json` is canonical, `tokens.css` is generated

---

## 3. Components

- **Atomic Design**: Atoms → Molecules → Organisms
  - Source: Brad Frost — *Atomic Design*
- **Core components** (15-25 cover 80-90% of surfaces): Button, Input, Select, Card, Dialog, Tabs, Checkbox, Toggle, Badge, Tooltip
  - Source: Spell UI design system guide — https://spell.sh/blog/design-system-guide
- **Component states**: default, hover, active, focus, disabled, loading, error, empty
- **Variants**: primary/secondary/tertiary, size (sm/md/lg), danger, ghost
- **Cell inventory**: `src/shared/ui/` has 30+ components with consistent patterns

---

## 4. Patterns

- Layout patterns: lists, grids, forms, dashboards
- Interaction patterns: navigation, filtering, selection, feedback
- Empty/loading/error states
  - Source: Refactoring UI — "Design Empty States" — https://github.com/gnurio/refactoring-ui-plugin

---

## 5. Accessibility (a11y)

- **Contrast**: WCAG 2.2 AA — 4.5:1 text, 3:1 UI components
  - Source: https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum
- **Focus states**: focus-visible, focus ring
- **Screen readers**: semantic HTML, ARIA, alt text
- **Reduced motion**: `prefers-reduced-motion`
- **Touch targets**: 44×44px mobile, 40×40px desktop
  - Cell reference: `docs/design-system/DESIGN.md` §4.4

---

## 6. Visual Taste (Gu Tham My)

- Visual hierarchy: not everything should be bold, big, or colorful
  - Source: Refactoring UI — "Hierarchy is Everything"
- Whitespace: start with too much, then reduce
- Consistency: limit colors, sizes, spacing
- Restraint: less is more
- De-emphasize to emphasize: mute secondary elements
- Feedback loop: screenshot your UI and compare with polished apps (Linear, Notion, Apple, Vercel)

---

## 7. Operations & Governance

- Naming conventions for tokens, components, files
- Documentation: when to use / not to use, examples, do/don't
- Versioning: semantic versioning for the design system
- Tooling: Figma variables, Storybook, CSS custom properties, token generator
  - Source: UX Blueprints — "Your design system is only as good as its documentation" — https://www.uxblueprints.com/guides/how-to-create-a-design-system

---

## 8. Apple Design Lens

> Sources: Apple Human Interface Guidelines, UI Design Dos and Don’ts, WWDC 2017/2018/2026

Apple design là lớp “lens” để kiểm tra mọi quyết định UI trên nền tảng đã học.

### 8.1 Three themes
- **Clarity** — dễ đọc, dễ hiểu, không chen ngang.
- **Deference** — UI nhường chỗ cho nội dung.
- **Depth** — tầng lớp rõ ràng qua motion, vật liệu, shadow.

### 8.2 Eight principles
Purpose, Agency, Responsibility, Familiarity, Flexibility, Simplicity, Craft, Delight.

### 8.3 Fluid interfaces (WWDC18)
- **Response** — phản hồi tức thì.
- **Direct manipulation** — 1:1 tracking.
- **Interruptibility** — dừng/đổi hướng mọi lúc.
- **Spatial consistency** — vào/ra cùng hướng.
- **Hint** — motion gợi ý trạng thái cuối.
- **Rubber-banding** — ranh giới co giãn.

### 8.4 Decision filter
Trước khi thêm thứ gì, hỏi:
1. Phục vụ nguyên lý nào?
2. Có làm chậm input không?
3. Có thể interrupt/reverse không?
4. Có vi phạm familiarity không?
5. Nếu xóa, có ai buồn không?

### 8.5 Good / Bad quick reference
| Foundation | Tốt | Xấu |
|---|---|---|
| Color | Tonal palette, tên theo vai trò, OKLCH/HCT | Hex rải rác, tên theo màu, 1 brand cho mọi thứ |
| Typography | Type scale, tracking/leading theo size | 1 letter-spacing, text < 11pt, xám nhạt |
| Spacing | 4/8pt grid, density theo ngữ cảnh | 13px/19px/27px, không phân density |
| Layout | Control gần nội dung, 12-col grid, hit target >= 44pt | Căn giữa lung tung, nút 20×20px |
| Shape | Radius scale, shadow chỉ depth | Mọi thứ pill, shadow đen nặng trang trí |
| Motion | Spring damping 1.0, interruptible | Linear, 500ms cho việc lặp, không thể grab |
| Tokens | 3 tầng, SSOT, tên theo vai trò | Hardcode hex, file dark mode tách |
| Voice | Động từ trực tiếp, lỗi kèm cách sửa | “Xác nhận”, “Error 500” |
| a11y | 44pt, reduced motion, high contrast | Icon 16px không padding, animation không tắt |

---

## Fast-Track Learning Plan for Cell

| Week | Topic | Apply to Cell |
|------|-------|---------------|
| 1 | Color, spacing, tokens | Read `tokens.json` → understand `color-*`, `space-*` |
| 2 | Typography, layout, shape | Edit `tokens.json` → run `node scripts/generate-tokens.js` → verify in design-system showcase |
| 3 | Components, Atomic Design, states | Add or reuse a component in `src/shared/ui/` |
| 4 | a11y, motion, visual taste | Audit a screen using the checklist in `docs/design-system/DESIGN.md` |

---

## Core References (Read in Order)

1. **Refactoring UI** — https://refactoringui.com/ (fast, practical, dev-friendly)
2. **Material Design 3** — https://m3.material.io/ (token, type, spacing, color standards)
3. **DesignSystems.one** — https://www.designsystems.one/foundations (foundation overview)
4. **Atomic Design** by Brad Frost (component structure)
5. **WCAG 2.2** — https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum (accessibility)

### Apple Design References (bổ sung, đọc kèm)
- **Human Interface Guidelines** — https://developer.apple.com/design/human-interface-guidelines/foundations
- **UI Design Dos and Don’ts** — https://developer.apple.com/design/tips/
- **WWDC 2017 — Essential Design Principles** — https://developer.apple.com/videos/play/wwdc2017/802/
- **WWDC 2018 — Designing Fluid Interfaces** — https://developer.apple.com/videos/play/wwdc2018/803/
- **WWDC 2026 — Principles of Great Design** — https://developer.apple.com/videos/play/wwdc2026/250/

---

## Integration with Cell Codebase

Apply this knowledge to:
- `src/shared/styles/tokens.json` — canonical token source
- `src/shared/styles/tokens.css` — generated artifact (do not edit directly)
- `src/shared/ui/*` — shared component patterns
- `docs/design-system/DESIGN.md` — implementation rules
- `src/entrypoints/design-system-showcase/` — prototype before production
