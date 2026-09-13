# Todo: Tech-Debt Remediation — Audit 2026-09-13

> Plan: `tasks/plans/plan-tech-debt-2026-09-13.md` · Audit: `docs/audits/20260913_src-features-entrypoints-shared.md`
> Status cập nhật: 2026-09-13 — Phase 1–6 done, e2e stage2 verified (2 env flakes). Residuals ghi cuối file.

## Phase 1 — Quick wins ✅

- [x] T1 `existsSync` guard `phraseMatchBenchmark.test.ts` + fix 4 unused vars `e2e/stage2/*` — `fa925589`
- [x] T2 Remove storage-write + injected debug seams (runtime.ts, ffmpegRunner.ts, patch-ocr-csp.mjs) — `eeb0e211`
- [x] T3 Remove `__cellBg` + `__CELL_SPLIT_VIEW_LOG` relay — `eeb0e211`
- [x] T4 Gate `data-cell-debug-media`, `__CELL_OCR_DEBUG_INIT`, `__CELL_OCR_TRACKS` sau `__CELL_DEBUG__` — `eeb0e211`; + `svLog` gate `a353a6e5`
- [x] T5 eslint `recommendedTypeChecked` + 66 fixes — `f89dd43e`
- [x] T6 Remove dead `USE_LEGACY_SUBTITLE` flag — `d662b108`

## Checkpoint 1 ✅
- [x] typecheck + lint + test:unit + build green

## Phase 2 — SW-state hardening ✅

- [x] T7 Characterization tests session restore — `91268603`
- [x] T8 `mediaMap` repopulate on restore (`loadSessionMedia` trước `loadSessionDownloads`) — `19ffedf6`
- [x] T9 Single `OffscreenManager` qua `ctx.offscreenManager`; `sendToOffscreen` handshake — `3681b6a9`, `014ea817`
- [x] T10 `isReady` invalidate sau send fail + idle close 5 phút + in-flight guard — `54ee8a67`
- [x] Arch doc update — `2cb1b156`

## Phase 3 — God-file decomposition ✅ (đẩy sớm trước T11)

- [x] `contentScriptController.ts` 1827→751 dòng — 7 commits `51ece70e`…`3a066405` (ctx factory pattern, characterization 15/15 giữ nguyên)
- [x] `SubtitlePanels.tsx` 1501→360 dòng — 8 commits `90e0b547`…`9cc3f33c` (modules mới KHÔNG qua barrel)

## Phase 4 — Layer boundary ✅ (phần rẻ của T11)

- [x] `dictionaryPopup/schema.ts` → `entities/message/dictionarySchemas.ts` (16 importers) — `cf96dee1`
- [x] `subtitleSearchTypes` → `entities/subtitle/`; `LookupRequest` → `entities/dictionary` — `b643cb64`
- [x] Theme inversions: `colorGenerator`/`contrastValidator` xuống `shared/lib`; `themeTokens`/`ShadowThemeProvider` lên `features/theme` — `8951b4c0`
- [x] eslint `no-restricted-imports`: cấm `shared/**` + `entities/**` import `@/features*` — `4b012961`

## Phase 5 — Message protocol ✅ (phần rẻ của T12)

- [x] Zod coverage 16 handlers thiếu (localPlayer×7, ocr×4, screenshot, settings×3, ttsDownload) — `60a2b77b`
- [x] `MessageBus.on()` throw on duplicate registration — `c52c5328`
- [x] `sender.tab.id` wins over `payload.tabId` (anti-spoof) — `9d9dbb3e`
- [x] `sendMessage` reject rõ "no receiving end" kèm type — `c3f659e4`
- [x] Arch doc — `bb19bab4`

## Phase 6 — Build + deps ✅ (phần rẻ của T13)

- [x] `patch-ocr-csp.mjs`: required-patch gate (dep update đổi minified names → build fail thay vì ship dist hỏng) + residual `new Function`/`eval(` scan — `534f697b`
- [x] Dependency review → `tasks/reports/phase6-dependency-review.md` — `d1ec9284`
- [x] Remove unused `gsap` — `bb6eed46`

## Verification

- [x] 4 gates xanh trên mọi checkpoint: typecheck · 479 suites/5647 tests · lint · build
- [x] `npm run test:e2e:full` — 36–38 pass; 2 fail là environmental flakes (themoviebox ad-redirect `nn125.com`; `:49` overlay-click timing flake — pass 4/5 runs kể cả cùng ordering). Đã reproduce bằng debug spec: `popupHost: true`.
- [ ] Real Chrome MV3 session qua `testing-extension-browser` (MCP stealth-chrome-devtools không có trong session này — cần verify tay hoặc session có MCP)

## Residual (multi-sprint — không làm trong session này)

- [ ] T11 phần còn lại: real barrels mọi feature + phá cycle `dictionaryPopup↔universalPanel↔cardCreator↔subtitle` (~16 deep imports / 13 files)
- [ ] T12 phần còn lại: message registry SSOT (type+schema+direction+owner một bảng)
- [ ] T13 phần còn lại: bỏ string-patching dần (upstream patch hoặc CSP-safe builds), unify vite configs, gỡ `cardCreatorTest`/`mockup-*` khỏi FULL_INPUT, cân nhắc opencv cv-only build (10.3MB chunk — hiện đã lazy)
- [ ] Deps: consolidate `unzipit`→`fflate` (check range-read semantics), gom `lucide-react`+`@phosphor-icons` về 1 icon lib
