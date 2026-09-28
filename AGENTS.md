# Cell — Chrome MV3 extension: tải video + phụ đề + Anki card creator

## Mandate

- Không hỏi user khi thực thi (trừ `pipeline-analyze` interactive mode + `pipeline-design` approval gate); tự quyết, làm tới khi xong; không destructive vô cớ; fix root cause.
- Không viết comment trong code — code tự giải thích qua naming/cấu trúc.
- Gọi user "Anh yêu", xưng "em".
- KHÔNG làm MVP/bản nháp: mọi feature phải là product hoàn chỉnh ship được cho khách hàng — edge cases đầy đủ, i18n, a11y, persist state khi user expect, polish theo design system. "V1 tối giản" chỉ khi Anh yêu nói rõ.

## Workflow

- Mọi task → route qua skill `using-agent-skills` (skills ở `.agents/skills/`); task đổi → re-route.
- Feature work chạy stage pipeline `analyze → specify → design (UI only) → deliver` qua skills `pipeline-*`; stage truth = `tasks/pipeline-state.json`, mutate chỉ qua `scripts/pipeline-state.mjs` (transitions enforce evidence — không nhảy stage tay). Backlog items vào qua `idea-pick-off`.
- **Pipeline ownership (multi-agent):** item có `owner` — chỉ owner được `set`/`gates`/`resolve`/`transition`/`activate` item đó. Định danh qua `CELL_AGENT_ID` env (set 1 lần đầu session, vd `export CELL_AGENT_ID="devin-$PPID-$(date +%s)"`) hoặc `--owner <id>` trên mọi lệnh mutate; không có id = `human` (override cho Anh). Item của agent khác → KHÔNG mutate state, KHÔNG đụng files của nó; cần chuyển hướng → `request-handoff <slug> --note`, owner/human quyết `handoff --to`/`release --force --note`. Worktree `cell-worktrees/*` có `.cell-owner` ở root — owner khác mình thì tuyệt đối không ghi vào (kể cả "chỉ thêm test"). Dirty/uncommitted files không phải mình tạo = in-flight work của agent khác → không stash/commit/edit đè; merge cần shield thì chỉ stash `wip-shield:<agent-id>` của chính mình.
- Context theo nhu cầu, không đọc trước toàn bộ: `docs/2-architechture-system.md` khi đụng `src/`; `docs/1-share-language.md` khi gặp thuật ngữ domain lạ; `docs/0-wiki.md` khi cần map repo hoặc changelog. Trước khi viết logic mới: grep `.agents/skills/learning-and-apply/index.json` theo tags.
- Sau khi code: `npm run typecheck && npm run test:unit && npm run build` (build bắt lỗi Vite mà tsc không thấy) → verify trên Chrome thật → mới commit (`git-workflow-and-versioning`).

## Code conventions

- Function component + hooks; named export; không `any`; SSOT; không hardcode; tách function thuần khỏi side effect.
- Ponytail: reuse > rewrite; diff ngắn nhất sau khi hiểu problem; không abstraction/dependency không được yêu cầu; non-trivial logic để lại 1 runnable check.
- Algorithm: chính xác > performance > maintain > scale; O(1)→O(log n) lý tưởng, tối đa O(n), cấm O(n log n)+.
- UI: sửa token ở `tokens.json` (`tokens.css`/`tokens.ts` là generated); component từ `src/shared/ui/`; icon từ `ICON_CATALOG` (`src/shared/icons/index.ts`); sửa markup trước khi vá CSS.
- Persona: 5–80 tuổi, mọi thiết bị, RAM ≥1GB — UI responsive, cross-browser desktop/tablet/android, phản hồi <3s.

## Output hygiene

