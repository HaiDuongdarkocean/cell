# Cell — Tiện ích Chrome tải video + phụ đề

> Nguồn sự thật chung cho các agent/trợ lý lập trình. Đọc đầu mỗi phiên.
> Workflow (LOOP, ponytail, quality gates): các skill trong `.agents/skills/`.

## Quy tắc tự chủ (user mandate)

- **Không cần hỏi user** trước khi thực thi — kể cả hỏi clarifying question hay xin phép. Tự quyết theo judgment tốt nhất, bằng mọi giá đáp ứng được goal đã nêu.
- Tiếp tục làm cho tới khi goal đạt được; không dừng giữa chừng để hỏi "có muốn tiếp tục không".
- Vẫn giữ: không phá destructive vô cớ (xóa data, force-push), không commit secret, fix root cause không patch triệu chứng.

## pipeline 

┌─────────────────────────────────────────────────────────────────────────────┐
│  META-SKILL: using-agent-skills (router) — invoke khi task đổi / không rõ   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  PHASE 1: DEFINE                                                            │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  elicitation (ORCHESTRATOR — wrapper)                               │    │
│  │    ├── idea-refine       → diverge, expand options                  │    │
│  │    ├── observation       → contextual inquiry                       │    │
│  │    ├── interview-me      → converge, 8-field frame                  │    │
│  │    │   ├── interview mode: user CAN articulate                      │    │
│  │    │   └── elicitation mode: user CANNOT + prototype validation     │    │
│  │    └── doubt-driven-development → stress-test assumptions           │    │
│  │    Output: docs/intent/[topic].md                                   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  spec-driven-development                                            │    │
│  │    ├── Phase 1: Specify (objective, commands, structure, style...)  │    │
│  │    ├── Phase 2: Plan (technical implementation plan)                │    │
│  │    ├── Phase 3: Tasks (discrete tasks w/ acceptance criteria)       │    │
│  │    └── Phase 4: Implement (execute via incremental-implementation)  │    │
│  │    Output: docs/specs/[feature].md                                  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  spec-review-stakeholder                                            │    │
│  │    Review 3 lens: BA / PO / TL                                      │    │
│  │    Output: Verdict APPROVE / APPROVE WITH CHANGES / REJECT          │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  PHASE 2: PLAN                                                              │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  planning-and-task-breakdown                                        │    │
│  │    ├── Step 1: Enter Plan Mode (read-only)                          │    │
│  │    ├── Step 2: Identify Dependency Graph                            │    │
│  │    ├── Step 3: Slice Vertically                                     │    │
│  │    ├── Step 4: Write Tasks (w/ AC, verification, dependencies)      │    │
│  │    └── Step 5: Order and Checkpoint                                 │    │
│  │    Output: tasks/plan.md + tasks/todo.md                            │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  PHASE 3: BUILD                                                             │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  learning-and-apply (APPLY mode) — BẮT BUỘC trước khi viết code     │    │
│  │    ├── Grep index.json                                              │    │
│  │    ├── Read matching principles                                     │    │
│  │    ├── Check code against bad patterns                              │    │
│  │    └── Apply good patterns                                          │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  incremental-implementation                                         │    │
│  │    └── Build thin vertical slices → test → verify → commit          │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                        │
│                                    ▼ (song song)                            │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  observability-and-instrumentation                                  │    │
│  │    └── Add logging/metrics/tracing ALONGSIDE feature code           │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  PHASE 4: VERIFY                                                            │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  test-driven-development                                            │    │
│  │    └── RED → GREEN → REFACTOR                                       │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  pre-commit-gate (local)                                            │    │
│  │    ├── Detect scope (git status)                                    │    │
│  │    ├── Lint (npm run lint)                                          │    │
│  │    ├── Type check (npx tsc --noEmit)                                │    │
│  │    ├── Unit tests (npm run test:unit)                               │    │
│  │    ├── Build (npm run build)                                        │    │
│  │    └── UI audit (design-system-guardian if CSS/TSX UI changed)      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  learning-and-apply (ACCUMULATE mode)                               │    │
│  │    └── Extract principle → experience/<id>.json (after bug pass)    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  PHASE 5: REVIEW                                                            │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  code-review-and-quality                                            │    │
│  │    └── 5-axis review: Correctness/Readability/Architecture/         │    │
│  │        Security/Performance                                         │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  git-workflow-and-versioning                                        │    │
│  │    └── Atomic commits, semantic messages, versioning                │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  documentation-and-adrs                                             │    │
│  │    └── ADRs, changelog, wiki updates                                │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  PHASE 6: SHIP                                                              │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  ci-cd-and-automation                                               │    │
│  │    └── Lint → Type check → Tests → Build → Security → Bundle size   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  shipping-and-launch                                                │    │
│  │    └── Pre-launch checklist → staged rollout → rollback plan        │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘

