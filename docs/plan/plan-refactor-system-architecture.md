# Implementation Plan: Refactor System Architecture — Worktree cho Orca Platform

> **Giai đoạn**: G2 Implementation Plan (high-level — approach + risk mitigation + milestones + dependency graph)
> **Input (cite)**: `docs/specs/spec-refactor-system-architecture.md` (APPROVED 2026-06-30)
> **Review**: `docs/reviews/review-refactor-system-architecture.md` (APPROVED, 8 edits applied)
> **Intent**: `docs/intent/intent-refactor-system-architecture.md` (G0 research 53 nguồn)
> **Status**: Draft — chờ anh review trước G3 (ADR-016)
> **Date**: 2026-06-30
> **Lưu ý**: đây là plan high-level. Task breakdown chi tiết (acceptance criteria per file) chạy ở **G4 đầu** sau khi có Spec + Plan + ADR (rule AGENTS.md workflow).

## Overview

Plan này expand 14 milestone (M0-M13) từ spec `## Migration Strategy` thành **implementation approach + risk mitigation + dependency graph**, để chuẩn bị cho G3 (ADR-016 folder structure decision) và G4 (task breakdown + implementation).

Mục tiêu refactor (cite spec `## Objective`): chuyển `src/` + `tests/` từ flat-folder sang **FSD + Screaming Architecture** (`entrypoints/ + features/ + entities/ + shared/ + stores/ + app/`), behavior-preserving, thiết kế cho 23 feature domain Orca platform. KHÔNG đổi behavior, KHÔNG thêm dep, commit nhỏ mỗi cluster.

## Architecture Decisions (high-level — chi tiết ADR-016 ở G3)

