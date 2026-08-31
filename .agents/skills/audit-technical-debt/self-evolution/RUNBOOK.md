# RUNBOOK for audit-technical-debt

| Date | Scope | Score | Issues | Mutation applied |
|---|---|---|---|---|
| 2025-06-22 | `cell` src/ + toolchain | 26/30 | 5 gaps (file-size signal, scoring example, business estimate, flaky tests, owner/cadence guard) | Yes — SKILL.md v2 |
| 2025-06-22 | `cell` toàn bộ codebase (sau StudyMode/removeBracketed/benchmark threshold) | 28/30 | 2 minor (could include more build timing data; business translation could name days) | No — skill đã đủ |

---

## Run 2025-06-22 — Project `cell`

### Scope
Audit `src/` and the project toolchain for technical debt blocking feature velocity in the dictionary popup, OCR, and subtitle modules.

### Signals collected

- **Code markers:** `grep` for `TODO/FIXME/HACK/XXX` in `src/` returned 2 hits:
  - `src/shared/ui/Spinner.tsx:23` — `FIXME: extract to registry once stroke-width variant supported`
  - `src/features/dictionary/strategies/jsonArrayStrategy.ts:52` — regular comment, not debt.
- **Test coverage (unit, `--coverage`):**
  - Statements 70.69%, Branches 60.19%, Functions 64.16%, Lines 72.59%
  - Global threshold is 80% for all four — coverage debt confirmed.
  - Several modules at 0-25%: `entities/dictionary` (0%), `features/cardCreator/media` (~24%), `VideoCard.tsx` (0%).
- **Flaky / timing tests:** Under `--coverage`, `phraseMatchBenchmark.test.ts` and `Button.style-guard.test.ts` fail.
- **Dependency freshness:** `npm outdated` shows 11 packages behind, including `typescript`, `eslint`, `jest`, `lucide-react`, `zod`.
- **Build / lint / typecheck:** All pass, but build emits warnings (PostCSS `from` option, Vite config `__dirname`, module externalizations for OpenCV/ONNX).
- **File churn / size:** `git diff --stat` shows 108 changed files; `find src -name '*.ts' -o -name '*.tsx' | wc -l` largest files include `src/features/subtitle/ui/contentScriptController.ts` (~1951 lines), `src/features/dictionaryPopup/controller/webTextDictionaryController.ts` (~1633 lines), `src/features/subtitle/ui/SubtitlePanels.tsx` (~1407 lines).
- **Human signal (inferred):** Recent work focused on fixing test failures in `DictionaryTab`, `OcrController`, and `SubtitleManagerPanel`. These areas likely carry high testing/architectural debt.

### Inventory (top 5)

| # | Location | Type | Description | V | R | Rch | Cost | Score |
|---|---|---|---|---|---|---|---|---|
| 1 | Global test suite | Testing | Coverage < 80% global threshold; several modules 0-25% coverage; flaky benchmark/style-guard tests under coverage. | 4 | 4 | 5 | 2 | **4.20** |
| 2 | `src/features/subtitle/ui/contentScriptController.ts`, `src/features/dictionaryPopup/controller/webTextDictionaryController.ts`, `src/features/subtitle/ui/SubtitlePanels.tsx` | Architectural / Code quality | Controllers 1.4k-2k lines; high cognitive load and change risk. | 4 | 3 | 4 | 1 | **3.80** |
| 3 | `package.json` dependencies | Dependency | 11 outdated packages (TS, ESLint, Jest, lucide-react, zod); drift increases upgrade cost and security risk. | 3 | 3 | 4 | 3 | **3.20** |
| 4 | Working tree | Process | 108 modified/deleted files, 20+ untracked files, generated assets (`docs/design-system/*`, `src/shared/styles/tokens.css`) mixed with source changes. | 3 | 3 | 3 | 4 | **2.85** |
| 5 | `src/shared/ui/Spinner.tsx:23` | Code quality | `FIXME` to extract stroke-width variant to registry; isolated, low risk. | 2 | 1 | 2 | 5 | **2.00** |

### Business impact (top 3)

1. **Low test coverage:** Any change in media, dictionary entities, or large controllers has a high chance of shipping untested behavior. The 2 coverage-related test failures also reduce CI confidence.
2. **Oversized controllers:** Adding a new subtitle or dictionary feature requires editing 1.4k-2k line files, which inflates estimates and review time.
3. **Dependency drift:** Upgrading TypeScript, ESLint, and Jest later will cost more each quarter we delay; security patches may be blocked by version drift.

