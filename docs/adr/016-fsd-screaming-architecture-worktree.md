# ADR-016: FSD + Screaming Architecture Worktree cho Orca Platform

## Status

Accepted (G3 — folder structure decision. Implementation G4 milestone M0-M13, spec `docs/specs/spec-refactor-system-architecture.md` APPROVED, plan `docs/plan/plan-refactor-system-architecture.md`)

## Context

Cell (~99 file source + 85 test) đang hình thành "Big Ball of Mud" — `src/content/` có **17 `subtitle*.ts`** phẳng, `src/lib/converters/` có **transmux cluster ~16 file** (8 `parallel*.ts` + segment/merger/validator/timer/...) phẳng. Mở folder thấy technical prefix, không thấy domain intent. Tìm file/function mất >3 bước.

Sắp tới Cell mở rộng thành **Orca platform** — 23 feature domain / 17 nhóm UC / 130 UC (dict, reading, video-learning, podcast, EPUB/PDF, clipboard, vocabulary, flashcard, deck, SRS, Anki, bookmark, sync, settings, statistics, AI, auth, TTS...). Nếu giữ flat folder, thêm 23 feature → >200 file phẳng, không tra cứu/maintain được.

**Forces (từ spec + G0 research 53 nguồn `docs/intent/intent-refactor-system-architecture.md`)**:
- Worktree phải "scream" domain intent (Screaming Architecture — Robert C. Martin) — mở `src/features/` thấy ngay domain.
- Navigability: tìm file/function ≤3 bước.
- Extensibility: thêm feature Orca = tạo folder theo template, không nhét file phẳng.
- Behavior preservation: refactor structure, KHÔNG đổi behavior (P1-P3 research: test coverage prerequisite, incremental, respect boundaries).
- Dependency inversion + information hiding (P5 research): feature không import nội bộ feature khác; chrome.* wrap adapter.
- MV3 constraints: 5 entrypoint surface (background SW, content, offscreen, popup, sidepanel) — manifest/vite reference path, không thể move tự do.

**Constraints (codebase)**:
- `public/manifest.json` reference 5 entry path: `src/background/index.ts`, `src/content/content-script.ts`, `src/content/fetchInterceptor.iife.ts` (MAIN world), `src/popup/index.html`, `src/sidepanel/index.html`. Move → manifest update đồng bộ.
- `vite.config.ts` `rollupOptions.input` reference `src/offscreen/ffmpeg.html` + `src/sidepanel/index.html`.
- CRXJS build framework (`@crxjs/vite-plugin`) đang hoạt động — không migrate WXT (ngoài scope, ponytail rung 5).
- Reference projects: asbplayer (monorepo `common/` pure domain), import-dict + theocean-dict (Repository + Strategy + Provider/Adapter pattern).

## Decision

### D1: Adopt Feature-Sliced Design + Screaming Architecture (6 layer)

```
src/
├── entrypoints/   # MV3 surfaces (background, content, offscreen, popup, sidepanel) — CRXJS manifest entry
├── features/      # Business features domain-named (subtitle, transmux, download, detection, whitelist, settings, + 17 future Orca)
├── entities/      # Domain models (subtitle, video, settings, message, media, + future word/card/deck/...)
├── shared/        # Cross-cutting (lib/chrome-apis, lib/messaging, lib/parsers, lib/storage, utils, config)
├── stores/        # Zustand (giữ tại entrypoints/popup + sidepanel hiện tại, chưa tách — Q2 resolved)
└── app/           # App wiring (skip G4, tạo khi cần — Q3 resolved)
```

- **Rationale**: FSD cho layer rõ + import rule enforce; Screaming Architecture cho domain-named folders (không technical prefix). Hybrid 2 trường phái: FSD layer (entrypoints/features/entities/shared) + Screaming domain naming.
- Mỗi feature folder template: `{ui, logic, service, ports}/ + types.ts + index.ts` (barrel).

### D2: Dependency rule (FSD import rule)

```
entrypoints → features → entities → shared
features → entities, shared (KHÔNG → entrypoints, KHÔNG → feature khác qua internal path)
entities → shared (KHÔNG → features/entrypoints)
shared → shared (internal only)
app → tất cả (wiring)
```

