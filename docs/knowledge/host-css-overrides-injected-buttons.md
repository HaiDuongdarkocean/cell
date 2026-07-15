# Host CSS overrides injected overlay buttons (learned while fixing overlay icon sizing)

> **Principle**: [Host page CSS overrides unstyled properties on injected elements](principles.md#host-page-css-overrides-unstyled-properties-on-injected-elements)

## Problem

3 overlay icon buttons (panel toggle, subtitle manager, upload) rendered at ~50% expected size on themoviebox.org, but looked correct on youtube.com. Visual inspection showed SVG icons were tiny (8px instead of 15px) inside 25px buttons.

## Root causes

Content-script injects `<button>` elements into host page DOM. Any CSS property NOT explicitly set in inline style is fair game for host page CSS cascade:

1. **themoviebox CSS** has `button { padding: 1px 6px }` — a generic rule that applies to ALL buttons including our injected ones.
2. Our overlay buttons did not set `padding` in `cssText` → host padding applied → content-box shrank from 25px to ~11px.
3. SVG `width: 65%` calculates against **content-box** (11px), not border-box (25px) → SVG rendered at 7.66px instead of 16px.
4. YouTube CSS does NOT have generic `button { padding }` rule → buttons unaffected → icons looked correct there.

Additionally: SVG `fill="none"` attribute was overridden by host CSS `svg { fill: white }` (or similar) on themoviebox, causing white fill inside icons — invisible on light backgrounds.

## Fix

Files modified:
- `src/features/subtitle/ui/subtitlePanel.ts` — added `padding: 0; box-sizing: border-box` to button cssText + `fill:none !important` to SVG inline style
- `src/features/subtitle/ui/subtitleManagerPanel.ts` — same
- `src/features/subtitle/logic/subtitleImport.ts` — same

Key changes:
```css
/* Button cssText — explicit reset */
padding: 0;
box-sizing: border-box;

/* SVG inline style — !important on fill */
style="width:65% !important;height:65% !important;display:block;fill:none !important"
```

## Key insight

Content-script injected elements live in host page DOM — host CSS cascade applies to ANY property not explicitly set. Generic host rules like `button { padding }` or `svg { fill }` silently override defaults. Two defenses: (1) explicit reset on every property that affects sizing (`padding: 0`, `box-sizing: border-box`), (2) `!important` on critical visual properties (`fill: none`, `width/height` percentage). The bug was invisible on YouTube because YouTube's CSS doesn't have those generic rules — testing on multiple hosts is required to catch host-CSS collisions.

## Verification

Live debug via Edge DevTools MCP on themoviebox.org:

Before fix:
```
panel:   { w: 25, svgW: 8,  svgWidth: "7.66px",  padding: "1px 6px" }
cluster: { w: 25, svgW: 15, svgWidth: "14.9px",  padding: "0px" }
```

After fix:
```
panel:   { w: 25, svgW: 15, svgWidth: "14.9px",  padding: "0px" }
manager: { w: 25, svgW: 15, svgWidth: "14.9px",  padding: "0px" }
upload:  { w: 25, svgW: 15, svgWidth: "14.9px",  padding: "0px" }
```

All 4 buttons now have identical SVG render size (15px in 25px button = 65%). Confirmed on both youtube.com and themoviebox.org.