### Recommended roadmap

- **Quick wins (this sprint):**
  - Fix flaky `phraseMatchBenchmark.test.ts` and `Button.style-guard.test.ts` so coverage gate is reliable.
  - Commit or remove untracked files; separate generated assets (`tokens.css`, design-system reports) from source commits.
  - Fix `src/shared/ui/Spinner.tsx` `FIXME` if stroke-width variant is already supported.
- **Pay-down plan (next 2-3 sprints):**
  - Add tests for `entities/dictionary`, `features/cardCreator/media`, and the `contentScriptController`/`webTextDictionaryController` critical paths to reach 80% global coverage.
  - Split `contentScriptController.ts`, `webTextDictionaryController.ts`, and `SubtitlePanels.tsx` into smaller controllers/hooks.
  - Upgrade `zod`, `lucide-react`, `unzipit`, and `jest` family to latest compatible versions.
- **Watch list:**
  - Build warnings (PostCSS, Vite config, externalized modules) — not blocking, but address before they become errors.
  - Large `StreamFlixPage.tsx`/`VideoPlayer.tsx` mock pages (high churn in diff) — monitor for further growth.
- **Cadence:** Re-run this audit after the next quarterly release.

### Skill output scoring

| # | Criterion | Score | Notes |
|---|---|---|---|
| 1 | Scope concreteness | 5 | Bounded to `src/` and 3 feature areas. |
| 2 | Signal diversity | 4 | Markers, coverage, dependencies, build, churn, inferred human signal. No direct human interview. |
| 3 | Classification correctness | 4 | All 5 items in right 6-type buckets. |
| 4 | Scoring completeness | 5 | All items have 4 criteria + weighted score. |
| 5 | Business translation | 4 | Top 3 translated; could use more specific day estimates. |
| 6 | Roadmap actionability | 4 | Quick wins, pay-down, watch, cadence; could name an owner. |
| **Total** | | **26 / 30** | Pass threshold = 22. |

### Skill quality scoring

| # | Criterion | Score | Notes |
|---|---|---|---|
| 7 | Workflow clarity | 5 | Every step has purpose, actions, guard, loop-back. |
| 8 | Template usefulness | 4 | Template is present and used; could include an example row. |
| 9 | Anti-pattern coverage | 4 | 5 anti-patterns + 4 rationalizations. |
| 10 | Falsifiability | 4 | Most guards are pass/fail; a few are advisory. |

### Identified gaps for skill improvement

1. The skill does not explicitly ask for the **largest files / cyclomatic complexity** as an automatic signal. File size was collected but not guided. **→ Fixed in v2.**
2. The scoring formula uses `6 − cost`; the skill should include an example row to reduce scorer error. **→ Fixed in v2.**
3. The business translation step asks for one-line business impact, but does not require a **specific time/cost estimate** from the data. **→ Fixed in v2.**
4. The skill does not call out **flaky tests** as a distinct testing-debt signal. **→ Fixed in v2.**
5. The roadmap step should require at least one **owner or cadence**; the guard only mentions cadence. **→ Fixed in v2.**

---

## Run 2025-06-22 (re-audit) — Toàn bộ `cell` sau StudyMode/removeBracketed/benchmark threshold

### Scope
Audit toàn bộ codebase `cell` (src/, tests/, build, dependencies, process) để tìm tất cả nợ kỹ thuật hiện có.

### Signals collected

- **Code markers:** `TODO/FIXME/HACK/XXX` trong `src/` vẫn 2 hit (Spinner FIXME + jsonArrayStrategy comment thường).
- **Test coverage (unit, `--coverage`):**
  - Statements 70.6%, Branches 60.03%, Functions 64.33%, Lines 72.49% — tụt nhẹ, dưới 80% toàn cục.
  - `features/subtitle/ui` chỉ 13% statements, 9.79% branches, 6.28% functions, 12.54% lines.
  - `contentScriptController.ts` 1.99% statements, 0% branches/functions.
  - `reactSubtitleController.ts` 3.33% statements, 0% branches/functions.
  - `subtitleCueEngine.ts` 3.52% statements, 0% branches/functions.
  - `features/reader/logic` 0%, `features/reader/services` 0%.
  - `entrypoints/popup/components` 0%.
  - `features/settings/ui/mountSettingsDialog.ts` 0%, `mountSettingsDialogLegacy.ts` 0%.
  - `features/cardCreator/media` ~24%.
  - `features/studyModes/content/studyModeController.ts` 33.33%.
