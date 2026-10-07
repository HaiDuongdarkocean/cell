# Design Brief — reading-annotation (all mode)

> Spec: `docs/specs/reading-annotation.md` · Intent: `docs/intent/reading-annotation.md`
> Single justified variant. This feature adds no surface — it adds one glyph-scale layer to an existing render and one settings row. The whole design problem is geometry: paint a hint above a token without moving a single pixel of the line.

## Design Read

Subtitles live on a rhythm — eyes scan the glyph stream. An annotation that shifts the line, even by 2px of line-height, breaks that rhythm and (on host pages) reflows the article. So the reading cannot take space. It must float: a small centered hint pinned above the token's own box, painted by CSS, invisible to copy and to screen readers. The subtitle zone and cue list are controlled zones — overlap risk is bounded by our own line spacing — which is exactly why the spec scopes v1 to these surfaces and keeps web pages out.

## Function audit

| Function (spec REQ) | Features | Element affected |
|---|---|---|
| batch resolution (REQ-1/2) | invisible — message + cache | `data-reading` attribute lands on `.js-cell-token-word` |
| annotation render (REQ-3) | `::before` cap above token, absolute, centered | `.js-cell-token-word` in `tokenSpanRenderer` + React twins (`CueTokenText`, `PreviewBlock.TokenSpan`) + both CSS builders |
| profile toggle (REQ-4) | "Show readings" Toggle row | Subtitle card of `SettingsDialogContent` (next to `subtitleOverlayAutoLoad` family) |
| visibility flip (REQ-4/5) | per-token `reading-off` modifier class, same mechanism as the existing `status-off`/`frequency-off` layer toggles | `applyTokenClasses` + `restyleTokenBlock` already re-apply classes → flip = restyle, no rebind |
| empty/degrade (NFR-4) | no `data-reading` → no pseudo content | nothing renders |

## Journey map

TO-BE: learner opens a zh video → subtitle line shows pinyin caps above hanzi → copies a cue → clipboard gets clean sentence text → toggles "Show readings" off in Settings → caps vanish on the next restyle, line never moves.

## Dials

DESIGN_VARIANCE 1 (pure token-layer extension of existing layer-toggle conventions) · MOTION_INTENSITY 0 (annotations appear with metadata resolution — no transition, matching status/frequency pop-in behavior) · VISUAL_DENSITY 3 (annotations are subordinate: 55% scale, reduced opacity).

## Inspiration anchor

**Furigana/ruby print typesetting** — a smaller glyph centered above its base character, subordinate in weight. Non-digital: textbook pinyin over hanzi. The digital constraint that shapes it: `::before`, not `<ruby>` — the hint must never enter the clipboard.

## Chosen variant — "Ruby cap"

- **Geometry:** `::before { content: attr(data-reading) }` on `.js-cell-token-word`; `position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%)`; the word span gains `position: relative` (inline+relative is layout-neutral). Cap may overflow the token's width symmetrically into inter-word whitespace — accepted (furigana extensions do the same); it never widens the line.
- **Type:** `font-size: 0.55em` (em-relative — overlay subtitle size is user-configured), `line-height: 1`, `white-space: nowrap`, `font-style: normal`, `font-weight: 500`, `letter-spacing: -0.01em`, `color: inherit; opacity: 0.72` — reads as hint, not content.
- **Legibility:** `text-shadow` reusing `static.shadow.sm` — same guard the status underline uses over video.
- **Layer toggle:** `showReadings` in `TokenSpanBindOptions` → a per-token `reading-off` modifier class (mirrors the existing `status-off`/`frequency-off` layer toggles); CSS rule `content: none` kills the cap without touching `data-reading` → toggle flips via `restyleTokenBlock`, zero DOM rebuild.
- **Wrapped token:** abs-pos anchors to the inline box; a token split across lines shows its cap above the first fragment — acceptable degradation, never misplaced mid-word.
- **Missing reading:** no attribute → `content: attr()` resolves empty → no box, no gap.
- **Risk:** caps may touch the line above on tightly-packed multi-line cues — mitigated by 55% size + `bottom:100%` sitting in the line-gap; verified on the two-line fixture in the mockup.

### ASCII sketch

```
     xué  xí                    ˌɪntəˈnæʃnəl
sub: 学习 汉语 很快 。    cue row:  an international bank
     ──(status underline layer unchanged below)──
```

## Component mapping

`docs/intent/reading-annotation-component-mapping.md`.
