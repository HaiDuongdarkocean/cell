# Component Mapping — Unified Resource Import

Chosen concept: **A — Một dãy sách** (user-picked). Spec: `docs/specs/unified-resource-import.md`.
User direction bổ sung ghi nhận ở design gate: intake/upload phải live từng job — file xong thì resource card vào list ngay, trạng thái update trực tiếp không chờ phiên/reload (map xuống hành vi registry-job + importing-card-fill đã có; DELIVER giữ và siết chặt, không regressed).

Scope UI thực tế: `ResourcesPanel.tsx` (hai section → một), `ImportProgress.tsx` (badge + picker slot), `ResourceCard.tsx` (chips cho mọi resource), i18n keys mới.

## Elements

| Element | Component | Decision | Token(s) | Icon |
|---|---|---|---|---|
| Section head "Tài nguyên" | `SectionHeader` | reuse — một instance thay hai; copy i18n mới `resources.unified.*` | — | `pencil` (edit toggle) |
| Edit bar (select-all + bulk actions) | `Checkbox`, `Button` | reuse — delete-all noun đổi sang "tài nguyên" | `derived.light.color-field` | — |
| Dropzone | existing feature dropzone (`div`+`input` only) | reuse — accept union `.txt,.json,.zip,.db,.gz`; label/hint i18n mới | `core.light.border`, `derived.light.color-primary-subtle` | — |
| Job row | existing feature import-progress row built on `Button`, `Spinner`, `Icon` | extend — `KindBadge` cạnh filename + picker row khi file multi-component | `derived.light.color-surface-card`, `derived.light.color-primary-subtle` (fill), `derived.light.color-destructive` (error) | `alertCircle`, `triangleAlert`, `circleCheck` |
| Detected-kind badge trên job row | `Badge`, `Icon` | reuse — `size="sm"`, một badge per detected component | `derived.light.color-primary-subtle`, `core.light.primary` | `bookOpen`, `gauge` |
| Component picker trên job multi-component | `Chip` | reuse — `as="button"`, `selected` = phần sẽ nạp; deselect truyền qua chunk payload | — | — |
| Resource card | existing feature card built on `Card`, `Toggle`, `Checkbox`, `DragHandle`, `Menu`, `Dialog`, `Spinner`, `Input` | extend — bỏ gate `isDict` trên chip list (mọi resource render components), thêm label 'frequency' | `component.card.radius`, `derived.light.color-field` | `trash`, `info` |
| Pending/importing slot | existing pending-row merge (job row đứng đúng slot card sẽ vào) + fill trong card | reuse — đáp ứng yêu cầu "xong là vào list ngay" | `derived.light.color-primary-subtle` | — |
| Registry job rows | existing jobs-feature row built on `Card`, `Text`, `Button`, `Icon`, `Progress`, `Spinner` | reuse | — | — |
| Empty state | `EmptyState` | reuse — copy một section `resources.unified.empty` | — | — |
| Delete confirm | existing feature modal built on `Dialog`, `Button`, `Separator` | reuse — copy bỏ noun theo type | — | — |
| Frequency bands editor | existing feature editor built on `Button`, `Input` | reuse — footer của section gộp | — | — |
| Panel alert | `Alert` | reuse | — | — |
| Loading skeleton | existing feature card skeleton | reuse | — | — |
| i18n keys | — | mới: `resources.unified.title/subtitle/dropLabel/dropHint/empty/noun`, `resources.component.frequency`, `resources.badge.*` | — | — |

## Decisions ghi lại

- **Không element nào cần `create`** — mọi thứ reuse/extend shared + feature components đã có. KindBadge chỉ là `Badge` + `Icon` compose.
- **Không `redesign`** — concept A giữ nguyên ngôn ngữ hiện tại; delta là mất một section, thêm badge + picker.
- **`extend` trên 2 file feature**: `ImportProgress.tsx` (badge slot + `Chip` picker row), `ResourceCard.tsx` (bỏ `isDict` gate, thêm `frequency` vào `COMPONENT_LABEL`). `ResourcesPanel.tsx` collapse `SECTION_COPY` hai-key thành một bộ `resources.unified.*` — `sectionId` → `'resources'`.
- **Follow-up (không làm trong item này)**: chips trên `ResourceCard` là hand-rolled class `componentChip` trong khi `Chip` shared đã tồn tại — migrate riêng để tránh scope creep.
- `components` cũ (freq resources chưa có components) → lazy-scan path `RESOURCE_COMPONENTS` tồn tại; freq resources sau migrate có `['frequency']` nên chips hiện đúng.

## Trace

| Element | REQ | Journey step |
|---|---|---|
| Một dropzone + badge detect | REQ-1, REQ-2 | TO-BE 1, 2 |
| Component picker trên job | REQ-2 | TO-BE 3 (uncertainty) |
| Một list + reorder + chips 'frequency' | REQ-3, REQ-6 | TO-BE 5, 6 |
| Bands editor footer | REQ-6 | TO-BE 5 |
| Pending slot + importing fill + registry rows | REQ-8 | TO-BE 4 |