- Feature A import feature B **chỉ qua** `features/B/index.ts` (public barrel), KHÔNG qua `features/B/ui/foo.ts` (internal).
- `chrome.*` calls chỉ ở `shared/lib/chrome-apis/` + `entrypoints/` (SW init).
- **Enforce**: manual review + `npx tsc --noEmit` (catch type circular). ESLint layer-rule (eslint-plugin-boundaries) **KHÔNG thêm G4** (Q4 resolved — tránh new dep + scope creep, để ADR riêng sau).
- **Rationale**: information hiding (P5 research) — barrel = public API, internal hidden. Layer rule ngăn coupling cycle.

### D3: Migration pattern = Strangler Fig + Parallel Change (Expand-Contract)

- Mỗi move: **expand** (tạo new path + barrel) → **migrate** (update import từng file, test sau mỗi) → **contract** (xóa old path).
- Bottom-up order: `shared/` + `entities/` trước (foundation, không depend ai) → features → `entrypoints/` cuối (chạm manifest/vite, rủi ro cao nhất).
- Commit nhỏ mỗi cluster, test pass mỗi commit (~17-20 commit, M0-M13).
- **Rationale**: incremental over big-bang rewrite (P3 research). Behavior-preserving, dễ rollback (`git revert` per commit).

### D4: Behavior preservation + coverage baseline gate

