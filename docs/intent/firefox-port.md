# Intent: Firefox port — dual-browser support (Chrome + Firefox)

> Slug: `firefox-port` · Mode: interactive · Source: user statement — "anh muốn extension phải dùng được cho lõi chrome và firefox"
> ui_surface: no          ← no new UI design; browser side panel dropped per owner (in-page subtitle panel is canonical)
> confidence: medium

## Business Case

| Concept | Statement | Evidence | Confidence |
|---|---|---|---|
| Need | Tihoka chỉ chạy trên Chromium — người dùng Firefox không thể cài/dùng; product phụ thuộc 100% vào một nền tảng duy nhất | `public/manifest.json` (MV3 Chrome-only keys: `service_worker`, `side_panel`, `offscreen`, `world`...); user statement | high |
| Change | Chrome-only build → build Firefox load được + báo cáo compat có evidence để quyết định port đầy đủ | user: "lên plan về chạy thử để có quyết định" | high |
| Solution | Spike-first port: manifest transform + runtime adapter guards → load trên Firefox ≥128 → smoke-test core journeys → blocker report → quyết định | adapters đã tách: `src/shared/lib/chrome-apis/offscreen.ts`, `sidePanel.ts` | high |
| Value | Đạt được audience Firefox + dữ kiện thật thay vì đoán khi quyết định invest port/migrate WXT/drop | ~130 call site `chrome.*` trong `src/` — chỉ chạy thử mới biết chỗ nào thật sự sập | medium |
| Stakeholder | Anh (product owner + sole dev); người học dùng Firefox | user statement | high |
| Context | Codebase MV3 trên Vite + @crxjs; Firefox bắt buộc ≥128 (`world:"MAIN"` chỉ có từ FF 128 — bugzilla 1736575); đích cuối = AMO public listing, platform = desktop + Android; Chrome lane không được regression | `vite.config.ts:207`; `public/manifest.json`; user answers 2026-09-26 | high |

## Stakeholders

| Group | Who | Their need re: this change | Capability/constraint |
|---|---|---|---|
| Team | Anh + agent | Build được, verify được, chi phí duy trì 2 lane chấp nhận được | `chrome.*` đã tập trung ở `src/shared/lib/chrome-apis/` + entrypoints — điểm chèn runtime branching sẵn có |
| Customer | Firefox desktop users (người học từ video/phụ đề) | Cài và dùng được core flow: capture phụ đề → download → Anki card | Chưa biết audience Firefox thật — spike trả lời feasibility trước, demand sau |
| Supplier/Dependency | Firefox extension APIs; web-ext tooling; AMO signing | `world:MAIN` ≥128, `background.page` event page, `storage.session` ≥115 | Firefox không có `offscreen`, không có `sidePanel`, từ chối `background.service_worker` — web-ext issue #2532 |
| Organization | Maintainers tương lai | Một SSOT manifest, diff transform rõ ràng, không fork codebase | Mỗi thay đổi manifest/permission sau này phải verify cả 2 lane |
| Regulator | Mozilla AMO policy | Đích cuối = AMO public listing → review chặt `<all_urls>` host permission, WASM, data practices; Android listing còn bị curated | Dev path (temporary add-on) không cần sign — spike không bị block; report phải đo AMO-readiness |

## Needs

