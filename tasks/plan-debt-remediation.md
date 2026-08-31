# Implementation Plan: Debt Remediation — Audit 2025-06-22

## Overview

Trả nợ kỹ thuật đã audit của `cell` theo thứ tự: quick wins trước để lấy đà, sau đó pay-down theo từng island (subtitle → dictionary → build/infra). Mỗi task phải qua `pre-commit-gate` trước khi commit.

## Architecture Decisions

1. Không thay đổi behavior người dùng trong phase 1 — chỉ sửa warning, test, dọn cây.
2. Mỗi task pay-down phải có characterization/contract test trước khi refactor.
3. Không thêm dependency mới cho quick wins.
4. Commit theo type `debt:` với before/after state.

## Task List

### Phase 1: Quick Wins (build + test hygiene)

- [x] **Task 1: Fix Vite `__dirname` warning**
  - Files: `vite.config.ts`, `vite.showcase.config.ts`, `vite.test.config.ts`
  - Replace `__dirname` bằng `import.meta.dirname`.
  - Acceptance: `npx tsc --noEmit`, `npm run lint`, `npm run build` pass. ✅ Đã hoàn thành.

- [ ] **Task 2: Add `type="module"` cho `options.html` script**
  - File: `public/options.html`
  - Acceptance: warning `can't be bundled without type="module"` biến mất.

- [ ] **Task 3: Remove `console.log` trong `phraseMatchBenchmark.test.ts`**
  - File: `src/features/dictionary/logic/phraseMatchBenchmark.test.ts`
  - Acceptance: test pass, không còn `console.log`, threshold 300ms giữ nguyên (deliberate).

- [ ] **Task 4: Viết test cho `mountSettingsDialog.ts` / `mountSettingsDialogLegacy.ts`**
  - Files: `src/features/settings/ui/mountSettingsDialog.ts`, `mountSettingsDialogLegacy.ts`
  - Tests: `src/features/settings/ui/mountSettingsDialog.test.ts`
  - Acceptance: ít nhất 80% statements/lines của 2 file được cover, test pass.

### Checkpoint 1

- [ ] `npx tsc --noEmit` pass
- [ ] `npm run lint` pass
- [ ] `npm run build` warnings giảm đáng kể
- [ ] `npm run test:unit` pass và coverage không giảm
- [ ] `pre-commit-gate` pass

### Phase 2: Subtitle Island (pay-down)

- [ ] **Task 5: Characterization tests cho `reactSubtitleController` flow mount/sync/playPause**
  - Test: `src/features/subtitle/ui/reactSubtitleController.test.ts`
  - Acceptance: ít nhất 3 flow chính được pin, coverage của file tăng.

- [ ] **Task 6: Extract `StudyModeController` khỏi `reactSubtitleController` (nếu cần)**
  - Đã tồn tại `src/features/studyModes/content/studyModeController.ts`; KHÔNG tạo trùng tên.
  - Viết `reactSubtitleController.test.ts` characterization trước, sau đó quyết định move logic vào `features/studyModes` hay refactor thành hook `useSubtitleStudyModePlayback`.
  - Acceptance: behavior giữ nguyên qua contract test, `reactSubtitleController.ts` < 800 dòng.

- [ ] **Task 7: Characterization tests cho `contentScriptController` mount/sync**
  - Acceptance: 2 flow chính được pin, coverage tăng.

- [ ] **Task 8: Tách subtitle sync state khỏi `contentScriptController`**
  - Tạo `src/features/subtitle/ui/subtitleSyncController.ts`
  - Acceptance: file size giảm, contract test pass.

### Phase 3: Build & Dependency

- [ ] **Task 9: Sửa `INEFFECTIVE_DYNAMIC_IMPORT` cho `dictionaryRepository.ts` / `frequencyRepository.ts`**
  - Acceptance: build không còn warning này.

- [ ] **Task 10: Nâng cấp dependencies (TypeScript, ESLint, Jest)**
  - Acceptance: `package.json` updated, `npm install`, `tsc`/`lint`/`test` pass.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Refactor controller lớn gây regression | High | Characterization test trước, tách từng seam nhỏ, rollback bằng git |
| Build warning sửa sai làm build fail | Low | Kiểm tra build trên từng task, không sửa nhiều cùng lúc |
| Working tree 133 file gây nhầm commit | Medium | Chỉ `git add` file mình sửa, kiểm tra `git diff --cached` |

## Open Questions

- Có nên dọn sạch 133 file working tree trước phase 2? (cần xác nhận vì có thể xóa/sửa nhiều file)
- Có muốn giữ threshold 300ms benchmark hay muốn optimize để về lại 200ms?
