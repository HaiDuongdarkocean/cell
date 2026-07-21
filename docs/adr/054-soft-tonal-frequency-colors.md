# ADR-054: Soft Tonal frequency band colors

## Status

Accepted

## Context

Tokenize renders frequency bands (core/common/general/advanced/rare) as solid pills directly on arbitrary web pages. The previous palette used saturated semantic colors derived from `--color-success`, `--color-warning`, `--color-info`, `--color-secondary`, and `--color-muted`.

In dark mode these saturated colors produced bright, high-chroma pills (green `#10b981`, amber `#f59e0b`, blue `#60a5fa`) that felt harsh and uncomfortable against the host page, especially on long reading sessions. ADR-052 introduced five frequency bands; ADR-053 defined the pill + status-bar rendering model and noted that `advanced` and `rare` shared the same dark color because the design system lacked dedicated frequency tokens.

We needed a dedicated color set that is:
- comfortable in dark mode (low eye strain)
- still distinguishable across the five bands
- readable on both light and dark host pages
- maintainable through the design-token SSOT (`tokens.json`)

## Decision

Use a **Soft Tonal** palette for frequency band tokens, with dedicated `color-token-freq-*` tokens in `src/shared/styles/tokens.json`.

### Light mode

Muted pastel backgrounds with dark, high-contrast text:

| Band | Background | Foreground |
|------|------------|------------|
| core | `#e2f3e7` | `#14532d` |
| common | `#e5effd` | `#1e3a8a` |
| general | `#fdf9e6` | `#713f12` |
| advanced | `#fff3e8` | `#7c2d12` |
| rare | `#f3f4f6` | `#1f2937` |

### Dark mode

A single slate container (`#374151`) for all bands, paired with soft pastel text. The uniform container reduces visual noise and prevents saturated color patches on dark pages; the text colors still distinguish the bands:

| Band | Background | Foreground |
|------|------------|------------|
| core | `#374151` | `#bbf7d0` |
| common | `#374151` | `#bfdbfe` |
| general | `#374151` | `#fef08a` |
| advanced | `#374151` | `#fed7aa` |
| rare | `#374151` | `#f3f4f6` |

### Implementation

- Add `color-token-freq-*-bg` and `color-token-freq-*-fg` to `tokens.json` `derived.light` and `derived.dark`.
- Expose them through `tokens.ts` (`DEFAULT_LIGHT_TOKENS` / `DEFAULT_DARK_TOKENS` and `deriveColorTokens`) so custom core palettes still resolve to the same Soft Tonal frequency colors.
- Update `tokenSpanCss.ts` to use these dedicated tokens instead of deriving from `--color-success`, `--color-warning`, etc.
- Regenerate `tokens.css` via `scripts/generate-tokens.js`.

## Consequences

- Dark-mode tokens are significantly less jarring on long reading sessions.
- The five bands remain distinguishable by text color and the status underline.
- `advanced` and `rare` no longer share the same dark color (they share the container but use `#fed7aa` and `#f3f4f6` text), resolving the gap noted in ADR-053.
- Frequency colors are now design-system tokens, so future palette changes happen in one place (`tokens.json`).
- Known/ignored words still hide the frequency pill (`background: transparent`, `color: inherit`) as decided in ADR-053; on pages with poor text/background contrast this remains a limitation of the host page, not the token palette.
- The single dark container `#374151` can blend into host pages with the same gray background; the light text on top remains readable, but the token box may become subtle. This is an acceptable trade-off for a calmer dark mode.
