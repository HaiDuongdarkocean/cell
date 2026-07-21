# ADR-053: Tokenize visual style — solid pill + status bar without host box-model impact

## Status
Accepted

## Context
Tokenize wraps words on arbitrary web pages in `<span>` elements. We need to show:
- a frequency band indicator (core/common/general/advanced/rare)
- a status bar (unknown/tracking/known/ignore)
- correct rendering in light and dark mode
- correct rendering for multi-line words

The design must not disturb the host page's layout, line-height, or spacing.

## Decision
Use a **solid color pill** for frequency and a **2px inset status bar** rendered with `box-shadow`, both applied directly to the token `<span>`:
- `display: inline` (not `inline-block`) to avoid creating extra inline boxes.
- No `padding`, `margin`, or `line-height` added; the host text metrics are preserved.
- `border-radius: 0.15em` gives the pill a slight rounding without expanding the box.
- `box-decoration-break: clone` ensures a word that wraps across lines renders as separate pill fragments per line.
- Status is a `box-shadow: inset 0 -1px 0 0 <status-color>, inset 0 -1px 0 0 rgba(255,255,255,0.45)`. The 1px colored underline is paired with a 1px white highlight at the same offset so the underline remains visible when the status color matches the pill background.
- Known and ignored words hide the frequency pill and the status underline by default; the status underline reappears on hover. A `.js-cell-token--popup-open` pin (set by the popup dictionary controller while its popup is open) keeps the status underline visible even when the token is not hovered, so changing a word to known/ignore inside the popup does not hide its status bar until the popup dismisses. No extra de-emphasis (opacity/line-through) is applied to ignored words so they render like known words.
- Dark/light support uses `:root` defaults, `@media (prefers-color-scheme: dark)`, and `[data-theme="light"]` / `[data-theme="dark"]` overrides so the extension theme setting wins over the OS preference.
- Rare text uses `--color-text-muted` instead of `--color-muted-foreground` for better contrast on the muted pill.

## Consequences
- Tokens remain visually prominent while the host page's typography and spacing are left untouched.
- Multi-line tokens still receive per-fragment styling.
- The `box-shadow` status bar may overlap descenders on pages with very tight `line-height`; this is the trade-off for not adding padding.
- `advanced` and `rare` share similar dark-mode colors because the design system currently maps both `--color-secondary` and `--color-muted` to `#334155` in dark mode. A future token addition (`--color-frequency-advanced`, `--color-frequency-rare`) would resolve this.
