# Todo: Tech-Debt Remediation — Audit 2026-09-13

> Plan: `tasks/plans/plan-tech-debt-2026-09-13.md` · Audit: `docs/audits/20260913_src-features-entrypoints-shared.md`

## Phase 1 — Quick wins

- [ ] T1 `existsSync` guard `phraseMatchBenchmark.test.ts` + fix 4 unused vars `e2e/stage2/*`
- [ ] T2 Remove `__sendMessageDebug`/`__cellSendMessage` (runtime.ts), `__offscreenListenerMsg`/`__ffmpegBootstrap`/`__ffmpegScriptLoaded` (ffmpegRunner.ts), `__debugBroadcast` (patch-ocr-csp.mjs)
- [ ] T3 Remove `__cellBg` + `__CELL_SPLIT_VIEW_LOG` relay (background/index.ts)
- [ ] T4 Gate `data-cell-debug-media`+media polling, `__CELL_OCR_DEBUG_INIT` sau `__CELL_DEBUG__`; `__CELL_OCR_TRACKS` target origin
- [ ] T5 eslint `recommendedTypeChecked` + fix fallout (rollback: chỉ bật no-floating-promises/no-misused-promises trên src/)
- [ ] T6 Remove dead `USE_LEGACY_SUBTITLE` flag

## Checkpoint 1
- [ ] typecheck + lint + test:unit + build green; pre-commit-gate pass

## Phase 2 — SW-state hardening

- [ ] T7 Characterization test `performSessionRestore`/`mediaMap`
- [ ] T8 Persist detected media `chrome.storage.session` + repopulate `mediaMap` on restore
- [ ] T9 Single `OffscreenManager` + `ensureOffscreenReady` on every send
- [ ] T10 `isReady` re-validation on failure + idle TTL calls `closeOffscreenDocument`

## Phase 3 — Multi-sprint (planned)
- [ ] T11 Feature barrels + boundary enforcement (no-restricted-imports)
- [ ] T12 Message protocol SSOT
- [ ] T13 Build de-fragilize (opencv lazy-load, unify vite configs, clean FULL_INPUT)
- [ ] T14 God-file decomposition + dictionaryPopup domain extraction
