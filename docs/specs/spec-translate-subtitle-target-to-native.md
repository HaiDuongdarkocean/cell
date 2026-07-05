# Spec: Translate Subtitle Target → Native (Background Prefill)

> Phase G1 — Specification. Input: `docs/intent/intent-translate-subtitle-target-to-native.md` + `docs/mockups/mockup-translate-subtitle-target-to-native.html` (v6).
> Cite mockup: §F1 render như mockup section "Popup Settings" + "Keyboard Shortcuts tab" + "Overlay Default" + "Error Toast" (`docs/mockups/mockup-translate-subtitle-target-to-native.html`).

## Objective

Dịch subtitle từ ngôn ngữ **target** (gốc video, vd en) sang ngôn ngữ **native** (tiếng mẹ đẻ, vd vi) hiển thị song song trên player, **real-time khi xem** — khi site **không** cung cấp track native. Áp dụng cho **mọi site** extension đã support detect subtitle.

**User story**: Anh yêu xem video tiếng Anh trên bất kỳ site nào, muốn song ngữ Anh–Việt mà site không có track Việt → extension tự dịch lấy từ target track, hiển thị overlay song ngữ. User vào và học thôi, không quan tâm setting.

**Why now**: Extension đã có bilingual overlay infrastructure (ADR-013/014: 2 overlay div, `loadBilingualCues(targetCues, nativeCues)`). Chỉ thiếu nguồn `nativeCues` khi site không có track native → dịch lấy từ target.

## Tech Stack

- **Runtime**: Chrome Extension MV3 (manifest v3)
- **UI**: React 19, Zustand 5, TypeScript 6
- **Build**: Vite 8 + @crxjs/vite-plugin
- **Translation**: Google Translate unofficial endpoint (`translate.google.com/translate_a/single?client=gtx`) — fetch qua MV3 background service worker (CORS bypass)
- **Testing**: Jest 30 (unit + integration), Playwright (E2E)
- **No new dependency** — dùng `fetch` + `URLSearchParams` + `JSON.parse` stdlib

## Commands

```
Build:            npm run build
Typecheck:        npm run typecheck
Test (all):       npm test
Test unit only:   npm run test:unit         # ~3s, day-to-day
Test integration: npm run test:integration
Test watch:       npm run test:watch
Coverage:         npm run test:coverage
Lint:             npm run lint
Lint fix:         npm run lint:fix
E2E:              npm run test:e2e
```

> `npm test -- --testPathPattern=` deprecated in jest 30 → dùng `--testPathPatterns=`.

## Project Structure

```
src/
├── features/translate/                    # NEW feature (FSD screaming architecture, ADR-016)
│   ├── service/
│   │   ├── translateService.ts            # Pure: parseGoogleResponse(response) → string[]
│   │   └── translateService.test.ts       # Unit test (mock response)
│   ├── logic/
│   │   ├── translateChunker.ts            # Pure: chunkCuesByCharBudget(cues, indices, budget) → number[][]
│   │   ├── translateChunker.test.ts       # Unit test
│   │   ├── translatePrefill.ts            # Stateful: BackgroundPrefillController (queue + cache + guards)
│   │   └── translatePrefill.test.ts       # Unit test (mock fetch)
│   └── index.ts                           # Public API exports
├── features/subtitle/
│   ├── service/subtitleService.ts         # MODIFY: findSubtitlesForOverlay — thêm flag nativeTrackExists
│   └── logic/subtitleAutoLoad.ts          # MODIFY: trigger prefill khi native=null + autoTranslate ON
├── features/settings/ui/
│   └── SettingsDialog.tsx                 # MODIFY: thêm toggle field + shortcut row
├── shared/ui/
│   └── ShortcutInput.tsx                  # MODIFY: mở rộng support combo (Ctrl+Shift+Key)
├── entities/settings/types.ts             # MODIFY: thêm subtitleOverlayAutoTranslate + ShortcutAction 'toggle-translate' + KeyboardShortcut combo
├── entities/message/types.ts              # MODIFY: thêm 'TRANSLATE' MessageType + TranslatePayload
└── entrypoints/background/
    └── index.ts                           # MODIFY: thêm TRANSLATE handler (fetch Google, bypass CORS)

tests/unit/features/translate/             # Unit tests colocated
docs/specs/spec-translate-subtitle-target-to-native.md  # THIS FILE
docs/mockups/mockup-translate-subtitle-target-to-native.html  # Mockup v6
docs/intent/intent-translate-subtitle-target-to-native.md  # Intent
```

## Code Style

Functional components with hooks (no class). Named exports (no default). Colocate tests. Pure functions cho logic. TypeScript strict — no `any` without justification. Chrome API calls cite docs.

