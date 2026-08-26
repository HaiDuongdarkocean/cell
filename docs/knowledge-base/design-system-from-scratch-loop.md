# Design System from Scratch — Vòng lặp cải tiến liên tục

> Design system không phải là "thiết kế xong là xong". Nó là một hệ thống sống: **xây → dùng → quan sát → học → cải tiến → phát hành → lặp lại**. Tài liệu này tổng hợp pipeline đầy đủ từ bối cảnh sản phẩm đến governance và liên tục cải tiến, dùng cho việc tự học hoặc đào tạo team.

---

## Pipeline tổng thể

```text
                    DESIGN SYSTEM
                         │
        ┌────────────────┴────────────────┐
        │                                 │
   PRODUCT / UX                       BRAND
        │                                 │
        └────────────────┬────────────────┘
                         ↓
                  DESIGN PRINCIPLES
                         ↓
                  DESIGN DIRECTION
                         ↓
                     FOUNDATION
        ┌────────────────┼────────────────┐
        ↓                ↓                ↓
      Color         Typography        Spacing
      Shape          Elevation          Grid
      Icon            Motion          Layout
                         ↓
                      TOKENS
                         ↓
                  COMPONENT MODEL
                         ↓
                  ATOMIC ARCHITECTURE
                         ↓
        ┌────────────────┼────────────────┐
        ↓                ↓                ↓
    Primitives       Components       Patterns
        │                │                │
        └────────────────┼────────────────┘
                         ↓
                      STATES
                         ↓
                   ACCESSIBILITY
                         ↓
                    DOCUMENTATION
                         ↓
                    DESIGN ↔ CODE
                         ↓
                     GOVERNANCE
                         ↓
                  CONTINUOUS EVOLUTION
                         │
                         └────────────────→ (quay lại Research / Foundation)
```

---

## 0. Product / UX Context

Đây là điểm bắt đầu duy nhất đúng đắn.

**Cần trả lời:**

- Sản phẩm là gì? Giải quyết vấn đề gì?
- User là ai? Họ cần làm gì?
- Platform nào? (web, mobile, extension, TV)
- Brand personality là gì?
- Business requirements và technical constraints?

**Luận điểm:** Nếu không hiểu context, mọi quyết định màu sắc, spacing, component sẽ trở thành guessing.

**Ví dụ:** Với Cell — language-learning product, user 10–25 tuổi, cần tập trung vào nội dung học → UI phải minimal, ưu tiên readability, giảm configuration.

---

## 1. Research & Inspiration

Cảm hứng là bước quan trọng, nhưng cần được chia nhỏ và phân tích có hệ thống.

**Research references:**

- Material 3
- Apple HIG
- Fluent 2
- Carbon
- Polaris
- Ant Design
- Radix
- shadcn/ui

**Câu hỏi phân tích:**

```text
What do they use?
Why do they use it?
What problem does it solve?
Can I reuse the principle?
```

**Luận điểm:** Không copy visual. Mục tiêu là tìm ra **design language** và **interaction pattern**, sau đó adapt vào context của mình.

---

## 2. Design Principles

Trước khi tạo component, xác định các nguyên tắc quyết định hệ thống sẽ trông như thế nào.

**Ví dụ cho một design system "học tập":**

1. Learning first
2. Minimal configuration
3. Clear hierarchy
4. Accessible by default
5. Consistent interaction
6. Progressive disclosure

**Luận điểm:** Design principles là bộ lọc để mỗi quyết định thiết kế sau này đều có thể tự bảo vệ.

---

## 3. Design Direction

Bắt đầu quyết định visual language.

**Những yếu tố cần chốt:**

- Brand personality
- Visual style
- Tone
- Emotional direction
- Density
- Contrast
- Shape
- Typography
- Motion

**Ví dụ:** Minimal — Soft — Focused — Educational — Friendly — Modern.

**Luận điểm:** Chỉ sau bước này designer mới nên mở Figma và bắt đầu vẽ hi-fi.

---

## 4. Foundation

Đây là **nền móng** của Design System. Foundation phải được xác định trước tokens.

### Color

- Primary, secondary, tertiary
- Neutral, error, warning, success, info
- Surface, background, outline

