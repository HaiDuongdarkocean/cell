# Spec: Bilingual Subtitle Auto-Load

> PRD chi tiết — "what to build" (Giai đoạn 2 — Spec).
> Input: `docs/intent/intent-bilingual-subtitle-auto-load.md` (confirmed intent) + `docs/plan/plan-bilingual-subtitle-auto-load.md` (feasibility) + `docs/adr/007-bilingual-subtitle-auto-load.md` (architecture decisions).

## Objective

Mở rộng subtitle overlay auto-load từ 1 sub (target) thành 2 sub song ngữ (target + native), tự động phát hiện + load khi vào trang web có video.

**User story**: Là người học ngôn ngữ (Anh yêu), khi vào trang web có video + 2 subtitle (target en/zh + native vi), em muốn overlay tự hiện cả 2 dòng + panel list song ngữ, không cần thao tác manual, để đối chiếu target + native khi học.

**Success looks like**:
- Vào trang có video + 2 sub (target + native) → overlay tự hiện 2 dòng, panel list song ngữ, không thao tác manual.
- Vào trang có video + chỉ 1 sub (target hoặc native) → overlay hiện 1 dòng, sub thứ 2 đến sau → ghép bổ sung.
- Settings có 2 dropdown chọn target + native language.
- Tắt auto-load → toàn bộ auto-load path dừng.

## Tech Stack
- Chrome Extension MV3 (manifest v3)
- React 19 + Zustand 5 + TypeScript 6 (popup)
- Vite 8 + @crxjs/vite-plugin (build)
- Jest 30 (unit + integration)
- Playwright (E2E)
- ESLint 9 + Prettier 3
- Windows (PowerShell) — no bash heredoc

## Commands
```
Build:            npm run build
Typecheck:        npm run typecheck
Test unit:        npm run test:unit
Test integration: npm run test:integration
Lint:             npm run lint
Lint fix:         npm run lint:fix
E2E:              npm run test:e2e
```

## Project Structure (files mới + sửa)
```
src/
├── types/
│   ├── media.ts                    # SỬA: + subtitleOverlayNativeLanguage
│   └── message.ts                  # SỬA: + AUTO_LOAD_SUBTITLES, REQUEST_AUTO_LOAD_SUBTITLES, FETCH_SUBTITLE_CONTENT, AutoLoadSubtitlesPayload
├── constants/
│   ├── config.ts                   # SỬA: DEFAULT_SETTINGS + subtitleOverlayNativeLanguage = ''
│   └── messages.ts                 # SỬA: + MESSAGE_TYPES mới (nếu có list)
├── background/
│   ├── subtitleService.ts          # SỬA: findSubtitlesForOverlay (plural, trả target + native)
│   └── index.ts                    # SỬA: handler AUTO_LOAD_SUBTITLES push + REQUEST_AUTO_LOAD_SUBTITLES re-push + FETCH_SUBTITLE_CONTENT fallback
├── content/
│   ├── subtitleMerge.ts            # MỚI: mergeCuesForPanel(targetCues, nativeCues) → BilingualCue[]
│   ├── subtitleOverlay.ts          # SỬA: + loadBilingualCues(targetCues, nativeCues), runtime align 2 dòng
│   ├── subtitleUI.ts               # SỬA: overlay 2 span (target + native)
│   └── content-script.ts           # SỬA: listener AUTO_LOAD_SUBTITLES, cache, CORS fallback, REQUEST_AUTO_LOAD_SUBTITLES
├── popup/
│   ├── store/popupStore.ts         # SỬA: migration fill 'vi' + normalize invalid target lang
│   └── components/settings/
│       └── SettingsDialog.tsx      # SỬA: 2 CustomSelect (target + native), bỏ text input
tests/
├── unit/
│   ├── subtitleService.test.ts     # SỬA: test findSubtitlesForOverlay
│   ├── subtitleMerge.test.ts       # MỚI: test mergeCuesForPanel
│   └── subtitleOverlay.test.ts     # SỬA: test loadBilingualCues + runtime align
docs/
├── adr/007-bilingual-subtitle-auto-load.md  # MỚI (đã viết)
├── specs/spec-bilingual-subtitle-auto-load.md    # MỚI (file này)
└── test-reports/<date>-bilingual-subtitle-auto-load-mcp.md  # MỚI (Task 9)
```

## Code Style
Functional components + hooks (no class). Named exports (no default). Colocate tests. Pure functions cho logic. TypeScript strict mode — no `any` without justification. Chrome API calls cite official docs.

