# Tihoka — Chrome MV3 extension: tải video + phụ đề + Anki card creator

## Cách ghi rule vào file này

- Format bắt buộc: `KHI <điều kiện nhận diện được> → <hành động cụ thể>`.
- KHI rule cần signature nhận diện → ghi kèm signature (vd `wrapper y=0 + parent BODY = keeper miss`).
- Cấm mệnh đề trừu tượng không chỉ ra hành động ("nên cẩn thận", "ưu tiên chất lượng").
- KHI một dòng chứa nhiều ý/mệnh đề → tách thành nhiều dòng, mỗi dòng đúng một ý, mỗi dòng tối đa 200 ký tự.
- KHI rule check được bằng máy → viết hook (`.devin/hooks.v1.json` + `scripts/hook-*.mjs`) phải test lại xem hook có hoạt động đúng không, không ghi text ở đây.
- KHI thêm rule → gộp hoặc xóa rule cũ bị trùng/mờ.
- KHI vượt điều kiện → gọt trước khi ghi: đặt 5 câu hỏi (5 Whys) cho nội dung sắp ghi và nội dung đang có, xóa phần ít giá trị nhất theo tư duy nguyên bản — cấm nhồi.

## Mandate

- KHI chưa có giả định + plan → chưa được chạm code.
- KHI sửa → sửa ở gốc, không vá triệu chứng.
- KHI autonomous pipeline (`idea-pick-off all`, mode `all`) → tự làm tới cùng, chỉ dừng ở gate pipeline tự bắt.
- KHI work ad-hoc và yêu cầu chưa rõ → PHẢI hỏi trước khi sửa; đã rõ → tự làm tới cùng.
- KHI destructive/credentials/đổi scope/đụng shared UI → hỏi Anh trước ở mọi mode.
- Không viết comment trong code — code tự giải thích qua naming/cấu trúc.
- Gọi user "Anh yêu", xưng "em".
- Trả lời câu ngắn, từ đơn giản (ASD-STE100 ~80%).
- KHI giải thích hệ thống nhiều thành phần → vẽ sơ đồ.
- KHÔNG làm MVP: feature phải ship được (edge cases, i18n, a11y, persist state, polish); "V1 tối giản" chỉ khi Anh nói rõ.

## Workflow

- KHI nhận task → route qua skill `using-agent-skills`; task đổi → re-route.
- KHI feature work → pipeline `analyze → specify → design (UI) → deliver` qua skills `pipeline-*`.
- KHI đụng `tasks/pipeline-state.json` → chỉ qua `scripts/pipeline-state.mjs`, không sửa tay.
- KHI định danh pipeline → `Tihoka_AGENT_ID` env hoặc `--owner <id>`.
- KHI item có owner khác → không mutate state, không đụng files của nó; cần chuyển hướng → `request-handoff`.
- KHI thấy dirty/uncommitted file không phải mình tạo → in-flight work của agent khác — không stash/commit/edit đè.
- KHI worktree có `.Tihoka-owner` khác mình → tuyệt đối không ghi vào.
- KHI cần context → đọc theo nhu cầu: `docs/1-share-language.md` cho thuật ngữ, `git log`/`ls` cho map repo.
- KHI thấy `LESSONS matched` (hook-lessons inject) → đọc `.agents/skills/learning-and-apply/experience/<id>.json` TRƯỚC khi sửa.
- KHI fix bug verify xong và root cause tái dùng được → viết atom `experience/<id>.json` + entry `index.json` + chạy `learning-and-apply/scripts/validate.cjs`.
- KHI sửa bug → tái hiện end-to-end trên môi trường thật trước — chưa thấy bug chạy thì chưa sửa.
- KHI viết test cho bug → viết sau reproduce và test phải fail khi bug còn đó.
- KHI đụng shared hàm/type/field → grep hết callers + trace blast radius trước; đổi contract → migrate tất cả producers/consumers trong cùng commit.
- KHI xong code → `npm run typecheck && npm run test:unit && npm run build` → verify Chrome thật → commit.
- KHI UI đổi hình thái/tương tác → bắt buộc ảnh chụp before/after hoặc pixel-scan (DOM rect/computed không đủ — element đúng rect vẫn có thể không paint).
- KHI đụng `subtitleSplitView.ts`, `findPlayerContainer.ts`, `mountSubtitle.tsx`, `SubtitlePanel*.tsx` → re-verify `docs/specs/subtitle-split-view-ac.md` + `run.mjs youtube spamVerify` sau build.

## Debug sai đường — signature đã trả giá

