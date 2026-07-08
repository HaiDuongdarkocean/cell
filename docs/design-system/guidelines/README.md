# Guidelines — Cell Extension

> DSDS-style: level + rationale + examples. Guidelines = "khi nào" dùng cái gì.

## Guideline files

| File | Content | Level range |
|---|---|---|
| [development.md](development.md) | Dev guidelines — tokens, composition, content-script, dependencies | must / should / must-not |
| [accessibility.md](accessibility.md) | A11y guidelines + WCAG conventions (§4) — keyboard, ARIA, contrast, target size | must / should |
| [content.md](content.md) | Content guidelines — component docs, plain language | must |
| [layout.md](layout.md) | Layout guidelines (Settings) — organization, density, defaults, danger zone | must / should |
| [visual.md](visual.md) | Visual guidelines — softened black, hairline borders, radius scaling, strategic color | should |

## Levels

| Level | Meaning |
|---|---|
| **must** | Hard contract — violating breaks a11y, semantics, or sync. Block merge. |
| **must-not** | Anti-pattern — never do this. Block merge. |
| **should** | Strong recommendation — follow unless deliberate override documented in ADR. |

---

## Conflict resolution

> When two guidelines conflict, apply these resolution rules in order. If unresolved, escalate to ADR ([../governance.md#contribution-process](../governance.md#contribution-process)).

### Resolution priority (highest → lowest)

| Priority | Rule | Why |
|---|---|---|
| 1 | **`must` + `must-not` override `should`** | Hard contracts (a11y, semantics) beat soft recommendations (visual polish) |
| 2 | **Accessibility > visual** | WCAG violations exclude users; visual imperfections annoy. A11y wins. |
| 3 | **Content correctness > layout convention** | Wrong label harms more than wrong grouping — fix content first |
| 4 | **Specific guideline > general guideline** | "Touch target ≥ 44px" (specific) beats "minimize visual weight" (general) when conflict |
| 5 | **ADR decision > all guidelines** | An approved ADR is a deliberate override — guidelines yield to documented decisions |

### Common conflicts + resolutions

| Conflict | Resolution | Example |
|---|---|---|
| "Reserve primary for key actions" vs "Active state needs visibility" | Active state may use primary — active IS the key action. Use `--color-primary-subtle` bg (subtle) not full primary bg (loud). | Nav active item: subtle bg + primary text |
| "Max 4-5 per card" vs "Group by user intent" | User intent wins — if a group has 7 related settings, keep them in 1 card (splitting breaks mental model). Add a divider ([../patterns/settings.md#layout-primitives](../patterns/settings.md#layout-primitives)) instead. | Overlay group: 7 settings in 1 card with dividers |
| "Touch target ≥ 44px" vs "Popup compact (480px)" | Compact context allows 40px (`--nav-cluster-size-sm`) with ADR-018 exception documented. 44px is `should`, not `must`. | Nav cluster small variant: 40px (ADR-018) |
| "Plain language" vs "Technical accuracy" | Plain language for labels; technical terms allowed in helper text/tooltip. Label = what users DO, helper = how it works. | Label: "Use real-time updates" / Helper: "Falls back to WebSocket when HTTP polling fails" |
| "Composition over configuration" vs "Component needs many variants" | If >3 boolean props control behavior → split into 2 components (composition). If ≤3 → props OK. | `IconButton` with variant+size (2 props) OK; if added `active+disabled+loading` → split to `ToggleButton` |
| "Immediate feedback (no save)" vs "Destructive action needs confirmation" | Destructive overrides immediate — confirm dialog before applying destructive change. Non-destructive = immediate. | Toggle: immediate. Reset: confirm dialog first. |

### Escalation

If a conflict is not covered above:
1. Check existing ADRs (`docs/adr/`) — an ADR may already decide.
2. If no ADR — draft one ([../governance.md#contribution-process](../governance.md#contribution-process)) with the conflict + chosen resolution + rationale.
3. DS Owner approves → ADR merged → conflict resolved + documented for future.
