# Visual Guidelines — Cell Extension

| Guidance | Level | Rationale |
|---|---|---|
| Visual: use `#0f0f0f`-style softened black, not pure `#000000` | should | YouTube principle — softer feel while maintaining max contrast (our `--color-text` = `#0f172a` already follows this) |
| Visual: 1px hairline borders for card definition, not heavy shadows | should | YouTube uses borders, shadows reserved for floating elements only |
| Visual: border-radius scales with element size (4px small → 18px large) | should | YouTube rounding philosophy — consistent scaling, not random values |
| Visual: reserve branded/primary color for key actions only | should | YouTube strategic color — default states monochromatic for efficiency + a11y |

## Examples

| Guidance | ✅ Do | ❌ Don't |
|---|---|---|
| Softened black, not pure #000 | `--color-text: #0f172a` (already) | `color: #000000` |
| 1px hairline borders for cards | `border: 1px solid var(--color-border)` | `box-shadow: 0 4px 12px rgba(0,0,0,0.3)` for card definition |
| Border-radius scales with size | small control `--radius-sm: 6px` → card `--radius-md: 8px` → panel `--radius-lg: 12px` | Everything `border-radius: 4px` (no scaling) |
| Reserve primary color for key actions | Default button: surface bg; Active state: primary bg | Every button: primary bg (color noise) |
