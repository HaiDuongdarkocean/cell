# Design Review — up-tab-layout-contract

> Artifacts: `docs/intent/up-tab-layout-contract-design-brief.md` · `docs/intent/up-tab-layout-contract-component-mapping.md` · mockup `src/entrypoints/mockup-up-tab-layout-contract/` · evidence `tmp/up-tab-layout-contract/`
> Mode: `all` — vision pass by measured geometry + computed styles against the spec's declared deltas (structure item; DOM/CSS evidence is the honest signal here).

## Verified on the rendered mockup (Playwright, real Chromium, iframe `ViewportFrame`)

Variant **contract** (TO-BE replica), mobile 390×844 light unless noted — all 14 checks green:

| Check | Result |
|---|---|
| Playlist `.list` is a real scrollport | `overflow-y:auto`, `scrollHeight > clientHeight` |
| `.content` flush host | computed `padding: 0px` — no carve-out needed |
| Unified gutter | `padding-top:12px / padding-left:16px` (block/inline) |
| Scroll-bottom inset | `padding-block-end:16px`; last row rests 16.0px above nav hairline |
| Dead `@container` activated | `container-type:inline-size` on `.list`; rows wrap ≤480px — actions drop full-width below the body |
| `isActive` teardown | preview badge present → tab switch → 0 mounted while hidden, still 0 on return |
| Keep-alive recap | expanded row + `scrollTop=199` survive a round-trip (`display:none` restores scroll in Chromium) |
| Card surface | card computes `color(srgb 0.976 …)` elevated vs body `rgb(247,250,252)` — raised on every tab via `.body` remap |
| EmptyState fill | host 656px tall, content gaps 275/275 — ratio 1.00 (centered) |

Variant **real** (production `UniversalPanel` + real tab module CSS) — defects reproduced as control:

| Check | Result |
|---|---|
| Playlist clipped | `.content{overflow:hidden}` clips 1775px of list — unreachable |
| Double gutter | shell 8px (≤599px) + tab 16px = 24px effective at 390 |
| Preview leak | playing badge stays mounted in the `[hidden]` pane |
| Empty top-anchor | playlist `.empty` top=0, void below = 601px |

## Screenshots

`tmp/up-tab-layout-contract/`: `contract-{mobile,desktop}-{light,dark}.png`, `contract-{mobile,desktop}-empty.png`, `contract-mobile-{scrolled-bottom,wrap-closeup,empty-vocab}.png`, `real-{mobile,desktop}-light.png`, `real-desktop-dark.png`, `real-mobile-{empty,hidden-preview}.png`. Served via `npx vite --port 5220` (dev server stopped after capture).

## DS-faithfulness pass

1. **Surfaces:** solid tokens only — `core.*.surface`-class base, elevated cards via the hoisted remap; no glass/blur. PASS.
2. **Shape:** rows/cards keep `--radius-md`/`--radius-lg`; nav buttons `--radius-md`; pill badge `--radius-full` — consistent with sibling panels. PASS.
3. **Typography:** unchanged (structure item — out of scope per boundary). PASS.
4. **Touch targets:** replica nav/rows use `--touch-target` (44px floor); playlist `.pInner` min-height 44px mirrors production. PASS.
5. **States:** populated + empty both render; hover/active via real `Button`/`Card`; hidden-pane lifecycle demonstrated by badge teardown. PASS.
6. **Dark mode:** contract + real captured dark at both viewports — remap + surfaces hold. PASS.

## Deviations vs shipped panel

| Sev | Item |
|---|---|
| — | Replica header/sidebar/nav are simplified chrome (labels omitted on mobile nav). Cosmetic mockup scaffolding, not design output — the real chrome ships untouched. |
| P2 | Replica dictionary tab collapses to list + sheet peek only (no right pane) — edge-managed tab shown for the inset-over-peek case; sufficient for the contract decision. |

## Follow-ups for DELIVER

- `.scrollport` composes `themed` — if Vite rejects chained composes, inline the `.themed` declarations (spec REQ-2 exception).
- REQ-6 publish-guard: skip `setPreview` + revoke URL when `isActive` flips mid-read (pinned in spec).
- `UniversalPanel.test.tsx:101-119` flips to assert recap node persistence.
- This mockup dir is deleted at ship (`mockup-<slug>/` convention).

VERDICT: PASS
