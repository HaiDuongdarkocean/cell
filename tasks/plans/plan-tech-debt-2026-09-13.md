# Implementation Plan: Tech-Debt Remediation — Audit 2026-09-13

> Source: `docs/audits/20260913_src-features-entrypoints-shared.md` (14 items, top score 4.20).
> Branch: `audit/tech-debt-2026-09-13` (worktree `Tihoka-audit`). Todo: `tasks/todos/todo-tech-debt-2026-09-13.md`.

## Overview

Trả nợ theo roadmap của audit: quick wins trước (debug seams + un-red gates + legacy flags), sau đó pay-down item #1 (MV3 SW-state fragility 4.20). Boundary enforcement (#2) và god-file decomposition (#4) là multi-sprint — plan ghi tasks nhưng không chạy trong session này.

## Architecture Decisions

1. Debug seams → **remove outright** khi chỉ phục vụ debug một lần (`__sendMessageDebug`, `__offscreenListenerMsg`, `__debugBroadcast`, `__TihokaBg`, `__Tihoka_SPLIT_VIEW_LOG`); **gate sau `__Tihoka_DEBUG__`** khi vẫn có giá trị chẩn đoán định kỳ (`data-tihoka-debug-media`, `__Tihoka_OCR_DEBUG_INIT`). `__Tihoka_OCR_TRACKS` `'*'` → post vào đúng origin thay vì gate.
2. `USE_LEGACY_SUBTITLE` → **xóa flag** (implementation đã chết — bật lên chỉ warn + mất overlay). Hai flag còn lại giữ nguyên vì còn implementation sống; chỉ gom về một config module nếu diff nhỏ.
3. SW-state: persist detected media vào `chrome.storage.session` (survives SW restart, không lộ ra disk) + repopulate `mediaMap` trong `performSessionRestore`. `OffscreenManager` → singleton per-service-owner + luôn `ensureOffscreenReady` trước send; `isReady` re-validate khi send fail; `closeOffscreenDocument` được gọi bởi idle TTL.
4. Characterization/contract test trước khi đổi behavior (mediaMap restore, OffscreenManager handshake). Commit type `debt:` / `fix:` theo git-workflow.

## Task List

### Phase 1: Quick Wins

- [ ] **T1: Un-red gates** — `existsSync` skip cho `phraseMatchBenchmark.test.ts` (pattern của 4 sibling fixture tests) + fix 4 unused vars `e2e/stage2/{split-view-edge,split-view-real}.spec.ts`. Verify: `npm run test:unit` green trên fresh clone, `npm run lint` clean.
- [ ] **T2: Remove storage-write + injected debug seams** — `runtime.ts` (`__sendMessageDebug`, `__TihokaSendMessage` hook), `ffmpegRunner.ts` (`__offscreenListenerMsg`, `__ffmpegBootstrap`, `__ffmpegScriptLoaded`), `patch-ocr-csp.mjs` (`__debugBroadcast` injection). Verify: grep 0 hits, `npm run build` pass.
- [ ] **T3: Remove background global seams** — `__TihokaBg` globalThis exposure + `__Tihoka_SPLIT_VIEW_LOG` relay (`background/index.ts:174-189,350`). Verify: grep 0 hits, typecheck pass.
- [ ] **T4: Gate content-script + OCR debug surfaces** — `data-tihoka-debug-media` writes + `GET_DETECTED_MEDIA` 5s×12 polling sau `__Tihoka_DEBUG__`; `__Tihoka_OCR_DEBUG_INIT` postMessage handler sau `__Tihoka_DEBUG__`; `__Tihoka_OCR_TRACKS` target origin thay `'*'`. Verify: production behavior không đổi khi flag off.
- [ ] **T5: eslint → `recommendedTypeChecked`** + fix fallout. Rollback signal: >60 errors → scope về `no-floating-promises` + `no-misused-promises` trên `src/` và ghi follow-up.
- [ ] **T6: Reconcile `USE_LEGACY_SUBTITLE`** — xóa flag + dead branch (warn-and-disable path), update docs.

### Checkpoint 1
- [ ] `npm run typecheck && npm run lint && npm run test:unit && npm run build` — all green
- [ ] `pre-commit-gate` pass; commit atomic per task

### Phase 2: SW-state hardening (item #1, score 4.20)

- [ ] **T7: Characterization test cho session restore** — pin `performSessionRestore` + `mediaMap` contract trước khi sửa.
- [ ] **T8: Repopulate `mediaMap` trên SW restart** — persist detected media `chrome.storage.session` tại write-points + restore trong `performSessionRestore`. Acceptance: queued download resume sau simulated SW restart không còn `"No media found"`.
- [ ] **T9: Consolidate `OffscreenManager`** — 3 rogue instances → 1 shared; mọi send đi qua `ensureOffscreenReady()`. Acceptance: cold-start send không còn race.
- [ ] **T10: `isReady` re-validation + idle close** — invalidate cached ready khi send fail; `closeOffscreenDocument()` được gọi bởi idle TTL. Acceptance: offscreen doc không resident vĩnh viễn.

### Checkpoint 2
- [ ] Unit tests green; e2e stage2 smoke (nếu có môi trường) hoặc manual verify note

### Phase 3: Boundary + god-file (multi-sprint — planned, not executed this session)

- [ ] **T11:** Real barrels cho mọi feature + dời `features/theme` deps khỏi `shared/` + gỡ `entities/message` feature import + phá cycle `dictionaryPopup↔universalPanel↔cardCreator↔subtitle` → eslint `no-restricted-imports`.
- [ ] **T12:** Message protocol SSOT (item #5): registry type+schema+direction+owner; zod ~15 uncovered types; enforce sender tabId; reject duplicate handlers; `sendMessage` distinguish no-chrome.
- [ ] **T13:** Build de-fragilize (item #6): bỏ string-patching dần, lazy-load opencv 10.3MB, unify vite configs, gỡ `cardCreatorTest`/`mockup-*` khỏi `FULL_INPUT`.
- [ ] **T14:** God-file decomposition tiếp (item #4) sau T11; extract `dictionaryPopup` domain assets (item #8) cùng T11.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Gỡ debug seam phá e2e/diagnosis workflow | Med | Gate sau `__Tihoka_DEBUG__` thay vì xóa khi còn giá trị; grep consumers trước khi xóa |
| `recommendedTypeChecked` sinh hàng trăm errors | High | Rollback về 2 promise rules trên `src/`; không force fix trong 1 task |
| mediaMap restore sai shape → download fail | High | Contract test trước (T7); persist đúng shape `mediaMap` đang dùng |
| OffscreenManager consolidation đổi timing | Med | Giữ API surface; chỉ đổi instance ownership + readiness gate |

## Open Questions

- `__Tihoka_SPLIT_VIEW_LOG`: split-view iframe bug đã fix chưa? (comment "Temporary — remove after split view iframe bug is fixed") — nếu chưa, gate sau `__Tihoka_DEBUG__` thay vì xóa.
