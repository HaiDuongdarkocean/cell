# Design Review — srs-front-variants

Stage: design → deliver gate
Artifacts reviewed:
- `docs/intent/srs-front-variants-design-brief.md` (Concept B chosen)
- `docs/intent/srs-front-variants-component-mapping.md`
- `src/entrypoints/mockup-srs-front-variants/` (ConceptB.tsx, mockData.ts, mockup.css, live at dev server)
- `docs/specs/srs-front-variants.md` (v3 — flat `fieldIds` + derived toggles)

## Reviewer decision trail (Anh, interactive design gate)

| Feedback | Resolution |
|---|---|
| Chọn Concept B (card shelf) — cần gọn, hiện đại hơn | Tile portrait, preview-first; chip field picker thay checkbox; preset + search + kebab top bar |
| Back không cần cấu hình — back luôn full | Back picker removed; canonical back only |
| Preview dùng đúng card SRS (SSOT) | `VariantCardPreview` renders production `SrsReviewCard.module.css` markup; production = `SrsVariantFront` shared component |
| Rename input nhỏ, radius 8px | Compact input, `radius-lg` |
| Edit + Reset-default gộp | Tap tile = edit; reset lives in shelf kebab menu |
| "Add mode" khó hiểu → không cần mode | Model simplified to `fieldIds[]`; toggles derive automatically (scope / audio / dictation input) |
| Thiếu Save, Delete quá sáng, cần cân đối | Draft + explicit `Save` (primary); `Delete` ghost neutral → red only on hover; footer `Delete — Save` |
| Chỉ `×` trên dialog là close | Footer Close removed |
| Chip không đổi size khi đổi label | `min-width` + centered + `tabular-nums` on `.bFrontToggle`/`.bChip` |

## Checks

- Brief linter: `node scripts/check-design-brief.mjs srs-front-variants` → **PASS** (16 components verified against `src/shared/ui`)
- Mockup typecheck: `npx tsc --noEmit` → clean
- Tokens only in `mockup.css`; no Liquid Glass; icons all in `ICON_CATALOG`
- Servability guard demonstrable live: note switcher `Full → No image → Word audio only → Text only` dims tiles correctly (dictation hides when no audio — no text fallback, per dictation-must-hear rule)
- Derived toggles verified in preview: scope cycle `A + ¶ → A → ¶`; audio `Word / Sent`; single-side material collapses toggle

## Spec deltas ratified by this review

- `SrsVariant = { id, name, icon, fieldIds[], newLoops, builtin?, order }` — no `frontModes`, no `back` config
- `'input'` pseudo-field = dictation; requires ≥1 audio resolvable else variant excluded
- `SrsUiPrefs.variantToggles` (scope/audio) replaces `variantModes`
- `SrsReviewRecord` gains `dictationMode?` (drop `frontModeId`)

VERDICT: APPROVE

Approved by Anh (design gate) — proceed to `deliver`.
