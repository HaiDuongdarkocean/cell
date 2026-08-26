# Audit Playbook

## Core Rule

**Audit for leverage, not for exhaustiveness.** Find the few changes that carry the most weight.

## Choose Depth

| Depth | Use When | Scope |
|---|---|---|
| **quick** | User says "sửa nhanh" / time budget < 30 min | High-traffic components only |
| **standard** | Default | All interactive UI |
| **deep** | Full redesign or high-stakes page | Whole page + content + motion |

## Part 1 — Visual Audit

### Color

- Hardcoded hex / `md-sys` tokens outside token file → **P0**
- More than one accent color → **P1**
- Mixing warm and cool grays → **P1**
- Pure `#000000` / `#ffffff` without accessibility reason → **P2**
- Generic black drop shadows → **P2**

### Typography

- Body < 16px or line-width > 75ch → **P1**
- Skipping heading levels → **P1**
- All-caps subheaders without reason → **P2**
- Orphaned words on last line → **P2**

### Spacing

- No consistent 4/8px scale → **P1**
- Oversized padding destroying hierarchy → **P1**
- Misaligned baselines in card groups → **P2**

### Shape / Radius

- Mixed radius systems without documented rule → **P1**
- Uniform radius on every element → **P2**

### Elevation

- Shadows untinted → **P2**
- Cards used where spacing is enough → **P2**

## Part 2 — Layout Audit

| Check | Why | Severity |
|---|---|---|
| Primary action not visible in first 3s | Visual hierarchy fails | P0 |
| Layout breaks at 320px | Mobile-first fails | P0 |
| Related controls not grouped | Proximity fails | P1 |
| No clear focal point | Hierarchy fails | P1 |
| Generic AI layout (3 equal cards, centered hero) | Anti-default | P1 |
| `height: 100vh` instead of `min-height: 100dvh` | Mobile viewport bug | P2 |
| Complex flex percentage math | Use Grid | P2 |
| No max-width on wide screens | P2 |

## Part 3 — Interaction & State Audit

| Check | Why | Severity |
|---|---|---|
| Missing focus ring | WCAG AA | P0 |
| Touch target < 44×44px on mobile | Fitts's Law | P0 |
| No loading / empty / error states | Meaningful state | P1 |
| Navigation uses background for hover/active | No-background rule | P1 |
| No active/pressed feedback | Tactile response | P1 |
| Dead links / buttons | Visibility of system status | P1 |
| `prefers-reduced-motion` not handled | Accessibility | P1 |
| Color is sole indicator of state | WCAG | P2 |

## Part 4 — AI Tells (Landing / Marketing Pages Only)

Run this only if the page is a landing page, portfolio, or marketing surface.

| Tell | Severity |
|---|---|
| Em-dash (`—`) visible anywhere | P0 |
| 3 equal feature cards | P1 |
| Generic AI copy: "Elevate", "Seamless", "Unleash" | P1 |
| Fake names / fake numbers / Lorem Ipsum | P1 |
| Hero headline > 2 lines or subtext > 20 words | P1 |
| Logo wall inside hero | P1 |
| Two CTAs with same intent | P1 |
| Version labels in hero | P2 |
| Section-number eyebrows | P2 |
| Decorative dots without semantic state | P2 |

## Part 5 — Design-System Audit Commands

Run from project root. Adjust paths to the project.

```bash
# 1. M3 tokens
grep -rn 'md-sys-color' src/ --include="*.css" --include="*.module.css" --include="*.tsx" --include="*.ts" || true

# 2. Hardcoded hex
grep -rn '#[0-9a-fA-F]\{3,8\}' src/ --include="*.css" --include="*.module.css" | grep -v tokens.css || true

# 3. Hardcoded px in spacing/radius/sizing
grep -rn 'padding:\|margin:\|gap:\|border-radius:\|font-size:\|width:\|height:' src/ --include="*.module.css" | grep -v 'var(' | grep -v '0px' | head -100 || true

# 4. Inline SVG
grep -rn '<svg' src/ --include="*.tsx" | grep -v icons | grep -v Icon.tsx || true

# 5. Hardcoded z-index
grep -rn 'z-index:' src/ --include="*.css" --include="*.module.css" | grep -v 'var(--z-' | grep -v tokens || true
```

Classification:

| Output | Action |
|---|---|
| `md-sys-color` | P0 — replace with project token |
| `#RRGGBB` outside tokens | P0 — move to tokens |
| `px` in spacing/radius/sizing without `var(` | P1 — tokenize |
| `<svg>` outside icon catalog | P1 — move to icon catalog |
| `z-index` without token | P1 — use token scale |

## Part 6 — When to Stop

Stop auditing when you have:

- At least one **P0** that breaks user goal, OR
- Two **P1** that together explain the user's vague feedback, OR
- No findings that the user would actually notice.

If the only findings are P2/P3, ask the user whether to stop.