| ID | Need (statement) | FURPS+ | Evidence/`[assumption]` | Confidence |
|---|---|---|---|---|
| N1 | Extension load được trên Firefox ≥128 mà không lỗi manifest | F | `background.service_worker` bị Firefox từ chối cài (web-ext #2532); cần `browser_specific_settings.gecko.id` | high |
| N2 | Core capture pipeline hoạt động trên Firefox — MAIN-world interceptors + subtitle capture | F | 5 script `world:"MAIN"` trong `public/manifest.json:40-97`; Firefox ≥128 hỗ trợ | high |
| N3 | Background logic chạy trên event page (`background.scripts`) thay service worker | F/R | `public/manifest.json:24-27`; Firefox không chạy MV3 SW | high |
| N4 | Heavy WASM work (ffmpeg/transmux/OCR/TTS/pronunciation) chạy được khi không có `chrome.offscreen` | F/P | `src/entrypoints/offscreen/` host 5 runner; Firefox event page có full DOM → có thể chuyển vào background hoặc hidden page | medium |
| N5 | Extension không crash khi `chrome.sidePanel` không tồn tại — surface này là dead code (subtitle panel in-page đã có sẵn), drop khỏi Firefox build | U | user redirect 2026-09-26: "không cần sidepanel, đó là dead code — đã có subtitle side panel rồi" | high |
| N6 | Chrome lane không regression — cùng SSOT manifest, cùng code | R | user: "dùng được cho lõi chrome VÀ firefox" | high |
| N7 | Compat/blocker report từ bản chạy thật để quyết định full port / WXT migration / drop | S | user: "chạy thử để có quyết định" | high |

## Scope

- **In:** dev-mode Firefox desktop load (temporary add-on qua `about:debugging`/`web-ext`); script transform manifest → `dist-firefox/`; runtime adapter guards (`offscreen` — và các API khác report phát hiện); `side_panel`/`sidePanel` **dropped** (dead code per owner); smoke-test core journeys trên Firefox ≥128; blocker/compat report artifact gồm **AMO-readiness** + **Android feasibility desk-check** (desk-check, không test device thật); giữ Chrome lane xanh.
- **Out:** AMO signing/listing submission; CI dual-build; Firefox Android device testing; Safari; redesign UI cho sidebar.
- **Non-goals:** migrate build system sang WXT (quyết định SAU khi có report); feature parity 100% mọi màn (OCR/TTS/SRS verify riêng nếu report cho phép); không đụng Chrome manifest lane.

## Workflow

Dev chạy `npm run build` (Chrome lane, unchanged), rồi `npm run build:firefox` — script đọc `dist/manifest.json`, emit `dist-firefox/` với manifest đã transform (`background.page` event page, `browser_specific_settings.gecko`, strip `side_panel` + keys Chrome-only). Dev mở Firefox ≥128 → `about:debugging` → Load Temporary Add-on → trỏ vào `dist-firefox/manifest.json`. Extension load; content scripts + MAIN-world interceptors inject trên trang video. User dùng in-page subtitle panel sẵn có, capture phụ đề, download — mỗi bước hoặc chạy hoặc log blocker vào report. Cuối: Anh đọc report → quyết định port đầy đủ / migrate WXT / drop.

## Journey

### AS-IS
1. Firefox user muốn dùng Tihoka — không có build nào cho Firefox, extension chỉ tồn tại dạng Chrome MV3.
2. Dev thử load `dist/` qua `about:debugging` → Firefox từ chối cài ngay: `background.service_worker is currently disabled`.
3. Giả sử vá được manifest, `chrome.offscreen`/`chrome.sidePanel` không tồn tại → video processing (5 WASM runner) và UI chính đều chết — nhưng không ai biết chính xác còn bao nhiêu chỗ nữa sập.
4. Quyết định đầu tư port hay migrate WXT hoàn toàn là phỏng đoán — ~130 call site `chrome.*` chưa có ai verify trên Firefox thật.

### TO-BE
1. Dev chạy `npm run build:firefox` → `dist-firefox/` emit với manifest hợp lệ cho Firefox (`background.page` event page, `gecko.id`, không `side_panel`/`sidebar_action`).
2. Dev load temporary add-on trên Firefox ≥128 → extension cài được, content script + 5 MAIN-world interceptors chạy trên trang video.
3. Dev verify subtitle panel in-page trên trang video; capture phụ đề YouTube, thử download video (WASM chạy trong event page), tạo Anki card — mỗi journey hoặc pass hoặc thành blocker có log cụ thể.
4. Compat report gom kết quả theo feature: works / degraded / broken + root cause, kèm AMO-readiness (review risk) và Android feasibility desk-check — nằm trong `tasks/reports/` (hoặc docs/reviews).
5. Anh quyết định bằng evidence: port tiếp cho parity, migrate WXT, hay drop Firefox — Chrome lane vẫn xanh suốt quá trình.

## Stories

- S1: As a Firefox desktop user, I want to install and use Tihoka so that I can capture subtitles and create cards — done when extension loads on Firefox ≥128 và core capture flow chạy được.
- S2: As the product owner, I want a compat report from a real Firefox run so that I can decide full port / WXT / drop — done when smoke matrix có evidence cho từng feature chính.
- S3: As a Chrome user, I want zero change so that my extension không hồi quy — done when Chrome gates (typecheck, unit, build, browser) vẫn xanh.

## Risks

| Risk | Type | Impact | Team's ability to respond |
|---|---|---|---|
| Firefox API gaps ngoài 3 cái đã biết (~130 chrome.* sites chưa audit hết) | hidden | Port cost lớn hơn dự kiến | Spike chính là công cụ phát hiện — report trước khi commit |
| Event page non-persistent kill giữa chừng job ffmpeg dài | internal | Download/transcode fail trên file lớn | Verify trong spike; fallback = dedicated visible tab hoặc keep-alive |
| WASM CSP khác trên Firefox (`wasm-unsafe-eval`) | external | onnxruntime/paddleocr/sql.js fail | Verify trong spike; manifest CSP per-browser transform |
| Dual-lane maintenance: mỗi manifest change verify 2 lần | operational | Drift Chrome↔Firefox | SSOT `public/manifest.json` + transform script deterministic |
| Browser side panel bỏ hẳn trên Firefox (dead code — in-page subtitle panel là canonical UI) | internal | Không có UI gap | Resolved per owner decision 2026-09-26 |
| Firefox Android: API set hạn chế, release chỉ cài extension trong curated list | external | Android có thể là no-go dù desktop ổn | Desk-check trong report; parity decision tính riêng cho Android |
| AMO review chặt `<all_urls>` + WASM | legal | Listing bị từ chối khi publish | AMO-readiness section trong report lượng hoá risk trước khi submit |

## Decision

go — staged: spike (N1, N7) trước, report quyết định có đi tiếp parity (N2–N5) hay không. Chrome lane (N6) là điều kiện cứng suốt item.

## Draft Acceptance Criteria

- [ ] `npm run build` Chrome lane unchanged; `npm run build:firefox` emit `dist-firefox/` load được bằng temporary add-on trên Firefox ≥128 không lỗi manifest.
- [ ] Compat report (`tasks/reports/firefox-port-compat.md` hoặc `docs/reviews/`) liệt kê từng feature: works/degraded/broken + evidence; có section AMO-readiness + Android feasibility.
- [ ] Chrome lane: typecheck + unit + build + browser smoke xanh sau mọi thay đổi adapter.
- [ ] Không có Chrome-only API call nào crash unhandled trên Firefox — fail đều có fallback hoặc log rõ.
