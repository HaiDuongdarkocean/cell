# ADR-092: Dewdrop Liquid-Glass Button — Purity Rules

> ⚠️ **Superseded note (2026-09-08):** Tài liệu này tham chiếu Liquid Glass / glass material / blur — vật liệu này đã bị loại khỏi Cell. Luật thiết kế hiện hành: `docs/design-system/DESIGN_RATIONALE.md`; checklist: `docs/design-system/DESIGN.md`. Nội dung yêu cầu tính năng trong tài liệu vẫn hiệu lực; chỉ các mô tả visual kiểu glass/blur không còn áp dụng.

**Status:** Accepted  
**Date:** 2025  
**Author:** Devin  
**Context:** Defining the non-negotiable visual principles for the "Dewdrop" (Sương Mai) liquid-glass button treatment so that it remains as pure as a morning dewdrop on a leaf.

---

## 1. Context

The Cell design system is exploring a "Liquid Glass" button family. Version A is codenamed **Dewdrop (Sương Mai)**. The creative inspiration is a single drop of water resting on a leaf at dawn:

> "Hạt sương đậu trên lá lúc bình minh. Trong suốt — nhìn xuyên qua thấy lá mờ do nước khúc xạ. Ánh dương phản chiếu trên mặt cong. Khi chạm nhẹ, rung 'có như không', làn sóng lan ra làm tâm hồn vui sướng."

A dewdrop is **pure, transparent, and weightless**. It has no pigment, no solid border, and no opaque body. All visual information comes from **light** (reflection, refraction, caustics) and **shadow** (contact with the leaf, surface curvature). Any design that adds a solid fill, a colored border, or an opaque backing violates the core metaphor.

This ADR records the goal, acceptance criteria, and non-negotiable rules that keep the Dewdrop button faithful to that metaphor while still being usable as an action button.

---

## 2. Goal

Create a liquid-glass button that is **as pure as a dewdrop**: transparent, colorless, and borderless. It must communicate actions and states through **light and shadow alone** — never through solid color, opaque fills, or visible borders. The background behind the button must always be perceptible, refracted but never hidden.

---

## 3. Acceptance Criteria

| # | Criterion | How to verify |
|---|---|---|
| AC1 | **Transparent body** | The background behind the button is always visible, at least blurred, through the glass body. |
| AC2 | **No border** | No solid stroke, outline, ring, or visible edge line. "Edge" is only a soft light/shadow gradation. |
| AC3 | **No opaque color fill** | Variants (primary, success, destructive, etc.) do not use solid color as a background or border. |
| AC4 | **Natural light** | Only two diagonal light sources (135° and 315°) on the curved surface, each fading radially, transparent, and independent. |
| AC5 | **Natural shadow** | A soft contact shadow where the drop touches the surface, plus a curved inner shadow that suggests the water's lens-like bulge. No lift shadow on hover. |
| AC6 | **Gentle interaction** | Hover brightens/shifts light subtly; press scales down slightly (~0.985) as if pressing the water surface; focus shows a soft, non-solid ring; active adds a faint glow. The drop never lifts off the leaf. |
| AC7 | **Edge-case legibility** | On bright, dark, patterned, or photographic backgrounds, text remains readable through text-shadow and sufficient blur/contrast — not through an opaque backing. |
| AC8 | **Reduced-motion respect** | Ripple and transitions reduce or disable when `prefers-reduced-motion` is active. |

---

## 4. Non-negotiable Rules

These rules are hard constraints. A mockup or implementation that violates any of them is **not a Dewdrop**.

| # | Rule | Rationale |
|---|---|---|
| **R1** | **NO solid background color.** The glass background must remain translucent; any tint must be extremely faint (`alpha < 0.45` in light mode, `alpha < 0.55` in dark mode). | A dewdrop is transparent water, not tinted plastic. |
| **R2** | **NO solid border, stroke, or ring.** No `border`, `outline`, or `box-shadow` that creates a visible, continuous edge line with `alpha > 0.3`. | A dewdrop has no "frame"; its edge is defined only by refraction and caustics. |
| **R3** | **NO color-fill variants.** Primary, success, destructive, etc. must not use solid color as a background or border. Variant meaning is conveyed only through a faint tint in reflected light. | Color pigments are impurities in pure water. |
| **R4** | **NO lift shadow on hover.** The drop stays on the leaf. No `translateY(-*)` or strong shadow that makes it appear to float. | A water drop adheres to the surface; it does not levitate. |
| **R5** | **NO opaque text-protection layer.** Do not place a solid dark or light layer behind text to fake contrast. Use `text-shadow` and strong `backdrop-filter` blur instead. | An opaque backing would hide the leaf behind the drop. |
| **R6** | **ALWAYS maintain refraction.** `backdrop-filter: blur(...)` is mandatory. The background must remain visible through the button in every state. | Refraction is the defining visual property of a glass/water drop. |
| **R7** | **ALWAYS use light and shadow only for feedback.** Hover, press, focus, active, and disabled states are communicated only by changes in light intensity, shadow depth, or subtle scale. | Anything else introduces foreign visual material. |
| **R8** | **ALWAYS use two diagonal light sources.** Light catches the curved surface at 135° and 315°, symmetrically. Each source is local and fades independently; they do not merge into a continuous beam. | This matches the physics of light on a convex water surface. |
| **R9** | **NEVER use an opaque white glow.** Highlights must be transparent (`alpha < 0.35` in light, `alpha < 0.15` in dark) with a soft radial fade. | A solid glow looks like plastic, not water. |
| **R10** | **Color tint belongs only in reflected light.** If a variant needs a color signal, it can only appear in the faint rim caustics or reflected highlight, never in the body fill. | Pigment stays on the surface it reflects from; it does not tint the water itself. |

---

## 5. Known violations to fix

The current `liquid-glass-dewdrop.html` mockup violates these rules in several places:

1. **Dark mode glass opacity 0.68** → violates **R1**. Must be reduced to `0.45–0.55` and compensated with stronger blur and text-shadow.
2. **Variant background tints too strong** (`primary-soft` at `0.22`) → violates **R1 + R3**. Must be reduced to `0.08–0.12`.
3. **Edge-case row on bright/white backgrounds** → the dark buttons look like solid buttons, hiding the background; violates **R1 + R6**.
4. **Variant rim glow too saturated** → violates **R10**. Color must be a very faint tint in the caustic, not a bright rim.

---

## 6. Consequences

- The Dewdrop button will look more delicate and "real" because it never pretends to be a solid object.
- Color variants become much more subtle; accessibility must be guaranteed through contrast of the text-shadow and the dark vibrancy layer, not through background color.
- Dark mode requires careful calibration: a dark but still translucent vibrancy layer (`0.45–0.55`) plus `blur(18–22px)`, plus a strong dark text-shadow, preserves both the metaphor and WCAG AA text contrast.
- Edge-case testing becomes essential: the button must remain transparent on white, gradient, pattern, and photographic backgrounds.

---

## 7. References

1. Brad Frost, *Atomic Design*: https://bradfrost.com/blog/post/atomic-web-design/
2. Apple, *Liquid Glass* design language (visual reference for translucent materials and light).
3. Current mockup: `src/entrypoints/design-system-showcase/mockups/liquid-glass-dewdrop.html`
