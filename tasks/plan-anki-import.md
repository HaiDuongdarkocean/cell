# Plan — anki-import

Spec: `docs/specs/anki-import.md` · Design: `docs/intent/anki-import-design-brief.md` + `-component-mapping.md`

## Slice plan (thin, verified, committed)

### S1 — Normalized model + transform core (pure, no UI)
- `src/features/ankiImport/model/normalized.ts` — `NormalizedAnkiData`, `NormalizedCard`, `NormalizedNote`, `NormalizedDeck`, `NormalizedNotetype`, `NormalizedRevlog`, `FieldRole`, `FieldMapping`.
- `src/features/ankiImport/logic/stateConvert.ts` — queue/type→fsrsState table, due conversion (crt+days vs unix-s vs lastRevlog+ivl), memory_state protobuf decode (`DataView`), SM-2 fallback, progress formula, learningSteps/left unpack.
- `src/features/ankiImport/logic/deckFlatten.ts` — `A::B::C`→`A › B › C`, filtered-deck routing via `odid`, leaf-name collision suffixing.
- `src/features/ankiImport/logic/fieldMapping.ts` — role heuristics (`[sound:]`→audio, `<img`→image, ord0→target, longest-text→sentence, `ipa|kana|reading`→ipa) + apply mapping to synthesized `SrsNotetype` (fields, `__media` extras, always-renderable `frontTemplates` per component — NO_TEMPLATE guard).
- `src/features/ankiImport/logic/revlogMap.ts` — ease→judgment, deterministic record ids.
- Tests: `stateConvert.test.ts`, `deckFlatten.test.ts`, `fieldMapping.test.ts`, `revlogMap.test.ts` with fixture data.
- AC: AC-1 (unit), AC-4 (flatten/cloze/suspended/filtered), AC-7 (record mapping), AC-8 (due conversion math).

### S2 — Apkg adapter
- `src/features/ankiImport/adapters/apkgAdapter.ts` — unzipit → sniff anki21b(fzstd, lazy `import('fzstd')`)/anki21/anki2 → sql.js → normalized rows (normalized tables preferred, `col.*` JSON fallback) → `NormalizedAnkiData` + media map + scheduling-missing detection.
- Dep: `fzstd` (lazy dynamic import only inside anki21b branch).
- Tests: fixture `.apkg` buffer built in-test via fflate; anki2-stub error path.
- AC: AC-3, AC-1 (parse feeds S1 transforms).

### S3 — AnkiConnect adapter
- `src/features/ankiImport/adapters/connectAdapter.ts` — chunked `deckNamesAndIds`/`modelNames`/`modelFieldNames`/`findCards`/`cardsInfo`/`findNotes`/`notesInfo`/`getReviewsOfCards` over existing `invokeAnkiConnect`; media lazy `retrieveMediaFile`. Dedup `importSource` unchanged.
- Transport: reuse `CARD_CREATOR_REQUEST` relay path used by cardCreator (inspect `src/features/cardCreator/service/*` caller — reuse same send function).
- Tests: mock fetch fn — chunking, error propagation, due-from-revlog derivation.
- AC: AC-2.

### S4 — Import writer + schema extension
- `importSource?: {provider:'anki', cardId:number, noteId:number}` on `SrsNote`+`SrsCard` schemas (`.optional()`), types updated.
- `src/features/ankiImport/services/importWriter.ts` — `importNormalized(data, selection, mappings, langProfile, onProgress, signal)`: resolve/create collection+decks+configs+notetypes → per-card atomic bundle (note+card+records+assets) → `recalcCard` → counts; skip suspended/cloze/dedup via one in-memory cardId Map; cancel checkpoints between bundles.
- `src/features/ankiImport/services/mappingPresets.ts` — `chrome.storage.local` `ankiImport.mapping.<name>` get/set.
- Tests: in-memory IDB harness already used by repository tests — full import of fixture, re-run dedup, suspend/cloze skips, review records.
- AC: AC-1, AC-4, AC-6, AC-7, AC-8 (due-parity check helper for fixture test), NFR-6.

### S5 — Wizard UI + entry
- `src/features/ankiImport/ui/ImportWizard.tsx` + step components (`SourceStep`, `ScopeStep`, `LanguageStep`, `MappingStep`, `RunningStep`, `ReportStep`) following the mockup layout; Dialog desktop / MobileSheet mobile; preview renders through `resolveReviewSurface` on a transient SrsNote built from mapped sample.
- `.apkg` file input + drag/drop; AnkiConnect ping on source select; guided checklist on fail.
- `SrsHome.tsx`: import IconButton (`srs.home.importAnki`, icon `import`) before settings gear; opens wizard.
- i18n keys `srs.import.*` en+vi.
- AC: AC-2 (checklist), AC-4/5 (picker+preview), AC-9, AC-10.

### S6 — Gates, verify, docs, ship
- `npm run typecheck && npm run lint && npm run test:unit && npm run build` (pre-existing failures in other agents' files documented, not fixed).
- Browser verify via dev server; delete `mockup-anki-import/` at ship.
- `docs/2-architechture-system.md` + `docs/0-wiki.md` updates; ADR for `importSource` schema extension + `fzstd` dep.
- Fresh-context verify → `docs/reviews/anki-import-verify.md`.

## Reuse ledger (ponytail check)

| Need | Existing | Decision |
|---|---|---|
| zip | `unzipit@2.0.3` | reuse |
| sqlite | `sql.js` | reuse |
| zstd | none | add `fzstd`, lazy |
| AnkiConnect HTTP | `invokeAnkiConnect` + `CARD_CREATOR_REQUEST` relay | reuse, add typed wrappers |
| write path | `putNote/putCard/putDeck/...`, `recalcCard`, `srsSyncScope` | reuse; uniqueness guards bypassed via direct puts (validated by Zod) |
| assets | `audioAssetRepository`/`imageAssetRepository`/`quotaManager` | reuse |
| preview | `resolveReviewSurface` | reuse |
| wizard host | `Dialog`/`MobileSheet` | reuse |

## Risks

- `cardsInfo` field coverage (`odid`,`ord`) — verify on live AnkiConnect at S3; spec documents fallback.
- `left` packing semantics — approximation accepted in spec.
- Bundle size of sql.js WASM — already shipped dep.
