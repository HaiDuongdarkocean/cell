# Design System Inventory — Subtitle Navigation Control Cluster

> **Date**: 2026-07-02
> **Phase**: G3 Design (`design-system-ui-ux` Step 1-4)
> **Feature**: Subtitle Navigation Control Cluster (spec `docs/specs/spec-subtitle-navigation-control.md`, ADR-018)
> **Runtime context**: Content-script isolated world (cluster injected into `video.parentElement`)
> **Token source**: `src/entrypoints/popup/styles/theme.css` (popup) + `src/shared/lib/themeTokens.ts` (content-script mirror, ADR-015 T12)

## Step 1 — Interface Inventory

### Cluster = NEW surface (no existing cluster UI to audit)

Cluster là feature mới — chưa có DOM/CSS trong codebase. Inventory focus:
1. **What tokens exist** mà cluster phải reuse (không invent mới nếu đã có).
2. **What cluster-specific tokens** cần thêm (size, opacity, half-circle — không có trong existing tokens).
3. **Cross-runtime injection**: cluster chạy trong content-script isolated world → phải dùng `themeTokens.ts` mirror (ADR-015 T12), không thể import `theme.css` trực tiếp.

### Existing tokens cluster sẽ reuse

| Token | Value (light / dark) | Cluster use |
|---|---|---|
| `--color-text-inverse` | #ffffff / #0f172a | Button icon color (cluster on dark video bg → white icons) |
| `--color-primary` | #2563eb / #60a5fa | Active/repeat-hold state accent |
| `--color-surface` | #f8fafc / #1e293b | Cluster bg base (before opacity) |
| `--color-border` | #e2e8f0 / #334155 | Button divider |
| `--shadow-md` | 0 4px 12px rgba(0,0,0,0.08) / 0.4 | Cluster floating shadow |
| `--transition` | 150ms ease | Button hover/collapse transition |
| `--radius-md` | 8px | Button radius (44px touch target) |
| `--radius-full` | 9999px | Half-circle collapse (border-radius 50% 0 0 50%) |
| `--spacing-xs` | 4px | Button internal padding |

### Cluster-specific tokens cần thêm (NEW — cite spec §)

| Token | Value | Cite |
|---|---|---|
| `--nav-cluster-size-sm` | 40px | spec §NF1 (touch target small) |
| `--nav-cluster-size-md` | 48px | spec §NF1 (default medium) |
| `--nav-cluster-size-lg` | 56px | spec §NF1 (touch target large) |
| `--nav-cluster-bg-opacity-default` | 0.7 | spec §F10 (bg opacity setting default) |
| `--nav-cluster-btn-opacity-default` | 0.9 | spec §F10 (button opacity setting default) |
| `--nav-cluster-collapse-size` | 32px | spec §F4 (half-circle diameter) |
| `--nav-cluster-edge-threshold` | 20px | spec §F4 (drag-to-edge collapse threshold) |
| `--nav-cluster-z-index` | 1000001 | spec §NF2 (above subtitle overlay 999999) |
| `--nav-cluster-repeat-hold-ms` | 500 | spec §F7 (hold threshold) |
| `--nav-cluster-no-sub-window-ms` | 3000 | spec §F9 (no-sub repeat window) |

### Inconsist count: 0 (new surface, no existing cluster to conflict)

**Stop condition check**: 0 inconsist → nhưng cluster cần NEW tokens (size/opacity/collapse không có trong existing) → proceed Step 2 (token addition) + Step 3 (atom extraction). Skip drift audit (Step 5) cho cluster — baseline 0.

## Step 2 — Token Foundation

### Approach: extend existing `theme.css` + `themeTokens.ts` mirror (NOT new file)

Cluster chạy trong content-script → dùng `themeTokens.ts` mirror. Popup settings panel (Navigation tab) dùng `theme.css`. Cả 2 phải sync (ADR-015 T12 pattern).

### Tokens to add (both files — keep in sync)

```css
/* === Nav Cluster — spec §NF1, §F4, §F7, §F9, §NF2 === */
--nav-cluster-size-sm: 40px;
--nav-cluster-size-md: 48px;
--nav-cluster-size-lg: 56px;
--nav-cluster-bg-opacity-default: 0.7;
--nav-cluster-btn-opacity-default: 0.9;
--nav-cluster-collapse-size: 32px;
--nav-cluster-edge-threshold: 20px;
--nav-cluster-z-index: 1000001;
--nav-cluster-repeat-hold-ms: 500;
--nav-cluster-no-sub-window-ms: 3000;

/* Nav cluster colors — reuse existing tokens, no new color */
/* bg = --color-surface with opacity (rgba via token composition) */
/* icon = --color-text-inverse */
/* active/repeat accent = --color-primary */
/* border = --color-border */
```

**Token Fatigue guard**: 10 new tokens, all ≤3 words (`nav-cluster-size-sm`, `nav-cluster-bg-opacity-default` = 4 words but semantic — "default" suffix disambiguates from user setting). No alias-of-alias. Every token cites spec §.

**No new color tokens** — cluster reuses `--color-surface`, `--color-text-inverse`, `--color-primary`, `--color-border`. Opacity applied via `rgba()` composition in CSS (not new token) — user-adjustable via settings (`navClusterBgOpacity`, `navClusterButtonOpacity`).

