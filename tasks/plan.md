# Implementation Plan: Design System Library — Foundations + Atoms

## Overview

Đổi trang design-system showcase thành **Design System Library**. Wave này tập trung tuyệt đối vào Foundations (Level 0) và Atoms (Level 1), đồng thời hiển thị Molecules/Organisms/Templates/Pages như roadmap disabled `Coming later`. Không tạo nội dung giả cho các cấp cao hơn.

Nguồn yêu cầu chi tiết: `docs/specs/spec-design-system-library-foundations-atoms.md`.

## Architecture decisions

1. `level` + `category` là taxonomy hiển thị chính; technical `group`/source path không còn là primary navigation.
2. Metadata level phải explicit; không silent infer level từ folder.
3. Foundations và Atoms có presentation mode khác nhau: foundation specimens vs atom preview cards.
4. Higher levels là static disabled roadmap entries, không phải discovered showcase content.
5. Giữ Vite `import.meta.glob` auto-discovery hiện tại, thay contract/grouping thay vì rewrite architecture.
6. Không tạo Molecule/Organism/Template/Page showcase trong wave này.

## Dependency graph

```text
ShowcaseMeta level/category contract
              |
              +--> discovery normalization + grouping/search helpers
                            |
                            +--> library sidebar + roadmap
                            |
                            +--> foundation/atom section rendering
                                          |
                                          +--> responsive CSS + browser verification
```

## Task list

### Phase 1: Contract and discovery

- [ ] **Task 1: Define Library metadata contract and normalization**
  - Acceptance: `ShowcaseMeta` supports explicit `level`, `category`, `description`, `status`; active discovered entries have supported level; no level is silently inferred from source folder.
  - Verify: unit tests cover valid metadata, missing/invalid metadata behavior, and deterministic ordering.
  - Files: `src/entrypoints/design-system-showcase/autoDiscovery.ts`, discovery tests.
  - Scope: M.

- [ ] **Task 2: Migrate Foundation and Atom showcase metadata**
  - Acceptance: Color/Spacing are `foundations`; eligible primitive showcases are `atoms`; each has UI-intent category; uncertain compositions are not mislabeled.
  - Verify: script/test reports all active showcase entries have level/category; build passes.
  - Files: `src/shared/ui/*.showcase.tsx` only for migrated entries.
  - Scope: M.

### Checkpoint: Taxonomy

- [ ] `npm run typecheck` passes.
- [ ] Discovery/grouping tests pass.
- [ ] No active entry relies on technical group as its only display taxonomy.

### Phase 2: Library shell and navigation

- [ ] **Task 3: Replace ShowcaseGallery grouping with level → category navigation**
  - Acceptance: sidebar has Foundations and Atoms active sections, higher levels disabled with `Coming later`; counts are correct; active links scroll to level/category sections.
  - Verify: component tests or DOM assertions cover active/disabled navigation and counts.
  - Files: `ShowcaseGallery.tsx`, `autoDiscovery.ts` helpers, related tests.
  - Scope: M.

- [ ] **Task 4: Update page copy and search semantics**
  - Acceptance: title says `Design System Library`; subtitle says `Foundations → Atoms`; search says `Search library...`; result/empty copy says items, not atoms/showcase; search matches title/category/level/description.
  - Verify: unit tests for filtering and browser DOM check for forbidden old copy.
  - Files: `App.tsx`, `ShowcaseGallery.tsx`, related CSS/tests.
  - Scope: S.

### Checkpoint: Library shell

- [ ] Search/filter works without losing level hierarchy.
- [ ] Higher levels are visibly disabled and non-interactive.
- [ ] Light/dark mode preserves navigation hierarchy.

### Phase 3: Level-specific presentation

- [ ] **Task 5: Create Foundation section presentation**
  - Acceptance: Foundation previews render as documentation specimens; Color and Spacing remain visually inspectable; foundation cards are not indistinguishable from atom cards.
  - Verify: browser check confirms swatches/bars and foundation headings appear before atoms.
  - Files: `ShowcaseGallery.tsx`, `ShowcaseGallery.module.css`, foundation showcase files if needed.
  - Scope: M.

- [ ] **Task 6: Create Atom catalog presentation**
  - Acceptance: Atoms render compact responsive cards with title, category, level/status metadata, and preview; uncertain components are excluded or marked for review rather than mislabeled.
  - Verify: browser check at 320/768/1024/1280px; no overflow or clipped preview.
  - Files: `ShowcaseGallery.tsx`, `ShowcaseGallery.module.css`, atom showcase files if needed.
  - Scope: M.

### Checkpoint: Visual system

- [ ] Foundation and Atom visual languages are distinct.
- [ ] Responsive behavior works at required breakpoints.
- [ ] No raw colors or spacing values introduced in new library UI.

### Phase 4: Verification and documentation

- [ ] **Task 7: Add/adjust tests and architecture documentation**
  - Acceptance: discovery/grouping/filter tests cover new contract; architecture tree/function index describes Library files; wiki index references new spec if required.
  - Verify: `npm run test:unit`, `npm run typecheck`, `npm run build`.
  - Files: tests, `docs/2-architechture-system.md`, `docs/0-wiki.md`.
  - Scope: M.

- [ ] **Task 8: Browser review and final quality pass**
  - Acceptance: Chrome DevTools confirms all success criteria; console has no new errors; light/dark and disabled roadmap work.
  - Verify: Chrome DevTools MCP + `npm run build`.
  - Files: fixes only if verification finds regression.
  - Scope: M.

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Existing showcases do not expose composition rules | High | Migrate only confirmed Atoms; keep uncertain entries in an explicit review list rather than guessing. |
| Metadata migration touches many files | Medium | Introduce contract first, migrate in small batches, keep build green at checkpoints. |
| Foundation previews have different dimensions | Medium | Use level-specific presentation wrappers and avoid forcing one universal card height. |
| Disabled roadmap appears interactive | Medium | Use `aria-disabled`, non-button presentation or guarded button, clear `Coming later` label and disabled styles. |
| Current typecheck has pre-existing App unused-symbol errors | Medium | Record baseline before changes; do not attribute unrelated errors to Library work. |

## Open questions

- Exact final Atom migration list must be confirmed from each component's imports/composition; this is intentionally resolved during Task 2 rather than guessed from filenames.
- Whether Foundation categories beyond Color/Spacing already have showcase modules or need new specimens is a Task 5 inventory decision, not a reason to create fake content.
