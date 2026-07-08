# Design System — Cell Extension

> **Living document** (semi-living: update khi add/remove/rename token, pattern, atom, hoặc a11y convention — không phải mỗi commit).
> **Inspired by** [DSDS — Design System Documentation Spec](https://github.com/somerandomdude/design-system-documentation-schema) (8 entity types + document-block system), adapted to markdown folders for 1-dev Chrome Extension project.
> **Complements W3C Design Tokens Format**: token **values** live in `theme.css` + `themeTokens.ts` (source of truth). This folder documents the **semantics, usage, and contracts** around them.
> **DS version**: 1.2.0 (see [CHANGELOG.md](CHANGELOG.md))
> **Last updated**: 2026-07-08 (split into nested folders — DSDS-style)

---

## Mục lục

7 layers + references, mỗi layer 1 folder/file. Đọc theo thứ tự nếu onboarding; jump thẳng tới layer nếu đã quen.

| # | Layer | Folder/File | "Câu hỏi" | Mô tả |
|---|---|---|---|---|
| 1 | **Principles** | [principles/](principles/README.md) | "Tại sao?" | 17 design principles (YouTube + M3 + Settings) — 27 sources researched |
| 2 | **Tokens** | [tokens/](tokens/README.md) | "Gì?" | Color (9 core + 13 derived), typography, spacing, shape/elevation/motion + theme runtime (ADR-022) |
| 3 | **Components** | [components/](components/README.md) | "Thế nào?" | 23 components (popup React + popup media + content-script DOM factories + controllers) + usage guide + atomic design mapping |
| 4 | **Patterns** | [patterns/](patterns/README.md) | "Kết hợp?" | 14 interaction patterns (ADR-cited) + 6 settings pattern groups (sidebar/card/typography/form/dependency/danger) |
| 5 | **Guidelines** | [guidelines/](guidelines/README.md) | "Khi nào?" | 25+ guidelines (must/should/must-not) + examples per guideline + conflict resolution |
| 6 | **Code** | [runtime.md](runtime.md) | "Implementation?" | 5 runtime contexts + cross-runtime sync (ADR-015 T12) |
| 7 | **Governance** | [governance.md](governance.md) | "Ai quyết định?" | Ownership + contribution process + versioning + deprecation + changelog + Update Protocol |
| — | **References** | [references.md](references.md) | "Nguồn?" | YouTube/M3 token comparisons + 27 research sources + ADR links + specs (DSDS, W3C DTCG, Keep a Changelog) |
| — | **Changelog** | [CHANGELOG.md](CHANGELOG.md) | "Lịch sử?" | DS version history (Keep a Changelog 1.1.0 format) |

---

## Quick start

### Đang thiết kế UI mới?
1. Đọc [principles/](principles/README.md) — 17 principles cho context
2. Check [tokens/](tokens/README.md) — dùng tokens có sẵn, không tự tạo
3. Check [components/](components/README.md) — compose components có sẵn
4. Check [patterns/](patterns/README.md) — apply patterns phù hợp
5. Check [guidelines/](guidelines/README.md) — verify must/should/must-not
6. Nếu cần token/component/pattern mới → [governance.md#contribution-process](governance.md#contribution-process)

### Đang audit DS?
- Re-verify từng layer vs codebase — xem [governance.md#update-protocol](governance.md#update-protocol) (trigger → update file → verify by)
- Quarterly audit optional (G7) — `grep` + `ls` toàn bộ

### Đang onboarding?
- Đọc theo thứ tự 1→7 + references
- Mỗi layer file có cross-links tới layer liên quan

---

## Token source of truth

| Runtime | Source file | Mirror | Sync |
|---|---|---|---|
| Popup + Sidepanel | `src/entrypoints/popup/styles/theme.css` | — (direct Vite import) | auto |
| Content-script | — | `src/shared/lib/themeTokens.ts` (ADR-015 T12) | manual + sync test |

> **Critical**: Content-script CANNOT import `theme.css` directly (isolated world). Must use `themeTokens.ts` mirror. Forgetting this = UI breaks with raw `var(--color-*)` unresolved. See [runtime.md](runtime.md).

---

## DS score (self-audit 2026-07-08)

| Layer | Score | Notes |
|---|---|---|
| 1. Principles | 94% (7.5/8) | 27 sources, conflict resolution implicit |
| 2. Tokens | 100% (10/10) | Semantic, tier, light/dark, WCAG, sync, runtime customizable |
| 3. Components | 85% (8.5/10) | 23 components + do/don't + code + atomic mapping; props in JSDoc (file-level) |
| 4. Patterns | 87% (7/8) | 14 interaction + 6 settings, ADR-cited; links file-level not component-level |
| 5. Guidelines | 87% (7/8) | 25+ guidelines + examples + conflict resolution; per-guideline date = file-level |
| 6. Code (Runtime) | 100% (8/8) | Source file, mirror, sync test, React + DOM factory, type safety |
| 7. Governance | 94% (7.5/8) | Ownership, contribution, versioning, deprecation, changelog; audit optional |
| **TOTAL** | **93% (55.5/60)** | 6/7 layers ≥85%, all FAILs filled, 4.5 PARTIALs ponytail-acceptable |

See commit history + [CHANGELOG.md](CHANGELOG.md) for evolution.

---

## Ponytail ceilings (future upgrades when justified)

- **Storybook** — when component count > 30 or team > 2 (currently 23 + 1 dev, manual docs OK)
- **Auto-generated changelog** — when entries > 50 (currently manual, cheaper than tooling)
- **`tokens.css` shared asset** — build-time import in both popup + content-script (eliminates `themeTokens.ts` mirror drift risk — ADR-015 T12 ceiling)
- **Per-guideline reviewed date** — when guidelines churn high (currently file-level date OK)
- **Enforced quarterly audit** — when drift incidents recur (currently optional, semi-living trust)
