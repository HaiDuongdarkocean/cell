# Plan: Anki config in Settings / schema cache

## Data model

1. Move `SourceFieldKey` / `FieldMapping` to `src/entities/settings/types.ts`, re-export from `fieldMapping.ts`.
2. Add `CardCreatorSettings.fieldMappings: Record<string, FieldMapping>`.
3. Add `STORAGE_KEYS.ANKI_SCHEMA_CACHE` in `config.ts`.
4. Bump `CURRENT_SCHEMA_VERSION` to 29; add `fieldMappings: {}` to `DEFAULT_CARD_CREATOR_SETTINGS`.

## Schema cache service

1. Create `src/features/cardCreator/service/ankiSchemaCache.ts`.
2. Implement `loadAnkiSchemaCache`, `saveAnkiSchemaCache`, `removeAnkiSchemaCache`, `refreshAnkiSchemaCache`, `getModelFields`.
3. Cache structure: `{ url, fetchedAt, decks, models, fieldsByModel }`.
4. `getModelFields` merges into an existing cache; does not persist malformed cache.
5. Wrap storage writes in try/catch.
6. Write unit tests.

## Prefetch

1. Replace `cardCreatorPrefetch.ts` with cache-first, stale-while-revalidate.
2. Return cached decks/models immediately; background revalidate via `refreshAnkiSchemaCache`; notify `onAnkiSchemaRefreshed` listeners on actual change.
3. Single in-flight promise per URL; clear on rejection.
4. Update `cardCreatorPrefetch.test.ts`.

## State hook

1. Update `useCardCreatorState.ts`.
2. Cache-first field loading with `getModelFields`; saved mapping per note type; auto-map fallback; persist auto-map/restored mapping.
3. Add module-level `fieldMappingWriteQueue` to serialize writes.
4. Subscribe to `onAnkiSchemaRefreshed` to update dropdowns.
5. Add submit retry on missing deck/model via `refreshAnkiSchemaCache`.

## Settings UI

1. Rewrite `CardCreatorSettingsPanel.tsx` into a wizard: destination, URL + test, note type, deck, field mapping editor.
2. Remove SRS destination step from `DictionaryPopupSettingsPanel.tsx`.
3. Wire `SettingsDialogContent.tsx` to pass `srsDestination` + `onDestinationChange`.

## Card Creator form

1. Remove map select from `FieldRow.tsx`.
2. Remove mapping props from `CardCreatorDialogContent.tsx` and FieldRow calls.
3. Update `CardCreatorPanel.tsx` `hasCardCreatorSettingsChanged` to include `fieldMappings`.

## Quick Add

1. Update `webTextDictionaryController.ts` Quick Add path to read `fieldMappings` from settings, with auto-map fallback.

## i18n

1. Add new keys to `src/shared/i18n/messages/en.json` and `vi.json`.

## Tests

1. Write/update `ankiSchemaCache.test.ts`, `cardCreatorPrefetch.test.ts`, `useCardCreatorState.test.ts`, `CardCreatorSettingsPanel.test.tsx`, `FieldRow.test.tsx`.
2. Write `e2e/stage2/card-creator-anki-config.spec.ts`.

## Gate

1. `npm run lint`, `npx tsc --noEmit`, `npm run test:unit`, `npm run build`, `npm run build:mock`, `npm run test:e2e:stage2 -- card-creator-anki-config`.
