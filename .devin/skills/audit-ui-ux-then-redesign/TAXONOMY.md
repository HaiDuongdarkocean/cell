# Component Taxonomy & Atomic Rules

## Core Rule

**Every UI element must earn its place in the system.** Before creating, prove it cannot be built from what already exists.

## Atomic Design Layers

```text
Token → Atom → Molecule → Organism → Template → Page
```

### Layer Rules

| Layer | What it is | Can contain | Must not |
|---|---|---|---|
| **Token** | Color, type, space, radius, elevation, motion, z-index | values only | component logic |
| **Atom** | Smallest UI unit: button, icon, input, label | tokens only | other atoms, layout logic |
| **Molecule** | 2+ atoms working together: search field, input + label + error | atoms, tokens | new elevation, new shape |
| **Organism** | Distinct section: card, header, form, table | molecules + atoms | card-in-card of same type |
| **Template** | Layout grid, breakpoints, page skeleton | organisms, regions | content, hardcoded spacing |
| **Page** | Specific instance | template + content | new tokens, new components |

### No-Skip Rule

A page cannot skip molecules and directly compose atoms into an organism. A template cannot invent new token values. If you find a page doing this, the fix belongs at the layer below.

## Box Contract

Any container with regions (Card, Dialog, Panel, Page section) has at most:

- **Header**
- **Body**
- **Footer**
- **Aside** (optional)

Each region self-manages its own padding. The parent container does **not** add padding. This keeps spacing predictable and composable.

## Reuse / Extend / Create / Remove Decision Tree

For each UI element in the page:

1. **Does a shared component already cover this?**
   - Yes → **Reuse**. Use it. No discussion.
2. **Can it be built from 2+ existing atoms without new tokens?**
   - Yes → **Extend**. Compose it.
3. **Is it unique to this page and not reusable?**
   - Yes → Ask: **"Should it exist at all?"**
     - No → **Remove** or collapse into an existing pattern.
     - Yes → **Create**. Document why it is unique.
4. **Does it duplicate an existing element?**
   - Yes → **Remove** or **Refactor** the duplicate into a variant.

## Guard Questions

- Does this element need a new token? If yes, is it a real gap or a one-off?
- Does this element appear on more than one page? If yes, it belongs in shared UI.
- If you remove this element, does the page still work? If yes, remove it.

## Anti-Patterns

| Pattern | Why it's wrong |
|---|---|
| Page invents a new button style | Violates single source of truth |
| Card contains another card | Organism nests same type |
| Molecule adds its own box-shadow | Adds elevation at wrong layer |
| Template adds padding to a component | Breaks component portability |
