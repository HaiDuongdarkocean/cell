# Design Principles — Cell Extension

> **Source**: 27 sources researched (Material Design 3, Google Design, YouTube Blog, YouTube Design System, Android Settings Guidelines, NN/g, SaaS patterns, conference talks). See [../references.md](../references.md) for full list.
> **Status**: Reference principles — apply when designing new UI, not enforced tokens. Our tokens ([../tokens/](../tokens/)) remain source of truth for values.
> **Last updated**: 2026-07-03

---

## YouTube Core Philosophy

| # | Principle | Meaning | Apply to |
|---|---|---|---|
| 1 | **Content-First Utility** | UI là canvas gần monochrome, không cạnh tranh với content. "Design gets out of the way" | Popup, overlay — keep UI restrained, let media/subtitles shine |
| 2 | **Natural Evolution** | Design changes = evolution, không revolution. Test với users trước khi commit | All UI changes — iterate, don't redesign from scratch |
| 3 | **Rounded Shapes Philosophy** | Rounded = friendly, inviting, comfortable to tap. Radii scale theo placement/size/relationship | All controls — use `--radius-sm/md/lg` scale, don't invent random values |
| 4 | **Softened Contrast** | Dùng `#0f0f0f` thay vì pure `#000000` — softer, less aggressive, vẫn max contrast | Our `--color-text: #0f172a` already follows this principle |
| 5 | **"Alive" Brand** | Brand moves with content, reacting, shifting. Dynamic rather than declarative | Animations, transitions — subtle motion, not static |
| 6 | **Strategic Color Usage** | Reserve branded/primary color cho key actions ONLY. Default states = monochromatic | `--color-primary` only for active state, focus, key actions — not everywhere |

## Material Design 3 Core

| # | Principle | Meaning | Apply to |
|---|---|---|---|
| 7 | **4dp Grid System** | All spacing theo 4dp base unit — consistent visual rhythm | Our `--spacing-xs/sm/md/lg/xl` (4/8/12/16/24) already follows this |
| 8 | **Semantic Color Roles** | Colors assigned by role (primary/secondary/tertiary/neutral), không arbitrary | Our token naming (`--color-text`, `--color-surface`) already semantic |
| 9 | **Tone-Based Accessibility** | Color combinations based on luminance → ensure 4.5:1 contrast | Verify token pairs in both light + dark mode |
| 10 | **Material You: Comfortable** | Make users feel "at home" via personalization | Theme toggle (light/dark) — users choose their comfort |
| 11 | **Material You: Spirited** | Imbue digital interfaces with natural world qualities (organic forms) | Rounded radii, subtle transitions — not harsh rectangles |

## Settings-Specific Principles

| # | Principle | Meaning | Apply to |
|---|---|---|---|
| 12 | **Progressive Disclosure** | Reveal essential only, defer less important to secondary screens | Advanced settings collapse, core settings visible |
| 13 | **User Intent Organization** | Group by what users want to DO, không phải system architecture | 5 groups: Media / Overlay / Shortcuts / Nav Cluster / Download |
| 14 | **Friction-Scaled to Risk** | Destructive actions require confirmation proportional to consequence | Reset settings → confirm dialog; toggle → no confirm |
| 15 | **Single-Column Focus** | Settings dùng narrow reading measure (~680-720px max) cho readability | Popup 480px — within reading measure |
| 16 | **Polite Defaults** | Defaults = common, no risk, don't interrupt, don't hurt battery/performance | All default settings values |
| 17 | **Immediate Feedback** | Switches change state instantly, no "Save" button | All toggle/select in settings |

---

## Conflict resolution

Khi 2 principles xung đột → xem [../guidelines/README.md#conflict-resolution](../guidelines/README.md#conflict-resolution) (priority rules + 6 common conflicts). Nếu unresolved → escalate to ADR ([../governance.md#contribution-process](../governance.md#contribution-process)).