```ts
// translateService.ts — pure function, testable
export function parseGoogleResponse(response: unknown): string[] {
  // Google response: [[[<translated>, <original>], ...], ...]
  if (!Array.isArray(response) || !Array.isArray(response[0])) return [];
  return response[0].map((seg: unknown[]) => String(seg[0] ?? ''));
}

// translateChunker.ts — pure
export function chunkCuesByCharBudget(
  cues: SrtCue[],
  indices: number[],
  charBudget: number,
): number[][] {
  const chunks: number[][] = [];
  let current: number[] = [];
  let chars = 0;
  for (const i of indices) {
    const cueChars = cues[i].text.length;
    if (chars + cueChars > charBudget && current.length > 0) {
      chunks.push(current);
      current = [];
      chars = 0;
    }
    current.push(i);
    chars += cueChars;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}
```

## Testing Strategy

- **Unit** (`tests/unit/`, ~3s, no network):
  - `translateService.test.ts` — parseGoogleResponse với mock response (valid, empty, malformed)
  - `translateChunker.test.ts` — chunkCuesByCharBudget (edge: empty, single cue > budget, exact budget)
  - `translatePrefill.test.ts` — BackgroundPrefillController (mock fetch, test queue sequential, cache hit/miss, guards: play event, tab hidden, SPA nav clear, backoff)
  - `ShortcutInput.test.tsx` — combo capture (Ctrl+Shift+T), single-char backward compat
- **Integration** (`tests/integration/`): 1 test real Google endpoint (verify parse, mockable cho CI)
- **E2E** (Playwright): real YouTube video en → overlay vi xuất hiện, seek instant sau prefill, SPA nav clear, tab hidden pause
- **Browser verify** (MCP edge-devtools): real Edge trước commit (browser-facing code, stop-the-line)

## Boundaries

- **Always do**:
  - Run `npm run test:unit` + `npx tsc --noEmit` + `npm run lint` before commit
  - Browser verify trên real Edge/Chrome trước commit (browser-facing code)
  - Update `docs/2-architechture-system.md` khi add/remove/rename files (3 chỗ: tree, dependency table, function index)
  - Atomic commits: code ≠ docs (2 commit nếu touch cả 2)
  - Follow ADR-013/014 overlay pattern (loadBilingualCues, không invent overlay mới)
  - Pure functions cho logic (testable, no side effects)
- **Ask first**:
  - Thêm dependency mới (check bundle size)
  - Modify manifest.json (test real Chrome)
  - Change ShortcutInput atom (affects 5 existing shortcuts — backward compat)
- **Never do**:
  - Commit secrets / API keys (Google unofficial endpoint không cần key)
  - Persist translated cache to chrome.storage (privacy — per-session in-memory only)
  - Send subtitle data to any endpoint other than Google Translate unofficial
  - Block main thread (translate async, overlay sync O(log n))
  - Auto-translate when native track exists (native track thật ưu tiên)

## Success Criteria

### Functional (F)
- **F1**: Toggle "Auto-translate when native missing" trong SettingsDialog section "Subtitle Overlay", disabled khi overlay auto-load OFF. Default ON. Render như mockup section "Popup Settings".
- **F2**: Khi video 'play' event + autoTranslate ON + site không có track native → start background prefill (dịch từ cue 0, chunk 1500 chars, sequential 1.5s gap).
- **F3**: Khi native track exists → KHÔNG dịch (native track thật ưu tiên).
- **F4**: Seek → cache.has(seekIdx)? hiện ngay instant : dịch chunk [seekIdx, +1500 chars], resume sequential.
- **F5**: Tab hidden → pause queue. Tab visible → resume từ chunk đã dừng.
- **F6**: SPA nav → clear cache + cancel queue (reuse pattern `subtitleAutoLoad.ts`).
- **F7**: Google rate-limit/block → toast "Translation temporarily unavailable" + retry backoff (1s→2s→4s→give up). Target overlay không ảnh hưởng. Render như mockup section "Error Toast".
- **F8**: Shortcut Ctrl+Shift+T toggle auto-translate tạm thời (không đổi setting). Đặt trong Keyboard Shortcuts tab (Card 3). Render như mockup section "Keyboard Shortcuts tab".
- **F9**: ShortcutInput mở rộng support combo — tất cả shortcut input cùng width (pill radius-full, min-width = combo dài nhất). Single-char pill (←/→/R/O/P) align combo pill (Ctrl+Shift+T). Backward compat 5 shortcut cũ.
- **F10**: Translated cues feed vào `loadBilingualCues(targetCues, translatedCues)` — reuse path ADR-013/014, 0 thay đổi overlay code.

