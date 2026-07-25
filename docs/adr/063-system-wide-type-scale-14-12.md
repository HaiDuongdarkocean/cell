# ADR-063: System-wide 14/12px type scale (SSOT)

## Status
Accepted — implemented in Slice 1 of system-wide UI-UX redesign.

## Context
The codebase had a fragmented type scale:
- `tokens.json` defined `sm=13px`, `md=15px`, `lg=16px`, `xl=18px`, `2xl=20px`, `3xl=24px`, `4xl=30px`, `2xs=10px`.
- `shared/ui` atoms, feature UIs, entrypoints, and content-script CSS used `var(--font-size-sm)`, `var(--font-size-lg)`, etc., so 13px/15px/16px/18px were rendered in many places.
- The product intent is a flat, readable UI with only **14px body** and **12px caption/small** text, consistent across React, popup, sidepanel, options, and content-script overlays.

## Decision
1. Canonical text sizes are **14px** (`--font-size-base`) and **12px** (`--font-size-xs`) only.
2. Update `tokens.json` so that every `--font-size-*` token resolves to one of those two values:
   - `sm`, `base`, `md`, `lg`, `xl`, `2xl`, `3xl`, `4xl` → `14px`
   - `xs`, `2xs` → `12px`
3. Regenerate `tokens.css` from `tokens.json`; do not edit generated artifacts by hand.
4. Replace all `font-size` declarations in `.module.css`, `.ts` CSS strings, and `.html` pages with `var(--font-size-base)` / `var(--font-size-xs)`.
5. For decorative icons/emoji (not reading text), use `font-size: var(--space-*)` so icon sizing is independent of the type scale and remains visually consistent.
6. Runtime/user-controlled subtitle overlay font sizes (`--sb-target-font`, `--sb-native-font`) are intentionally excluded — those are content, not UI chrome.

## Consequences
- Positive: one SSOT for typography; no more 13px drift; React and content-script UIs share the same two text sizes.
- Positive: `tokens.json` change alone fixes every current and future misuse of `var(--font-size-sm)` for body text.
- Trade-off: headings are now the same 14px size as body; hierarchy is expressed through `font-weight`, `color`, and spacing rather than larger type. This matches the flat design system.
- Risk: icon-only elements that were sized via `font-size-3xl` etc. must be explicitly converted to `--space-*`; missing conversions would shrink icons to 14px. We audited and converted all known cases.

## Verification
- `grep` for `font-size:` not using `base`, `xs`, or `--space-*` in `src/` returns only runtime subtitle variables.
- `npm run build`, `npm run typecheck`, `npm run test:unit` pass.
