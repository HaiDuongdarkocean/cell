# Plan: dict-sheet-breadcrumb

Spec: `docs/specs/dict-sheet-breadcrumb.md` · Design: `docs/intent/dict-sheet-breadcrumb-design-brief.md` + `-component-mapping.md` · Mockup: `src/entrypoints/mockup-dict-sheet-breadcrumb/`

## Tasks

| # | Task | AC | Files |
|---|---|---|---|
| 1 | Sheet atom: additive `header`, `modal`, `inert` props | AC-9 | `src/shared/ui/Sheet.tsx` |
| 2 | Breadcrumb atom: additive `separator` prop (CSS var, default `/`) | AC-4 | `src/shared/ui/Breadcrumb.tsx`, `Breadcrumb.module.css` |
| 3 | `LookupTrail` feature component: strip + scroll-x + wheel-map + edge fades + auto-scroll-end + gate `trail.length>=2` | AC-1, AC-4, AC-5, AC-7, AC-10 | `dictionaryPopup/ui/LookupTrail.tsx`, `LookupTrail.module.css` |
| 4 | Mount plumbing: `trail`, `isTopLevel`, `onTrailNavigate` options + `setOptions` keys | AC-3 | `mountPopupDictionary.ts` |
| 5 | Lifecycle: `lookupTerm` on PopupLevel; remove `isSheetMode()?0:` force; `syncTrail()` on push/prune; `onTrailNavigate→closeFromLevel(i+1)` | AC-1..AC-6 | `controllerTypes.ts`, `popupLifecycle.ts` |
| 6 | Dictionary sheet branch: render `LookupTrail` via `Sheet.header`; `modal`/`inert` per `isTopLevel` | AC-1, AC-7, AC-9 | `Dictionary.tsx` |
| 7 | i18n `dict.trail.backTo` en+vi | AC-4 | `messages/en.json`, `vi.json` |
| 8 | Unit tests: sheet-mode stack push, crumb navigate prune, Escape pop-one, page lookup reset | AC-1..AC-6, AC-8 | `webTextDictionaryController.test.ts` |
| 9 | Docs + cleanup: `docs/2-architechture-system.md` popup stack section; delete `src/entrypoints/mockup-dict-sheet-breadcrumb/` | DoD | docs, mockup dir |

## Gates

`npm run typecheck && npm run lint && npm run test:unit && npm run build` → real-Chrome verify (sheet mode chain + crumb back) → fresh-context verify review → ship.
