# Intent: Design System Showcase HTML

> Output of `interview-me` session for `docs/design-system/design-system-showcase.html`.

## Confirmed intent

- **Outcome:** A single HTML file at `docs/design-system/design-system-showcase.html` that acts as the visual single source of truth for Cell's design system.
- **Auto-regenerate:** Hook into `npm run build` so it updates automatically without manual edits.
- **Display layers:**
  1. **Foundational:** tokens (color, spacing, typography, radius, shadow, border), icons.
  2. **Component catalog:** name, props, snippet, and **real rendered** variants.
  3. **Pattern & screen preview:** full previews of real screens/panels — popup dictionary, subtitle panel, universal panel, card creator, block UI, etc.
  4. **Standards:** usage guidance (when/why to use what).
- **Principle:** Do not write new component code. Use a transform function/script that reads from the existing codebase.
- **Constraint:** No complex build. Simple hook into existing `npm run build`.

## Open questions for spec phase

- How to render real React components into a static HTML file during build without duplicating component code?
- How to discover and import `src/shared/ui/**/*.tsx` and `src/features/**/ui/**/*.tsx`?
- How to extract props/variants from TypeScript component files?
- How to render full panel/screen previews that may require context/providers?
- How to keep the showcase lightweight and fast (<3s response)?
