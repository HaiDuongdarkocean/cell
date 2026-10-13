# Design Review — dict-example-selection

> Brief: `docs/intent/dict-example-selection-design-brief.md` · Mapping: `docs/intent/dict-example-selection-component-mapping.md`
> Mockup: `src/entrypoints/mockup-dict-example-selection/` (dev server, live at `/src/entrypoints/mockup-dict-example-selection/index.html`)

## Verification performed

- Real panel mounts: production `CandidateView` rendered with mock `LookupResult` — examples shown as today's static `•` lines, never reaching prefill.
- Concept A interaction verified via Playwright: example click → `aria-checked=true` on example AND parent def (cascade); def uncheck → examples reset; `include-all` toggle → def check selects all 3 examples.
- Concepts B + C render distinct archetypes (pinned always-visible boxes / inline `·`→✓ mark).
- Mobile 375 + Desktop 640 viewports; dark theme default; all states render.

## User decision

Picked **Concept A — Mirror rows** with amendment: "cả def và example dùng • cái nhỏ này" — the idle marker is the shared small dot (`TihokaDefCheck::before` circle) for both def and example rows. Concept A already renders exactly that.

Amendment implication recorded in mapping: UI marker unified (`•` idle dot); card-text serialization keeps `· ` for example lines so the string round-trip parse can distinguish them from `• ` def lines.

## Trace check

- Journey TO-BE-1..4 → REQ-1..4 → elements in mapping: example row host, check slot, text zone, settings pill, `· ` serializer.
- No orphan elements; every element has reuse/extend/create + tokens + icon.

VERDICT: APPROVE

