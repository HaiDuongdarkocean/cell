# Interface Inventory Template

> Fill this during Step 1. Cite file:line for every claim. No "it feels inconsistent" — only measured evidence.

## Project context

- **Project**: <name>
- **UI source root**: <path, e.g. src/>
- **Runtime contexts**: <list: popup, sidepanel, content-script, web, mobile...>
- **Existing token file**: <path or "none">
- **Date audited**: <YYYY-MM-DD>

## Component families

### Buttons

| Call site | File:line | Size | Radius | Hover bg | Hover color | Focus ring | Token or raw? |
|---|---|---|---|---|---|---|---|
| <name> | <file:line> | 32x32 | var(--radius-sm) | var(--color-surface-hover) | var(--color-text) | 2px focus | token |
| ... | ... | ... | ... | ... | ... | ... | ... |

**Inconsistencies found:**
- #<n>: <description> — <file:line> vs <file:line>. Type: Visual/Architecture/Interaction/By-design.

### Cards

| Call site | File:line | Radius | Border | Hover | Selected | Token or raw? |
|---|---|---|---|---|---|---|
| ... | ... | ... | ... | ... | ... | ... |

**Inconsistencies found:**
- #<n>: ...

### Inputs

| Call site | File:line | Radius | Border | Focus | Padding | Token or raw? |
|---|---|---|---|---|---|---|
| ... | ... | ... | ... | ... | ... | ... |

### Tags / Badges

| Call site | File:line | Radius | Font-size | Background | Token or raw? |
|---|---|---|---|---|---|
| ... | ... | ... | ... | ... | ... |

### Toggles / Switches

| Call site | File:line | Size | Knob | On color | Off color | Token or raw? |
|---|---|---|---|---|---|---|
| ... | ... | ... | ... | ... | ... | ... |

### Dropdowns / Selects

| Call site | File:line | Trigger radius | Menu radius | Hover | Selected | Token or raw? |
|---|---|---|---|---|---|---|
| ... | ... | ... | ... | ... | ... | ... |

### Dialogs / Modals

| Call site | File:line | Radius | Overlay | Close button | Token or raw? |
|---|---|---|---|---|---|
| ... | ... | ... | ... | ... | ... |

### Empty states

| Call site | File:line | Icon | Title | Hint | Token or raw? |
|---|---|---|---|---|---|
| ... | ... | ... | ... | ... | ... |

## Raw value audit (tokens bypassed)

| Raw value | File:line | Token that should be used | Reason it was bypassed |
|---|---|---|---|
| rgba(239,68,68,0.08) | <file:line> | --color-error-subtle (missing) | token not defined |
| #1a1a2e | <file:line> | --color-surface-dark (missing) | hardcoded scene backdrop |
| ... | ... | ... | ... |

## Cross-runtime token coverage

| Runtime context | Receives tokens? | How? | Drift risk |
|---|---|---|---|
| popup | yes | imports tokens.css | none |
| sidepanel | no | — | HIGH — inline styles |
| content-script | yes | themeTokens.ts inject | MEDIUM — mirror file drift |

## Summary

- **Total inconsist**: <n>
- **By type**: Visual <n>, Architecture <n>, Interaction <n>, By-design <n>
- **Critical (must fix)**: <n>
- **Token gaps**: <n> raw values that need new tokens
- **Cross-runtime gaps**: <n> contexts without token injection
- **Recommendation**: proceed to Step 2 / fix critical only / already consistent
