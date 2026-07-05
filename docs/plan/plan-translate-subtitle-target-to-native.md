# Plan: Translate Subtitle Target → Native (Background Prefill)

> Phase G2 — Implementation Plan (high-level). Input: `docs/specs/spec-translate-subtitle-target-to-native.md`.
> Cite spec: mỗi approach/risk/milestone maps to spec F1-F10, NF1-NF7, C1-C9.

## Approach

### Architecture (3 layer, reuse ADR-013/014 overlay)

```
┌─────────────────────────────────────────────────────────────┐
│ POPUP (React)                                               │
│  SettingsDialog                                             │
│   ├─ Toggle "Auto-translate when native missing" (F1)       │
│   └─ Keyboard tab: ShortcutInput combo Ctrl+Shift+T (F8,F9) │
└─────────────────────────────────────────────────────────────┘
                          │ chrome.storage
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ CONTENT-SCRIPT                                              │
│  subtitleAutoLoad (MODIFY)                                  │
│   ├─ native=null + autoTranslate ON → start prefill (F2)    │
│   └─ SPA nav → clear cache + cancel (F6)                    │
│  BackgroundPrefillController (NEW)                          │
│   ├─ chunk 1500 chars, sequential 1.5s gap (NF3)            │
│   ├─ cache Map<cueIndex, string> per-session (NF5)          │
│   ├─ guards: play event, tab hidden (F2,F5)                 │
│   ├─ seek → cache hit instant / miss → chunk (F4)           │
│   └─ feed loadBilingualCues(targetCues, translatedCues) (F10)│
│  SubtitleOverlayController (REUSE — 0 change)               │
│   └─ onTimeUpdate → findCurrentLine → updateOverlayText     │
└─────────────────────────────────────────────────────────────┘
                          │ chrome.runtime.sendMessage TRANSLATE
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ BACKGROUND SW (MV3)                                         │
│  TRANSLATE handler (NEW)                                    │
│   ├─ fetch translate.google.com/translate_a/single?client=gtx│
│   ├─ CORS bypass (host_permissions <all_urls> đã có)        │
│   └─ return parsed string[]                                 │
└─────────────────────────────────────────────────────────────┘
```

### Key decisions (cite spec)
- **Background sequential prefill** (spec F2, NF6) — dịch hết từ cue 0, không sliding-window
- **0 setting params** (spec NF7) — hardcode CHAR_BUDGET=1500, MIN_REQUEST_GAP_MS=1500
- **Toggle default ON** (spec F1) — auto-dịch khi native thiếu
- **Cache per-session in-memory** (spec NF5) — Map<cueIndex, string>, clear on SPA nav
- **ShortcutInput combo** (spec F9) — mở rộng atom, backward compat 5 shortcut cũ
- **Reuse loadBilingualCues** (spec F10) — 0 thay đổi overlay code

## Scope

### In scope (spec F1-F10)
- New feature `src/features/translate/` (4 file: service, chunker, prefill, index)
- Modify: settings/types, message/types, background/index, subtitleService, subtitleAutoLoad, ShortcutInput, SettingsDialog
- Tests: unit (translate service/chunker/prefill/ShortcutInput) + 1 integration (real Google) + E2E (Playwright)

### Out of scope (spec §Out of scope)
- Transcribe audio, download kèm subtitle, cloud API trả phí, multi-native, LRU trim, sliding-window

## Risk Mitigation

| Risk (spec) | Mitigation | Milestone |
|---|---|---|
| Google block unofficial (NF4) | Sequential 1.5s gap + backoff 1s→2s→4s + toast (F7) | M3 |
| ShortcutInput break 5 shortcut cũ (F9) | Backward compat: single-char → combo object. Test tất cả 5 cũ pass. | M5 |
| Main thread lag (NF1) | Translate async, overlay sync O(log n) đã có. Chunk split O(k) k≤200. | M3 |
| Memory leak 4h (NF2) | Cache per-session, clear SPA nav. 300KB = 0.03% RAM. | M3 |
| CORS Google (NF) | Background SW fetch, host_permissions đã có. | M2 |
| Privacy (NF5) | In-memory only, không persist, không gửi endpoint khác. | M3 |

## Milestones (high-level — task breakdown chi tiết ở G4)

| M | Name | Spec ref | Verify |
|---|---|---|---|
| M1 | Settings + message types | F1, F8 | tsc --noEmit |
| M2 | translateService + background TRANSLATE handler | F2 | unit test parseGoogleResponse |
| M3 | translateChunker + translatePrefill controller | F2-F6, NF1-NF3 | unit test chunker + prefill (mock fetch) |
| M4 | subtitleService + subtitleAutoLoad trigger | F2, F3, F10 | unit test trigger logic |
| M5 | ShortcutInput combo + SettingsDialog UI | F1, F8, F9 | unit test + browser screenshot vs mockup |
| M6 | Integration + E2E + browser verify | C1-C9 | Edge MCP real YouTube en→vi |

## Verification Checkpoints

| Checkpoint | After | Gate |
|---|---|---|
| CP1 | M1-M2 | tsc + unit test pass |
| CP2 | M3-M4 | unit test pass + lint |
| CP3 | M5 | unit test + browser screenshot match mockup v6 |
| CP4 | M6 | Edge MCP C1-C9 pass + npm run test:unit + tsc + lint |

## Parallel vs Sequential

- **Sequential**: M1 → M2 → M3 → M4 (dependency chain: types → service → prefill → trigger)
- **Parallel possible**: M5 (ShortcutInput + UI) independent M1-M4 → có thể làm song song M3-M4
- **M6 last**: integration + E2E cần tất cả M1-M5 xong

## Dependencies (no new dep)

- Reuse: `findSubtitlesForOverlay`, `loadBilingualCues`, `subtitleAutoLoad`, `subtitleToast`, `ShortcutInput`, `Toggle`, background SW fetch, message bus
- New files: 4 trong `src/features/translate/`
- Modify: 7 file (settings/types, message/types, background/index, subtitleService, subtitleAutoLoad, ShortcutInput, SettingsDialog)
