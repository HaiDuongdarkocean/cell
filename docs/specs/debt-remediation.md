# Spec: Debt Remediation (Cell — post audit 2025-06-22)

## Objective

Trả nợ kỹ thuật của `cell` theo thứ tự ưu tiên từ audit gần nhất. Mục tiêu là:

- Giảm rủi ro regression ở luồng subtitle (coverage thấp, controller khổng lồ).
- Dọn build warnings và bundle bloat một cách an toàn.
- Tăng coverage cho các module 0% / thấp theo từng island.
- Giữ nguyên behavior người dùng; không thêm tính năng mới.

## Tech Stack

- TypeScript 6.0.3, React, Vite 8.2.2, Jest 30.4.2, ESLint 9.39.5.
- `src/` — source; `tests/unit/` — unit tests; `tasks/` — plan/todo.

## Commands

- Type check: `npx tsc --noEmit`
- Lint: `npm run lint`
- Unit tests: `npm run test:unit`
- Coverage: `npx jest --selectProjects unit --coverage`
- Build: `npm run build`

## Project Structure

- `src/features/subtitle/ui/` — subtitle controllers (nợ lớn nhất).
- `src/features/settings/ui/` — settings dialog mounts (0% coverage).
- `src/features/dictionary/logic/` — benchmark tests.
- `vite.config.ts`, `public/options.html` — build config.
- `tasks/plan-debt-remediation.md`, `tasks/todo-debt-remediation.md` — plan & tracking.

## Code Style

- Không thay đổi behavior; chỉ refactor, thêm test, sửa warning.
- Characterization tests phải được viết trước khi tách controller lớn.
- Commit message: `debt(scope): mô tả ngắn` kèm before/after state.

## Testing Strategy

- Characterization tests cho legacy code trước khi refactor.
- Contract tests khi dùng Strangler Fig / Branch by Abstraction.
- Unit tests mới phải pass dưới `--coverage`.
- Không giảm global coverage (70.6% statements, 60.03% branches hiện tại).

## Boundaries

- **Always do:**
  - Viết/đọc spec trước khi sửa controller lớn.
  - Chạy `pre-commit-gate` trước mỗi commit.
  - Chỉ `git add` file mình sửa; không commit 133 file working tree lẫn lộn.
- **Ask first:**
  - Xóa 133 untracked/changed files trong working tree.
  - Nâng cấp dependencies (TS, ESLint, Jest).
  - Thay đổi bundle/chunk strategy.
- **Never do:**
  - Commit generated/temp files.
  - Skip tests cho logic thay đổi.
  - Thêm behavior mới dưới danh nghĩa trả nợ.

## Success Criteria

- [ ] Build warnings từ Vite `__dirname` và `options.html` biến mất.
- [ ] `features/settings/ui/mountSettingsDialog.ts` và `mountSettingsDialogLegacy.ts` có coverage ≥ 80% statements/lines.
- [ ] `phraseMatchBenchmark.test.ts` không còn `console.log`.
- [ ] `reactSubtitleController.ts` giảm xuống < 800 dòng sau khi tách StudyMode.
- [ ] `contentScriptController.ts` giảm ≥ 200 dòng sau khi tách subtitle sync state.
- [ ] `features/subtitle/ui` coverage tăng ≥ 10%.
- [ ] `npm run build` và `npx tsc --noEmit` pass trên mỗi checkpoint.

## Open Questions

1. Có muốn dọn sạch 133 file working tree trước khi làm Phase 2? (có thể xóa/sửa nhiều file)
2. Giữ benchmark threshold 300ms hay optimize để về lại 200ms?
3. Có muốn thêm ADR cho StudyMode extraction trước khi sửa controller?

## Doubt review (2025-06-22) — kết quả reconcile

Doubt subagent phát hiện 7 vấn đề. Đã sửa / điều chỉnh:

- ✅ **Vite `__dirname`:** đã thay toàn bộ `__dirname` trong `vite.config.ts`, `vite.showcase.config.ts`, `vite.test.config.ts` bằng `import.meta.dirname`. `npx tsc --noEmit`, `npm run lint`, `npm run build` pass.
- ⚠️ **`public/options.html` type="module":** sẽ verify build warning biến mất trước khi commit; nếu vẫn còn, revert và dùng cách Vite handle HTML entry thay vì public static.
- ⚠️ **`INEFFECTIVE_DYNAMIC_IMPORT`:** không sửa trong Phase 1; cần ADR + audit consumer trước khi chạm.
- 🛑 **Tách `StudyModeController` / subtitle sync:** đã có `features/studyModes/content/studyModeController.ts`; KHÔNG tạo trùng tên. Phải viết characterization/contract tests trước khi refactor.
- 🛑 **Coverage contract:** `npm run test:unit` chưa có `--coverage`; sẽ dùng `npx jest --selectProjects unit --coverage` cho gate khi cần đo coverage.
- 🛑 **Working tree 133 files:** chỉ `git add` các file chủ đích; không commit toàn bộ.
