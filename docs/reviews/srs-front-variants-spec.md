# Spec Review — srs-front-variants (spec-reviewer subagent, fresh context)

Date: 2026-10-02 · Reviewed: `docs/specs/srs-front-variants.md` v2 vs `docs/intent/srs-front-variants.md` v2

Verified against: `entities/srs/{types,schemas}.ts`, `logic/{selectNextReview,resolveReviewSurface,reviewEngine,learningPath,resolvePool,pickHighestPriority,cardCreation}.ts`, `ui/{SrsReviewCardFront,srsUiPrefs,SrsStudyProvider,srsLabels}.tsx/ts`, `services/{firstRunService,noteAssetLoader,getSrsStats,getSrsHomeStats}.ts`, `repositories/srsDatabase.ts`, `sync/srsLocalSource.ts`, `sync/domain/merge/policies.ts`, `ankiImport/logic/{stateConvert,revlogMap,importWriter}.ts`, `entrypoints/srs-study/{SrsReviewCard,SrsDeckDetail}.tsx`.

## Findings

Major (all fixed in spec v2.1):
1. `SrsCollection.defaultVariantPresetId` declared required → old collection records fail zod parse before lazy-seed runs → now optional.
2. `SrsReviewRecord.templateId`/`stimulusType` + `SrsStimulus.type` enum không map được custom variant fieldIds → widened/vestigial per Data Model.
3. Reconcile-init chỉ ở write path nhưng read paths dereference `components[type]` unconditional → read-path rule `getComponent` helper.
4. `SRS_DB_SCHEMA_VERSION` bump + `SRS_STORES.variantPresets` giờ nêu tường minh trong REQ-5.
5. Preset sync: spec đã quyết register `variantPresets` vào `srsLocalSource` entity map (LWW, collection scope).
6. `recalcCard` tách `variantIds` (reconcile) vs `servableIds` (maintenance/explore) + `newLoops`; sibling writers listed.

Minor (all fixed): autoplay rule qua `inputExpectedFieldId`; REQ-2..4 Actor/Precondition; `progressionMode` vestigial; REQ-11→N13 trace; alternatives paragraph; orphan stats = preset-variants only; generic `srs.review.playAudio`; mid-session edit rule trong REQ-11.

Verified claims (hold): `mergeSrsCard` đã union-key components (confirm-only); builtin-id preservation → card/record history parses; ordered-pick→skip matches `buildStimulus` null-path; N1–N14 traced REQ+AC; AC-1–15 testable.

## Applied fixes

Applied to `docs/specs/srs-front-variants.md` (v2.1):

1. `SrsCollection.defaultVariantPresetId` → optional + lazy-seed (Data Model + REQ-5).
2. `SrsStimulus.type` widen `z.string()`; `SrsReviewRecord.templateId`/`stimulusType` optional vestigial; `+frontModeId` (Data Model + REQ-10).
3. Read-path rule: missing `components[id]` → empty component via `getComponent` helper (REQ-7 step 5).
4. `SRS_DB_SCHEMA_VERSION` bump + `SRS_STORES.variantPresets` named explicitly (REQ-5).
5. Presets registered for sync in `srsLocalSource` entity map (LWW, collection scope) (REQ-11).
6. `recalcCard` path param tách `variantIds` vs `servableIds` + `newLoops`; sibling writers listed (REQ-7 steps 3-4).
7. Autoplay rule: mode có `inputExpectedFieldId` → autoplay (bỏ flag riêng); REQ-2..4 có Actor/Precondition; `progressionMode` vào vestigial list; REQ-11 traced → N13; alternatives paragraph; orphan stats = preset-variants only; generic `srs.review.playAudio` aria-label.

VERDICT: APPROVE_WITH_CHANGES