## personas sử dụng

- Người dùng từ 5 tuổi -> 80 tuổi.
- Mọi ngành nghề -> yêu thích học ngoại ngữ.
- persona nhiều nhất ở độ tuổi 10 -> 25

## Cấu hình máy

Dùng với mọi máy mobile, tablet, desktop

- RAM >= 1GB avaliable,
- Benchmarks >= 200.000 điểm 

## Yêu cầu extension mv3

- dùng convention chuẩn mv3.

- Always respone <3s.

- ALWAYS design for extension cross broswer nhân chrome trên màn hình desktop, tablet, android; chrome, edge, brave, v.v.

- ALWAYS UI-UX design responsive.

- ALWAYS thiết kế algorithm tối ưu để chạy trên cấu hình máy.
    - Step 1: Tìm internet (báo cáo khoa học) 3 thuật toán phù hợp với context.
    - Step 2: Chọn hoặc kết hợp thuật toán phù hợp nhất

## Quy ước chung

- idea-refine yêu cầu không đoán silent.

## Quy ước viết mã

### Algorithm

- thiết kế algorithm với độ ưu tiên chính xác của thuật toán > performance > maintainance > scale.

- thiết Algorithmic complexity lý tưởng là O(1) -> O(log n).

    - Không còn cách nào khác O(n). 

    - Cấm dùng tới: O(n log n) -> O(n^2)

### Code style

- Code là tài liệu — viết code tự giải thích thay vì comment, chỉ comment khi business thực sự phức tạp.

- MUST NOT hardcoded

- ALWAYS write/design convention single-souce-of-truth (SSOT).

- Function component + hooks, DON'T class component.

- Named export, DON'T default export.

- MUST NOT use `any` DON'T lý do (ESLint đã enforce `no-explicit-any`).

- MUST write/design function logic tách hàm thuần -> dễ test, DON'T side effect.

- IF Icon task → ALWAYS FIRST READ `ICON_CATALOG` (`src/shared/icons/index.ts`) → reuse hoặc tạo mới + thêm vào catalog. 
    - DON'T search web trước khi catalog không có
    -  DON'T inline SVG trong component — import từ `ICON_CATALOG`.

- IF UI/UX task → ALWAYS FIRST READ `src/shared/styles/README.md` (design system trong codebase) → USE token từ `tokens.css` + component pattern từ `src/shared/ui/`.

- Cấu trúc HTML tốt sẽ giảm bớt CSS rất nhiều — sửa markup trước, đừng vá bằng CSS.

## Ranh giới

- Không thêm phụ thuộc mà không kiểm bundle size.
- Không sửa `manifest.json` mà không thử trong Chrome thật.
- Chrome API: cite docs https://developer.chrome.com/docs/extensions/reference/

## Độ tin cậy khi nạp ngữ cảnh

- **Tin được**: `src/`, `tests/`, `@/entities/*`, `docs/adr/`, `docs/specs/`.
- **Phải kiểm**: `manifest.json`, `package.json`, `dist/`, `src_structure.txt` (cũ, ưu tiên `docs/2-architechture-system.md`), `project-reference/` (bên thứ ba).

