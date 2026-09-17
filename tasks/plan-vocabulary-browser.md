# Plan — vocabulary-browser

Spec: `docs/specs/vocabulary-browser.md` · Intent: `docs/intent/vocabulary-browser.md` · Backlog #3

| # | Task | Files | Verify |
|---|---|---|---|
| 1 | Message layer: `WORD_STATUS_LIST/CYCLE/DELETE` + `WORD_STATUS_DELETED` — MESSAGE_TYPES, MessageType union, dictionarySchemas, registry; `getAllWordStatuses` store helper; handlers (CYCLE atomic via `cycleWordStatus` → trả status + broadcast CHANGED; DELETE → `deleteWordStatus` + broadcast DELETED — param hóa broadcast type) | `shared/config/messages.ts`, `entities/message/{types,registry,dictionarySchemas}.ts`, `features/dictionary/services/wordStatusStore.ts`, `entrypoints/background/handlers/wordStatus.ts` (+test) | unit: schemas, handler list/cycle/delete + broadcast đúng type |
| 2 | Client + bus: `normalizeLangCode` trong `wordStatusClient` áp mọi method (+3 methods mới list/cycle/delete); `wordStatusEvents` thêm removed detail + emit/on; `wordStatusCrossTab` relay DELETED → emit removed | `features/dictionary/services/{wordStatusClient,wordStatusEvents,wordStatusCrossTab}.ts` (+tests) | unit: normalize zh-hans→zh/''→'en', removed relay |
| 3 | Pure list logic: `filter+search+sort(recent/alpha/grouped)+paginate(clamp pageIndex)+applyEvent(upsert|removed)` | `features/vocabulary/logic/vocabularyList.ts` (+test) | unit: A2–A4, A18, dedupe-replay |
| 4 | Source: `vocabularySource` — subscribe onChanged/onRemoved TRƯỚC await LIST → buffer → replay; normalize event langCode; zustand store nhỏ theo `tokenizeStateStore` pattern | `features/vocabulary/services/vocabularySource.ts` (+test) | unit: A8–A11, A19 |
| 5 | UI `VocabularyTab`: Chip×4 + SearchField + Select sort + Pagination(200) + ListItem rows (term click→lookup cb, status Badge click→cycle, delete IconButton→Dialog confirm) + EmptyState + i18n `vocabulary.*` en/vi; status colors từ tokenSpanCss palette | `features/vocabulary/ui/{VocabularyTab.tsx,VocabularyTab.module.css}`, `shared/i18n/messages/{en,vi}.json` (+test) | render test: A1–A7, A12 |
| 6 | Tab threading 6 sites + `openDictionaryLookup(term)` controller method (set pendingSearchTerm only, không arm card-creator); icon từ ICON_CATALOG | `universalPanel/{types.ts,UniversalPanel.tsx,UniversalPanelBottomNav.tsx,UniversalPanelController.ts,mountUniversalPanel.ts}` (+test) | A16 mobile bottom nav, A17 persisted restore, A6 no card-creator arm |
| 7 | Gates + docs: `typecheck && lint && test:unit && build`; real-Chrome smoke (mock-youtube: mark → row xuất hiện); `docs/2-architechture-system.md`; backlog → shipped; `docs/0-wiki.md` changelog | — | all green |

Deps: 1 → 2 (client cần MESSAGE_TYPES/schemas). 3 ∥ 4 sau 2 (logic thuần disjoint; 4 cần bus từ 2). 5 sau 3+4. 6 sau 5 (wiring tab cần component). 7 cuối.

## Architecture decisions

- `features/vocabulary/` là feature mới (logic/services/ui) — không nhét vào `dictionary/` vì nó consume wordStatus chứ không produce; FSD sạch hơn.
- Cycle/delete atomic ở background — client không read-modify-write (spec §9).
- Local actions emit `emitWordStatusChanged`/`emitWordStatusRemoved` sau success — same-tab listeners (token underline, CueList, list) update không chờ broadcast (broadcast skip source tab).
- Pagination thay virtualization — `Pagination` sẵn có, 0 dep mới; page 200 rows.

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Broadcast DELETED không tới extension pages | Low | accepted v1 (spec §10) |
| BottomNav/persisted whitelist quên → silent drop | Med | A16/A17 test bắt regression |
| `getAll` payload lớn | Low | ceiling documented; key-range paging nếu >10k |

## Open questions

— (đã resolve trong spec §10)
