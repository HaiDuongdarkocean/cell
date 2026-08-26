# ADR-091: Atomic Design Taxonomy for Cell Design-System Showcase

**Status:** Accepted  
**Date:** 2025  
**Author:** Devin  
**Context:** Restructuring `src/entrypoints/design-system-showcase` sidebar taxonomy.

---

## 1. Context

The Cell design-system showcase uses a Brad-Frost-style atomic design hierarchy (`foundations`, `atoms`, `molecules`, `organisms`, `pages`) to organize 100+ showcases. During a sidebar redesign, there was confusion over whether color, typography, spacing, shape, motion, iconography, and grid should be treated as "foundations" or whether concrete UI components such as `Heading`, `Text`, `Icon`, `Grid`, `Flex`, `Container`, `Section`, `Box`, `AspectRatio`, `Separator`, and `Transition` should be moved into `foundations` because they relate to those dimensions.

This ADR records the original definitions, the distinction between design tokens (subatomic) and functional UI atoms, and the resulting classification rules used in the showcase.

---

## 2. Atomic design: the original five levels

Brad Frost defines **atomic design** as a methodology for creating interface design systems with five distinct stages:

1. **Atoms**
2. **Molecules**
3. **Organisms**
4. **Templates**
5. **Pages**

> Source: Brad Frost, *Atomic Design* (2013)  
> https://bradfrost.com/blog/post/atomic-web-design/  
> https://atomicdesign.bradfrost.com/chapter-2/

These are **concurrent mental-model stages**, not a linear workflow. Each stage is both a concrete thing and a way to think about the whole system.

---

## 3. What is an atom?

Brad Frost (original 2013 article):

> "Atoms are the basic building blocks of matter. Applied to web interfaces, **atoms are our HTML tags, such as a form label, an input or a button**."
>
> "Atoms can also include more abstract elements like **color palettes, fonts** and even more invisible aspects of an interface like **animations**."

Source: https://bradfrost.com/blog/post/atomic-web-design/

Brad Frost (book, Chapter 2):

> "If atoms are the basic building blocks of matter, then the **atoms of our interfaces serve as the foundational building blocks that comprise all our user interfaces**. These atoms include basic HTML elements like **form labels, inputs, buttons**, and others that can't be broken down any further without ceasing to be functional."

Source: https://atomicdesign.bradfrost.com/chapter-2/

**Key property:** an atom is the **smallest functional unit**. A `<button>` by itself is an atom; broken down further it is no longer functional. A color `#5E6AD2` is not functional on its own — it must be applied to an atom (e.g. the background of a button) to do work.

---

## 4. Design tokens are subatomic, not atoms

In 2019 Brad Frost explicitly introduced **design tokens as the subatomic particles of atomic design**:

> "In the natural world, atoms are the basic building blocks of matter. **Atoms are the smallest functional units of matter**, despite being composed of smaller particles such as protons, neutrons, and electrons."
>
> "In the world of UI, **design tokens are subatomic particles**. The design token `color-brand-blue` is a critical ingredient of a UI, but it's not exactly functional on its own. It needs to be applied to an 'atom' (such as the background color of a button) in order to come to life."

Source: https://bradfrost.com/blog/post/extending-atomic-design/  
Also: https://bradfrost.com/blog/post/design-tokens-atomic-design-%e2%9d%a4%ef%b8%8f/

This is consistent with other major design systems:

- **Cloudscape Design System** (AWS): "In the world of atomic design, if components are atoms that function as the basic building blocks of the system, **design tokens are the sub-atomic particles used to build components**."  
  Source: https://cloudscape.design/foundation/visual-foundation/design-tokens/

- **Atlassian Design**: design tokens are "name and value pairings that represent small, repeatable design decisions. A token can be a color, font style, unit of white space, or even a motion animation designed for a specific need."  
  Source: https://atlassian.design/foundations/tokens/design-tokens

- **VA.gov / USWDS**: primitive tokens are the "foundational building blocks" — colors, spacing, typography, elevation, opacity.  
  Source: https://design.va.gov/foundation/design-tokens

- **SAP Digital Design System**: foundation tokens include "Typography, Spacing, Radius, Foundation Colors."  
  Source: https://www.sap.com/design-system/digital/foundations/tokens/design-tokens/

**Conclusion:** color, typography, spacing, shape, motion, iconography, and grid — as abstract values/decisions — are **design tokens / foundations**, conceptually **subatomic**. The components that consume and render those tokens remain **atoms**.

---

## 5. Decision

1. **The showcase keeps a separate `foundations` level**, but it is understood as a token-reference layer, not one of the five atomic-design stages. It contains token swatches and design-principle documentation (e.g. `Foundation`, `Color Scale`, `Spacing Scale`).

2. **Atoms are the smallest functional React components / HTML primitives in `src/shared/ui/`**, including:
   - **Content atoms:** `Heading`, `Text`, `Icon`, `Separator`, `Avatar`, `Blockquote`, `Code`...
   - **Layout atoms:** `Box`, `Flex`, `Grid`, `Container`, `Section`, `AspectRatio`...
   - **Action atoms:** `Button`, `Input`, `Toggle`, `Checkbox`, `Radio`...
   - **Utility atoms:** `Transition`, `Portal`, `VisuallyHidden`...

3. **Do not reclassify a concrete UI component as `foundations` merely because it consumes or displays a token.** A `Color` token scale showcase can be `foundations`; a `Heading` component cannot.

4. **M3 Design Tokens**, because it documents an external / deprecated reference, is classified under `atoms/Reference` with `status: 'deprecated'` rather than being presented as a Cell foundation.

---

## 6. Consequences

- The sidebar hierarchy now separates **token reference** (Foundations) from **functional components** (Atoms).
- `Foundations` is small and focused: Overview, Color, Spacing (and future token scales such as Typography, Shape, Motion if needed — but only as token references, not components).
- `Atoms` is the largest level because it correctly holds all primitive UI components.
- Future designers/agents can refer to this ADR instead of guessing whether a component is a foundation or an atom.

---

## 7. References

1. Brad Frost, *Atomic Design* (original blog): https://bradfrost.com/blog/post/atomic-web-design/
2. Brad Frost, *Atomic Design Methodology* (book chapter): https://atomicdesign.bradfrost.com/chapter-2/
3. Brad Frost, *Extending Atomic Design*: https://bradfrost.com/blog/post/extending-atomic-design/
4. Brad Frost, *Design Tokens + Atomic Design = ❤️*: https://bradfrost.com/blog/post/design-tokens-atomic-design-%e2%9d%a4%ef%b8%8f/
5. Cloudscape, *Design tokens*: https://cloudscape.design/foundation/visual-foundation/design-tokens/
6. Atlassian Design, *Design tokens*: https://atlassian.design/foundations/tokens/design-tokens
7. VA.gov Design System, *Design tokens*: https://design.va.gov/foundation/design-tokens
8. SAP Digital Design System, *Design tokens*: https://www.sap.com/design-system/digital/foundations/tokens/design-tokens/
