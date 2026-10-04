# Design review: dict-sheet-breadcrumb

Mode `all` — vision-reader judges rendered mockup `src/entrypoints/mockup-dict-sheet-breadcrumb/` (Playwright screenshots `tmp/dict-sheet-breadcrumb/`, mobile 390px + desktop 1280px, dark + light, deep chain + navigated-back states).

## Pass 1 — FAIL

All requirements passed except: scrolled strip hard-clipped leftmost crumb mid-word (`used` → `sed`). Also noted transient hover pill on a crumb (capture artifact, not a defect).

## Fix applied

- `.mkTrail` gained per-edge `mask-image` gradient fades (`mkTrail--fadeStart`/`--fadeEnd`, `--space-5` width) toggled by scrollLeft/scrollWidth; spec REQ-4 + component mapping updated with the same rule for the real `LookupTrail`.

## Pass 2 — PASS

- Strip pinned below grab handle, fixed ✓
- Subtle distinct bg (`surface-card` vs `surface-popover`) + hairline border ✓
- `>` separators, current bold/primary, ancestors secondary ✓
- Long chain scrolls, newest crumb auto-visible at right edge, edge crumbs fade ✓
- No overlaps/clipping defects in any shot ✓

VERDICT: PASS
