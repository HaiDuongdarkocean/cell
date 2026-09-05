# ADR-098: `tokens.json` là SSOT cho `tokens.css` — pipeline generate, không edit tay

## Status

Accepted — discovered & enforced during the 2026-09-05 extended design-system audit
(commits `689437c7`, `c8a24f38`).

## Context

`src/shared/styles/tokens.css` là file **auto-generated** — header file có
"DO NOT EDIT MANUALLY". Nguồn sự thật là `src/shared/styles/tokens.json`,
generate bởi `scripts/generate-tokens.js` (chạy tự động trong `prebuild`).

Trong audit mở rộng (T13), một subagent đã thêm `--opacity-20` trực tiếp vào
`tokens.css`; lần regenerate kế tiếp xóa mất token đó trong khi 2 file
(`NavCluster.module.css`, `subtitlePanelsShared.module.css`) đã dùng
`var(--opacity-20)` → reference dang dở. Sự cố được phát hiện vì ta chạy lại
generator thủ công trước khi commit.

Nguy cơ tương tự tồn tại theo chiều ngược lại: dùng `var(--token)` với token
không tồn tại (audit tìm thấy 9 token undefined: `--shadow-text-soft`,
`--duration-medium`, `--transition-fast`, `--icon-default-size`,
`--color-border-strong`, `--blur-xs`, `--ease-bounce`, `--color-danger`,
`--stroke-width-xl`).

## Decision

1. **Thêm/đổi token → chỉ sửa `tokens.json`**, rồi `node scripts/generate-tokens.js`.
   Không bao giờ edit `tokens.css` trực tiếp.
2. **Parity phải duy trì ở 3 nơi** khi thêm một nhóm token mới:
   - `scripts/generate-tokens.js` — emit group ra `tokens.css`
   - `scripts/check-design-system-css.mjs` — registry cho css-check
   - `src/shared/lib/tokens.ts` (`STATIC_TOKENS`) — content-script injectors
3. **Trước khi dùng `var(--x)`**: verify token tồn tại trong `tokens.css`
   (generated output), không chỉ trong `tokens.json`.
4. **`var(--t, literal-fallback)` chỉ giữ khi token có thể không tồn tại**
   (ví dụ component-level token mà consumer có thể không định nghĩa).
   Fallback cho global token đã register là noise → xóa.
5. **`var(--*)` KHÔNG dùng trong CSS inject vào foreign documents**
   (content-script host pages, iframe bridges): token scope của ta không tồn tại
   ở đó → `var()` fail silently. Literal (kể cả `z-index: 2147483647`) là đúng.
6. **CI/pre-commit nên có bước**: `node scripts/generate-tokens.js` rồi
   `git diff --exit-code src/shared/styles/tokens.css` để bắt drift
   tokens.json↔tokens.css. (Hiện chỉ chạy trong prebuild.)

## Consequences

- Mọi thay đổi token là deterministic: `tokens.json` → regenerate → diff sạch.
- `check-design-system-css.mjs` báo 0 violations trên 87 files sau khi registry
  được sync; nếu thêm token mà quên update registry → false-positive.
- Agent/subagent làm việc trên file này phải đọc ADR này trước (ghi vào
  `AGENTS.md`).
