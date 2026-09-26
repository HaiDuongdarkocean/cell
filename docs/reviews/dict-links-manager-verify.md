# Verify — dict-links-manager

Plan: `tasks/plan-dict-links-manager.md` · Spec: `docs/specs/dict-links-manager.md` (REQ-1..8)

## Gates

- `npm run typecheck` — PASS (tsc --noEmit clean)
- `npm run lint` — PASS (eslint clean)
- `npm run test:unit` — PASS (578 suites / 6905 tests)
- `npm run build` — PASS (vite build + postbuild CSP patch clean)

## Unit coverage

- `dictLinkTemplate.test.ts` — isSafeDictUrl scheme whitelist; validateDictLink (name trim/cap 64, template cap 2048, `{term}` required, substituted URL must parse http/https); makeDictLink (id, trim, `langCodes: []`)
- `fillExternalDictLinks.test.ts` — `{term}`/`{lang}` substitution + encodeURIComponent, `langCodes` filter (empty = all langs), unsafe/malformed templates dropped, stored order preserved, empty list → []
- `DictLinksManager.test.tsx` — rows render, empty state, add via dialog, invalid URL rejected without mutation, pencil edits name+URL, inline rename (Enter commit), delete confirm, ArrowDown keyboard reorder, langCodes preserved on rename
- `DictionaryPopupSettingsPanel.test.tsx` — surface tab strip (audio/image/translate/links), links tab default, translate tab pills, audio/image hints hide manager, onChange preserves sibling fields
- `settingsStore.test.ts` — `saveSettings` writes `dictionaryPopup` into the active profile and leaves other profiles untouched (REQ-7)

## Real-Chrome verification (Playwright persistent context + cloned profile, uBOLite loaded)

Script: `tmp/dict-links-manager/verify.mjs` — 13/13 checks:

- tab strip `[role=tablist]` renders Audio/Image/Translate/Links inside `data-section="dictionaryPopup"`
- surface tab measured height = 32px; manager icon buttons = 40×40px
- default links listed in stored order (Cambridge Dictionary, Wiktionary, Google Translate)
- audio tab → hint text, manager hidden; links tab → manager returns
- Add dialog → new row; invalid `javascript:` template → inline `[role=alert]` error, no mutation
- pencil dialog edits name + URL; click-name inline rename commits on Enter
- ArrowDown on drag handle reorders; new order written to `chrome.storage.local.settings.dictionaryPopup.externalDictLinks`
- delete confirm removes row; change survives full page reload

Evidence: `tmp/dict-links-manager/final.png`, script output above.

## Notes

- REQ-6/7 profile sync verified at unit level (active-profile write-through in `saveSettings`); browser run used the default no-profile state — profile switching shares the same `syncFlatFieldsToActiveProfile` path exercised by the unit test.
- Popup pill rendering reads the same persisted `externalDictLinks` via `useCandidate` → `useDictionaryToolbar`; URL safety + substitution covered by `fillExternalDictLinks` tests.

VERDICT: PASS