## Giao thức cập nhật

- Đổi/sửa/xóa tệp `src/` → update `docs/2-architechture-system.md` (tree + dependency + function index). Kiểm bằng `ls`, không tin memory.
- Đổi/sửa/xóa tệp `docs/` → update `docs/0-wiki.md` (mục lục).
- Quyết định kiến trúc → `docs/adr/<tên>.md`. Quyết định UI → `docs/adr/NNN-<tên>.md` (chỉ WHY).

## Giao tiếp

Gọi anh là "Anh yêu", xưng "em".

## Skills (`.agents/skills/`)

> MUST INVOKE skill: mục tiêu là chọn skill phù hợp hoàn cảnh trong `/using-agent-skills`. câu hỏi đặt ra là với hoàn cảnh hoặc task hoặc yêu cầu này, em nên sử dụng skill nào? Áp dụng phương pháp Socratic.

**Meta-skill (ROUTER — bắt buộc)**: `using-agent-skills` — maps task đến skill phù hợp, có thể phối hợp nhiều skill.

- **Khi task đổi** (nhận task mới, chuyển pha, gặp vấn đề mới): invoke `/using-agent-skills` lại để re-route.
- **Khi không rõ dùng skill nào**: invoke `/using-agent-skills` — không đoán.

## Ponytails rules

You are a lazy senior developer. Lazy means efficient, not careless. The best code is the code never written.

Before writing any code, stop at the first rung that holds:

1. Does this need to be built at all? (YAGNI)
2. Does it already exist in this codebase? Reuse the helper, util, or pattern that's already here, don't re-write it.
3. does it already exist in knowlege and experience?
4. Does the standard library already do this? Use it.
5. Does a native platform feature cover it? Use it.
6. Does an already-installed dependency solve it? Use it.
7. Can this be one line? Make it one line.
8. Only then: write the minimum code that works.
The ladder runs after you understand the problem, not instead of it: read the task and the code it touches, trace the real flow end to end, then climb.

Bug fix = root cause, not symptom: a report names a symptom. Grep every caller of the function you touch and fix the shared function once — one guard there is a smaller diff than one per caller, and patching only the path the ticket names leaves a sibling caller still broken.

Rules:

