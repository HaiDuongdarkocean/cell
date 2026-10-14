# Ops — Lifecycle & Contribution Contract

> Thay thế `DESIGN.md` §8–10 + `README.md` mechanics. Mọi public token/component/pattern có status + owner + bằng chứng.

## Token SSOT mechanics (cách dùng token trong code)

| Việc | Cách |
|---|---|
| Sửa giá trị token | Chỉ `tokens.json` → `node scripts/generate-tokens.js` (hoặc `npm run dev`/`build` tự chạy qua predev/prebuild) |
| Dùng trong React | `import '@/shared/styles/tokens.css'` → `var(--space-4)`, không hardcode |
| Dùng trong Shadow DOM | `import tokensCss from '...?raw'` → replace `:root`→`:host` → inject; `:host { font-size: var(--font-size-base) }` reset cô lập host |
| Dùng trong content script | `STATIC_TOKENS`/`DEFAULT_*_TOKENS` từ `src/shared/lib/tokens.ts` (generated, không sửa tay) |
| Dùng component | `import { Button } from '@/shared/ui'` — hover/active có sẵn |

## Prototype → Production flow

1. Build/redesign trong `src/entrypoints/design-system-showcase/`.
2. Chỉ `src/shared/ui/*` + tokens.
3. Verify Chrome: `?mode=light&viewport=320`, `?mode=dark&viewport=768`, `?mode=light&viewport=1280`.
4. Chạy audit commands (`ops/audit.md`) = 0.
5. User confirm visual.
6. Move nguyên code vào feature directory — **showcase là final UI**, không phải bản nháp.

## Lifecycle statuses

| Status | Nghĩa | Gate |
|---|---|---|
| `experimental` | Mới / single-consumer | → stable: reuse-gap evidence + owner + showcase + behavior test + human approval |
| `stable` | Proven ≥2 features hoặc 1 pattern | Phải có showcase + Playwright/unit test + states doc + a11y contract + consumer count |
| `deprecated` | Sẽ xóa; có replacement | Migration note `docs/design-system/MIGRATION.md` + window ≥1 minor release + warning trong source |
| `removed` | Đã xóa | Chỉ sau khi window đóng + CI chứng 0 consumers |

Status SSOT: `docs/design-system/COMPONENT_INVENTORY.json` (components) + `tokens.json` metadata (tokens). Token chỉ bị xóa khi chứng minh 0 consumer (trực tiếp, gián tiếp, Shadow DOM, content script, preset, test, generated asset).

## Contribution contract — trước khi thêm/sửa public UI primitive

1. **Reuse search trước** — `src/shared/ui/`, `ICON_CATALOG`, `tokens.json`.
2. **Prove the gap** — 1 dòng vì sao library hiện tại không express được.
3. **Owner** — tên trong `COMPONENT_INVENTORY.json`.
4. **Showcase** — `pages/*.showcase.tsx` + `.module.css`.
5. **Evidence** — `src/shared/ui/<Name>.test.tsx` hoặc Playwright E2E.
6. **Audit** — commands trong `ops/audit.md` = 0 cho source mới.
7. **ADR** — chỉ khi khó-đảo-ngược (token family mới, layer mới, breaking API). CSS tweak/variant mới KHÔNG cần ADR.

Proposal nhỏ nhất thỏa gap thắng. Ví dụ dry-run: `Pagination` — không primitive sẵn + `Button`+`HStack` không express page semantics → vào `experimental`.

## Breaking changes

Breaking = xóa/rename public export · đổi semantic token value · đổi prop API/ARIA contract · xóa pattern/e2e contract.
Bắt buộc: migration note "from/to/action" trong `MIGRATION.md` + deprecation ≥1 minor + `console.warn`/marker + CI 0 consumers trước khi xóa.

## Known migrations đang chờ

- `--color-primary-foreground` → `--color-text-on-primary`
- `--radius-full` → `--radius-pill`
- `--font-weight-regular` → `--font-weight-normal`
- `--size-touch-target-*` → `--touch-target-*`
- `--breakpoint-*` CSS vars → hardcode px / `BREAKPOINTS` JS
