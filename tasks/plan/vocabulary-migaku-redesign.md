# Vocabulary tab — Migaku-style redesign

Reference: `C:\Users\The0cean\Documents\ShareX\Screenshots\2026-10\Zalo_JWx7GtVj28.png` (Migaku "Known Words", Android, 692px wide).
Rule from Anh: clone hierarchy / layout / shape / spacing / features exactly; **colors come from Cell tokens only**.
Decisions confirmed by Anh: bulk bar lifted to `shared/ui`; card indicator shows **both** Anki-sync and Tihoka SRS; labels sentence case (Cell copy standard, not UPPERCASE).
Not a pipeline item (Anh: unrelated to pipeline). Owner: `devin-vocab-redesign-1791372569`.

## 1. Design read

The reference turns the vocabulary list from a "data table with tools on top" into a **collection page**: identity + progress first (hero), then how to slice it (sort / filter), then the words, and bulk actions appear only when the user has picked words. Every row has the same 3-slot rhythm: *select · word · state*.

## 2. Scale + measurements

Calibration: top circle buttons = 68px physical ≈ 40 logical → scale ≈ 1.7 (not a standard DPR → treat measures as ±2px and snap to tokens).

| Element | px phys | logical | Cell token target |
|---|---|---|---|
| Outer gutter | 12 | 7 | `space-2` |
| Top-bar circle buttons | 68 | 40 | circle `Button size="md"` (hit ≥44 on touch) |
| Top-bar gap between buttons | 16 | 9 | `space-2` |
| Top bar → hero | 22 | 13 | `space-3` |
| Hero card radius | 24 | 14 | `radius-lg` (nearest) |
| Hero padding block | 40 / 50 | 24 / 29 | `space-6` top, `space-6` bottom |
| Hero flag diameter | 130 | 76 | `FlagIcon size={72}` |
| Flag → headline | 20 | 12 | `space-3` |
| Headline (number + "Known words") | ~40 tall | ~22 | heading type ramp (H2 / `font-size-xl`, bold) |
| Breakdown line | ~26 tall | ~15 | `font-size-base`, regular |
| Hero → sort/filter row | 30 | 18 | `space-4` |
| Sort / Filter pills | 315×68 | 185×40 | `Button size="md"` pill, 2 equal columns |
| Gap between the 2 pills | 28 | 16 | `space-4` |
| Meta line ("2 selected") | ~26 tall | ~15 | `Text variant="supporting"`, centered |
| List card radius | 24 | 14 | `radius-lg` |
| Row height | 97 | 57 | `min-height: calc(var(--touch-target) + var(--space-3))` ≈ 56 |
| Row inline padding | 28 | 16 | `space-4` |
| Checkbox | 42 | 24 | shared `Checkbox` |
| Checkbox → word | 42 | 24 | `space-5` |
| Word | ~30 tall | ~17 | `font-size-md`, `font-weight-semibold` |
| Status circle / icon | 70 / 36 | 41 / 21 | circle `Button size="md"` / icon 20 (≈50%) |
| Row divider | 1 | 1 | `--color-divider` hairline |
| Bulk bar buttons | 335×64 | 197×38 | `Button size="md"` pill, 2 equal columns |
| Bulk bar gap / bottom offset | 14 / ~20 | 8 / 12 | `space-2` / `space-3` |

Proportions to keep when snapping: status circle = top-bar circle size; pill rows are 2 equal columns with the same gap (`space-4`); hero and list card share the same radius and gutter.

## 3. Atom → component → Cell mapping

Top to bottom. Close (X) from the reference is **dropped**: both hosts already own close/back (UniversalPanel header, SrsVocabularyView back button).

