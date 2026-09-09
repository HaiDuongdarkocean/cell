# Spec: Anki config in Settings / schema cache

> Status: Approved
> Related specs: `spec-card-creator-bottom-sheet-mobile.md`

## Objective

Move Card Creator field mapping and destination configuration from the inline Card Creator form into **Settings → Card Creator**. Cache AnkiConnect schema (decks, note types, fields) in `chrome.storage.local` so Card Creator can open with **zero schema calls** on warm cache.

## User stories

1. In **Settings → Card Creator**, the user picks `Save cards to: Anki | Ocean SRS`.
2. When `Anki` is selected, the user sets the AnkiConnect URL, tests the connection, then picks the default note type and deck from cached lists, and maps each Cell source field to an Anki field.
3. When `Ocean SRS` is selected, the whole Anki section is hidden.
4. Opening the Card Creator form uses the saved mapping; it no longer shows per-field mapping selects.
5. With a warm cache, opening Card Creator does not trigger `deckNames`/`modelNames`/`modelFieldNames` AnkiConnect calls (a background revalidation may run). Switching to a cached note type also does not re-fetch fields.

## Data model

- `settings.dictionaryPopup.srsDestination: 'anki' | 'ocean-srs'` is the SSOT destination. The picker lives in **Card Creator** settings.
- `settings.cardCreator.fieldMappings: Record<string, FieldMapping>` stores mappings keyed by note type name.
- `ankiSchemaCache` (storage key `ankiSchemaCache`) holds `{ url, fetchedAt, decks, models, fieldsByModel }`.

## Constraints

- No new dependencies.
- All user-facing strings route through `t()` + `en.json`/`vi.json`.
- Do not touch `src/features/cardCreator/state/fieldDependency.ts` or `e2e/stage2/card-creator-field-dependency.spec.ts`.

## Success criteria

- [ ] Open Card Creator with valid cache → no `deckNames`/`modelNames`/`modelFieldNames` calls on the render path; revalidation runs in the background.
- [ ] Change a cached note type → 0 schema calls (decks/models/fields); `findRecentNote` remains live by design.
- [ ] Mapping edited in Settings is used by Card Creator; `FieldRow` no longer shows a per-field map select.
- [ ] Settings: choose **Ocean SRS** → fully hide the Anki section.
- [ ] Unit tests + build + typecheck + lint are clean.
