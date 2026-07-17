# Panel body max-height not reset on dock/float mode transition

> **Principle**: [Inline style leak across state transitions → every set must have matching remove](principles.md#inline-style-leak-across-state-transitions--every-set-must-have-matching-remove)

## Problem

When the subtitle panel was docked beside the video, the subtitle list did not extend to the bottom of the video. The panel container stretched to the full video height, but the list inside stopped at ~400px, leaving empty space below the last cue.

Before fix:

- panel height: 656px
- panel body height: 400px (capped)
- empty space below the cue list

## Root causes

`createPanel` sets the panel body `max-height: 400px` for the floating panel (positioned absolute, limited height). That inline style persisted when the panel switched to docked mode. In docked mode the panel container has `height: 100%`, but the body still carried the 400px cap, so it could not fill the docked panel.

Code path: `src/content/subtitlePanel.ts` → `createPanel()` sets the body style; `src/content/subtitleDocking.ts` → `showPanelDocked()` did not reset it.

## Fix

In `showPanelDocked`:

- Select the panel body and set `maxHeight = 'none'` so the cue list fills the docked panel.

In `hidePanelDocked`:

- Restore `panelBody.style.maxHeight = '400px'` for the floating panel.

## Key insight

Mode-specific inline styles must be explicitly reset when switching modes. The style that is correct for one mode (floating panel max-height) becomes a bug in another mode (docked panel).

## Verification

- Inline browser fix (Edge DevTools MCP):
  - panel body height: 400px → 615px
  - panel body filled the docked panel
- Unit tests: `subtitleDocking.test.ts` setup now creates a panel body; asserts `maxHeight: 'none'` after show and `maxHeight: '400px'` after hide.
- All tests: 1095/1095 passed.
- Build + tsc passed.

## Related files

- `src/content/subtitlePanel.ts`
- `src/content/subtitleDocking.ts`
- `tests/unit/subtitleOverlay/subtitleDocking.test.ts`
