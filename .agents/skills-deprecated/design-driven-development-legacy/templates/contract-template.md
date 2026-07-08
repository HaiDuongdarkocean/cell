# Design Contract — <Feature Name>

> **Linked mockup**: `docs/mockups/mockup-<feature>.html`
> **Approval**: Approved by anh on <YYYY-MM-DD>
> **Mockup revision**: v<N>
> **Create this file ONLY if**: UI is complex (multi-state 4+ AND multi-token 5+ AND new interaction pattern). Otherwise mockup header approval is enough.

## 1. Intent contract (from intent-<feature>.md)

### User outcome
<What the feature does for the user — 1-2 sentences>

### Risk (must NOT happen)
- <Risk 1 — e.g., "Don't steal focus from video when opening">
- <Risk 2 — e.g., "Don't block video playback">
- <Risk 3>

### Implementation constraints (platform bounds)
- **Runtime**: <popup (React) | sidepanel (React) | content-script (DOM factory)>
- **Token source**: <theme.css direct | themeTokens.ts mirror (ADR-015 T12)>
- **New dependency**: <none | list if any>

## 2. Bounded variance (bounds for G4 code)

### Tokens reused (from design-system.md Section 1)
| Token | Value (light / dark) | Used in mockup | Source |
|---|---|---|---|
| --color-primary | #2563eb / #60a5fa | <e.g., Selected item accent> | theme.css:8 |
| --color-surface | #f8fafc / #1e293b | <e.g., Panel bg> | theme.css:13 |
| <...> | | | |

### New tokens (if any — cite ADR + spec §)
| Token | Value | Cite | Mockup line |
|---|---|---|---|
| <none — all reused> | | | |

### Interaction patterns (approved — cite ADR)
| Pattern | ADR | Applied how |
|---|---|---|
| Pointer Events drag + setPointerCapture | ADR-015 | <e.g., Drag panel position> |
| Keyboard: ArrowDown/Up + Enter + Esc | ADR-009 | <e.g., Navigate dropdown> |

### Accessibility floor (WCAG 2.1 AA)
- **Contrast**: text on surface ≥ 4.5:1 (verified: <#0f172a on #f8fafc = 15.8:1 ✅>)
- **Touch target**: ≥ 44px (desktop) / ≥ 56px (touch)
- **ARIA**: <role="listbox" + aria-selected | aria-pressed | aria-expanded>
- **Focus**: visible focus ring (--color-border-focus)

### Edge states (must mockup + implement)
- **Empty**: "<message>"
- **Loading**: <skeleton rows | spinner>
- **Error**: "<message> + retry"
- **<other state>**: <description>

## 3. Approval (Step 3 — anh duyệt)

- **Visual**: Approved by anh on <YYYY-MM-DD>
- **Edge states**: All <N> states reviewed
- **A11y**: Contrast + touch target + ARIA verified
- **Dark mode**: Verified
- **Intent drift check**: <Mockup matches intent, no change needed | Intent updated — see intent-<feature>.md rev <N>>

## 4. Implementation traceability (G4 + G5 use)

### G4 code must comply
- DOM structure matches mockup (data-testid, role, aria-label)
- CSS values match tokens (no raw hex, no hardcoded spacing)
- All <N> edge states implemented
- Keyboard navigation per approved patterns above

### G5 verify (drift check)
- MCP screenshot popup/content-script → compare with mockup screenshot
- Drift check: button size, color, spacing, position
- Accepted deviations (if any):
  - <none yet>
- Unresolved design debt (if any — for G7 audit):
  - <none yet>

## 5. Revision history

| Rev | Date | Change | Approved by |
|---|---|---|---|
| v1 | <YYYY-MM-DD> | Initial mockup | Anh |
| <vN> | | | |
