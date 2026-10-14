# Tihoka — Chrome MV3 extension: tải video + phụ đề + Anki card creator

## Mandate

- Nêu giả định + plan trước khi chạm code — chưa có plan chưa sửa. Làm đúng luôn, không vá tạm; sửa ở gốc, không sửa triệu chứng.
- **Autonomy theo mode:** autonomous pipeline (`idea-pick-off all`, `all` mode) → tự quyết làm tới cùng, chỉ dừng ở approval gate mà pipeline tự bắt (`pipeline-analyze` interactive, `pipeline-design`). Work thường (ad-hoc/manual) → yêu cầu chưa rõ ràng thì PHẢI hỏi trước khi sửa; đã rõ thì tự làm tới cùng, không destructive vô cớ, fix root cause. Mọi mode đều hỏi khi: thao tác destructive (xóa/force-push/drop), credentials/secrets, đổi scope được giao, đụng shared UI.
- Không viết comment trong code — code tự giải thích qua naming/cấu trúc.
- Gọi user "Anh yêu", xưng "em"; trả lời theo ASD-STE100 ~80% — câu ngắn, từ đơn giản, cấu trúc rõ; hệ thống nhiều thành phần thì vẽ sơ đồ.
- KHÔNG làm MVP/bản nháp: mọi feature phải là product hoàn chỉnh ship được cho khách hàng — edge cases đầy đủ, i18n, a11y, persist state khi user expect, polish theo design system. "V1 tối giản" chỉ khi Anh yêu nói rõ.

## Workflow

- Mọi task → route qua skill `using-agent-skills` (skills ở `.agents/skills/`); task đổi → re-route.
- Feature work chạy stage pipeline `analyze → specify → design (UI only) → deliver` qua skills `pipeline-*`; stage truth = `tasks/pipeline-state.json`, mutate chỉ qua `scripts/pipeline-state.mjs` (transitions enforce evidence — không nhảy stage tay). Backlog items vào qua `idea-pick-off`.
- **Pipeline ownership (multi-agent):** item có `owner` — chỉ owner được `set`/`gates`/`resolve`/`transition`/`activate` item đó. Định danh qua `Tihoka_AGENT_ID` env (set 1 lần đầu session, vd `export Tihoka_AGENT_ID="devin-$PPID-$(date +%s)"`) hoặc `--owner <id>` trên mọi lệnh mutate; không có id = `human` (override cho Anh). **Session binding:** `--owner <id>` trên lệnh `pipeline-state.mjs` gắn `owner.sessionId` = session hiện tại qua `hook-owner-bind` — chỉ session bound mới nhận prime/resume, gate pressure (stop-gate), stage-guard và gates-tracker; session khác chỉ thấy info line. Item của agent khác → KHÔNG mutate state, KHÔNG đụng files của nó; cần chuyển hướng → `request-handoff <slug> --note`, owner/human quyết `handoff --to`/`release --force --note`. Worktree `Tihoka-worktrees/*` có `.Tihoka-owner` ở root — owner khác mình thì tuyệt đối không ghi vào (kể cả "chỉ thêm test"). Dirty/uncommitted files không phải mình tạo = in-flight work của agent khác → không stash/commit/edit đè; merge cần shield thì chỉ stash `wip-shield:<agent-id>` của chính mình.
- Context theo nhu cầu, không đọc trước toàn bộ: `docs/2-architechture-system.md` khi đụng `src/`; `docs/1-share-language.md` khi gặp thuật ngữ domain lạ; `docs/0-wiki.md` khi cần map repo hoặc changelog. Trước khi viết logic mới: grep `.agents/skills/learning-and-apply/index.json` theo tags.
- Sửa bug: tái hiện end-to-end trên môi trường thật trước — chưa thấy bug chạy thì chưa sửa. Test/verify viết sau reproduce và phải fail khi bug còn đó.
- **Debug sai đường:** mỗi lần giả định/phép đo/bước debug hóa ra sai → ghi ĐÚNG 1 dòng ngắn vào file này để không tái phạm; file tối đa 5000 từ — vượt thì gom/trim dòng cũ.
- **Blast radius trước khi sửa (bắt buộc):** Tihoka ràng buộc chéo mạnh — một output (vd `contextSentence`, `Token`, `LookupRequest`) thường nuôi nhiều feature (popup, TTS, translate, card/SRS, OCR, reader, subtitle). Trước khi đụng hàm/type/field shared: grep hết callers + trace data nó sinh ra đi đâu → liệt kê feature bị ảnh hưởng trong plan → sửa xong verify từng consumer, không chỉ đường đang fix. Đổi contract (signature, semantic của field, đơn vị offset, boundary) → migrate TẤT CẢ producers/consumers trong cùng commit; không ship nửa chừng (vd đổi `contextSentence` sang câu xuyên-block thì `cursorOffset` đi kèm phải đổi sang offset-trong-câu ngay, không để lệch đơn vị).
- Sau khi code: `npm run typecheck && npm run test:unit && npm run build` (build bắt lỗi Vite mà tsc không thấy) → verify trên Chrome thật → mới commit (`git-workflow-and-versioning`). UI change có hình thái/tương tác mới → bắt buộc ảnh chụp before/after hoặc pixel-scan làm bằng chứng trong report (DOM rect/computed không đủ — element đúng rect vẫn có thể không paint). Sửa UI đơn vị nhỏ (đổi token, spacing, typo — không đổi hình dạng/tương tác) → chỉ cần verify kết quả đúng rồi build + commit, không cần bằng chứng ảnh.
- Mọi thay đổi đụng subtitle split-view/panel (`subtitleSplitView.ts`, `mountSubtitle.tsx`, `SubtitlePanel*.tsx`, subtitle auto-load) phải re-verify AC tại `docs/specs/subtitle-split-view-ac.md`.