- **Unit tests:** 441 suites, 5238 tests passed. Benchmark threshold đã nới từ 200ms → 300ms. `Button.style-guard.test.ts` pass. Không còn flaky fail.
- **Build (`npm run build`):** Pass nhưng có warnings:
  - Vite `__dirname` config, PostCSS `from` option, externalized `fs`/`crypto`/`path` từ OpenCV/espeak.
  - `options.html` script thiếu `type="module"`.
  - `INEFFECTIVE_DYNAMIC_IMPORT` cho `dictionaryRepository.ts` và `frequencyRepository.ts`.
  - Chunks >500KB warning. OpenCV 10.3MB, `dist-B1odrjVP.js` 10.5MB, `subtitle-CxFvRCfE.js` 694KB, `ort.bundle.min` 403KB.
  - Plugin `hover-only-on-hover-devices` chiếm 74% build time (13.7s/18.5s).
- **Dependency freshness:** 11 package outdated (TS, ESLint, Jest, jest-environment-jsdom, lucide-react, zod, unzipit, @eslint/js, @testing-library/jest-dom, @testing-library/react, eslint-plugin-react-hooks).
- **File churn 30 ngày:** `SubtitlePanels.tsx` (72), `SubtitleManagerPanel.tsx` (49), `contentScriptController.ts` (24), `reactSubtitleController.ts` (20), `mountSubtitle.tsx` (19), `regionSelector.ts` (17), `ocrContentScript.ts` (17).
- **File lớn nhất (non-test):** `contentScriptController.ts` 1971 dòng, `webTextDictionaryController.ts` 1633, `SubtitlePanels.tsx` 1410, `content-script.ts` 1179, `downloader.ts` 1153, `local-player/main.tsx` 1136, `reactSubtitleController.ts` 889.
- **Working tree:** 133 file thay đổi/untracked, bao gồm 10 plans `TODO`, generated assets, temp files (`_tmp_ocr_debug.ts`, `UsersThe0ceanAppDataLocalTempstudy-modes-prototype.png`), `.agents/skills/design-from-idea/`, `pnpm-workspace.yaml`, `scripts/audit-tokens.mjs`.
- **Human signal (inferred):** User vừa thêm StudyMode và removeBracketed, làm `reactSubtitleController.ts` phình từ 806 → 889 dòng. Benchmark threshold nới ra thay vì optimize. 10 plans design-system chưa thực hiện.

### Inventory (top 11)

| # | Location | Type | Description | V | R | Reach | Cost | Score |
|---|---|---|---|---:|---:|---:|---:|---:|
| 1 | `features/subtitle/ui` | Testing | Coverage 13% statements / 9.79% branches / 6.28% functions. `contentScriptController.ts` 2%, `reactSubtitleController.ts` 3.3%, `subtitleCueEngine.ts` 3.5%. | 5 | 5 | 4 | 2 | **4.65** |
| 2 | `contentScriptController.ts` (1971), `reactSubtitleController.ts` (889), `SubtitlePanels.tsx` (1410) | Architectural | Controllers khổng lồ, churn cao, StudyMode mới thêm vào `reactSubtitleController`. | 5 | 4 | 4 | 1 | **4.45** |
| 3 | Build bundle | Infrastructure | `opencv` 10.3MB, `dist` 10.5MB, `subtitle` 694KB, `ort.bundle` 403KB. Externalized Node modules. | 3 | 4 | 5 | 1 | **4.05** |
| 4 | `dictionaryRepository.ts`, `frequencyRepository.ts` dynamic imports | Architectural | `INEFFECTIVE_DYNAMIC_IMPORT`: import động nhưng cũng import tĩnh, không code-split hiệu quả. | 4 | 3 | 4 | 3 | **3.50** |
| 5 | `features/settings/ui/mountSettingsDialog.ts`, `mountSettingsDialogLegacy.ts` | Testing | 0% coverage; UI settings untested. | 4 | 3 | 3 | 3 | **3.30** |
| 6 | `package.json` dependencies | Dependency | 11 packages outdated. | 3 | 3 | 4 | 3 | **3.20** |
| 7 | `features/reader/logic`, `features/reader/services`, `entrypoints/popup/components` | Testing | 0% coverage; reader/popup untested. | 4 | 3 | 2 | 3 | **3.10** |
| 8 | `plans/00{1..10}*` + hardcoded motion tokens | Process / Architectural | 10 plans TODO; design-system token debt chưa giải quyết. | 3 | 2 | 4 | 2 | **3.00** |
| 9 | Working tree (133 files, generated assets, temp files) | Process | Untracked/generated files lẫn source; khó review và merge. | 3 | 3 | 3 | 4 | **2.85** |
| 10 | `phraseMatchBenchmark.test.ts` threshold nới 200ms → 300ms | Testing / Code quality | Giấu vấn đề perf bằng cách nới threshold thay vì optimize; `console.log` còn sót. | 2 | 3 | 3 | 5 | **2.40** |
| 11 | Build warnings (Vite `__dirname`, PostCSS `from`, `options.html` type) | Infrastructure | Warnings build có thể thành lỗi sau nâng cấp. | 2 | 2 | 3 | 4 | **2.20** |