1. **Pattern: Strangler Fig + Parallel Change (Expand-Contract)** (cite spec `## Migration Strategy`). Mỗi move: expand (tạo new path + barrel) → migrate (update import từng file, test sau mỗi) → contract (xóa old path). Behavior-preserving, test pass mỗi bước.
2. **Bottom-up dependency order**: build foundation trước (shared → entities → features → entrypoints). Lý do: `shared/` + `entities/` không depend ai → move trước an toàn nhất. `entrypoints/` depend tất cả → move cuối (M9), chạm manifest/vite (rủi ro cao nhất → fail fast sau khi foundation stable).
3. **Coverage baseline trước cluster lớn** (cite spec Milestone 0, review Risk #1). M0 đo coverage subtitle/transmux/download, viết characterization test cho behavior chưa cover TRƯỚC M6/M7/M8. Exit gate: gap closed.
4. **M9 tách 5 sub-commit** (cite spec, review Risk #6). Mỗi entrypoint group + manifest/vite path update = 1 commit, `npm run build` pass per commit. Tránh để system unbuildable giữa chừng.
5. **chrome.* wrap incremental** (resolved Q1). Wrap khi chạm file ở M11, không wrap tất cả trước. Gate M11 only.
6. **YAGNI cho future Orca** (resolved Q2/Q3). KHÔNG tạo feature folder rỗng, KHÔNG tách Zustand slice, KHÔNG tạo `app/` layer cho đến khi feature thực cần.

## Dependency Graph (implementation order)

```
M0 Coverage baseline (pre-flight — không move, chỉ đo + characterization test)
    │
M1 Scaffolding (tạo folder rỗng — không phụ thuộc gì)
    │
    ├──────────────────────────────────────────────┐
    ▼                                                ▼
M2 shared/ (parsers, storage, utils, config)    M3 entities/ (types)
   - không depend feature                           - depend shared (1 số type)
   - 3 stray converters move ở đây                  - move sau M2
    │                                                │
    └──────────────────┬─────────────────────────────┘
                       ▼
         ┌─────────────┼─────────────┬──────────────┐
         ▼             ▼             ▼              ▼
   M4 detection/   M5 whitelist/  M6 transmux/   (features depend shared + entities)
   (logic only)    (logic+svc)    (~16 file)
         │             │             │
         │             │        (M6 cần characterization test từ M0)
         └─────────────┴──────┬──────┘
                              ▼
                  M7 subtitle/ (17 file — largest)
                  (depend shared/parsers + entities/subtitle)
                  (cần characterization test từ M0)
                              │
                              ▼
                  M8 download/ (depend detection, selectors)
                  (cần characterization test từ M0)
                              │
                              ▼
                  M9 entrypoints/ (5 sub-commit — depend TẤT CẢ features)
                  (chạm manifest.json + vite.config.ts — rủi ro cao nhất)
                  M9.1 background → M9.2 content (+fetchInterceptor) →
                  M9.3 offscreen → M9.4 popup → M9.5 sidepanel
                              │
                              ▼
                  M10 settings/ (extract từ entrypoints/popup sau M9)
                              │
                              ▼
                  M11 chrome-apis/ adapters (incremental wrap)
                              │
                              ▼
                  M12 tests/ mirror (move test theo new src structure)
                              │
                              ▼
                  M13 Final cleanup + docs + full regression + E2E
```

**Critical path**: M0 → M1 → M2 → M7 → M8 → M9 → M13. M3/M4/M5/M6 có thể xen kẽ nhưng solo dev → tuần tự theo thứ tự spec.

## Implementation Approach per Milestone

> Chi tiết move list ở spec `## Migration Strategy`. Đây là **approach + verify + risk** mỗi milestone.

### M0 — Coverage baseline (pre-flight)
- **Approach**: `npm run test:coverage` → đọc report → identify behavior chưa cover ở subtitle/transmux/download → viết characterization test (Feathers: test "code ACTUALLY does"). Save baseline `docs/test-reports/coverage-baseline-pre-refactor.md`.
- **Verify**: characterization test pass + coverage report saved. Exit gate: gap closed cho M6/M7/M8.
- **Risk**: coverage thấp ở module DOM-heavy (subtitleOverlay, parallelCoordinator) → characterization test khó viết (cần jsdom mock). **Mitigation**: nếu không test được bằng unit → rely browser verify (Edge MCP) làm characterization manual, ghi vào baseline doc.

### M1 — Scaffolding
- **Approach**: tạo 6 folder rỗng + `.gitkeep`. Update `docs/2-architechture-system.md` note target structure.
- **Verify**: `npm run test:unit` pass (không move gì). `git status` thấy folder mới.
- **Risk**: thấp.

### M2 — shared/ layer
- **Approach**: move `lib/parsers/` + 3 stray converters (`assToSrt/vttToSrt/srtNormalizer` từ `lib/converters/`) + `lib/storage/` + `lib/utils/` + `constants/` → `shared/`. Parallel Change per folder.
- **Verify**: `npm run test:unit` + `npx tsc --noEmit` pass. Grep old import path = 0.
- **Risk**: `lib/utils/` chứa `whitelist.ts` (sẽ thành feature M5) → KHÔNG move whitelist ở M2, chỉ move fileUtils/timeUtils/urlUtils. **Mitigation**: move selective, để whitelist.ts lại cho M5.

### M3 — entities/ layer
- **Approach**: move `src/types/` → `entities/{subtitle,video,settings,message,media}/`. Split file types theo domain.
- **Verify**: tsc pass (type import update). Test pass.
- **Risk**: types có thể cross-reference (Subtitle import Video). **Mitigation**: tsc catch circular; nếu circular → giữ chung 1 entities file hoặc shared base type.

### M4 — detection/ feature
- **Approach**: move `lib/detectors/` (4 file: video, subtitle, script, language) → `features/detection/logic/`. Tạo barrel.
- **Verify**: test pass + tsc. Detection unit test (38 language profiles) pass.
- **Risk**: thấp (pure logic, well-tested).

### M5 — whitelist/ feature
- **Approach**: move `lib/utils/whitelist.ts` → `features/whitelist/logic/` + tách `whitelistStore.ts` service nếu có chrome.storage. Barrel.
- **Verify**: test pass + tsc.
- **Risk**: thấp.

### M6 — transmux/ feature
- **Approach**: move ~16 file transmux cluster → `features/transmux/{planning,execution,merging}/`. Barrel. Đây là cluster lớn thứ 2.
- **Verify**: test pass + **integration test** (parallel/sequential m3u8 download + transmux — network). tsc.
- **Risk**: transmux có Web Worker (`transmuxWorker.ts`) + workerFactory → import path worker phức tạp (Vite worker import syntax). **Mitigation**: verify worker spawn sau move bằng integration test. Characterization test từ M0 pin merge behavior (tfdt offset — knowledge `parallel-fmp4-merge.md`).

### M7 — subtitle/ feature (largest)
- **Approach**: move 17 `content/subtitle*.ts` → `features/subtitle/{ui,logic,service}/` theo mapping spec. Barrel. Cluster lớn nhất.
- **Verify**: test pass + tsc + **browser verify** (Edge MCP: overlay hiển thị, drag hoạt động, bilingual, panel toggle). Stop-the-line.
- **Risk**: subtitle modules tightly coupled (overlay ↔ dragPosition ↔ sync ↔ merge). Move 1 file → update nhiều import. **Mitigation**: Parallel Change từng file, test sau mỗi. Characterization test từ M0 pin overlay/drag/sync behavior. Browser verify bắt buộc trước commit (DOM runtime bug không catch bằng unit test).

### M8 — download/ feature
- **Approach**: move `background/{downloader,downloadQueue,autoDownload,networkInterceptor}.ts` → `features/download/service/` + `selectBestMedia.ts` → `logic/`. Barrel.
- **Verify**: test pass + tsc + integration test (download flow).
- **Risk**: download depend networkInterceptor (webRequest) + chrome.downloads → chạm chrome.* (chưa wrap đến M11). **Mitigation**: giữ chrome.* call inline (chưa wrap), chỉ move file. Wrap để M11. Characterization test pin auto-download dedup (knowledge `auto-download-subtitle-catchup.md`).

### M9 — entrypoints/ migration (5 sub-commit — highest risk)
- **Approach**: mỗi sub-commit move 1 entrypoint group + update manifest/vite path + build verify. M9.1 background → M9.2 content (+fetchInterceptor.iife + themeTokens, manifest content_scripts[1]) → M9.3 offscreen (vite input) → M9.4 popup → M9.5 sidepanel (manifest side_panel + vite input).
- **Verify**: `npm run build` pass **per sub-commit** + browser verify (M9.2 MAIN world inject, M9.4 popup load, M9.5 sidepanel load).
- **Risk**: **CRITICAL** — miss entrypoint path → build break/runtime break. fetchInterceptor.iife.ts MAIN world dễ miss. **Mitigation**: build verify per sub-commit (không chỉ per milestone). Browser verify M9.2/M9.4/M9.5. Reference spec Edge Case 1/2 (manifest paths đầy đủ).

### M10 — settings/ feature
- **Approach**: extract settings UI + logic từ `entrypoints/popup/components/settings/` → `features/settings/`. Barrel.
- **Verify**: test pass + tsc + browser verify (settings dialog).
- **Risk**: settings UI depend popup store + chrome.storage. **Mitigation**: giữ store reference (chưa tách slice — Q2 resolved). Move UI + logic, để store ở popup.

### M11 — chrome-apis/ adapters (incremental)
- **Approach**: wrap chrome.runtime/storage/tabs/downloads/webRequest/offscreen vào `shared/lib/chrome-apis/`. Update callers. 2-3 commit theo API group.
- **Verify**: characterization test pin behavior TRƯỚC wrap + adapter test (mock chrome.*) + browser verify.
- **Risk**: wrap introduce bug (adapter signature sai). **Mitigation**: characterization test trước wrap. Incremental per API (không big-bang). Ponytail: chỉ wrap API thực dùng.

### M12 — tests/ mirror
- **Approach**: move `tests/unit/` mirror new `src/` structure. Colocate.
- **Verify**: test pass (path update). Coverage không giảm so M0 baseline.
- **Risk**: test path import stale. **Mitigation**: move test cùng cấu trúc source, grep old path = 0.

### M13 — Final cleanup + docs
- **Approach**: xóa old empty folders. Update `docs/2-architechture-system.md` full + `docs/0-wiki.md`. Full regression.
- **Verify**: `npm run test:unit` + `test:integration` + `tsc --noEmit` + `build` + browser verify + **E2E (Playwright)**.
- **Risk**: empty folder còn sót, doc stale. **Mitigation**: `Get-ChildItem -Recurse src` diff target structure = 0 unaccounted.

## Checkpoints

### Checkpoint A — After M0-M1 (foundation ready)
- [ ] Coverage baseline saved, characterization gap closed cho M6/M7/M8.
- [ ] 6 folder scaffolding tạo, test pass.
- [ ] Review: anh confirm coverage baseline đủ làm regression net.

### Checkpoint B — After M2-M3 (shared + entities stable)
- [ ] shared/ + entities/ move xong, tsc pass, grep old import = 0.
- [ ] No behavior change (git diff --stat chỉ move + import).

### Checkpoint C — After M4-M8 (all features migrated)
- [ ] detection/whitelist/transmux/subtitle/download move xong.
- [ ] Unit + integration test pass. Browser verify subtitle (overlay/drag).
- [ ] `features/` screams domain intent (NF1).

### Checkpoint D — After M9 (entrypoints + manifest stable)
- [ ] 5 entrypoint group move, manifest/vite path update.
- [ ] Build pass + browser verify (extension install, MAIN world, popup, sidepanel).
- [ ] **Critical checkpoint** — extension load + core flow (detect/download/subtitle) hoạt động.

### Checkpoint E — After M10-M13 (complete)
- [ ] settings/ extract, chrome-apis wrap, tests mirror, docs update.
- [ ] Full regression pass (unit + integration + tsc + build + browser + E2E).
- [ ] All Success Criteria (F1-F6, NF1-NF6, P1-P3) met.
- [ ] Ready for G5 testing / merge.

## Risks and Mitigations (plan-level — cite spec `## Risks`)

| Risk | Impact | Mitigation |
|------|--------|------------|
| Miss entrypoint path (fetchInterceptor.iife) → build break | **High** | M9 tách 5 sub-commit, build verify per commit, browser verify M9.2 MAIN world (spec Edge Case 1) |
| Behavior drift khi move (vô tình sửa logic) | **High** | Characterization test M0 + git diff --stat review per commit (chỉ move + import) |
| Coverage gap → behavior không protected khi move | **High** | M0 pre-flight đo + viết characterization test trước M6/M7/M8 (review Risk #1) |
| Subtitle cluster coupling (17 file) → import cascade | Med | Parallel Change từng file, test sau mỗi, browser verify trước commit M7 |
| Transmux Web Worker import path (Vite syntax) | Med | Integration test verify worker spawn sau M6 |
| Circular dependency sau tách feature/entities | Med | tsc catch; extract shared vào entities/shared nếu circular |
| chrome.* wrap introduce bug ở M11 | Med | Characterization test trước wrap, adapter test mock chrome.*, incremental per API |
| Big refactor fatigue (17-20 commit) | Med | Commit nhỏ, test pass mỗi commit, checkpoint A-E nghỉ giữa |
| Bus factor = 1 (solo) | Low | ADR-016 ghi reasoning, update 2-architechture-system.md mỗi milestone |

## Parallelization (solo dev — chủ yếu sequential)

- **Must sequential**: M9 entrypoints (manifest shared state), dependency chain M2→M7→M8→M9.
- **Có thể xen kẽ** (nếu cần): M4/M5 (detection/whitelist độc lập), M3 (entities) song song M2 (shared) — nhưng solo → tuần tự theo spec order an toàn hơn.
- **Future (multi-agent)**: nếu dùng subagent, M4 + M5 + M6 là independent feature slices → parallelize được sau khi M2+M3 done. Nhưng refactor = shared file edits → risk conflict → em lean sequential.

## Open Questions (cho anh review trước G3)

1. **ADR-016 scope**: ADR-016 chỉ ghi folder structure decision (FSD + Screaming), hay tách thêm ADR-017 (port pattern) + ADR-018 (chrome-apis adapter)? **Em lean 1 ADR-016 tổng + note port/adapter là sub-decision** (tránh ADR sprawl, solo dev). Anh confirm ở G3?
2. **M0 coverage threshold**: characterization gap "closed" nghĩa là coverage ≥ X% hay chỉ cover các behavior critical (overlay/drag/merge/auto-download/transmux)? **Em lean cover critical behaviors** (không chase % number — Feathers: pin behavior quan trọng, không cần 100%). Anh confirm?
3. **Commit message convention**: `refactor: move <cluster> to features/<domain>/` — anh OK format này cho ~17-20 commit?

## References

- **Spec (input)**: `docs/specs/spec-refactor-system-architecture.md` (APPROVED)
- **Review**: `docs/reviews/review-refactor-system-architecture.md`
- **Intent (G0)**: `docs/intent/intent-refactor-system-architecture.md`
- **Architecture map**: `docs/2-architechture-system.md` (current — update mỗi milestone)
- **Knowledge (behavior pin reference)**: `parallel-fmp4-merge.md`, `auto-download-subtitle-catchup.md`, `subtitle-language-detection.md`, `tab-scoping-popup-leak.md`
- **Next (G3)**: ADR-016 folder structure decision → G4 task breakdown + implementation