- Refactor = move + import update + barrel + port. **KHÔNG đổi logic** (git diff --stat chỉ move + import).
- **Milestone 0 pre-flight** (review Risk #1): `npm run test:coverage` đo baseline subtitle/transmux/download → viết characterization test cho **critical behaviors** chưa cover (overlay/drag/sync/merge/auto-download dedup/transmux fMP4 merge) TRƯỚC khi move. Exit gate: critical behavior pinned.
- Coverage threshold (Q2 resolved): **cover critical behaviors, không chase % number** (Feathers: pin behavior quan trọng, không cần 100%).
- **Rationale**: test coverage prerequisite (P1 research). Characterization test (Feathers) pin "code ACTUALLY does" trước refactor.

### D5 (sub-decision): Port pattern cho external deps (testability + future Orca)

```typescript
// features/subtitle/ports/ISubtitleStorage.ts
export interface ISubtitleStorage {
  getOverlayConfig(): Promise<OverlayConfig>;
  setOverlayConfig(config: OverlayConfig): Promise<void>;
}
// Adapter ở shared/lib/chrome-apis/storage.ts implement interface
```

- Feature định nghĩa port interface (`ports/I*.ts`); adapter ở `shared/lib/chrome-apis/` implement.
- **KHÔNG tạo port cho tất cả** — chỉ khi cần testability hoặc future Orca swap (OAuth, SQLite, AnkiConnect). Incremental (ponytail + Metz P8: tránh premature abstraction).
- **Rationale**: dependency inversion (P5 research) — feature depend interface, không depend chrome.* trực tiếp. Future Orca: swap chrome.storage → SQLite WASM mà không đổi feature logic.

### D6 (sub-decision): chrome.* adapter ở shared/lib/chrome-apis/ (incremental wrap)

- Wrap chrome.runtime/storage/tabs/downloads/webRequest/offscreen vào `shared/lib/chrome-apis/` ở **Milestone 11** (incremental, sau khi feature move xong).
- **Wrap khi chạm file** (Q1 resolved), KHÔNG wrap tất cả trước. Characterization test pin behavior TRƯỚC wrap.
- Future Orca thêm: identity (OAuth), tts, notifications.
- **Rationale**: Ports & Adapters (Hexagonal) — chrome.* là I/O boundary. Incremental tránh over-engineer (Metz P8: duplication > wrong abstraction).

## Consequences

**Positive**:
- Worktree screams domain — mở `features/` thấy subtitle/transmux/download/detection (NF1).
- Navigability ≤3 bước: `features/<domain>/` → concern `ui/logic/service/ports/` (NF2).
- Extensibility: thêm Orca feature = tạo `features/<domain>/` theo template, không nhét file phẳng (NF5).
- Testability: logic tách pure (no DOM), port cho phép mock external deps.
- Future Orca-ready: 23 feature domain có chỗ; entities/ chứa domain models; shared/chrome-apis chuẩn bị OAuth/SQLite/AnkiConnect.
- Dependency rule ngăn coupling cycle (barrel public API, internal hidden).

**Negative**:
- Refactor cost: ~17-20 commit, chạm ~99 file source + 85 test. Risk behavior drift (mitigate: characterization test + git diff review).
- M9 entrypoints chạm manifest/vite = rủi ro cao (mitigate: 5 sub-commit, build per commit, browser verify).
- Layer rule không auto-enforce (manual + tsc) — risk vi phạm vô tình (mitigate: review + future ESLint ADR).
- Folder nesting sâu hơn (`features/subtitle/ui/overlayLayer.ts` thay `content/subtitleUI.ts`) — import path dài hơn (mitigate: barrel rút gọn).

**Neutral**:
- Test mirror structure (`tests/unit/features/subtitle/` ↔ `src/features/subtitle/`) — colocate.
- `stores/` + `app/` layer khai báo nhưng chưa dùng đầy đủ (YAGNI — tạo khi Orca feature cần).
- `docs/2-architechture-system.md` update mỗi milestone (bus factor = 1 mitigation).

## Alternatives Considered

### A1: Bulletproof React — feature folders, types trong `features/*/types.ts` (không có entities/ layer)
- **Rejected (partial)**: dùng feature folder + colocation từ Bulletproof React, nhưng **giữ entities/ layer** (FSD) cho shared domain models (Subtitle, Video dùng cross-feature). Hybrid: entities/ cho shared domain, features/*/types.ts cho feature-specific (Q5 resolved).

### A2: Giữ flat folder, chỉ rename file theo domain prefix
- **Rejected**: rename không giải quyết >200 file phẳng khi thêm Orca. Vẫn 1 folder khổng lồ, không có layer/boundary. Paving the cow path (anti-pattern research).

### A3: Full rewrite từ đầu theo Orca architecture
- **Rejected (G0 score 53/100)**: big-bang rewrite rủi ro cao, mất behavior đã verify (subtitle drag, transmux fMP4 merge, auto-download). Strangler Fig + incremental an toàn hơn (P3 research).

### A4: Monorepo (pnpm + Turborepo) như asbplayer — tách `common/` pure domain package
- **Rejected (premature)**: monorepo phù hợp khi có web app + extension + mobile (Orca Phase 2-3). Hiện tại chỉ extension → monorepo over-engineer. Để future ADR khi Orca web app cần share domain. Hiện tại `entities/` + `shared/` trong single package đủ.

### A5: Tách ADR-016 (structure) + ADR-017 (port) + ADR-018 (chrome-apis adapter)
- **Rejected (Q1 resolved)**: 1 ADR-016 tổng + port/adapter là sub-decision D5/D6. Tránh ADR sprawl cho solo dev. ESLint layer-rule mới tách ADR riêng (khi thêm dep).

### A6: ESLint eslint-plugin-boundaries enforce layer rule ngay G4
- **Rejected (Q4 resolved)**: thêm new dep + scope creep trong refactor. Manual review + tsc G4. ESLint layer-rule để ADR riêng sau (sau khi structure stable).

## Verification Plan (G4/G5)

- **Per milestone**: `npm run test:unit` + `npx tsc --noEmit` pass. `npm run build` pass (M9 per sub-commit). Grep old import path = 0.
- **Per cluster commit**: `git diff --stat` review — chỉ move + import, KHÔNG logic diff (F6 behavior preservation).
- **Browser verify** (stop-the-line): M7 subtitle (overlay/drag), M9.2 content (MAIN world inject), M9.4 popup, M9.5 sidepanel.
- **Integration**: M6 transmux (parallel/sequential m3u8), M8 download.
- **Final (M13)**: full regression unit + integration + tsc + build + browser + E2E (Playwright).
- **Structure check**: `Get-ChildItem -Recurse src` diff target structure = 0 unaccounted file.
- Success Criteria F1-F6 / NF1-NF6 / P1-P3 (spec §Success Criteria).

## Related

- **Spec**: `docs/specs/spec-refactor-system-architecture.md` (APPROVED, 8 review edits applied)
- **Plan**: `docs/plan/plan-refactor-system-architecture.md` (14 milestone + dependency graph + checkpoint A-E)
- **Review**: `docs/reviews/review-refactor-system-architecture.md` (APPROVED, Opus 4.8, 1 CRITICAL + 2 HIGH fixed)
- **Intent (G0)**: `docs/intent/intent-refactor-system-architecture.md` (research 53 nguồn + 7 nguyên lý)
- **Orca scope**: `docs/reading-summaries/phase-1-wiki-chapters.md` → `phase-7-theocean-dict.md`
- **Builds on**: ADR-004 (layered clean architecture), ADR-006 (architecture proposal)
- **Architect role**: `docs/reference/software-org-roles.md` #4
