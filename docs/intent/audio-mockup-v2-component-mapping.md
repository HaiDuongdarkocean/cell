# Audio — Mockup v2 Component Mapping

> Mapping the chosen v2 concept (D/E/F) to the existing Cell design system.

## Shared mock pieces (reused by all v2 concepts)

| UI element | File | Reuse / extend / create | Notes |
|---|---|---|---|
| `AudioTester` | `src/entrypoints/mockup-audio/common.tsx:37` | **Reuse** | `Input` + `Select` + `Button`. Used in D/E/F. |
| `PriorityChain` | `src/entrypoints/mockup-audio/common.tsx:90` | **Reuse** | `ol` + `Button` Up/Down. Used in D/E/F. |
| `LocalPackagePanel` | `src/entrypoints/mockup-audio/common.tsx:167` | **Reuse** | `Select`, `Button`, `Input`, `SettingsRow`. |
| `TtsSettingsPanel` | `src/entrypoints/mockup-audio/common.tsx:250` | **Reuse** | `Toggle`, `Select`, slot selects. |
| `TtsTesterPanel` | `src/entrypoints/mockup-audio/common.tsx:308` | **Reuse** | `Textarea`, `Select`, voice list. |
| `TtsLocalPacksPanel` | `src/entrypoints/mockup-audio/common.tsx:422` | **Reuse** | `Toggle`, `Select`, pack list. |

## Concept D — Stepper mapping

| UI element | Component | Action |
|---|---|---|
| Step rail | Custom `nav` + `button` | **Create** (small local component) |
| Step number circle | `Text` / `Icon` | **Reuse** |
| Step content area | `Card` + `VStack` | **Reuse** |
| Footer Back/Next/Save | `Button` | **Reuse** |
| Section headers | `Heading` + `Icon` + `Text` | **Reuse** |

## Concept E — Accordion mapping

| UI element | Component | Action |
|---|---|---|
| Sticky audio tester | `AudioTester` (common) | **Reuse** |
| Collapsible sections | `Accordion` from `@/shared/ui` | **Reuse** |
| Accordion trigger layout | Custom children inside `Accordion.Trigger` | **Extend** (style only, no new API) |
| Section content | `PriorityChain`, `LocalPackagePanel`, `TtsSettingsPanel`, etc. | **Reuse** |

## Concept F — Split inspector mapping

| UI element | Component | Action |
|---|---|---|
| Top tester | `AudioTester` (common) | **Reuse** |
| Left source rail | Custom `aside` + `button` | **Create** |
| Active rail item | `Button` / custom | **Reuse** `Button` with custom style |
| Right detail pane | `Card`-like surface | **Reuse** `Card` or `Surface` |
| Engine-to-detail routing | Local state in `ConceptF.tsx` | **Create** |

## Decision rules

1. **No new `src/shared/ui` components** are required for any of D/E/F.
2. **Local-only components** (step rail, split rail) are acceptable inside the mockup entrypoint; they should only be promoted to `src/shared/ui` if a second production feature needs them.
3. All styles live in `src/entrypoints/mockup-audio/mockup.module.css` and use tokens only.
4. If Concept D is chosen, consider extracting a generic `Stepper` to `src/shared/ui` only after a second use case appears (e.g., onboarding, setup wizard).
5. If Concept F is chosen, consider whether `Sidebar` or `CollapsibleSidebar` can replace the custom rail before production.
