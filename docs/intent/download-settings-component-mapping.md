# Download Settings — Component Mapping

> ⚠️ **Superseded note (2026-09-08):** Tài liệu này tham chiếu Liquid Glass / glass material / blur — vật liệu này đã bị loại khỏi Cell. Luật thiết kế hiện hành: `docs/design-system/DESIGN_RATIONALE.md`; checklist: `docs/design-system/DESIGN.md`. Nội dung yêu cầu tính năng trong tài liệu vẫn hiệu lực; chỉ các mô tả visual kiểu glass/blur không còn áp dụng.

## Chosen concept
**Concept A — Liquid Glass Grouped Cards** is the proposed default. It keeps the
production IA (same four groups, same field order, same `Select` semantics, same
conditional Workers row) and only changes the container: each group becomes a
frosted-glass card. Concepts B and C are viable alternates — B when a denser,
dashboard-style surface is wanted; C when the section must stay short — but both
add interaction or visual weight that Concept A avoids.

## UI elements (Concept A)

| UI element | Decision | Maps to | Notes |
|---|---|---|---|
| Section frame (`Download` title + description) | **Reuse** | `Card`, `Heading level={4}`, `Text` (`@/shared/ui`) | Identical to production `cardHeader`/`cardTitle`/`cardDesc`. |
| Group card (Concurrency, Format & Quality, Conversion, Filename) | **Reuse** | `Card variant="glass"` | The shipped `glass` variant already provides frosted surface, hairline glass border, inner highlight, and `backdrop-filter` blur — no new CSS needed. |
| Group heading (small uppercase) | **Extend** | `Text` or a `div` with a `groupLabel`-style class | Production `.groupLabel` already exists in `SettingsDialog.module.css`; it moves inside the group card. Optionally promote to a shared `GroupLabel` atom later. |
| Row label | **Reuse** | `<label className={styles.rowLabel}>` / `<span>` + `HintIcon` | Unchanged production pattern; `label` when no hint, `span` + `HintIcon` for Parallel conversion. |
| Select fields (all 7) | **Reuse** | `Select` (`options: SelectOption[]`, `onChange(value: string)`) | Numeric fields (`concurrentDownloads`, `manualWorkerCount`) convert via `Number()` on change; workers clamped to `[MIN_PARALLEL_WORKERS, MAX_PARALLEL_WORKERS]`. |
| Field wrapper (label above select) | **Reuse** | `SettingsRow dense stacked` | Already used by production for the Format & Quality pair; in A it applies to all fields. |
| Format & Quality 2-column layout | **Reuse** | `VStack columns={2} responsive gapResponsive={{ mobile: '2', desktop: '4' }}` | Identical to production. (The mockup uses a container-query grid only because the stage simulates width; production keeps `VStack`.) |
| Conditional Workers child | **Reuse** | `SettingsRow dense divider stacked` + `.childField` indent | `settings.parallelConversion === 'manual'` gate, unchanged. |
| Field order / grouping | **Reuse** | `SETTING_GROUPS` metadata | Same order as `SettingsDialogContent.tsx` lines ~429-508. |
| Hint popover on Parallel conversion | **Reuse** | `HintIcon` | Copy moved to i18n key in production; plain English in mockup. |

## Elements introduced by alternates (not in default)

| UI element | Concept | Decision | Maps to |
|---|---|---|---|
| Glass tile + accent stripe + `Icon` chip + value line | B | **Create** (local to the card) | `Icon` (existing catalog names: `download`, `fileVideo`, `gauge`, `repeat`, `layers`, `pencil`, `slidersHorizontal`); accent tints derive from `--color-primary/success/warning` + `-subtle` tokens. |
| Sticky summary bar of current choices | C | **Create** | Plain `div` + chips; `position: sticky` + `--color-glass-thick` + `backdrop-filter`. |
| Collapsible group drawers | C | **Reuse** | `Collapsible` (`collapsed` prop) + header `<button aria-expanded>` + `Icon name="chevronDown"`. |

## Mockup → production mapping

- `src/entrypoints/mockup-download-settings/real.tsx` mirrors `SettingsDialogContent.tsx` lines ~419-509 1:1 (except the container-query pair grid, noted in-file).
- Concept A's group cards map to wrapping each production `groupLabel` + its `SettingsRow`s in `Card variant="glass"` inside the Download section — no data-shape or persistence changes.
- `mockData.ts` constants (`CONCURRENT_OPTIONS`, `QUALITY_*`, `CONVERT_*`, `PARALLEL_*`, `WORKER_OPTIONS`, `FILENAME_SOURCE_*`, `PREFERRED_FORMAT_*`) duplicate the module-level constants in `SettingsDialogContent.tsx` lines 56-82; if a concept ships, those should be extracted to a shared module both files import.

## Anti-patterns avoided

- No new settings data shape — `Settings` keys stay unchanged.
- No new select/dropdown component — the `Select` atom is reused everywhere.
- No hardcoded values — accents, glass, and spacing use token CSS only.
- No production edits — everything new lives in `src/entrypoints/mockup-download-settings/` + this doc.