| # | Reference atom | Function | Cell component | Notes |
|---|---|---|---|---|
| A1 | ↺ circle | Undo last vocabulary action | `Button variant="secondary" shape="circle"` + `rotateCcw` | disabled when nothing to undo; `aria-label` "Undo" |
| A2 | "Deselect all" pill | Select all / deselect all | `Button variant="secondary"` pill | label = "Select all" when 0 selected, "Deselect all" when ≥1; hidden in Trash view and when the visible list is empty |
| A3 | 🔍 circle | Toggle search row | circle Button + `search`, `aria-expanded` | opens a full-width `SearchField` row under the top bar, autofocus; closing clears the query; stays open while query non-empty |
| A4 | ⋯ circle | More actions | circle Button + `ellipsis` → `<Menu align="right">` | items: "Trash" (`trash2`, trailing count) · "Sync with Anki" (`repeat`, runs `ANKI_STATUS_SYNC_RUN`, item disabled + spinner text while running, refreshes card sources after) |
| B | Hero card | Collection identity + progress | `Box bg="card"` card | flag `FlagIcon`; headline `<number> Known words`; breakdown `<n> learning  <n> tracked  <n> ignored` |
| C | Sort / Filter pills | Slice the list | existing filter/sort `<Menu>`s, triggers restyled as 2 equal `secondary` pills | trigger label shows the **current value** (e.g. "Recently marked ▾", "All ▾") with leading icon — deviation: reference shows static "Sort by"; current value keeps state visible |
| D | "2 selected" | Selection / result meta | `Text variant="supporting"` centered | ≥1 selected → "N selected"; else "N words" for the current filtered result. Migaku's legacy-count note is dropped (no Cell equivalent) |
| E | List card | The words | `<ul>` inside `Box bg="card"`, radius-lg, rows divided by hairline | whole tab scrolls (hero scrolls away), list is **not** its own scrollport |
| E1 | Checkbox | Select row | shared `Checkbox`, `aria-label` "Select <term>" | |
| E2 | Word | Open dictionary lookup | existing ghost term `Button` → `onLookup` | ellipsis truncation, `title` = term |
| E3 | Small blue cards glyph | "Has a card" | non-interactive icons, `aria-label`/`title` | `import` icon = linked Anki card ("In Anki"); `layers` icon = Tihoka SRS note ("In Memory") — same `layers` glyph as the "Open Memory" tool; both can show. Color `--color-text-accent-strong` |
| E4 | Status circle | Cycle status | circle `Button`, bg/fg from `--chip-status-<status>-bg/-fg`, icon per status | keeps `data-cell-id="vocabulary-cycle-<term>"` + `aria-label` "Cycle status for <term>" |
| F | Floating "Change status" + "Delete" | Bulk actions | **new shared `SelectionBar`** | appears only when ≥1 selected; sticky to the bottom of the tab scroll area; elevated |

Status icon map (collision-checked against the catalog): `known → circleCheck`, `learning → clock`, `tracking → eye`, `ignore → eyeOff`. Put it in one `STATUS_ICON: Record<MarkedStatus, IconName>` next to `STATUS_LABEL` in the vocabulary feature and reuse it in the Change-status menu items.

## 4. Color map (semantics → Cell tokens)

| Use | Token |
|---|---|
| Page / tab background | `--color-surface` (unchanged) |
| Hero + list card | `Box bg="card"` |
| Top-bar circles, pills | `Button variant="secondary"` defaults |
| Hero headline number | `--chip-status-known-fg` |
| Breakdown numbers | `--chip-status-learning-fg`, `--chip-status-tracking-fg`, `--chip-status-ignore-fg`; labels `--color-text` |
| Status circle | `--chip-status-<s>-bg` background, `--chip-status-<s>-fg` icon; hover = the existing `color-mix(... var(--color-text) 8%)` rule from `Chip.module.css` |
| Checked checkbox | shared `Checkbox` (primary) |
| "Change status" | `Button variant="primary"` |
| "Delete" | `Button variant="errorSubtle"` + `trash` icon |
| Card-source icons | `--color-text-accent-strong` |
| Meta / supporting text | `--color-text-secondary` |

Rule: *status color only lives on status meaning (numbers + status circles); everything else is neutral or primary.* Verify ≥4.5:1 text and ≥3:1 icon contrast in dark **and** light theme.

## 5. Behaviour spec

