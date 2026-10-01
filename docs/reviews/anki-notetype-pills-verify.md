# Verify — anki-notetype-pills

Reviewer: fresh-context lane (read-only) · Date: 2026-10-01 · Spec: `docs/specs/anki-notetype-pills.md`

## Review rounds

**Round 1 — FAIL (1 blocker):** `manageSurface` occupied different positional slots in the two `MappingStep` return branches (index 2 inside `.mapLayout` vs index 1 in the `!nt` early return). Unkeyed reconciliation unmounted/remounted the portal when `nt` flipped defined↔undefined while the surface was open (disable last enabled notetype / re-enable from empty state) — focused checkbox destroyed, `activeElement` reset, Tab escaped containment. Violated REQ-3 containment + REQ-4 exception.

**Round 2 — PASS:** `manageSurface` is now a stable fragment child outside `.mapLayout` in both branches (`ImportWizard.tsx` ~697-707 vs ~722-807) — the Popover/portal never remounts across the empty↔nonempty boundary.

## AC results

| AC | Result | Evidence |
|---|---|---|
| AC-1 borderless pill bar above fields, counts, selected state, ghost icon; no advRow | PASS | `.ntBar`/`.ntPills` + `Chip as="button"`/`IconButton`; `advRow` CSS + `ankiImport.advanced.*` removed |
| AC-2 pill press retargets selects + preview, resets sample/unflips | PASS | `selectNt` sets `selectedNtId`, `onSampleIdx(0)`, `setFlipped(false)`; Chrome run: 捨てる→読む |
| AC-3 explicit selection state | PASS | `selectedNtId` state + derived effective `nt` (`ImportWizard.tsx`) |
| AC-4 popover ≥840px / sheet <840px, all non-cloze rows incl. 0-card, stays open across toggles | PASS | `useIsMobile(BREAKPOINTS.expanded)`, `manageableNts` from `data.notetypes`; Chrome run: 3 rows incl. Listening 0 cards |
| AC-5 disable removes pill same frame + ntIds excludes | PASS | `toggleNtById` → `pillNts` re-derives; Chrome run confirmed |
| AC-6 disable-selected → next enabled nt (order, wrap); focus stays in surface | PASS | `nextEnabledNotetypeId` wrap logic + unit tests; focus probe stayed inside popover |
| AC-7 zero pills → empty state, manage icon reachable | PASS | `!nt` branch renders ntBar + `noneSelected` |
| AC-8 keyboard: Tab reaches pills+icon, Enter/Space activates, 2px focus ring | PASS | `Chip`/`IconButton` existing focus-visible + Tab wrap in popover |
| AC-9 480px no overflow, wrap | PASS | `flex-wrap` `.ntPills`; Chrome run at 480px |
| AC-10 no regressions | PASS | flip/dots/sticky footer/live-media code paths untouched |
| AC-11 zero enabled → Start import disabled, re-enable restores | PASS | `canContinue` requires `enabled ∩ cards≥1` non-empty + mappings; Chrome run confirmed |

## Notes

- Popover keyboard containment is explicit (`onManageKeyDown` Tab wrap) since the portal escapes the Dialog focus trap — matches spec.
- Focus restoration on Escape → manage icon via `pushEscapeLayer`; scroll dismissal ignores surface-internal scrolls (`useDismissOnScroll`).
- Unit tests (`notetypeSelection.test.ts`, 9 cases) cover pill filtering + wrap fallback incl. zero-card and all-disabled edges.

VERDICT: PASS
