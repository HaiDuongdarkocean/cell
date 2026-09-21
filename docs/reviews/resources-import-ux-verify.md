# Verify Review — resources-import-ux

VERDICT: PASS

Verification of the delivered implementation against
`docs/specs/resources-import-ux.md`, `tasks/plan-resources-import-ux.md`, and the
post-plan user feedback (integrated-lookup refresh, resource-management UX
rework, profile-scoping removal, filename-stem display).

## Scope covered

- Per-file import job rows with exact entry totals, bounded FIFO scheduler,
  duplicate prompts, independent outcomes (original spec scope — verified in
  an earlier real-Chrome round, `tmp/resources-import-ux/verify.mjs`).
- Resource-change → integrated-lookup auto-refresh (new scope).
- Last searched term retained + auto-replayed on panel remount.
- Integrated dictionary scrolling fix.
- Resource-management rework: edit mode, bulk selection/delete, filename
  stems, word-count-only meta, no profile scoping, 3×2 grip, no reorder
  arrows, `Ngưỡng độ phổ biến` editor redesign, token rounding.
- Drag-and-drop reorder rework (post-verify user feedback): section-level
  `useSectionDrag` session — lifted ghost card, dashed placeholder sliding
  to the live target slot, sibling translateY shifts, edge auto-scroll,
  Escape/pointercancel, 200ms settle, commit by resource id. Reviewed
  separately in `resources-import-ux-verify-drag.md` (PASS-WITH-NOTES).

## Conformance matrix

| Requirement | Status |
|---|---|
| Resource mutations (enable/disable/delete/reorder/import) refresh the integrated lookup for the same `langCode` | ✅ |
| Last lookup context stored and replayed on resource change | ✅ |
| Integrated panel restores `searchHistory[0]` on mount when no `initialTerm`/`initialResult` | ✅ |
| Lookup filters `installationFinished === false` and `enabled === false` | ✅ |
| Integrated scroll: `overflow-y:auto` + `overscroll-behavior:auto` (chains when unbounded); wide container gives `lookupColumn` `max-height` + `overflow-y:auto` | ✅ |
| Cards show filename stem (`.json`/`.zip`/`.txt`/compound suffixes stripped) | ✅ |
| Meta = `N từ` (+`đang thêm…` while installing); no format/date/priority strings | ✅ |
| Profile scoping removed: no `activeProfileId` filter, no profile picker, no auto-scope on import, no `profileIds` lookup filter | ✅ |
| Grip = 3 columns × 2 rows dots; no reorder arrows; ArrowUp/Down + pointer drag persist via `reorderResources` | ✅ |
| Pointer drag = lift-and-placeholder pattern: ghost follows pointer, dashed placeholder slides to live target slot, siblings shift with transitions, drop settles and persists order after reload | ✅ |
| Edit mode: pencil `aria-pressed`, accessible labels, selection highlight; per-card trash + `Xóa n đã chọn`/`Xóa tất cả` exist ONLY in edit mode + confirm modals | ✅ |
| `Ngưỡng độ phổ biến`: title, explainer, 4 labeled rows with hints, `top ≤` inputs, conditional reset | ✅ |
| `--radius-lg` rounding on dropzone/cards/skeletons/empty/job rows | ✅ |

## Evidence

- `npm run typecheck` — pass.
- `npm run lint` — pass.
- `npm run test:unit` — **564/564 suites, 6717/6717 tests** pass.
- `npm run build` — pass (feature-cycle + deep-import checks clean).
- Real-Chrome verifier `tmp/resources-import-ux/verify2.mjs` on bundled
  Chromium with a cloned profile — **34/34 checks pass**:
  - `dict-v2.json`/`freq-v2.txt`/`freq-v3.txt` import → cards render as
    `dict-v2` / `freq-v2` / `freq-v3` stems with `5 từ`/`50 từ`/`40 từ` meta.
  - Search `hello` → `həˈloʊ` + definition shown; **disabling the dictionary
    auto-refreshes to "No definitions found" without re-typing**; re-enabling
    restores results; deleting the last dictionary refreshes to empty.
  - Page reload → `hello` auto-looked-up from persisted search history.
  - Grip dots measure 16×10.66px (3:2 ratio); card buttons are only
    expand/toggle/delete — no reorder arrows.
  - Dropzone + cards compute `border-radius: 8px` (`--radius-lg`).
  - Edit mode: `aria-pressed`, no trash/delete-all outside edit mode, both
    appear inside it and hide again on exit; `Xóa tất cả` → section-wide
    modal (cancelled), select → `Xóa 1 đã chọn` → confirm → card removed.
  - Pointer drag on the freq section: dashed placeholder appears and follows
    the pointer, dragged slot carries `data-dragging` (ghost), drop swaps
    `freq-v3,freq-v2 → freq-v2,freq-v3`, and **the new order survives a page
    reload** (screenshot `tmp/resources-import-ux/shots/09-mid-drag-ghost-placeholder.png`).
  - Wide container → `lookupColumn` `max-height:868px` + `overflow-y:auto`.
  - Bands editor: title + explainer + 4 labeled `top ≤` rows + 4 inputs.

## Residual notes

- `ResourceInfo.profileIds` remains in the entity as legacy data — no UI or
  lookup consumer reads it; removal is a data-migration task, not this item.
- `verify.mjs` (original import-UX contract) remains the regression suite for
  import mechanics; `verify2.mjs` covers this rework.
- Drag review minors accepted (`resources-import-ux-verify-drag.md`): no
  window/document scroll fallback (panel only lives inside a scrollable
  dialog), no movement threshold (a click on the grip flashes the placeholder
  for one frame at most — pointerup cancels a no-op drop), no aria-live
  reorder announcement (keyboard ArrowUp/Down remains the accessible path).