## Code conventions

- Function component + hooks; named export; không `any`; SSOT; không hardcode; tách function thuần khỏi side effect.
- Code như vi khuẩn: ngắn, tiết kiệm, module độc lập. Đọc AGENTS.md + code xung quanh trước, mimic style đó; sửa đúng chỗ cần sửa — không refactor phần không liên quan.
- Ponytail: reuse > rewrite; diff ngắn nhất sau khi hiểu problem; không abstraction/dependency không được yêu cầu; non-trivial logic để lại 1 runnable check.
- Algorithm: chính xác > performance > maintain > scale; O(1)→O(log n) lý tưởng, tối đa O(n), cấm O(n log n)+.
- UI: sửa token ở `tokens.json` (`tokens.css`/`tokens.ts` là generated); component từ `src/shared/ui/`; icon từ `ICON_CATALOG` (`src/shared/icons/index.ts`); sửa markup trước khi vá CSS.
- Danh sách lựa chọn (dropdown/menu/actions/filter/sort/select) → `<Menu>` + `<MenuItem>` + `<MenuSeparator>` (`src/shared/ui/Menu.tsx`): surface `radius-md`, item hover/focus bằng `surface-hover` background, dismissal + arrow-key do Menu lo. KHÔNG tự viết `.menuSurface`/`.menuItem` trong feature, KHÔNG nhét list dọc vào `<Popover variant="toolbar">`. Thấy pattern đã có 1 exemplar trong repo → đưa lên `shared/ui` rồi reuse, không viết bản thứ hai. Đụng component `src/shared/ui/` hiện có (API/behavior) → hỏi Anh xác nhận trước.
- Verify overlay/menu mới: chụp cạnh instance canonical (vd menu Vocabulary) + kiểm anchor sau scroll/gần mép; sai lệch quan sát được = defect phải fix, không ghi "chấp nhận được".
- Shadow-DOM boundary: code chạy trong surface mount qua `mountReactShadow` (universal/subtitle panel, dictionary popup, card creator) — đọc focus/selection qua `el.getRootNode()` (`root.activeElement`, `ShadowRoot.getSelection()`), nghe event non-composed (`scroll`/`focus`/`blur`/`mouseenter`/`pointerenter`) trên scope đó chứ không `window`/`document`, outside-click dùng `composedPath()`, Escape qua `pushEscapeLayer`.
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
- `public/manifest.json` pin `"key"` = public key của `tihoka-key.pem` (gitignored — key ký CRX ở `scripts/release-github.ps1`/`ship-dist.ps1`) → extension id `ifceodogdeeaacmdigljgmafnhkbfnia` cho **mọi** đường cài (load-unpacked dev, CRX, Quetta/Edge/Chromium fork) — manifest key và key ký CRX bắt buộc cùng ID để `launchWebAuthFlow` redirect URI ổn định. Guard: `tests/unit/manifest.test.ts`. KHÔNG regenerate pem, KHÔNG bỏ key, KHÔNG đổi key ký CRX (đổi = user hiện tại mất auto-update + orphan storage). `build-firefox.mjs` strip `key` cho Firefox.
- Google OAuth `redirect_uri_mismatch` = redirect URI `https://<extension-id>.chromiumapp.org/` chưa whitelist trong Google Cloud Console (Authorized redirect URIs), KHÔNG phải bug code — `identity.getRedirectURL()` trả URI động theo runtime ID (unpacked → manifest key; CRX → key ký CRX; Firefox → `*.extensions.allizom.org`). Vì Quetta/Edge/forks cài `tihoka.crx` nên dùng chung ID của CRX → 1 entry phủ hết user, không phải thêm per-user.
- Tin được `src/`, `docs/`; phải kiểm `manifest.json`, `package.json`, `dist/`, `project-reference/`.
- CẤM `robocopy /MIR` để xóa worktree/dir chứa `node_modules` — nó đi xuyên junction và xóa luôn content ở junction target (đã từng wipe `node_modules` repo chính). Xóa worktree: `git worktree remove`; nếu path-too-long thì xóa `node_modules` trong worktree trước bằng `rm -rf` rồi mới `git worktree remove --force`.

## Boundaries & updates

- Không thêm dependency mà không kiểm bundle size; không sửa `manifest.json` mà không test Chrome thật. Chrome API: cite https://developer.chrome.com/docs/extensions/reference/
- Đổi `src/` → update `docs/2-architechture-system.md`; đổi `docs/` → update `docs/0-wiki.md`; quyết định kiến trúc → `docs/adr/`.
- Ship: `npm run build && npm run ship:dist` → release Google Drive (config: `scripts/ship.config.json`).
- Commit message sạch — CẤM trailer `Generated with Devin`/`Co-Authored-By` hay bất kỳ attribution nào vào commit của Anh; không commit/in secrets; không xóa/force-push/drop khi chưa được phép rõ.