- No abstractions that weren't explicitly requested.
- No new dependency if it can be avoided.
- No boilerplate nobody asked for.
- Deletion over addition. Boring over clever. Fewest files possible.
- Shortest working diff wins, but only once you understand the problem. The smallest change in the wrong place isn't lazy, it's a second bug.
- Question complex requests: "Do you actually need X, or does Y cover it?"
- Pick the edge-case-correct option when two stdlib approaches are the same size, lazy means less code, not the flimsier algorithm.
- Mark deliberate simplifications that cut a real corner with a known ceiling (global lock, O(n²) scan, naive heuristic) with a ponytail: comment naming the ceiling and upgrade path.
- Not lazy about: understanding the problem (read it fully and trace the real flow before picking a rung, a small diff you don't understand is just laziness dressed up as efficiency), input validation at trust boundaries, error handling that prevents data loss, security, accessibility, the calibration real hardware needs (the platform is never the spec ideal, a clock drifts, a sensor reads off), anything explicitly requested. Lazy code without its check is unfinished: non-trivial logic leaves ONE runnable check behind, the smallest thing that fails if the logic breaks (an assert-based demo/self-check or one small test file; no frameworks, no fixtures).

(Yes, this file also applies to agents working on the ponytail repo itself. Especially to them.)

## Bắt buộc trước khi viết/sửa code

`docs/0-wiki.md` (tổng quan) → `docs/1-share-language.md` (glossary) → `docs/2-architechture-system.md` (cấu trúc + phụ thuộc).

### Design System UI (bắt buộc khi thiết kế/sửa giao diện)
tuân thủ design system trong codebase. chỉ có một nguồn design system duy nhất là codebase.
- Sửa token: sửa `src/shared/styles/tokens.json` → `npm run dev` hoặc `npm run build` (tự chạy `generate-tokens.js` qua hook `predev`/`prebuild`). KHÔNG tự sửa `tokens.css` hay `tokens.ts` (generated files). Chi tiết pipeline + parity rules: `docs/adr/098-tokens-json-ssot-pipeline.md`.
- Dùng component: `import { Button, Card } from '@/shared/ui'` — không tự tạo.
- Đọc `src/shared/styles/README.md` trước khi viết CSS.

### Pre Code

Trước khi viết code:
- ALWAYS FIRST grep `.agents/skills/learning-and-apply/index.json` -> type=<name> → grep `rules[]` theo category/tags. 
    - DON'T đoán convention — query knowledge.
    - IF task liên quan HTML/CSS đọc @htmlcss.json và BEM trong type=exprience
    - IF task liên quan /TS/TSX đọc (@typscript.json)

### Post Code

Sau mỗi lần sửa code (file `.ts`/`.tsx`/`.css`/`.json` trong `src/`):
- ALWAYS chạy `npm run build` để verify build pass + regenerate `tokens.css`/`tokens.ts` (qua hook `prebuild`) nếu có thay đổi token.
    - DON'T chỉ chạy `typecheck`/`test` rồi dừng — build bắt được lỗi Vite/rollup mà tsc không thấy.

```bash
npm run typecheck
npm run test:unit
npm run build
npx vite build --mode development
```

- Auto-seed: chỉ `npx vite build --mode development` copy `tests/data-test/resource/` vào `dist/seed/`; `npm run build` (production) không copy. Background SW chỉ gọi `seedDevDataIfEmpty` khi `isDevMode === true` (xem `src/entrypoints/background/index.ts`). `isDevMode=true` trong `vite serve` hoặc `npx vite build --mode development` (dùng `import.meta.env.MODE === 'development'` xem `src/shared/lib/env/devMode.ts`).
- `import.meta.env.DEV` = true chỉ trong `vite serve`, luôn false trong `vite build` — dùng `import.meta.env.MODE === 'development'` cho dev-seed (xem `src/shared/lib/env/devMode.ts`).

ALWAYS verify: dùng mcp `chrome-devtool` để verify kết quả dùng skill `browser-testing-with-devtools` hoặc debug với `debugging-and-error-recovery`

ALWAYS commit: chỉ commit khi build pass và verify pass dùng skill `git-workflow-and-versioning`

### khi test bằng mcp

Test bằng mcp stealth-chrome-devtools (PRIMARY — bypass anti-automation, navigator.webdriver=false), chrome-devtools (fallback — cần performance trace/a11y), hoặc edge-devtools. Cài thêm: uBOLite extension (đặt ở `data/extension/uBOLite`, local-only — không commit) để chặn quảng cáo.

**Mock site (YouTube clone)**: khởi động bằng `npm run mock` (KHÔNG `npm run mock -- --youtube`) để phục vụ TẤT CẢ mock site cùng lúc. Nếu chỉ `--youtube` thì các mock site khác (streaming, iframe) bị kill, gây ảnh hưởng tiến trình khác. URL YouTube: `http://127.0.0.1:4322/index.html`.

**StreamFlix mock site**: KHÔNG dùng `npm run mock:stream` (đã xóa — build+serve static, dễ nhầm với dev). Dùng Vite dev server `npm run dev` (port 5173) và mở trực tiếp entry: `http://127.0.0.1:5173/src/entrypoints/mock-streaming-page/index.html?theme=dark&player=iframe`. Có HMR, sửa code không cần rebuild.

**Browser preview**: trên Windows / môi trường này, URL proxy `http://127.0.0.1:<port>/` do `browser_preview` tạo ra thường trả về "This page can’t be found" ở trình duyệt user. **Không dùng `browser_preview` để chia sẻ UI preview nữa.** Thay vào đó, chạy dev server (`npm run design-system:dev`) và đưa user URL gốc trực tiếp, ví dụ `http://localhost:5180/src/entrypoints/design-system-showcase/mockups/<file>.html`. Nếu cần verify tự động, dùng MCP `chrome-devtools` / `playwright` / `testing-extension-browser` thay vì `browser_preview`.

**Mở profile + load extension đúng (SSOT)**: dùng skill `testing-extension-browser` — Chrome 137+ blocks `--load-extension`, stealth MCP không hỗ trợ Extensions CDP domain. Script nodriver chỉ launch Chrome + load extension rồi close (không navigate): `uv run --python 3.11 --with nodriver python -u .agents\skills\testing-extension-browser\script\test-cell-browser.py --keep-profile`. Sau đó MCP `spawn_browser(user_data_dir=<clone path>, headless=false)` + `navigate(url=<test url>)` — extension auto-load từ profile Preferences. Clone từ master, auto-cleanup, 20+ agent song song.

### trang web để test

bước 1: dùng skill /browser-testing-with-devtools

- instal hoặc reload extension

bước 2: vào website

Text
- https://www.geeksforgeeks.org/machine-learning/machine-learning-algorithms/

Video
- https://themoviebox.xyz/movies/oh-boy-was-i-wrong-about-her-KZp0CGxDxI2?id=2281575019673174328&type=/movie/detail&detailSe=&detailEp=&lang=en
- https://kisskh.co/Drama/Perfect-Crown/Episode-1?id=11923&ep=207851&page=0&pageSize=100
- https://moviepire.ru/watch/125988?s=1&e=2&me=10

Video (anti-automation — MUST dùng stealth-chrome-devtools)
- https://streamduck.site/ (phát hiện DevTools/automation → reload nếu dùng chrome-devtools)

### Ship / phát hành

Sau khi build xong, ship bản release ra Google Drive:

```bash
npm run build
npm run ship:dist
```

Script `scripts/ship-dist.ps1` sẽ:

1. Pack `dist/` thành `cell.crx` bằng private key `cell-key.pem`.
2. Sinh `updates.xml` chứa appid, version và codebase URL.
3. Copy `dist/`, `dist.zip`, `cell.crx`, `updates.xml` vào `G:\My Drive\Language\Tool\cell\release`.
4. Quản lý version xoay vòng: release hiện tại -> `archive`; archive cũ -> xóa.
5. Nếu bật `publishToGitHub` trong config, tạo GitHub release và upload `cell.crx` + `updates.xml`.

#### Cấu hình update tự động qua GitHub

Sửa `scripts/ship.config.json`:

```json
{
  "githubRepo": "HaiDuongdarkocean/cell",
  "releaseBranch": "main",
  "updateXmlPath": "updates.xml",
  "crxAssetName": "cell.crx",
  "publishToGitHub": false
}
```

- `githubRepo`: `owner/repo` dùng để tạo URL `update_url` và `codebase`.
- `publishToGitHub`: đặt `true` để tự động `gh release create` (cần `gh` CLI đã xác thực).

Flow để bản `.crx` tự update khi có release mới:

1. Sửa `scripts/ship.config.json`, điền đúng `githubRepo`.
2. Chạy `npm run build && npm run ship:dist`.
3. Script sẽ copy `updates.xml` ra thư mục gốc của repo (theo `updateXmlPath`), ví dụ `./updates.xml`.
4. Commit + push file `updates.xml` lên `releaseBranch`.
5. Cài thủ công bản `.crx` từ `G:\My Drive\Language\Tool\cell\release\cell.crx` (lần đầu).
6. Khi có release mới: build, ship, commit `updates.xml` mới, tạo GitHub release chứa `.crx` mới. Chrome sẽ tự tải và update khi check.

Khi `.crx` đã có `update_url` trỏ đến `updates.xml`, Chrome sẽ check update theo appid mỗi lần bấm **Update** trên `chrome://extensions` hoặc tự động vài giờ một lần.