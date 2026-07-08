# References — Cell Extension

> **Status**: Reference values from research. Our tokens ([tokens/](tokens/)) remain source of truth. This file documents the research basis for our token choices.

## YouTube Color Palette (reference only — not our tokens)

| YouTube Token | Light | Dark | Usage | Our equivalent |
|---|---|---|---|---|
| `--yt-spec-text-primary` | `#0f0f0f` | `#f1f1f1` | Primary text | `--color-text: #0f172a` / `#f1f5f9` |
| `--yt-spec-text-secondary` | `#606060` | `#aaa` | Secondary text | `--color-text-secondary: #475569` / `#cbd5e1` |
| `--yt-spec-text-tertiary` | `#909090` | `#717171` | Tertiary/disabled | `--color-text-muted: #94a3b8` / `#64748b` |
| `--yt-spec-border-color` | `#c6c6c6` | `#3f3f3f` | Hairline borders | `--color-border: #e2e8f0` / `#334155` |
| `--yt-spec-general-background-a` | `#ffffff` | `#181818` | Page bg | `--color-background: #ffffff` / `#0f172a` |
| `--yt-spec-general-background-b` | `#f9f9f9` | `#0f0f0f` | Alternate bg | `--color-surface: #f8fafc` / `#1e293b` |
| `--yt-spec-brand-link-text` | `#065fd4` | `#065fd4` | Links | `--color-primary: #2563eb` / `#60a5fa` |

> **Note**: Our Slate palette is cooler-toned than YouTube's neutral grey. Both follow the same semantic role structure. We do NOT adopt YouTube's exact hex values.

## Typography Scale Comparison

| Level | YouTube | M3 | Our token | Notes |
|---|---|---|---|---|
| Display | 57sp | display-large | — | N/A — popup has no hero moments |
| Headline | 32sp | headline-large | — | N/A — popup compact |
| Title (page) | 22sp | title-large | `--font-size-lg: 16px` | Scaled down for 480px popup |
| Title (section) | 14sp | title-small | `--font-size-base: 14px` | Match |
| Body | 14sp | body-medium | `--font-size-sm: 13px` | Slightly smaller (compact) |
| Label | 12sp | label-medium | `--font-size-xs: 12px` | Match |
| Caption | 10sp | label-small | — | N/A — not used |

## Spacing Scale Comparison

| Token | YouTube/M3 | Our token | Match? |
|---|---|---|---|
| xs | 4px | `--spacing-xs: 4px` | ✅ |
| sm | 8px | `--spacing-sm: 8px` | ✅ |
| md | 12px | `--spacing-md: 12px` | ✅ |
| lg | 16px | `--spacing-lg: 16px` | ✅ |
| xl | 24px | `--spacing-xl: 24px` | ✅ |
| 2xl | 32px | — | Add if needed |
| 3xl | 48px | — | Add if needed |

> **Note**: Our spacing scale already follows 4dp base unit (M3 principle). No changes needed.

## Border Radius Scale Comparison

| Token | YouTube | M3 | Our token | Notes |
|---|---|---|---|---|
| xs | 4px | 4px | — | Add `--radius-xs: 4px` if needed |
| sm | 8px | 8px | `--radius-sm: 6px` | Close — 2px difference |
| md | 10px (cards) | 8px | `--radius-md: 8px` | Match M3 |
| lg | 12px | 12px | `--radius-lg: 12px` | ✅ |
| xl | 16px | 16px | — | Add if needed |
| 2xl | 18px (buttons) | — | — | YouTube-specific, not adopted |
| full | 9999px | 9999px | `--radius-full: 9999px` | ✅ |

> **Note**: YouTube uses 10px for cards, 18px for buttons. We use 8px (M3) for cards, 6px for small controls. Both follow "scale with size" principle.

## Accessibility Conventions (WCAG refs)