- **Selection**: `ReadonlySet<string>` of terms. Survives search changes and sort changes; cleared on segment (filter) change, language change, entering Trash, and after a bulk action completes. Select all = every term in the current filtered+searched result (not just rendered rows). Terms that disappear from the source (external delete) are dropped from the selection.
- **Change status** (bulk): opens a `<Menu>` anchored to the button with Tracking / Learning / Known / Ignored (status icon + label). One batched write.
- **Delete** (bulk): `ConfirmDialog` "Remove N words?" → batched move to Trash (same 24h Trash semantics as today).
- **Undo**: single-level, in-memory, reset on language change. Records the last of: row cycle, bulk status change (previous status per term), bulk delete (terms). Undo of a status change re-applies previous statuses (batched, grouped by previous status); undo of delete restores the terms from Trash (batched). After undo the button is disabled again.
- **Edit mode is removed** (checkbox + bulk Delete replace it). Remove `vocabulary.edit`/`vocabulary.done` usage and the reserved action slot.
- **Trash view** (from ⋯ menu): hero, sort/filter, select-all and checkboxes hidden; top bar shows a back circle (`chevronLeft`, "Back to vocabulary") + title "Trash"; retention note; rows inside the same card list with existing restore / delete-forever actions + confirm. Escape or back returns to the list.
- **Incremental rendering** replaces `Pagination`: render 100 rows, an `IntersectionObserver` sentinel (root = the tab scroll element, created from the element ref — shadow-DOM safe) appends 100 more. Reset to 100 on filter/search/sort change. Must stay smooth at 9,000 entries.
- **Card sources**: load once per language + after "Sync with Anki"; failure is silent (icons simply absent), never blocks the list.
- **States**: loading → centered `Spinner`; empty store / empty filter / empty trash → existing `EmptyState`s; action failure → existing `Alert`.
- **Responsive**: content column `max-width: var(--max-width-lg)` centered inside the tab (desktop panel is wide; reference is a phone column). At ≤ 360px the 2-column pill rows stay 2 columns with label truncation; long locale strings (+30%) truncate with ellipsis, never wrap the pills.
- **SrsVocabularyView**: remove its now-duplicate flag chip (the hero shows the flag); keep back button + title.
- Focus order: top bar → (search) → sort → filter → rows (checkbox, word, status) → bulk bar. Bulk bar appearing must not steal focus. Menus/dialogs use existing Escape layers.
- Motion: bulk bar enters/leaves with existing `duration-*`/`ease-*` tokens (slide+fade), disabled under `prefers-reduced-motion`.

## 6. Data / message layer

1. `features/dictionary/services/wordStatusStore.ts` (+ trash store): add user-source batch writes mirroring the single-term paths exactly (same validation, sync capture, trash semantics), each in **one** IDB transaction:
   - `setWordStatuses(langCode, terms, status)`
   - `trashWordStatuses(langCode, terms)`
   - `restoreWordStatuses(langCode, terms)`
   Pattern to follow: `setWordStatusesFromSync`.
2. New messages `WORD_STATUS_SET_MANY`, `WORD_STATUS_TRASH_MANY`, `WORD_STATUS_RESTORE_MANY` — constants in `shared/config/messages.ts`, zod schemas in `entities/message/dictionarySchemas.ts`, registry entries, handlers in `entrypoints/background/handlers/wordStatus.ts`, client functions next to the existing single-term clients. After each batch: `emitWordStatusesReload(lang)` once (not N events).
3. `features/ankiStatusSync`: `listCardSourceTerms(langCode): Promise<{ anki: string[]; srs: string[] }>` — anki = `getAllLinks()` filtered by `langCode`; srs = normalized `targetWord`s of notes whose deck's collection `targetLanguage` matches (reuse the scan in `srsOutcomesByTerm`, without the maturity filter). Message `ANKI_STATUS_CARD_TERMS` + schema + handler in `handlers/ankiStatusSync.ts`.
4. `VocabularySource` gains `setStatusMany`, `trashMany`, `restoreMany`, and `cardSources` in state (`{ anki: ReadonlySet<string>; srs: ReadonlySet<string> }`, loaded with entries, refreshed by `refreshCardSources()`).
5. Showcase `VocabularyPanelPage.showcase.tsx`: handle the 4 new messages, seed a few Anki-linked and SRS terms so indicators are visible.

## 7. Shared UI: `SelectionBar`

`src/shared/ui/SelectionBar.tsx` (+ `.module.css`, `.showcase.tsx`, `.test.tsx`, export from `shared/ui/index.ts`).

```ts
export interface SelectionBarProps {
  readonly open: boolean;
  readonly label?: ReactNode;
  readonly children: ReactNode;
  readonly className?: string;
  readonly 'data-cell-id'?: string;
}
```

