# Plan — vocabulary-tab-redesign

> Spec: `docs/specs/vocabulary-tab-redesign.md` · Design: Concept A (Chapter tabs) · `docs/intent/vocabulary-tab-redesign-{design-brief,component-mapping}.md`
> Scope: rebuild VocabularyTab IA + 24h soft-delete trash (new IDB store, 4 new message types, multi-store tx).

## Tasks

| # | Task | Priority | Parallel | Blocked strategy | AC |
|---|---|---|---|---|---|
| 1 | Data layer: `STORES.WORD_TRASH` + `DB_SCHEMA_VERSION` 11→12 + `createAllStores`/`clearAllStores` + dbCache `onversionchange` close | P0 | — | — | AC-1,2,11 |
| 2 | `wordTrashStore.ts`: `TrashedWordEntry`, `TRASH_TTL_MS`, `trashWordStatus` (multi-store tx), `listWordTrash` (purge+reconcile), `restoreWordStatus` (multi-store tx, tracking fallback), `deleteWordTrash`, `purgeExpiredTrash` | P0 | after 1 | — | AC-1,2,3,4 |
| 3 | `wordStatusStore.ts`: `setWordStatus` normalize `unknown`→delete; valid write clears pending trash; `deleteWordStatus` clears pending trash; `getAllWordStatuses` readwrite sweep of legacy `unknown` rows | P0 | after 1 | — | AC-5,6,12 |
| 4 | Message layer: types.ts + messages.ts + dictionarySchemas.ts + registry.ts — `WORD_STATUS_TRASH/TRASH_LIST/RESTORE/TRASH_DELETE` | P0 | after 2 | — | AC-1,3,4 |
| 5 | `handlers/wordStatus.ts`: 4 handlers + broadcasts (DELETED on trash, CHANGED on restore); `WORD_STATUS_LIST` handler purges trash; `WORD_STATUS_DELETE` clears trash via store | P0 | after 4 | — | AC-1,2,3,4 |
| 6 | `wordStatusClient.ts` + `features/dictionary/index.ts`: `trashWordStatus`, `listWordTrash`, `restoreWordStatus`, `deleteWordTrash` | P0 | after 5 | — | AC-1,3,4 |
| 7 | `vocabularyList.ts`: segment filter model (`'all'\|status\|'trash'`) replacing statuses Set; keep sort/paginate | P0 | after 2 | — | AC-9,12 |
| 8 | `vocabularySource.ts`: += trash entries state, `refresh`, `trash`, `restore`, `purge` methods; `changed{status:'unknown'}` removes in-memory entry | P0 | after 6,7 | — | AC-1,3,4,13 |
| 9 | `VocabularyTab.tsx` + module.css rewrite: segment rail (tablist+counts, InkTabs/Dictionary-toolbar language), full-width SearchField, sort+Edit row, view/edit modes, remove/purge Dialogs, trash rows (prev-status, countdown, Restore, delete-forever), EmptyStates ×3, Pagination, data-cell-ids per spec | P0 | after 8 | — | AC-7,8,9,10 |
| 10 | i18n: all new keys in `en.json` + `vi.json` (segments, edit/done, restore, trash copy, countdown, dialogs) | P0 | with 9 | — | AC-10 |
| 11 | Tests: `wordTrashStore.test.ts` (tx, TTL clock-mock, reconcile, idempotent, fallback) + update `wordStatusStore`/`vocabularyList`/`vocabularySource`/`VocabularyTab`/`baseRepository` tests | P0 | after 9 | — | AC-1..13 |
| 12 | Gates: typecheck + lint + test:unit + build; delete `src/entrypoints/mockup-vocabulary-tab-redesign/` | P0 | after 11 | — | AC-11 |
| 13 | Real-browser verify ~360/700/1200px: remove→trash→restore→purge; `docs/reviews/vocabulary-tab-redesign-verify.md` | P0 | after 12 | — | AC-7 + DoD |
| 14 | Docs (`2-architechture-system.md`, `0-wiki.md` changelog) + atomic commits (this item's files only) + `transition → shipped` | P0 | after 13 | — | DoD |

## Notes

- `previousStatus` always handler-derived inside tx (REQ-7); never client-sent.
- `WORD_STATUS_TRASH` bypasses `unknown`→delete normalization (REQ-7/8) — only entry path to trash.
- Trash view not live-synced across tabs — accepted risk (spec §Open Questions).
- Working tree has concurrent WIP (PrimerTab, useMenuPlacement, i18n msgs, mockup dir) — commits must stage only this item's files.
