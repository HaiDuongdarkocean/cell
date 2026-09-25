# Verify Review — dict-example-selection

VERDICT: PASS

## Scope reviewed

- Spec: `docs/specs/dict-example-selection.md` (14 Success Criteria)
- Plan: `tasks/plan-dict-example-selection.md`
- Implementation diff across `dictionaryPopup` (useCandidate, CandidateView, DictionaryCheckable/CandidateView CSS, DictionaryPanelView skeleton), `entities/dictionary/popupTypes.ts`, `dictionary/logic/formatDefinitions.ts`, `cardCreatorBridge.ts`, `addToOceanSrs.ts`, settings types + `DictionaryPopupSettingsPanel`, i18n en/vi, `DictionaryCheckable.showcase.tsx` mirror.
- Fresh-context review: `subagent_explore` (agent af507d60), read-only, traced every criterion to file:line evidence. Worktree contained unrelated agents' in-flight changes; review scoped to this item's diff only.

## Findings per spec criterion

- AC-1/AC-2 (rows + dot→checkbox contract): sibling `cellDefExampleItem` rows with `role="checkbox"`, `aria-checked`, `tabIndex=0`, Space/Enter + `preventDefault`/`stopPropagation`, idle `·` dot + hover/focus/press/checked compound states — `CandidateView.tsx`, `DictionaryCheckable.module.css`. PASS
- AC-3 (example→def cascade): `toggleExample` selects parent def on check only — `useCandidate.ts`. PASS
- AC-4/5/6 (def toggle semantics): `toggleDefinition` clears `exampleSelection[defId]` on uncheck; fills all indices only when `includeAllExamples` (loaded `?? false`, manual default). PASS
- AC-7/AC-8 (deselect-last keeps def; composite ids): empty `Set` preserved; `selectedExamples` emitted in source order with `defId:index` ids — `buildCandidatePrefill.ts`, `definitionSelection.ts`. PASS
- AC-9 (format): `formatDefinitions` emits `· ` lines under `• ` def lines; byte-identical output when `selectedExamples` absent (`dictionaryGenerate` path safe). PASS
- AC-10 (snapshot clone): structured `selection.definitions` wins over `contextDefinitions` re-parse; `selectedExampleIds` propagated and re-initialized on clone — `cardCreatorBridge.ts`, `useCandidate.ts` init key. PASS
- AC-11/AC-12 (setting + i18n): Settings → Dictionary Popup step with "Pick examples myself | Include all examples" coerced to boolean, profile-scoped persist; `settings.dictionaryPopup.examples*` keys in en/vi. PASS
- AC-13 (SRS): `addToOceanSrs` appends selected examples to SRS fields. PASS
- AC-14 (guards/scope): text-region and `getSelection()` click guards; `·`-line re-parse never yields `• · ex`; `SenseLine role:'example'` left non-selectable per scope cut. PASS
- Boundaries: `useDictionaryLookup` untouched; compound selectors stayed in `DictionaryCheckable.module.css`; skeleton + showcase mirrors updated.

## Deterministic gates

- `npm run typecheck` — pass
- `npm run lint` — pass on all touched files (pre-existing errors in unrelated dirty files only)
- `npm run test:unit` — scoped suites 72/72 pass (definitionSelection, useCandidate, buildCandidatePrefill, formatDefinitions, CandidateView, DictionaryPopupSettingsPanel, addToOceanSrs); full suite green except 4 unrelated `migakuFixtures.test.ts` timeouts on files owned by another agent
- `npm run build` — pass
- Browser (real Chromium, `tmp/dict-example-selection/verify.mjs` on Universal Panel showcase, 390px viewport) — 20/20 checks: role/aria/tabindex, text-region no-toggle, gutter/label/Space/Enter toggling, cascade, def-uncheck reset, manual vs include-all setting (via profile-scoped storage + tab remount), Send to Card field contains `• def` + `· example` lines.

## Issues found

- Minor: `initExampleSelection` accepted malformed id `defId:` (empty index → `Number('')=0`). Fixed with empty-suffix guard.
- Minor: example-row `onClick` does not `stopPropagation` — harmless, mirrors def-row pattern.
- Note: `selectedExamples` collapses explicit-empty vs untouched per def — observably identical, documented.

## Residual risks

- `dictionaryPopup` settings are per-language-profile flat fields; raw-storage writes must target `languageProfiles[active].dictionaryPopup` (verified — not a bug, but a trap for future tests; captured in a learning atom).
- Full-suite `migakuFixtures.test.ts` timeouts are foreign-owned dirty files, unrelated to this diff.
