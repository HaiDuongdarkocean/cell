# Test Plan: Anki config in Settings / schema cache

## Unit

| # | Target | What to verify |
|---|---|---|
| 1 | `ankiSchemaCache.test.ts` | Load/save/refresh cache; URL mismatch returns null; `getModelFields` cache hit and cache miss; `getModelFields` does not persist malformed cache; storage write failures are non-fatal. |
| 2 | `cardCreatorPrefetch.test.ts` | Cache-first return; background revalidation and listener notification; URL change drops stale promise; failure clears in-flight promise. |
| 3 | `useCardCreatorState.test.ts` | Prefetch cached data used; saved mapping per note type applied; auto-map fallback persisted; note type change uses cached fields; submit missing deck/model retry. |
| 4 | `CardCreatorSettingsPanel.test.tsx` | Destination picker calls `onDestinationChange`; Ocean SRS hides Anki section; note type + deck selects populate from cache; field mapping editor writes per-note-type `fieldMappings`; successful test refreshes schema cache. |
| 5 | `FieldRow.test.tsx` | No map select rendered; label + input still work. |

## E2E

| # | Target | Steps |
|---|---|---|
| 1 | `e2e/stage2/card-creator-anki-config.spec.ts` | Seed `ankiSchemaCache` + `settings` via background evaluate; open Universal Panel → Dictionary tab; assert Card Creator renders note type/deck from cache while offline (mocked AnkiConnect offline); open Settings → Card Creator; switch destination Anki/Ocean SRS and assert section visibility; map a field and verify `settings.cardCreator.fieldMappings` persists. |

## Acceptance

- Run `npm run lint`, `npx tsc --noEmit`, `npm run test:unit`, `npm run build`, `npm run build:mock`, `npm run test:e2e:stage2 -- card-creator-anki-config`.