- Root chỉ chứa file tool/project bắt buộc (manifest, config, lockfile). File do mình quyết định tạo → đúng thư mục cùng loại: test → `tests/`/`e2e/`, plan → `tasks/` (hoặc `animation-plans/` cho skill improve-animations), docs → `docs/`, script → `scripts/`, mockup → `src/entrypoints/mockup-<slug>/` (design-time, xóa khi ship); skill có dòng Output → theo skill.
- Scratch/screenshot/log → `tmp/<task-slug>/` (gitignored); xong việc không cần reproduce thì xóa. Output tool vào path cố định đã gitignore (`dist/`, `build/`, `coverage/`, `e2e-results/`, `.playwright-mcp/`) thì để nguyên.
- Trước commit check `git status`: file lạ ở root là rác → dời/xóa, KHÔNG vá `.gitignore` cho one-off. File lạ không phải mình tạo → check `git ls-files` + imports trước khi đụng.
- `docs/`: canon `0,1,2` + `adr|audits|context|design-system|ideas|intent|knowledge-base|mockups|research|reviews|specs`; `tasks/`: `pipeline-state.json` (pipeline SSOT) + `plan|todo|reports`; `tests/`: `unit|integration|data-test|mocks`.
- Mọi skill chỉ sống ở `.agents/skills/` — không tạo skill ở `.devin/` hay chỗ khác.

## Environment quirks

- Chrome 137+ block `--load-extension` trên Google Chrome; Windows cũng block `external_crx`. Skill `testing-extension-browser` pack `.crx` + clone profile; Playwright persistent Chromium/Chrome-for-Testing với `--load-extension` + warm-up để launch, navigate, verify. `chrome-devtools` MCP fallback cho trace/a11y.
- `browser_preview` proxy hỏng trên Windows → đưa user URL dev server gốc.
- `npm run mock` serve tất cả mock sites (KHÔNG `--youtube` — kill các site khác); `mock:stream` deprecated → `npm run dev` + entry URL trực tiếp.
- `import.meta.env.DEV` luôn false trong build — dev-seed check `MODE === 'development'` (`src/shared/lib/env/devMode.ts`).
- Google OAuth (user-data-sync): client ID ở `.env.local` (gitignored) → `VITE_GOOGLE_OAUTH_CLIENT_ID`, code chỉ đọc qua `import.meta.env`; KHÔNG đọc/in giá trị, KHÔNG commit, KHÔNG lưu client secret vào repo (flow `launchWebAuthFlow` không cần secret).
- `public/manifest.json` pin `"key"` (public key của `cell-key.pem`, gitignored) → extension id ổn định `acaplpheplggagjpekjlmcjhgghimcfm` mọi máy/load — bắt buộc cho `launchWebAuthFlow` redirect. KHÔNG regenerate pem, KHÔNG bỏ key (đổi id = đứt OAuth + orphan storage). `build-firefox.mjs` strip `key` cho Firefox.
- Tin được `src/`, `docs/`; phải kiểm `manifest.json`, `package.json`, `dist/`, `project-reference/`.
- CẤM `robocopy /MIR` để xóa worktree/dir chứa `node_modules` — nó đi xuyên junction và xóa luôn content ở junction target (đã từng wipe `node_modules` repo chính). Xóa worktree: `git worktree remove`; nếu path-too-long thì xóa `node_modules` trong worktree trước bằng `rm -rf` rồi mới `git worktree remove --force`.

## Boundaries & updates

- Không thêm dependency mà không kiểm bundle size; không sửa `manifest.json` mà không test Chrome thật. Chrome API: cite https://developer.chrome.com/docs/extensions/reference/
- Đổi `src/` → update `docs/2-architechture-system.md`; đổi `docs/` → update `docs/0-wiki.md`; quyết định kiến trúc → `docs/adr/`.
- Ship: `npm run build && npm run ship:dist` → release Google Drive (config: `scripts/ship.config.json`).
- Commit message sạch — CẤM trailer `Generated with Devin`/`Co-Authored-By` hay bất kỳ attribution nào vào commit của Anh.
