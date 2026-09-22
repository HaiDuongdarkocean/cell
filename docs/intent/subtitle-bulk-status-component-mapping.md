# Component Mapping — Subtitle bulk status

> Chosen direction: **Concept B — Water wash** (`docs/intent/subtitle-bulk-status-design-brief.md`).
> Scope of visual delta is deliberately tiny: one CSS rule on token spans + one a11y live region. Everything else is existing mechanism wiring (controllers, selection store, extraction) with no UI.

| Element | Component | Decision | Token(s) | Icon |
|---|---|---|---|---|
| Selected-state wash on token spans — CSS rule in `tokenSpanCss.ts`, both builders (`buildTokenSpanCss` + `buildTokenSpanCssForShadow`) | — | extend | `--color-primary-subtle` (~18% `color-mix` wash via `background-image`) | — |
| Selected modifier class on cue-list token spans — `CueListTokenText` in `CueList.tsx` (feature code, not shared/ui) | — | extend | same wash via shared token CSS | — |
| Selection-count announcement region — one per page, visually hidden | VisuallyHidden | reuse | — | — |
| Selected-state injected var `cell-token-selected-bg` — `CELL_TOKEN_MAP` in `tokenSpanCss.ts` | — | extend | `derived.light.color-primary-subtle` / `derived.dark.color-primary-subtle` | — |
| Ctrl/cmd+click + Esc + 1–4 interaction — existing `statusKeyControls` + `CueListTokenize` opt-in callback | — | extend | — | — |
| Local-player subtitle overlay tokens — existing `SubtitleBlock` token rendering | — | reuse | existing token CSS | — |

## Notes

- **No new shared/ui component is created.** The only DOM addition is a single `VisuallyHidden` `aria-live="polite"` region per page for selection-count announcements.
- The wash uses `background-image` (`linear-gradient(color-mix(in srgb, <primary-subtle-ish>…) 0 0)`) so it composes with the frequency pill's `background-color` and never touches the status underline's `box-shadow` — one rule covers all status×band combinations.
- Token CSS variables are injected via `CELL_TOKEN_MAP` in `tokenSpanCss.ts` (host pages don't load `tokens.css`), so the wash color must be added there as a mapped var, not referenced as `--color-primary-subtle` directly.
- No icons. No new strings beyond the announcement message (i18n `en.json` + `vi.json`).
- Mockup `src/entrypoints/mockup-subtitle-bulk-status/` is a design-time artifact — deleted at ship.