### Typography

- Font family
- Font size
- Font weight
- Line height
- Letter spacing
- Text styles

### Spacing

- 4, 8, 12, 16, 20, 24, 32, 40, 48, ...

### Shape

- Radius: none, small, medium, large, full

### Elevation

- Level 0, 1, 2, 3, ...

### Layout

- Container, grid, columns, gutter, margin, breakpoint

### Iconography

- Size, stroke, style, alignment, optical correction

### Motion

- Duration, easing, transition, animation

**Luận điểm:** Foundation là ngôn ngữ thiết kế. Tokens chỉ là cách mã hóa ngôn ngữ đó.

---

## 5. Design Tokens

Sau khi Foundation ổn định, mã hóa chúng thành tokens.

### Ba tầng token

```text
Primitive Token
      ↓
Semantic Token
      ↓
Component Token
```

**Ví dụ:**

```text
Primitive:   blue.500, gray.900, spacing.4, radius.8
Semantic:    color.primary, color.text.primary, color.surface, color.border
Component:   button.container.primary, button.label.primary, button.border.primary
```

**Luận điểm:** Token là single source of truth cho màu sắc, typography, spacing và các quyết định thiết kế khác. Nó kết nối design và code. Token càng có cấu trúc rõ ràng, hệ thống càng dễ scale.

> "Design tokens are the building blocks of all UI elements. The same tokens are used in designs, tools, and code." — Material 3

---

## 6. Component Architecture

Đây là lúc Atomic Design bắt đầu có giá trị.

```text
Foundation
     ↓
Tokens
     ↓
Primitives
     ↓
Components
     ↓
Patterns
     ↓
Templates
```

### Atomic Design (Brad Frost)

- **Atoms:** nhãn, input, button, color, font
- **Molecules:** nhóm atom có chức năng
- **Organisms:** phần UI phức tạp hơn
- **Templates:** bố cục trang
- **Pages:** thực thể cụ thể với nội dung thật

**Luận điểm:**

> "Atomic design is a methodology composed of five distinct stages working together to create interface design systems in a more deliberate and hierarchical manner." — Brad Frost
>
> "Atomic design is not a linear process, but rather a mental model to help us think of our user interfaces as both a cohesive whole and a collection of parts at the same time." — Brad Frost

---

## 7. Component States

Một component không chỉ có default. Cần định nghĩa đầy đủ states:

```text
Default
Hover
Pressed
Focused
Disabled
Loading
Selected
Error
```

Và cần variants kích thước:

```text
Small
Medium
Large
```

Và variants loại:

```text
Primary
Secondary
Ghost / Tertiary
```

**Luận điểm:** Thiếu states sẽ khiến component khi implement trở nên không đoán được và dễ sinh inconsistency.

---

## 8. Accessibility

Không nên để cuối cùng mới nghĩ tới. Nó phải chạy **song song** với component design.

**Cần kiểm tra:**

- Color contrast
- Keyboard navigation
- Focus state
- Touch target size
- Text readability
- Screen reader
- Reduced motion
- Error communication

**Luận điểm:**

> "The U.S. Web Design System is built on a foundation of accessibility." — USWDS
>
> "The ideal contrast range to meet all requirements is 7:1 - 15:1." — W3C Design System

---

## 9. Patterns

Sau khi component ổn định, bắt đầu xây UX patterns — không còn là component đơn lẻ mà là flow.

**Ví dụ:**

```text
Vocabulary Learning Pattern

Search
   ↓
Dictionary result
   ↓
Preview
   ↓
Add vocabulary
   ↓
Create card
   ↓
Review
```

**Luận điểm:** Pattern giải quyết vấn đề người dùng, không chỉ là bố cục đẹp.

---

## 10. Documentation

Design system không có documentation thì rất khó scale. Mỗi component cần trả lời:

```text
What?
Why?
When?
How?
When NOT to use?
```

**Cấu trúc tài liệu component mẫu:**

- Purpose
- Usage
- Anatomy
- Variants
- States
- Sizes
- Accessibility
- Do / Don't
- Code example

---

## 11. Design → Code

Đây là lúc design system trở thành infrastructure thực sự.