**Ví dụ style** (pure function merge):
```typescript
// src/content/subtitleMerge.ts
import type { SrtCue, BilingualCue } from '@/types/media';

/**
 * Merge 2 bộ cues thành BilingualCue[] cho panel.
 * Target làm xương; mỗi cue target → tìm cue native overlap lớn nhất tại cue.start.
 * Cue target không có native → nativeText = ''.
 */
export function mergeCuesForPanel(
  targetCues: readonly SrtCue[],
  nativeCues: readonly SrtCue[],
): BilingualCue[] {
  if (targetCues.length === 0) return [];
  return targetCues.map((target) => {
    const native = findBestNativeAt(target.start, nativeCues);
    return {
      index: target.index,
      start: target.start,
      end: target.end,
      targetText: target.text,
      nativeText: native?.text ?? '',
    };
  });
}

function findBestNativeAt(timeMs: number, nativeCues: readonly SrtCue[]): SrtCue | null {
  // Binary search hoặc linear scan — ponytail: linear scan (n ~ 1000, đủ nhanh)
  let best: SrtCue | null = null;
  let bestOverlap = 0;
  for (const cue of nativeCues) {
    const overlap = Math.min(cue.end, timeMs + 1) - Math.max(cue.start, timeMs);
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      best = cue;
    }
  }
  return best;
}
```

## Testing Strategy
- **Unit (Jest, ~3s)**: pure functions + logic. `mergeCuesForPanel`, `findSubtitlesForOverlay`, `loadBilingualCues` (mock video element), settings migration.
- **Integration (Jest, ~29s)**: không thêm (feature không cần network real).
- **Browser MCP (chrome-devtools)**: real Chrome, verify auto-load flow end-to-end. Bắt buộc cho content-script + popup UI.
- **Coverage**: mọi pure function mới có unit test. Mọi message handler mới có unit test. Browser MCP cho UI + content-script.

**Test cases bắt buộc**:
1. `mergeCuesForPanel`: perfect match, lệch timestamp, target > native, native > target, empty target, empty native.
2. `findSubtitlesForOverlay`: cả 2 có, chỉ target, chỉ native, không có, autoLoad off, cả 2 language empty.
3. `loadBilingualCues` + runtime align: cả 2 active, chỉ target active, chỉ native active, không có cue active.
4. Settings migration: field missing → fill `'vi'`, invalid target lang → normalize `''`.
5. Browser MCP: auto-load 2 sub, partial load, re-trigger sub thứ 2, CORS fallback, toggle off.

