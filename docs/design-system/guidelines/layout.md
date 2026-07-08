# Layout Guidelines (Settings) — Cell Extension

| Guidance | Level | Rationale |
|---|---|---|
| Settings: organize by user intent, not system architecture | must | "Account/System/Preferences" mean nothing to users — group by what users want to DO |
| Settings: max 10-15 items per screen, 4-5 per card | should | Over 15 = overwhelming, over 5 per card = scan fatigue |
| Settings: stable category names (no frequent relabeling) | must | Relabeling creates navigation debt — users relearn location each change |
| Settings: polite defaults (common, no risk, no battery drain) | must | Android Settings guideline — defaults should be safe + common |
| Settings: danger zone at bottom, distinct visual framing | should | Spatial separation signals "this is different" — prevents accidental destructive action |

## Examples

| Guidance | ✅ Do | ❌ Don't |
|---|---|---|
| Organize by user intent | Groups: Media / Overlay / Shortcuts / Nav Cluster / Download | Groups: System / Preferences / Advanced |
| Max 10-15 items per screen, 4-5 per card | 12 settings across 3 cards (4 each) | 20 settings in 1 card |
| Stable category names | "Overlay" stays "Overlay" across versions | "Overlay" → "Subtitles" → "Captions" across releases |
| Polite defaults | Default: overlay enabled, parallel = auto | Default: overlay disabled, parallel = manual (forces config) |
| Danger zone at bottom, distinct framing | Reset card at bottom with `--color-error-subtle` bg | Reset button next to a toggle (no separation) |
