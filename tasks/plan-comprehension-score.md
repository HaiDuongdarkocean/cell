# Plan — comprehension-score

Spec: `docs/specs/comprehension-score.md` · Intent: `docs/intent/comprehension-score.md` · Backlog #2

| # | Task | Files | Verify |
|---|---|---|---|
| 1 | Entities + pure core: `ComprehensionKind/Band/Stats` types; `computeStats(tokens, kind)`; `createScoreTracker(tokens, statuses)` — `Map<term,{count,status}>`, `applyStatus` O(1); baseline suppress (statusMap rỗng → null) | `entities/comprehension/types.ts`, `features/tokenize/logic/comprehensionScore.ts` (+test) | unit: bands 95/98/90/95 boundaries, 0.5 tracking, empty, zh case, A1–A6,A11,A14,A17 |
| 2 | Media score source: subscribe `useCuesStore.targetCues` → `createTokenList(cue.text)` → unique terms → 1 `getWordStatuses` → tracker; buffer `onWordStatusChanged` trong await + replay; fail-open warn; publish `comprehensionStore` (zustand, pattern theo tokenizeStateStore) | `features/subtitle/logic/mediaScoreSource.ts` (+test), `features/tokenize/services/comprehensionStore.ts` | unit: cue-change → 1 batched call; A10,A15,A16 |
| 3 | UI: `ComprehensionBadge` (icon+%+band label, status palette tokens) + `ComprehensionPill` (2-segment media/text toggle, media default) + i18n `comprehension.*` en/vi | `features/tokenize/ui/ComprehensionBadge.tsx`, `ComprehensionPill.tsx`, `shared/i18n/messages/{en,vi}.json` | render test: toggle, hidden khi no stats, band color |
| 4 | Floating pill mount + web wiring: `mountComprehensionPill` shadow-DOM fixed top-right (`--z-overlay-top`); `featureInit` start media source → pill; unmount khi cả hai stats null | `features/tokenize/ui/mountComprehensionPill.ts`, `entrypoints/content/featureInit.ts` | typecheck + real-Chrome smoke (mock-youtube) |
| 5 | SubtitlePanel chip: CueList prop `onTokensResolved?: (map) => void` (fire khi tokenMap resolved/updated) → SubtitlePanel `computeStats(map flatten, 'media')` → header chip | `CueList.tsx`, `SubtitlePanel.tsx` | render test + panel smoke |
| 6 | Web text score: khi `isTokenizeEnabledForUrl` → pass 1: prepare all `blocks` (không bind) → terms → `getWordStatuses` → tracker → store.text; recompute on mutation batch debounced | `webTokenizeController.ts` (expose `getBlocksTokens()`/helper), mediaScoreSource-like `textScoreSource` | unit + smoke |
| 7 | Reader chip: book open → `tokenizeTextBlock` paragraphs (chunked yield) → `getWordStatuses` → header chip cạnh `readerStats` | `entrypoints/reader/App.tsx` | render test: A13 |
| 8 | Local player pill: mount pill trên player page — media source reuse (cùng `useCuesStore`) | `entrypoints/local-player/main.tsx` + wire | smoke local player |
| 9 | Gates + docs: `typecheck && lint && test:unit && build`; real-Chrome smoke; `docs/2-architechture-system.md`; backlog → shipped + spec/plan links; `docs/0-wiki.md` changelog | — | all green |

Deps: 1 → mọi thứ. 2,3 sau 1 (parallel-able: 2=subtitle logic, 3=UI disjoint). 4 sau 2+3. 5,6,7 sau 1+3 (disjoint files → parallel-able). 8 sau 2+4. 9 cuối.

## Architecture decisions

- Score chỉ cần **status**, không cần frequency → lean pass (`createTokenList` + `getWordStatuses`), bỏ `resolveCueListTokenMetadata` cho source path (spec §9).
- `ComprehensionStats`/`Kind`/`Band` ở `entities/comprehension` — contract chung cross-feature (pill ở tokenize UI, source ở subtitle logic, mount ở entrypoints).
- Media source sống ở `features/subtitle/logic/` (consume cuesStore) — cùng pattern `unknownCueMap.ts`; tracker core ở `features/tokenize/logic/`.
- Pill mount 1 lần per page context; reader/local-player là extension pages → mount trực tiếp, không shadow cần thiết? — verify: reader/local-player có dùng shadow mount không → follow convention của từng page (local player dùng SubtitlePanels bình thường → pill mount plain fixed div là đủ).

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Text scan page lớn >3s | Med | prepare-only, chạy sau activation, cap blocks nếu measure chậm (spec §10) |
| Pill đè OrbitalBadge | Low | default top-right vs badge right-center; accepted v1 |
| Cues đổi liên tục (auto-translate streaming) | Med | debounce rebuild theo cue-set identity (key: length+first.start+last.end như contentScriptController:186) |

## Open questions

— (đã resolve trong spec §10: cross-tab relay free, langCode = subtitleOverlayTargetLanguage convention)