## Boundaries
- **Always do**:
  - Run `npm run test:unit` + `npx tsc --noEmit` trước khi commit.
  - Browser MCP verify cho content-script + popup UI.
  - Cite Chrome API docs (https://developer.chrome.com/docs/extensions/reference/).
  - Pass `tabId` trong message payloads (AGENTS.md rule).
  - Update `docs/2-architechture-system.md` 3 chỗ khi sửa file src/.
  - Ponytail PRE-FILTER trước TDD.
- **Ask first**:
  - Thêm dependency mới.
  - Sửa `manifest.json`.
  - Thay đổi message protocol hiện có (breaking change).
- **Never do**:
  - Commit `.env` hoặc secrets.
  - Log full subtitle URL (chỉ log language + format + cue count — ADR-007 D8).
  - Hardcode default `vi` cho tất cả user (default `''`, migration fill `'vi'` cho existing).
  - Phá flow `parseBilingualSrt` hiện có.
  - Smart-merge timestamp (out of scope V1).

## Success Criteria (testable)

### Functional
- [ ] **F1**: Settings có 2 `CustomSelect` (target + native). Default cả 2 `''`. Migration fill `'vi'` cho native khi field missing.
- [ ] **F2**: `findSubtitlesForOverlay(subtitles, settings)` trả `{ target, native } | null`. Null khi autoLoad off. Null khi cả 2 language empty. **Không null khi chỉ 1 language set** (trả sub khớp language đó, sub kia = null → partial load).
- [ ] **F3**: Background push `AUTO_LOAD_SUBTITLES` xuống content-script khi `PAGE_SCAN_RESULT` đến + autoLoad on + có sub khớp.
- [ ] **F4**: Content-script listen `AUTO_LOAD_SUBTITLES` → fetch + parse target + native → `loadBilingualCues` (overlay) + `mergeCuesForPanel` (panel).
- [ ] **F5**: Overlay hiển thị 2 dòng (target trên, native dưới). Runtime align mỗi `timeupdate`.
- [ ] **F6**: Panel list `BilingualCue[]`. Target làm xương + native best-effort. Khi target rỗng → fallback native xương (panel vẫn list để click seek native). Click cue → seek.
- [ ] **F7**: Khi chỉ 1 sub (target hoặc native) → overlay + panel hiện 1 dòng. Sub thứ 2 đến sau → re-render với `loadBilingualCues(targetCũ, nativeMới)` + `mergeCuesForPanel(targetCũ, nativeMới)` (không mất sub đầu, re-render toàn bộ). Auto-load và drag-drop là 2 flow độc lập — ai đến sau override overlay + panel, không accumulate cross-flow.
- [ ] **F8**: Content-script cache parsed cues theo URL. Re-trigger `PAGE_SCAN_RESULT` không re-fetch/re-parse.
- [ ] **F9**: Content-script fetch fail (CORS/403) → request background `FETCH_SUBTITLE_CONTENT` → background fetch → trả text. Vẫn fail → toast error, không crash.
- [ ] **F10**: Content-script init xong → gửi `REQUEST_AUTO_LOAD_SUBTITLES` → background re-push nếu sub đã detect.
- [ ] **F11**: Tắt `subtitleOverlayAutoLoad` → background không push MỚI. Overlay + panel giữ trạng thái hiện tại (không clear). User clear manual (drag-drop clear hoặc toggle overlay). Không phá session học đang diễn ra.
- [ ] **F12**: Drag-drop/import 1 file bilingual SRT → vẫn dùng `parseBilingualSrt` (flow cũ không phá).

### Non-functional
- [ ] **NF1**: `npm run test:unit` pass (≤ 5s).
- [ ] **NF2**: `npx tsc --noEmit` pass.
- [ ] **NF3**: `npm run lint` pass.
- [ ] **NF4**: Browser MCP test pass (real Chrome, console clean, screenshots overlay + panel).
- [ ] **NF5**: Runtime align overlay dùng 2 binary search (`findCurrentLine` từ `subtitleSync.ts`) cho target + native mỗi `timeupdate` (n ~ 1000 cues, 4 lần/giây fire — không degrade). Panel merge (`findBestNativeAt`) dùng linear scan 1 lần (render 1 lần, không hot path).
- [ ] **NF6**: Cache memory < 1MB cho 10 sub URL (sub text nhỏ).
- [ ] **NF7**: Không log full subtitle URL (security — ADR-007 D8).

### Acceptance (end-to-end)
- [ ] **A1**: Vào trang có video + 2 sub (target en + native vi) → overlay tự hiện 2 dòng + panel list song ngữ, không thao tác manual.
- [ ] **A2**: Vào trang có video + chỉ target sub → overlay hiện 1 dòng target. Native sub đến sau (lazy-load) → overlay + panel ghép bổ sung.
- [ ] **A3**: Vào trang có video + chỉ native sub → overlay hiện 1 dòng native.
- [ ] **A4**: Tắt auto-load trong settings → vào trang có video + sub → overlay + panel không auto-load.
- [ ] **A5**: Drag-drop 1 file bilingual SRT → overlay + panel hoạt động như cũ (flow không phá).
- [ ] **A6**: 2+ sub cùng target language → chọn sub đầu tiên khớp (V1, không dropdown).
- [ ] **A7**: Sub URL CORS fail → background fetch fallback → sub vẫn load. Vẫn fail → toast error.

## Data Flow

```
[Page load]
  ↓
[PageScanner scan DOM] → PAGE_SCAN_RESULT (videoUrls + subtitleUrls) → [Background]
  ↓
[Background: findSubtitlesForOverlay(subtitles, settings)]
  ├── autoLoad off → null (skip)
  ├── cả 2 language empty → null (skip)
  └── có match → { target, native }
  ↓
[Background: chrome.tabs.sendMessage(tabId, AUTO_LOAD_SUBTITLES, payload)]
  ↓ (nếu content-script chưa ready → receiving end does not exist)
  ↓
[Content-script: listener AUTO_LOAD_SUBTITLES]
  ├── check cache (Map<URL, cues>) → skip fetch nếu đã cache
  ├── fetch target URL (nếu chưa cache)
  │   ├── fail (CORS/403) → FETCH_SUBTITLE_CONTENT (background resolve relative URL từ tabUrl trước khi fetch) → [Background fetch] → text
  │   └── success → text
  ├── parse target (SRT/VTT/ASS; ASS → assToSrt convert) → SrtCue[]
  ├── fetch + parse native → SrtCue[]
  ├── controller.loadBilingualCues(targetCues, nativeCues) → [Overlay runtime align]
  │   └── re-render toàn bộ khi sub thứ 2 đến (không accumulate, override)
  ├── mergeCuesForPanel(targetCues, nativeCues) → BilingualCue[] → [Panel render]
  │   └── target rỗng → fallback native xương
  └── auto-show panel (docked)

[Auto-load vs drag-drop]
  ├── 2 flow độc lập
  └── ai đến sau override overlay + panel (không accumulate cross-flow)

[Content-script init]
  ↓
[REQUEST_AUTO_LOAD_SUBTITLES] → [Background]
  ↓
[Background: re-push AUTO_LOAD_SUBTITLES nếu sub đã detect]
```

## Error Cases

| Case | Behavior |
|---|---|
| autoLoad off | Background không push. Content-script không fetch/render. |
| Cả 2 language empty | `findSubtitlesForOverlay` trả null. Background không push. |
| Chỉ có target sub | native = null. Overlay 1 dòng target. Panel list target-only. |
| Chỉ có native sub | target = null. Overlay 1 dòng native. Panel list native-only (target xương rỗng → fallback native xương). |
| Không có sub khớp | `findSubtitlesForOverlay` trả null. Background không push. Overlay + panel trống. |
| Fetch target fail (CORS) | Fallback background fetch. Vẫn fail → toast error, không crash. Native vẫn load nếu OK. |
| Fetch native fail (CORS) | Fallback background fetch. Vẫn fail → toast error. Target vẫn load nếu OK. |
| Parse fail | Toast error, không crash. Sub đã load vẫn hoạt động. |
| Content-script chưa inject khi background push | `chrome.tabs.sendMessage` throw → background log, không retry. Content-script init xong → `REQUEST_AUTO_LOAD_SUBTITLES` → background re-push. |
| Re-trigger PAGE_SCAN_RESULT (SPA lazy-load) | Content-script check cache → skip fetch nếu URL đã load. Sub mới (URL chưa cache) → fetch + accumulate. |
| Timestamp lệch lớn giữa 2 sub | Panel: native best-effort, cue target không overlap → `nativeText = ''`. Overlay: runtime align độc lập, có thể không đồng bộ panel (intentional — ADR-007 D1). |
| 2+ sub cùng target language | Chọn sub đầu tiên khớp (V1, deterministic first-match). |
| Sub URL chứa signed token | Không log full URL (security — ADR-007 D8). Log chỉ language + format + cue count. |
| Toggle auto-load off khi đang hiển thị | Background không push mới. Overlay + panel giữ trạng thái hiện tại (không clear). User clear manual. |
| Sub URL relative (`/subs/en.vtt`) | Content-script resolve theo page origin (OK). Background `FETCH_SUBTITLE_CONTENT` handler cần absolute URL — background resolve từ `tabUrl` + relative URL trước khi fetch. |
| Sub format ASS | Auto-load hỗ trợ SRT/VTT/ASS. ASS → convert sang SRT (reuse `assToSrt`). Convert fail → toast error, skip sub đó. |
| Drag-drop + auto-load conflict | 2 flow độc lập. Ai đến sau override overlay + panel. Không accumulate cross-flow. |
| Sub URL relative + background fetch | Background resolve relative URL từ `tabUrl` (sender tab) trước khi fetch. Nếu không có `tabUrl` → skip, toast error. |

## Open Questions (resolved)
- **Q1 (toggle off clear)**: **Resolved** — Không clear, giữ trạng thái hiện tại. User clear manual. Lý do: không phá session học đang diễn ra. (F11 đồng bộ.)
- **Q2 (panel native-only)**: **Resolved** — Fallback native xương khi target rỗng. Panel vẫn list để click seek native. (F6 + ADR-007 D1 đồng bộ.)
- **Q3 (cache clear)**: **Resolved** — Clear khi content-script re-inject (tab navigate). Không clear khi toggle auto-load (preserve để toggle on lại nhanh).

## Out of Scope (V1)
- Dropdown overlay chọn sub khi 2+ sub cùng ngôn ngữ (V2).
- Persist sub preference theo URL/tab (V2).
- Smart-merge timestamp (nối cue khi lệch) (out of scope confirmed).
- Thay thế flow `parseBilingualSrt` (giữ 2 flow song song).
- Detect native language từ browser locale (V2).

## Future (V2)
- Dropdown overlay chọn sub mong muốn.
- Persist selected sub per URL.
- Detect native language từ `navigator.language`.
- Smart-merge timestamp (nếu demand).