| Convention | Spec | WCAG ref | Our compliance |
|---|---|---|---|
| Contrast ≥ 4.5:1 (normal text) | Token pairs verified | [1.4.3](https://www.w3.org/TR/WCAG22/#contrast-minimum) | ✅ All text tokens meet |
| Contrast ≥ 3:1 (large text) | Token pairs verified | [1.4.3](https://www.w3.org/TR/WCAG22/#contrast-minimum) | ✅ |
| Touch target ≥ 44px (desktop) | Min height/width | [2.5.5](https://www.w3.org/TR/WCAG22/#target-size-enhanced) | ✅ Nav cluster 32px (compact exception) |
| Touch target ≥ 48×48dp (M3) | M3 baseline | M3 guidelines | Should — upgrade nav cluster to 40px+ |
| Focus indicator visible | 2px solid, 2px offset | [2.4.7](https://www.w3.org/TR/WCAG22/#focus-appearance) | ✅ `--color-primary` ring |
| Color not sole info carrier | Shape + text + icon backup | [1.4.1](https://www.w3.org/TR/WCAG22/#use-of-color) | ✅ Active = pill bg + text color |
| Keyboard operable | Enter/Space/Arrow/Esc | [2.1.1](https://www.w3.org/TR/WCAG22/#keyboard) | ✅ All interactive elements |

---

## Research Sources (27 total)

**Web sources (8+):**
- Material Design 3 — https://m3.material.io/
- Google Design — https://design.google/
- YouTube Design System (Refero) — https://styles.refero.design/style/8fc58a26-47be-406e-8429-37925551c0ec
- YouTube Blog (Ambient mode) — https://blog.youtube/inside-youtube/youtube-ambient-color-mode-visual-language-redesign/
- Android Settings Guidelines — https://source.android.com/docs/core/settings/settings-guidelines
- Android Developers Settings — https://developer.android.com/design/ui/mobile/guides/patterns/settings
- Windows Settings Guidelines — https://learn.microsoft.com/en-us/windows/apps/design/
- Nielsen Norman Group — https://www.nngroup.com/
- SaaS Settings Patterns — https://setting.page/, https://saasui.design/
- GitLab Pajamas — https://design.gitlab.com/patterns/settings-management

**Video sources (6):**
- YouTube Insiders: VidCon 2023 Settings improvements — https://www.youtube.com/watch?v=MAKWhN32T6k
- YouTube Insiders: New Look Sneak Peek — https://www.youtube.com/watch?v=JSEkfOHUbLk
- Google Design: Make Material your own — https://www.youtube.com/watch?v=HbAFGivZ158
- Figma Config 2024: Design systems best practices — https://www.youtube.com/watch?v=MJTCfSFLUGE
- Figma Config 2024: Broken promises of design systems — https://www.youtube.com/watch?v=BQXTt-NZ2Bs
- Figma Config 2024: Value of opinions in design systems — https://www.youtube.com/watch?v=piRTrMcoIqA

**Written analysis (13+):**
- YouTube Blog: Decoding YouTube's new design language
- Google Design: YouTube's New Red — https://design.google/library/youtube-new-red-color
- Florencio Zavala: YouTube Brand Standards case study — https://www.florenciozavala.com/case-studies/youtube
- PRINT Magazine: YouTube at 20 — https://www.printmag.com/3d-visualization/youtube-at-20-designing-a-brand-that-lives-with-culture/
- Chris Bettig: YouTube Identity — https://chrisbettig.com/work/youtube
- Chris Bettig: YouTube 2024 Update — https://chrisbettig.com/work/youtube-2024
- PageFlows: YouTube Settings Flow — https://pageflows.com/post/desktop-web/settings/youtube
- UX Horizon: YouTube UX analysis — https://uxhorizon.com/youtube-ux-why-its-so-easy-to-keep-watching/
- Medium: Top 7 UX Laws YouTube uses — https://medium.com/design-bootcamp/top-7-ux-laws-youtube-perfectly-uses-to-keep-you-hooked-bb7e51d2dd1e
- DUMBO Design: YouTube UX model — https://dumbo.design/en/insights/the-simple-model-behind-youtubes-compelling-ux/
- Substack (Eliz Laraki): How one UX researcher ignited YouTube changes
- YouTube Accessibility Plan (Canada) — https://support.google.com/youtube/answer/16668503
- Medium: Heuristic Evaluation of YouTube — https://medium.com/@mohaneeshkumar1/heuristic-evaluation-of-youtube-a-ux-experts-s-perspective-8e48bf100000

---

## Specs & Standards

- **DSDS — Design System Documentation Spec**: https://github.com/somerandomdude/design-system-documentation-schema (8 entity types + document-block system — inspired this folder's structure)
- **W3C Design Tokens Format**: https://www.designtokens.org/ (token values source of truth — this folder complements, doesn't duplicate)
- **DSDS documentation site**: https://designsystemdocspec.org/
- **Adobe Spectrum Design Data spec**: https://spectrum.adobe.com/ (DSDS credits this for layered model: structural rules + quality rules + testable criteria)
- **Keep a Changelog 1.1.0**: https://keepachangelog.com/en/1.1.0/ (changelog format — see [CHANGELOG.md](CHANGELOG.md))

## ADRs referenced

- **ADR-003**: Background ↔ content-script messaging (tabId filter)
- **ADR-007**: Auto-load subtitle on URL change (id-level dedup)
- **ADR-009**: Keyboard shortcuts (single keydown → action)
- **ADR-011**: Side-panel per-tab state
- **ADR-012**: Two-phase render wipe (SPA navigation)
- **ADR-013**: `chrome.storage.local` + `onStorageChanged` realtime persist
- **ADR-015 T12**: `themeTokens.ts` mirror pattern — `docs/adr/015-subtitle-drag-integrated.md`
- **ADR-016**: FSD screaming architecture (feature/domain)
- **ADR-018**: Nav-cluster tokens — `docs/adr/018-subtitle-navigation-control-cluster.md`
- **ADR-022**: Runtime theme customization — `docs/adr/022-port-theocean-theme-system.md` (9 core tokens, system mode, WCAG validation, import/export)

## Legacy

- **Legacy inventory**: `docs/reviews/design-system-inventory-2026-07-02.md` (snapshot — superseded by this folder)