- `wrapper y=0 + parent BODY` = slot keeper miss → shell out-of-flow thì wrapper chiếm in-flow slot host reserve, không `position:fixed`, không cắm DOM spot của shell.
- Overlay đúng z-index vẫn bị chặn hit-test = kẹt trong stacking context thấp → mount lên shared parent, không vá z-index.
- Mental model: extension = nhiều **context** độc lập (SW, content script mỗi frame, pages, main-world iife) + web security model (origin → rào document, OOPIF → process riêng, world → rào trong một document).
- `page.frames()` không list OOPIF + `evaluate` page-level không chạm frame cross-origin → attach CDP browser-level `Target.attachToTarget` vào target của iframe, hoặc `iframeEl.contentFrame()` trong Playwright.
- Cần evaluate trong content-script world của frame → lọc `Runtime.executionContextCreated` theo `name==='Tihoka'` + `auxData.frameId`; context list trộn mọi frame nếu không filter.
- Element probe trả "không tồn tại" → check creator ghi `id` hay `tagName` trước khi kết luận (`#Tihoka-subtitle-root` là id — tag selector false-negative, đã phí một session debug).
- Iframe render + video play mà zero Tihoka artifact → injection cho frame tạo-động lazy; poll marker (`#Tihoka-subtitle-root`, `native-caption-hide`) trước khi kết luận inject fail.
- Frame `ep_id` tự rotate → frame handle + context stale giữa chừng; re-query handle mỗi iteration, không cache.
- Sau `build` + ext reload mà trang cũ báo `ERR_FILE_NOT_FOUND assets/*loader*` → trang giữ loader hash cũ; reload page, không phải bug code mới.
- Per-site setting đọc trong child frame → key theo `ancestorOrigins` top origin; `location.href` trong iframe = embed domain → key sai vĩnh viễn, user toggle không bao giờ ăn.
- Gate OR nhiều level key (`frameUrl || topOrigin`) → entry stale ở level xa override toggle hiện tại; chọn priority tường minh (child → top origin độc quyền, frameUrl chỉ fallback).
- Child frame cần top page identity → `location.ancestorOrigins[last]` hoặc `document.referrer` đủ; không cần postMessage hỏi top.

## Code conventions

- Function component + hooks; named export; cấm `any`; SSOT; cấm hardcode.
- Code như vi khuẩn: ngắn, module độc lập; mimic style xung quanh; sửa đúng chỗ cần sửa.
- KHI viết logic non-trivial → để lại 1 runnable check/test.
- Algorithm: chính xác > performance > maintain > scale; tối đa O(n).
- KHI sửa UI → token ở `tokens.json`; component từ `src/shared/ui/`; icon từ `ICON_CATALOG`; sửa markup trước khi vá CSS.
- KHI cần dropdown/menu/list chọn → `<Menu>` + `<MenuItem>` + `<MenuSeparator>`.
- KHÔNG tự viết `.menuSurface`/`.menuItem`; KHÔNG nhét list vào `<Popover variant="toolbar">`.
- KHI thấy pattern đã có exemplar → đưa lên `shared/ui` rồi reuse.
- KHI đụng API component `src/shared/ui/` hiện có → hỏi Anh trước.
- KHI verify overlay/menu mới → chụp cạnh instance canonical + kiểm anchor sau scroll/gần mép; lệch quan sát được = defect phải fix.
- KHI code trong shadow-DOM surface (`mountReactShadow`) → focus/selection qua `el.getRootNode()`, outside-click qua `composedPath()`, Escape qua `pushEscapeLayer`.
- Persona: 5–80 tuổi, mọi thiết bị, RAM ≥1GB → responsive, cross-browser, phản hồi <3s.

## Output hygiene

- KHI tạo file → đúng thư mục cùng loại: test → `tests/`, plan → `tasks/`, docs → `docs/`, script → `scripts/`, mockup → `src/entrypoints/mockup-<slug>/`, scratch → `tmp/<task-slug>/` (gitignored).
- KHI trước commit → check `git status`.
- KHI file lạ ở root → dời/xóa, KHÔNG vá `.gitignore` cho one-off.
- KHI file lạ không phải mình tạo → check `git ls-files` + imports trước khi đụng.
- Skill chỉ sống ở `.agents/skills/`.
- KHI tạo thư mục con mới trong `docs/`, `tasks/`, `tests/` → check nhóm hiện có trước; KHÔNG tạo nhóm mới ngoài canon.

## Environment quirks

- Chrome 137+/Windows block `--load-extension` + `external_crx` → test extension qua `testing-extension-browser` (.crx + cloned profile) hoặc `testing-browser-with-profile` (Brave debug window).
- `browser_preview` proxy hỏng trên Windows → đưa user URL dev server gốc.
- `npm run mock` serve tất cả mock sites (KHÔNG `--youtube`); `mock:stream` deprecated → `npm run dev` + entry URL.
- `import.meta.env.DEV` luôn false trong build → dev-seed check `MODE === 'development'` (`src/shared/lib/env/devMode.ts`).
- Google OAuth client ID ở `.env.local` → code đọc qua `import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID`; KHÔNG đọc/in/commit giá trị.
- `public/manifest.json` pin `"key"` → extension id `ifceodogdeeaacmdigljgmafnhkbfnia` cho mọi đường cài.
- KHÔNG regenerate/đổi key (đổi = user mất auto-update); `build-firefox.mjs` strip key cho Firefox.
- `redirect_uri_mismatch` = redirect URI `<ext-id>.chromiumapp.org` chưa whitelist trong Google Cloud Console — không phải bug code.
- Tin được `src/`, `docs/`; phải kiểm `manifest.json`, `package.json`, `dist/`, `project-reference/`.
- CẤM `robocopy /MIR` trên dir chứa `node_modules` (đi xuyên junction, đã wipe repo chính) → xóa `node_modules` trước rồi `git worktree remove`.

## Boundaries & updates

- KHI thêm dependency → kiểm bundle size trước.
- KHI sửa `manifest.json` → test trên Chrome thật.
- KHI dùng Chrome API → cite developer.chrome.com/docs/extensions/reference/.
- KHI quyết định kiến trúc → ghi `docs/adr/`.
- Ship: `npm run build && npm run ship:dist` → Google Drive (`scripts/ship.config.json`).
- Commit message sạch — CẤM attribution AI trong commit của Anh.
- KHÔNG commit/in secrets.
- KHÔNG xóa/force-push/drop khi chưa được phép rõ.