### Cross-runtime injection

- **Content-script** (cluster DOM): `themeTokens.ts` already injected by `contentScriptController.init` (ADR-015 T12, line 74). Add nav-cluster tokens to `LIGHT_TOKENS` + `DARK_TOKENS` strings. No new injection point.
- **Popup** (Navigation tab settings): `theme.css` already bundled via Vite. Add nav-cluster tokens to `:root` + `[data-theme="dark"]`.
- **Sync test** (Step 4): unit test asserting `themeTokens.ts` token list matches `theme.css` token list.

## Step 3 — Atom Extraction

### Rule of Three gate

| Component family | Call sites sharing behavior | Extract? |
|---|---|---|
| Nav cluster button (⋯/◀/🔁/▶/⏪/⏩) | 6 buttons in 1 cluster, same click/hold/ARIA pattern | **YES** — 6 ≥ 3 |
| Nav cluster drag handle (⋯) | 1 (only ⋯ is drag handle) | **NO** — 1 < 3, inline in controller |
| Nav cluster collapse half-circle | 1 (only collapsed state) | **NO** — 1 < 3, CSS class in controller |
| Nav cluster settings slider | 3 sliders in Navigation tab (size, bg opacity, btn opacity) | **YES** — 3 ≥ 3, but reuse existing slider atom if present |

### Atom: `NavClusterButton`

```typescript
// src/features/subtitle/ui/navClusterButton.ts (new)
interface NavClusterButtonProps {
  /** Icon glyph (⋯/◀/🔁/▶/⏪/⏩). */
  icon: 'drag-handle' | 'prev' | 'repeat' | 'next' | 'rewind' | 'forward';
  /** ARIA label for the button. */
  ariaLabel: string;
  /** Click handler (for prev/next/seek). */
  onClick?: () => void;
  /** Hold start (for repeat). */
  onHoldStart?: () => void;
  /** Hold end (for repeat). */
  onHoldEnd?: () => void;
  /** aria-pressed state (for repeat toggle). */
  pressed?: boolean;
  /** data-testid suffix. */
  testId: string;
}
export function createNavClusterButton(props: NavClusterButtonProps): HTMLButtonElement;
```

**Why atom**: 6 buttons share click/hold/ARIA/data-testid pattern. Single change (e.g. add focus ring) fixes all 6. Pure DOM factory (content-script can't use React).

**Why NOT React atom**: Cluster runs in content-script isolated world, not React tree. Existing content-script UI (`subtitlePanel.ts`, `subtitleOverlay.ts`) uses DOM factories (`createToggleButton`, `createOverlayLayer`). Mimic pattern.

### Atom: `SettingsSlider` (reuse if exists, else extract)

Check existing `SettingsDialog` for slider pattern. If 3+ sliders already exist with shared behavior → extract. If <3 → inline in `NavClusterSettingsPanel`.

## Step 4 — Enforcement

### Multi-runtime → 3 layers (per skill: multi-runtime = checklist + lint + sync test)

1. **Review checklist**: `checklists/drift-audit-checklist.md` — reviewer runs on UI-touching PR. Check: cluster uses tokens (no raw hex/px), atoms extracted for Rule of Three, mirror files in sync.

2. **Lint rule** (grep-based pre-commit): ban raw hex in `navClusterController.ts` + `navClusterButton.ts` + `NavClusterSettingsPanel.tsx`. Ban inline `style.cssText` with color/opacity in cluster files.

3. **Sync test** (unit): `tests/unit/shared/lib/themeTokens.test.ts` — assert `themeTokens.ts` token list matches `theme.css` token list (parse both, compare token names + values). Catches drift when someone edits one file and forgets the other. **Already needed for existing tokens** (ADR-015 T12 ceiling) — cluster tokens added to same test.

## Step 5 — Drift Audit (baseline, not re-run)

Cluster = new surface, 0 inconsist baseline. Re-run Step 1 quarterly (G7) hoặc khi thêm runtime context. First drift audit after G4 implementation + G5 testing complete.

## Verification

- [x] Interface Inventory exists (0 inconsist, new surface, tokens to reuse + add cited)
- [x] Token addition flat (10 tokens, all ≤3-4 words, every token cites spec §)
- [x] Atom Registry: `NavClusterButton` (6 call sites, Rule of Three pass), `SettingsSlider` (conditional)
- [x] Enforcement: 3 layers (checklist + lint + sync test) — multi-runtime project
- [x] Drift Audit: baseline 0, re-run quarterly

## Related

- **Spec**: `docs/specs/spec-subtitle-navigation-control.md`
- **ADR**: `docs/adr/018-subtitle-navigation-control-cluster.md`
- **Token source**: `src/entrypoints/popup/styles/theme.css` + `src/shared/lib/themeTokens.ts` (mirror)
- **Pattern reuse**: ADR-015 T12 (themeTokens injection), ADR-013 (overlay layer atoms)
- **Next**: `frontend-ui-engineering` builds cluster HOW (ARIA toolbar, responsive touch target, state machine) using these tokens + atoms.
