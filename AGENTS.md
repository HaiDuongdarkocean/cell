# Cell — Chrome MV3 extension: tải video + phụ đề + Anki card creator

## Mandate

- Không hỏi user khi thực thi (trừ skill elicitation/interview-me); tự quyết, làm tới khi xong; không destructive vô cớ; fix root cause.
- Không viết comment trong code — code tự giải thích qua naming/cấu trúc.
- Gọi user "Anh yêu", xưng "em".

## Workflow

- Mọi task → route qua skill `using-agent-skills` (skills ở `.agents/skills/`); task đổi → re-route.
- Trước khi code: đọc `docs/0-wiki.md` → `1-share-language.md` → `2-architechture-system.md`; grep `.agents/skills/learning-and-apply/index.json` theo tags.
- Sau khi code: `npm run typecheck && npm run test:unit && npm run build` (build bắt lỗi Vite mà tsc không thấy) → verify trên Chrome thật → mới commit (`git-workflow-and-versioning`).

## Code conventions

- Function component + hooks; named export; không `any`; SSOT; không hardcode; tách function thuần khỏi side effect.
- Ponytail: reuse > rewrite; diff ngắn nhất sau khi hiểu problem; không abstraction/dependency không được yêu cầu; non-trivial logic để lại 1 runnable check.
- Algorithm: chính xác > performance > maintain > scale; O(1)→O(log n) lý tưởng, tối đa O(n), cấm O(n log n)+.
- UI: sửa token ở `tokens.json` (`tokens.css`/`tokens.ts` là generated); component từ `src/shared/ui/`; icon từ `ICON_CATALOG` (`src/shared/icons/index.ts`); sửa markup trước khi vá CSS.
- Persona: 5–80 tuổi, mọi thiết bị, RAM ≥1GB — UI responsive, cross-browser desktop/tablet/android, phản hồi <3s.

## Environment quirks

- Chrome 137+ block `--load-extension` → script nodriver trong skill `testing-extension-browser` + MCP `stealth-chrome-devtools` (PRIMARY; `chrome-devtools` fallback cho trace/a11y). Test sites: xem section Test sites trong skill đó.
- `browser_preview` proxy hỏng trên Windows → đưa user URL dev server gốc.
- `npm run mock` serve tất cả mock sites (KHÔNG `--youtube` — kill các site khác); `mock:stream` deprecated → `npm run dev` + entry URL trực tiếp.
- `import.meta.env.DEV` luôn false trong build — dev-seed check `MODE === 'development'` (`src/shared/lib/env/devMode.ts`).
- Tin được `src/`, `docs/`; phải kiểm `manifest.json`, `package.json`, `dist/`, `project-reference/`.

## Boundaries & updates

- Không thêm dependency mà không kiểm bundle size; không sửa `manifest.json` mà không test Chrome thật. Chrome API: cite https://developer.chrome.com/docs/extensions/reference/
- Đổi `src/` → update `docs/2-architechture-system.md`; đổi `docs/` → update `docs/0-wiki.md`; quyết định kiến trúc → `docs/adr/`.
- Ship: `npm run build && npm run ship:dist` → release Google Drive (config: `scripts/ship.config.json`).
