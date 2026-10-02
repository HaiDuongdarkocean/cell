# Plan — srs-front-variants (deliver)

Spec: `docs/specs/srs-front-variants.md` (v3) · Brief+mapping: `docs/intent/srs-front-variants-{design-brief,component-mapping}.md` · Review: `docs/reviews/srs-front-variants-design.md` (APPROVE)

## Goal

Variant = user-managed memory component `{id,name,icon,fieldIds[],newLoops,builtin?,order}` in presets (collection default / deck override). Front renders only `fieldIds`; toggles (scope both/word/sentence, audio word/sentence) derive automatically from fieldIds + note material and persist in `srsUiPrefs.variantToggles`. Back always canonical. Unservable variants excluded from candidates (no `NO_TEMPLATE`). New UI: "Variants" tab in study settings = card shelf + Dialog editor (draft/Save, ghost Delete, `×` close only).

## Slices (sequential — shared type foundation first)

### S1 · Domain + schema (AC-5, AC-13, AC-15)
- `types.ts`: `VariantId`, `SrsVariant` (fieldIds: `(string|'input')[]`), `SrsVariantPreset`, `SrsVariantToggles`; `SrsCard.components/studyAgainDue` → `Record<VariantId,…>`; `SrsMemoryComponent.type` → string; `SrsReviewSession` {variant,toggles}; `SrsStimulus.type` widen string; `SrsReviewRecord` componentType→string + `dictationMode?`; `SrsDeck.variantPresetId?`; `SrsCollection.defaultVariantPresetId?`; `SrsUiPrefs.variantToggles`.
- `schemas.ts`: ComponentTypeSchema → `z.string()` in keyed records; new `SrsVariantSchema`/`SrsVariantPresetSchema`; vestigial frontTemplates/stages kept.
- DB: `variantPresets` table + repo + seed default preset (lazy on first read of `defaultVariantPresetId`).
- `recalcCard`: reconcile components vs preset variants (init missing, keep orphans).

### S2 · Guard + scheduler (AC-6, AC-7, AC-9)
- `features/srs/lib/variantFront.ts`: `hasMaterial(fieldId,note)`, `isServable(variant,note)` (input → needs ≥1 audio resolvable), `deriveToggles(variant,note,pref)`, `expectedField(variant,note,toggles)`, `fieldKind()`.
- `selectNextReview`: per-(card,variant) servable check → candidates; ordered pick → `loadNoteAssets` → build stimulus by filtered fieldIds → fail → next candidate; remove `NO_TEMPLATE` throw.
- `learningPath`/`recalcCard`: servable-variant param; unservable doesn't block explore-lock/maintenance.

### S3 · Review front UI (AC-1..4, AC-8)
- `SrsVariantFront.tsx` (extract from `SrsReviewCardFront`): generic field renderer + derived toggle chips top-left (fixed `min-width`); dictation input + placeholder per expected; audio button + autoplay when `input` present; no default targetWord/sentence render.
- Wire into `SrsReviewCard`; toggle changes persist `variantToggles` pref; Enter submit; `isSpellingCorrect` via `expectedField`; record `dictationMode`.
- Back unchanged.

### S4 · Variant manager UI (AC-10, AC-11, AC-14)
- `SrsStudySettings` += `Variants` tab → `SrsVariantShelf` (preset Select + search + kebab Menu [reset defaults] + New) + tile grid (tile = `SrsVariantFront` mini + name + loops + hidden state) + add tile.
- `SrsVariantEditorDialog`: preview (SrsVariantFront on sample note) → compact name InputField → field chips → loops SegmentedControl 1–3 → HintIcon hints → footer `Delete ghost→red-hover | Save primary`; draft state, `×` discards; validation (name, fieldIds non-empty).
- Deck detail: preset override row (inherit/select).
- i18n `srs.variants.*` + `srs.review.*` en+vi.

### S5 · Ripple (AC-5, AC-13, AC-14)
- stats/`isNew`/deck-detail iterate preset variants; orphan excluded; labels = variant.name (builtin fallback i18n).
- Sync: register `variantPresets` in `srsLocalSource` (LWW, collectionId scope).
- Import: components = deck's preset variants; revlog → builtin ids.
- `updateCurrentNote` mid-session: stale-stimulus semantics; toggles re-resolve only if selected option loses material.

### S6 · Mockup cleanup + docs + ADR
- Delete `src/entrypoints/mockup-srs-front-variants/`; revert any mock-only vite config.
- `docs/2-architechture-system.md` update; ADR variant-model; wiki changelog at ship.

## Tests
- `variantFront.test.ts`: isServable matrix, toggle derive + degrade, expectedField.
- schema compat: old 3-key card parses; prefs merge.
- scheduler: excluded variants, ordered-skip, per-variant newLoops.
- recalcCard reconcile; preset assign/delete fallback.
- DOM: front doesn't contain expected answer (AC-8).

## Gates
`typecheck` · `lint` · `test:unit` · `build` + real-Chrome verify (uiSurface=yes) + fresh-context verify → `docs/reviews/srs-front-variants-verify.md`.