```text
Figma
  ↓
Design Tokens
  ↓
Token transformation
  ↓
CSS variables
  ↓
React components
```

**Ví dụ:**

```css
--color-primary: ...;
--color-surface: ...;
--spacing-md: ...;
--radius-md: ...;
```

```tsx
<Button variant="primary" size="md">
  Add vocabulary
</Button>
```

**Công cụ xuất hiện ở bước này:**

- Storybook
- Token pipeline
- Component library
- npm package
- Code Connect
- CI/CD
- Versioning

---

## 12. Governance

Khi Design System lớn lên, cần quy định rõ:

- Ai được tạo component?
- Ai phê duyệt thay đổi?
- Token thay đổi như thế nào?
- Breaking changes xử lý ra sao?
- Deprecated components migrate thế nào?
- Versioning quản lý như thế nào?

**Ví dụ:**

```text
Ocean DS v1.0
      ↓
Button v1
      ↓
Button v2
      ↓
Button v3
```

**Các hoạt động:**

- Contribution
- Review
- Release
- Versioning
- Deprecation
- Migration

---

## 13. Continuous Improvement

Design system không phải:

```text
Design → Done
```

Mà là:

```text
Build
 ↓
Use
 ↓
Observe
 ↓
Find problems
 ↓
Improve
 ↓
Document
 ↓
Release
 ↓
Repeat
```

**Luận điểm:** Mỗi lần lặp lại, quay về Research / Foundation để kiểm tra xem context user, platform, brand có thay đổi không.

---

## Những điểm then chốt cần nhớ

### 1. Token đứng sau Foundation, không đứng trước

Designer phải quyết định design language trước, sau đó mới encode nó thành token. Token là hệ quả, không phải khởi đầu.

### 2. Atomic Design là mental model, không phải Design System

Atomic Design giúp tổ chức UI theo thứ bậc. Design system còn bao gồm tokens, principles, patterns, documentation, governance.

### 3. Accessibility là song song, không phải add-on

Không nên để a11y cho bước cuối. Mỗi component khi thiết kế phải kèm theo contrast, focus, keyboard, touch target, reduced motion.

### 4. Design System là vòng lặp, không phải mục tiêu một lần

Hệ thống sống cần được sử dụng, quan sát, cải tiến liên tục.

---

## Nguồn tham khảo

1. **Material 3** — subsystems color, typography, shapes và design tokens: https://developer.android.com/develop/ui/compose/designsystems/material3
2. **Material 3 Typography tokens** — type scale, emphasized tokens, design tokens as building blocks: https://m3.material.io/styles/typography/type-scale-tokens
3. **Apple Human Interface Guidelines — Foundations** — platform-agnostic design fundamentals: https://developer.apple.com/design/human-interface-guidelines/foundations
4. **Brad Frost — Atomic Design** — mental model 5 stages: https://bradfrost.com/blog/post/atomic-web-design/
5. **Brad Frost — Atomic Design chapter 2** — design system methodology: https://github.com/bradfrost/atomic-design/blob/master/chapter-2.md
6. **Brad Frost — Components, Recipes, Snowflakes** — component taxonomy nuance: https://bradfrost.com/blog/post/design-system-components-recipes-and-snowflakes/
7. **W3C Design Tokens Community Group — Design Tokens Format Module** — primitive / semantic / component token layers: https://www.w3.org/community/reports/design-tokens/CG-FINAL-format-20251028/
8. **W3C Design System — Settings & Contrast** — token usage and WCAG contrast guidance: https://design-system.w3.org/settings/index.html
9. **USWDS Accessibility** — accessibility built into design system foundation: https://designsystem.digital.gov/documentation/accessibility/
10. **Cell Design System ADRs:**
    - `docs/adr/084-foundation-color-system.md`
    - `docs/adr/085-foundation-typography.md`
    - `docs/adr/086-foundation-spacing.md`
    - `docs/adr/087-foundation-shape-elevation.md`
    - `docs/adr/088-foundation-motion.md`
    - `docs/adr/089-foundation-iconography.md`
    - `docs/adr/090-foundation-grid-breakpoints.md`
    - `docs/adr/091-atomic-design-taxonomy.md`
