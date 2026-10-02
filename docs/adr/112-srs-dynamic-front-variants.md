# ADR-112: SRS dynamic front variants — user-managed `SrsVariant`/`SrsVariantPreset` replacing fixed components

## Status

Accepted — shipped with pipeline item `srs-front-variants` (spec
`docs/specs/srs-front-variants.md`, design brief
`docs/intent/srs-front-variants-design-brief.md`).

## Context

The original SRS review model hardcoded three memory components
(`ComponentType = 'sound' | 'meaning' | 'spelling'`) with fixed front templates.
That surfaced two problems:

- Templates could expose the answer (audio played on the front, image-less
  meaning cards fell back to text), so reviews did not always test retrieval.
- Users could not define their own recall variations, tune the front surface,
  or set per-variant new-card loops.

## Decision

1. **Variants are entities, not an enum.** `SrsVariant =
   { id, name, icon?, fieldIds, newLoops, builtin?, order }` where `fieldIds`
   declare which note fields render on the front (`input` is a pseudo-field for
   dictation). Cards store `components: Record<VariantId, SrsMemoryComponent>` —
   every variant has independent FSRS state and progress. Builtins keep the
   stable ids `sound`/`meaning`/`spelling` so existing card components and Anki
   import (`stateConvert` 3-component fan-out) carry over without migration.
2. **Presets own variant lists at collection scope.** `SrsVariantPreset =
   { id, collectionId, name, variants, isDefault, createdAt }` is a new synced
   data class (`srsVariantPreset`, applied after `srsCollection`, before
   `srsNotetype`); `deck.variantPresetId` overrides the collection default so
   decks can share a preset. `variantPresetRepository` lazily seeds the default
   preset and clears deck references when a preset is deleted.
3. **Front behavior derives from `fieldIds`, not config.** `lib/variantFront.ts`
   is the pure SSOT: `target`+`sentence` ⇒ scope toggle (both→word→sentence),
   `wordAudio`+`sentAudio` ⇒ audio toggle, `input` ⇒ dictation field with the
   expected answer resolved from the active audio target. `isVariantServable`
   gates variants on actual note material — a variant with no renderable front
   is hidden and unscheduled; dictation without audio is hidden (no text
   fallback, which would copy the answer).
4. **Scheduling resolves presets per deck.** `selectNextReview` loads the
   effective preset (deck override → collection default), builds candidates for
   every variant, filters by `servableVariantIds`, then revalidates after media
   resolution via `orderCandidates` ordered-skip so a dead asset never blocks
   later variants. `recalcCard` reconciles `components` against the active
   preset (orphans kept but ignored) and computes `maintenanceMode` over
   servable variants only — zero servable ⇒ `maintenanceMode=false`.
5. **One renderer for front everywhere.** `ui/SrsVariantFront.tsx` renders the
   front for review, the Variants-panel tile previews, and the editor preview;
   the back is always the canonical full-field `SrsReviewCardBack`. The Variant
   Manager lives as a "Variants" tab in `SrsStudySettings` (Concept-B card
   shelf, draft/Save editor dialog, ghost-delete destructive-on-hover).

## Consequences

- `SrsReviewRecord.componentType`/`stimulusType` store dynamic strings
  (`variant:<id>` stimulus types); `componentType` is a `VariantId` for new
  records — history consumers must read labels via `componentLabelById`.
- Editing a preset re-runs `recalcCard` lazily per touched card; orphaned
  components are retained so restoring a variant does not lose progress.
- `getSrsHomeStats`/`SrsDeckDetail` derive "new"/progress from active preset
  variant ids instead of the fixed component set.