### Non-Functional (NF)
- **NF1**: Main thread per timeupdate < 2ms (gate + binary search overlay sync). Không lag 60fps.
- **NF2**: Memory < 100KB (cache Map<cueIndex, string> per-session, ~6000 cues × 50 chars = 300KB worst case 4h video = 0.03% RAM, không trim).
- **NF3**: Network ~400 requests trong 10 phút đầu (4h video), còn 3h50m = 0 request. Google unofficial OK (rate limit ~5000/day).
- **NF4**: Graceful degradation — Google block không crash extension, target overlay vẫn hoạt động.
- **NF5**: Privacy — subtitle là dữ liệu công khai, gửi Google Translate OK. Cache per-session in-memory, không persist, clear on SPA nav.
- **NF6**: Latency — cue đầu tiên hiện < 2s sau play (1 request chunk đầu). Sau 5-10 phút: seek instant toàn video.
- **NF7**: 0 setting cho translation params (chunk size, gap, budget hardcode) — đúng kim chỉ nam "user vào và học thôi".

### Acceptance Criteria (C — browser verify)
- **C1**: Real YouTube video en (no track vi) + autoTranslate ON → overlay song ngữ en-vi xuất hiện < 2s sau play. Verify Edge MCP.
- **C2**: Seek sau 5 phút prefill → native overlay hiện instant (cache hit). Verify Edge MCP.
- **C3**: SPA nav sang video khác → cache clear, không leak cues cũ. Verify Edge MCP.
- **C4**: Tab hidden 30s → queue pause. Tab visible → resume. Verify Edge MCP console log.
- **C5**: Toggle Ctrl+Shift+T → auto-translate tắt, native overlay ẩn. Toggle lại → bật. Verify Edge MCP.
- **C6**: Toggle "Auto-translate" OFF trong settings → không dịch dù native track thiếu. Verify Edge MCP.
- **C7**: Site khác YouTube (vd themoviebox.org) có subtitle en, không có vi → auto-translate hoạt động. Verify Edge MCP.
- **C8**: ShortcutInput combo pill render đúng — tất cả 6 shortcut input cùng width, combo Ctrl+Shift+T hiển thị key chips nằm ngang. Verify Edge MCP screenshot vs mockup.
- **C9**: Google block (mock 429) → toast "Translation temporarily unavailable", target overlay vẫn hiện. Verify Edge MCP.

## Open Questions

None — tất cả resolved trong G0 interview + G0.5 mockup review:
- Fallback UX: Toast + retry (confirmed)
- Toggle default: ON (confirmed)
- Cache scope: Per-session in-memory (confirmed)
- Chunk strategy: Background sequential prefill, char budget 1500, gap 1.5s (confirmed)
- Shortcut: Ctrl+Shift+T combo, mở rộng ShortcutInput (confirmed)
- General cho mọi site: confirmed (không chỉ YouTube)

## Dependencies

- **Reuse** (không new dep):
  - `findSubtitlesForOverlay` (subtitleService.ts) — trigger khi native=null
  - `loadBilingualCues` (subtitleOverlay.ts) — feed translated cues
  - `subtitleAutoLoad.ts` — SPA nav clear pattern
  - `subtitleToast.ts` — toast error
  - `ShortcutInput` atom — mở rộng (không invent mới)
  - `Toggle` atom — reuse y nguyên
  - Background SW fetch — CORS bypass (host_permissions đã có)
  - Message bus (ADR-003 tabId filter) — TRANSLATE message
- **New files**: 4 file trong `src/features/translate/` (service + logic + index + tests)
- **Modify**: 5 file (subtitleService, subtitleAutoLoad, SettingsDialog, ShortcutInput, settings/types, message/types, background/index)

## Risks

| Risk | Mitigation |
|---|---|
| Google block unofficial endpoint | Sequential 1.5s gap + exponential backoff (1s→2s→4s) + toast graceful degradation |
| ShortcutInput break 5 shortcut cũ | Backward compat: single-char → `{ctrl:false, shift:false, alt:false, key:'R'}`. Test tất cả 5 shortcut cũ pass. |
| Main thread lag | Translate async (await fetch), overlay sync O(log n) đã có. Chunk split O(k) với k≤200. |
| Memory leak 4h video | Cache per-session, clear on SPA nav. 300KB = 0.03% RAM, không trim. |
| CORS Google endpoint | Background SW fetch (MV3, host_permissions `<all_urls>` đã có) |
| Privacy subtitle data | Subtitle = public data. Cache in-memory only, không persist. Không gửi endpoint khác ngoài Google. |