- `role="toolbar"`, `aria-label` from label/i18n; `position: sticky; bottom: var(--space-3)`; `--color-surface-elevated` background via `Box bg="popover"` like today; `radius-lg`; `--shadow-lg`; enter/exit motion; children laid out as equal-width flex items with `space-2` gap; optional leading label (count) for SrsHome.
- Migrate `SrsHome` select bar to it (count label + Delete + Cancel) with no behaviour change.

## 8. i18n (en + vi, all new keys)

`vocabulary.hero.knownWords` ("Known words" / "từ đã biết"), `vocabulary.hero.learning`, `vocabulary.hero.tracking`, `vocabulary.hero.ignore`, `vocabulary.selectAll`, `vocabulary.deselectAll`, `vocabulary.selectedCount` ("$1 selected"), `vocabulary.wordCount` ("$1 words"), `vocabulary.row.select` ("Select $1"), `vocabulary.undo`, `vocabulary.search.toggle`, `vocabulary.more`, `vocabulary.sync`, `vocabulary.syncing`, `vocabulary.trash.back`, `vocabulary.bulk.changeStatus`, `vocabulary.bulk.delete`, `vocabulary.bulk.deleteTitle` ("Remove $1 words?"), `vocabulary.bulk.deleteDescription`, `vocabulary.source.anki` ("In Anki"), `vocabulary.source.srs` ("In Memory"), `ui.selectionBar.aria`. Numbers via `toLocaleString()`. Drop keys that become unused (`vocabulary.edit`, `vocabulary.done`) only if no other caller.

## 9. Tests

- `vocabularyList.test.ts`: pure helpers for selection (select-all over filtered result, prune vanished terms) and undo-record building.
- `VocabularyTab.test.tsx` rewritten for the new UI: hero counts; select one → meta "1 selected" + bulk bar; select all / deselect all; bulk change status calls `setStatusMany`; bulk delete confirm calls `trashMany`; undo after each; Trash via ⋯ menu; incremental rendering appends on sentinel intersect (mock `IntersectionObserver`); card-source icons render with labels; filter change clears selection.
- `wordStatusStore.test.ts` / trash store tests: batch functions (one transaction, trash semantics, `unknown` handling identical to single path).
- Handler tests for the 4 new messages; `listCardSourceTerms` test.
- `SelectionBar.test.tsx`; SrsHome still passes.
- `e2e/stage2/vocabulary-tab-trash.spec.ts` updated to the new flow (no Edit toggle).

## 10. Verification + evidence

- `npm run typecheck && npm run test:unit && npm run build` green; eslint on changed files.
- Showcase live for Anh: `npm run design-system:dev` → Vocabulary Panel page, `?data=` default and `overflow`.
- Screenshot sweep into `tmp/vocabulary-migaku-redesign/` (dark + light, 390px and 1280px): default, 2 selected + bulk bar, change-status menu open, delete confirm, search open, ⋯ menu open, Trash view, empty, loading, focus-visible on row controls. Crops of top bar / hero / row compared side by side with the reference.
- Menu screenshots next to the canonical Vocabulary filter menu; anchor check after scroll and near the edge.
- Stage2 e2e spec passes.
- Update `docs/2-architechture-system.md` (vocabulary feature, new messages, SelectionBar) and `docs/0-wiki.md` changelog.

## 11. Deviation list

| Deviation | Why |
|---|---|
| Colors | Cell status + surface tokens, by Anh's rule |
| Sentence case labels | Anh's decision (Cell copy standard) |
| No close (X) | host surfaces own close/back |
| Sort/Filter trigger shows current value | keeps state visible |
| Migaku legacy-count note removed | no Cell equivalent |
| Learning/tracking colors differ from Migaku (Cell: tracking orange, learning blue) | Cell status semantics are SSOT |
| Content max-width on desktop | reference is a phone column; panel is wide |
| Top bar is `position: sticky` | Undo/search/more stay reachable while the list scrolls; reference scrolls them away |
| Meta line shows the result count when nothing is selected | reference has no equivalent slot; keeps the "how many words am I looking at" signal |
| Card-source icons are non-interactive badges | Cell has no per-card jump target from the vocabulary row yet |
| Bulk bar is sticky inside the tab scroll (not fixed to the viewport) | panel scrollport owns the scroll; keeps the bar above the mobile bottom nav |
