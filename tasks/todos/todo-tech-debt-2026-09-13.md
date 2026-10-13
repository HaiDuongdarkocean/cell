# Todo: Tech-Debt Remediation — Audit 2026-09-13

> Plan: `tasks/plans/plan-tech-debt-2026-09-13.md` · Audit: `docs/audits/20260913_src-features-entrypoints-shared.md`
> Status cập nhật: 2026-09-13 — Phase 1–6 done, e2e stage2 verified (2 env flakes). Residuals ghi cuối file.

## Phase 1 — Quick wins ✅

- [x] T1 `existsSync` guard `phraseMatchBenchmark.test.ts` + fix 4 unused vars `e2e/stage2/*` — `fa925589`
- [x] T2 Remove storage-write + injected debug seams (runtime.ts, ffmpegRunner.ts, patch-ocr-csp.mjs) — `eeb0e211`
- [x] T3 Remove `__TihokaBg` + `__Tihoka_SPLIT_VIEW_LOG` relay — `eeb0e211`
- [x] T4 Gate `data-tihoka-debug-media`, `__Tihoka_OCR_DEBUG_INIT`, `__Tihoka_OCR_TRACKS` sau `__Tihoka_DEBUG__` — `eeb0e211`; + `svLog` gate `a353a6e5`
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
- [ ] Real Chrome MV3 session qua `testing-extension-browser` Playwright persistent Chromium

## Phase 7 — Residuals đã xử ✅

- [x] Feature cycle → DAG: `dictionaryPopup` thành orchestrator một chiều; `cardCreator/subtitle/tokenize/dictionary/ocr/pronunciation/reader/srs/tts` = 0 imports; `universalPanel` chỉ giữ `ui/Dictionary` + `controller/panelBridge`; guardrail `no-restricted-imports` — `9253bcea`, `5da53576`, `03cbe2ef`, `2adb67e7`
- [x] Message registry SSOT: `entities/message/registry.ts` — 100 types → `{schema, direction, owner}` (79 có schema, 21 deliberately không); `MessageBus.on()` central reject-only validation; completeness test ép type mới đăng ký — `bacad23e`, `baedfe4a`

## Phase 8 — Residuals đợt 2 ✅

- [x] Dead message types: bỏ 10/11 candidates khỏi `MESSAGE_TYPES` + registry + `MessageType` union — `05f9d59a`. Giữ `LOOKUP_RESULT` (literal `'LOOKUP_RESULT'` sống trong worker requestId bridge — `entities/dictionary/popupTypes.ts` `WorkerMessageType` + `dictionaryPopup/worker/lookupWorkerHandler.ts`; transport postMessage riêng, không qua MV3 bus). CONVERT_TS_TO_MP4 v1 + `*_RESULT`/`FETCH_RESPONSE`/`QUICK_ADD`/`OCR_*_STATE`/`DETECT_MEDIA`/`EXTENSION_STATUS_UPDATE`/`GET_SUBTITLE_FOR_OVERLAY` đều zero-ref (kết quả offscreen đi qua `sendResponse`, không qua type riêng)
- [x] Cycle `settings↔{cardCreator,subtitle,audio}`: settings thành composition layer thuần — move `CardCreatorSettingsPanel`→`cardCreator/ui`, `ApiKeyManager`→`subtitle/ui`, `LocalPronunciationSettingsPanel`→`pronunciation/ui`; cạnh `settings→{dictionary,tts}` vốn đã một chiều. `cardCreator→pronunciation` là cạnh live (không phải cycle — pronunciation không import ngược). Guardrail `no-restricted-imports` cấm `@/features/settings` trong mọi feature trừ settings/universalPanel + cấm `@/features/cardCreator` trong pronunciation — `978fb248`
- [x] Deps verdict: **giữ `unzipit`** — `zipAudioResolver.ts` dựa vào lazy central-directory + per-entry slice reads trên File local (archive ~3.4GB); fflate `unzip`/`unzipSync` đòi toàn bộ archive trong `Uint8Array`, streaming `Unzip` vẫn phải scan tuần tự — không an toàn. **Giữ `@phosphor-icons/react`** — nav icons cố ý dùng Phosphor `fill` weight cho liquid-glass buttons (index.ts:8-9); lucide chỉ có stroke, không có fill-weight equivalent

## Residual (multi-sprint — không làm trong session này)

- [ ] T13 phần còn lại: bỏ string-patching dần (upstream patch hoặc CSP-safe builds), unify vite configs, gỡ `cardCreatorTest`/`mockup-*` khỏi FULL_INPUT, cân nhắc opencv cv-only build (10.3MB chunk — hiện đã lazy)
- [ ] Chunk-boundary tuning: `content-script.ts` entry 33→67KB sau DAG refactor (module hoist — total dist không đổi); `subtitle` chunk hấp thụ `mountCardCreatorDialog` (1.36MB)
- [ ] Real Chrome MV3 session qua `testing-extension-browser` Playwright persistent Chromium trước khi merge