### Business impact (top 3)

1. **Subtitle playback untested:** `contentScriptController`/`reactSubtitleController`/`SubtitlePanels` có coverage 2–13%. Mỗi feature mới (StudyMode, removeBracketed) đều phải sửa những file này, nhưng hầu như không có test bảo vệ behavior. Regression subtitle là rủi ro cao nhất vì nó là luồng chính.
2. **Bundle quá lớn:** OpenCV + ONNX + espeak tạo ra chunks 10MB+; extension tải chậm, chiếm bộ nhớ, trải nghiệm kém trên máy yếu.
3. **Controllers khổng lồ:** Thêm StudyMode vào `reactSubtitleController` (889 dòng) và removeBracketed xuyên suốt `SubtitlePanels`/`mountSubtitle` làm tăng độ phức tạp, estimate, và review time.

### Recommended roadmap

- **Quick wins (1-2 tuần):**
  - Dọn working tree: commit/remove 133 file, tách generated assets, xóa temp files.
  - Sửa build warnings: `__dirname` → `import.meta.dirname`, PostCSS `from`, `options.html` `type="module"`.
  - Viết test cho `mountSettingsDialog.ts`/`mountSettingsDialogLegacy.ts` (0% coverage).
  - Thay `console.log` trong `phraseMatchBenchmark.test.ts` bằng assertion có ý nghĩa hoặc ghi ADR nếu threshold nới là deliberate.
- **Pay-down (2-6 tuần):**
  - Viết characterization tests cho 3 flow chính của subtitle (mount, sync, play/pause), sau đó tách `reactSubtitleController` thành `StudyModeController` + `useSubtitlePlaybackState`.
  - Tách `contentScriptController` và `SubtitlePanels` theo Strangler Fig / Branch by Abstraction.
  - Giải quyết `INEFFECTIVE_DYNAMIC_IMPORT` cho `dictionaryRepository`/`frequencyRepository`.
  - Nâng `features/subtitle/ui` coverage lên ≥50% rồi ≥80% theo từng controller.
- **Big bets (1-2 quý):**
  - Giảm bundle OpenCV/ONNX/espeak (lazy-load, tree-shake, offscreen worker, hoặc thay thế).
  - Upgrade `typescript`, `eslint`, `jest`.
  - Thực hiện 10 plans design-system theo thứ tự đề xuất (002 → 007 → ...).
- **Watch list:**
  - `features/reader/*` 0% coverage.
  - `features/cardCreator/media` ~24% coverage.
  - `features/studyModes/content/studyModeController.ts` 33%.

### Cadence & owner

- Re-audit mỗi quý hoặc sau khi hoàn thành 3 island lớn.
- Owner: Tech lead phụ trách subtitle controller split và coverage; Infra owner phụ trách bundle/dependency.

### Re-test after mutation

- **Re-run command:** `find src -type f \( -name "*.ts" -o -name "*.tsx" \) ! -name "*.test.*" -exec wc -l {} + | sort -n | tail -n 15` produced a clear list of largest files, confirming the new Step 2 guidance works.
- **Updated skill quality score:** Workflow clarity 5/5, Template usefulness 5/5, Anti-pattern coverage 4/5, Falsifiability 5/5. **Total quality = 19/20** (up from 17/20).
- **Skill search result:** `audit-technical-debt` is discoverable via `/using-agent-skills` search.
