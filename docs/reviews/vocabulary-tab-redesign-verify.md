# Verify — vocabulary-tab-redesign

VERDICT: PASS

Commit: `5ba88bb5` · Stage: deliver → shipped
Spec: `docs/specs/vocabulary-tab-redesign.md` · Design: Concept B (compact toolbar)

## Deterministic gates

| Gate | Result | Evidence |
|---|---|---|
| `npm run typecheck` | pass | tsc clean |
| `npm run test:unit` | pass | 553 suites / 6542 tests, incl. `vocabularyList`, `vocabularySource`, `VocabularyTab`, `wordTrashStore` |
| `npm run build` | pass | vite build + postbuild CSP patch clean; `check-deep-imports` clean |
| eslint (changed files) | pass | `VocabularyTab.tsx`, `vocabularyList.ts`, `vocabularySource.ts`, e2e spec |

## Real-browser verification (stage2 Playwright + screenshots)

`e2e/stage2/vocabulary-tab-trash.spec.ts` — passed (5.9s, real Chromium + packed extension on StreamFlix):

- Filter menu counts: all/tracking/known/ignore/trash correct after seeding
- Legacy `unknown` seed row swept on read, never rendered
- Segment filter narrows live rows; search filters within view
- Edit mode reveals delete; confirm dialog soft-deletes into Trash
- Trash view: ordered by trashedAt desc, no sort/Edit controls, retention note
- Restore returns previous status; delete-forever purges with confirm
- Cycle follows `known → ignore → tracking` (3 persisted states, never `unknown`)
- State persists across page reload (real IndexedDB)

Screenshot sweep (`tmp/vocab-redesign-verify/`, panel host element):

- `desktop-view` — compact toolbar `All ▾ · Recently marked ▾ · Edit`, full-width search, pastel status chips aligned right, no timestamps, no delete buttons
- `desktop-filter-menu` — popover with per-segment counts + Trash item
- `desktop-edit` — delete icons appear in reserved slot; chips/rows do not shift
- `desktop-trash` — static previous-status chip + `Xh left` + restore + purge actions
- `narrow-view` (520px) — same layout, search full-width, no squeeze
- `narrow-edit` / `narrow-filter-menu` — identical structure at small width

## Requirement traceability

- Persisted statuses only tracking/known/ignore; `unknown` = absence — `setWordStatus` normalizes `unknown` → row delete at store level; legacy rows swept on read
- Vocabulary-tab cycle never produces `unknown` — `nextMarkedStatus` + `WORD_STATUS_SET`
- External `unknown` (popup, keys 1–4) removes the row without creating Trash
- Explicit Remove → Trash with previousStatus + trashedAt, 24h TTL, lazy purge on read
- Trash: dedicated filter-menu view, restore, delete forever, retention countdown
- Search on its own row; filter/sort compact menus; Edit separate from destructive controls
- Fixed action slot — Edit toggle causes no layout shift
- Pastel chip styling matches dictionary popup `TihokaHeaderStatus` (`--chip-status-*` tokens)
- i18n keys complete en+vi; a11y roles (`menu`, `menuitemradio`, `aria-checked`, `aria-expanded`, `aria-haspopup`) + stable `data-tihoka-id` hooks
