# Plan — dict-links-manager

Spec: `docs/specs/dict-links-manager.md` · Mapping: `docs/intent/dict-links-manager-component-mapping.md`

## Steps

1. **Promote shared utils**
   - `src/shared/lib/reorderItems.ts` ← move `reorderItems` from `features/cardCreator/ui/useMediaLists.ts` (update its import + test).
   - `src/shared/lib/useSectionDrag.ts` ← move `features/dictionary/ui/useSectionDrag.ts`; generalize `draggedId: number`→`number | string`, `SLOT_SELECTOR` → `slotPrefix` option (default `'slot-'`); update `ResourcesPanel` import.

2. **REQ-7 fix** — `settingsStore.ts` `saveSettings`: `syncFlatFieldsToActiveProfile` before `resolveSettingsFlatFields` (single-point; import from `@/entities/settings/lib/profileResolution` — check barrel export first).

3. **Feature logic** — `src/features/settings/logic/externalDictLinks.ts`:
   - `makeDictLinkId()` — guarded `crypto.randomUUID` + counter/timestamp fallback.
   - `validateDictLink(name, urlTemplate)` — trim, name 1–64, template ≤2048, contains `{term}`, probe substitute `{term}`→`x`/`{lang}`→`en` → `new URL()` http/https.

4. **i18n** — `en.json` + `vi.json`: `settings.dictionaryPopup.links.*` keys per mapping doc; reuse `dict.tab.*` for tab labels.

5. **Panel restructure** — `DictionaryPopupSettingsPanel.tsx` + `DictLinksManager.tsx` (new):
   - Timeline keeps global steps (openWith, showFirst, examples); `translationVisibility` moves under Translate tab.
   - Surface `tablist` (audio/image/translate/links), icon+label pills mirroring `DictionaryToolbar` (32px tabs).
   - `DictLinksManager`: Card rows (`--card-padding: spacing-2 spacing-3`, `radius-lg`), `DragHandle` pinned 40px, name click → inline `Input` rename, pencil → `Dialog` (name+URL+hint+error), trash → confirm `Dialog`, Add → same dialog; `useSectionDrag` for reorder + ArrowUp/Down; all controls 40px via local pin classes.

6. **Popup wiring** — `useDictionaryToolbar`: new option `externalDictLinks?`, `links` memo uses it (fallback `DEFAULT`), `fillExternalDictLinks` drops entries whose substituted URL fails `new URL()` or non-http(s). `useCandidate`: extend existing `loadSettings()` read → `dictLinks` state → pass to toolbar.

7. **Tests** — validation unit test; `fillExternalDictLinks` whitelist test; panel test (tab strip, CRUD, reorder); `saveSettings` profile-sync regression test.

8. **Gates** — typecheck, lint, test:unit, build → browser verify → `docs/2-architechture-system.md` → ship.

## Risks

- `useSectionDrag` generalization touches ResourcesPanel — keep default behavior byte-identical.
- `saveSettings` ordering: sync must run BEFORE resolve, on the merged `toStore`.
- Nested `Dialog` inside settings dialog — `pushEscapeLayer` handles stacking already.
