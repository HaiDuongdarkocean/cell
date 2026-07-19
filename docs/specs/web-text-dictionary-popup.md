# Spec: Web-text dictionary popup — decouple from video presence

> Intent: `docs/intent/web-text-dictionary-popup.md` (confirmed 2026-07-20 via `/interview-me`).
> ADR: `docs/adr/046-web-text-dictionary-decouple.md`.

## Objective

**User story:** As a language learner reading web articles (blog, Apple HIG docs, National Geographic, video subtitles), I want to hover/click any word and see it highlighted with a popup dictionary, so that I can understand words in context without manually selecting text.

**What:** Dictionary popup hoạt động trên **bất kỳ trang web nào có text** (không chỉ trang có `<video>`). Hover/click vào 1 từ → trích xuất đúng sentence + target word tại vị trí con trỏ → **highlight target word trong trang** (visual marker giống native text selection) → popup dictionary hiện trong < 1s end-to-end.

**Why:** `WebTriggerController` (commit `865e391`, `231b688`, `cee1f30`) đã được build hôm 2026-07-19 nhưng là **dead code trên trang không video**. `wireDictionaryPopup` chỉ được gọi bên trong `contentScriptController` (subtitle overlay controller), controller này chỉ init khi `findAndInitOverlay` tìm thấy `<video>` ready. Trên Apple HIG / National Geographic (không video) → controller không init → trigger không attach → không popup, mọi mode đều fail.

**Out of scope (non-goals):**
- PDF (Chrome built-in PDF viewer là `chrome-extension://` page, content script `<all_urls>` không inject được — cần cơ chế riêng, effort tách biệt).
- EPUB / external book reader apps.
- Native app text outside the browser.
- Cross-origin `<iframe>` text (content script `all_frames` covers same-origin iframes; cross-origin blocked by CORS/SOP).
- `<input>`, `<textarea>`, `contenteditable` text (caret model khác text node thường; xử lý riêng nếu cần sau này).
- `<canvas>`, `<svg>` text.

## Tech Stack

- Chrome Extension MV3, TypeScript strict, Vite + CRXJS.
- Content-script isolated world (vanilla DOM, no React) — `WebTriggerController` + `popupShell` + `WordHighlight`.
- Background service worker — `lookupOrchestratorMulti` (IDB query, origin-isolated).
- Settings: `chrome.storage` via `loadSettings()` from `@/shared/lib/storage/settingsStore`.
- Shadow DOM popup: `popupShell.ts` (tokens.css + components.css + popupDictionary.css via `?raw`).

## Commands

```bash
Build:     npm run build          # prebuild chạy generate-tokens.js
Dev:       npm run dev            # CRXJS hot-reload
Typecheck: npx tsc --noEmit
Unit test: npm run test:unit      # ~3s, không mạng
Lint:      npm run lint
```

## Project Structure (files liên quan)

```
src/entrypoints/content/content-script.ts          # Top-level content-script — init WebTextDictionaryController ở đây, độc lập video
src/features/dictionaryPopup/controller/webTextDictionaryController.ts  # (new) Top-level popup state + lookup + highlight wiring
src/features/dictionaryPopup/trigger/webTriggerController.ts          # Web-text trigger (hover/click) — đã có, thêm highlight callback
src/features/dictionaryPopup/ui/wordHighlight.ts   # (new) Temporary word highlight in page DOM
src/features/dictionaryPopup/ui/popupShell.ts      # Popup Shadow DOM container — đã có
src/features/dictionaryPopup/ui/popupDictionaryController.ts  # Popup state machine — đã có
src/features/dictionaryPopup/logic/lookupOrchestrator.ts       # Background IDB lookup — đã có
src/entrypoints/background/handlers/lookup.ts      # LOOKUP_REQUEST handler — đã có
src/shared/lib/storage/settingsStore.ts            # loadSettings() + onStorageChanged — chrome.storage
src/features/settings/ui/DictionaryPopupSettingsPanel.tsx     # Settings UI (dp-enabled, dp-trigger-mode) — đã có
docs/intent/web-text-dictionary-popup.md           # Intent (confirmed)
docs/specs/web-text-dictionary-popup.md            # Spec này
docs/adr/046-web-text-dictionary-decouple.md     # ADR chính thức
```

## Architecture

### 1. Decouple from video presence

```
content-script.ts
  ├── WebTextDictionaryController (top-level, non-video pages)
  │     ├── WebTriggerController (document-level mousemove/mouseup)
  │     ├── WordHighlight (page DOM marker)
  │     └── popupDictionaryController state + popupShell
  │
  └── initContentScriptController(video) (video pages, unchanged)
        ├── SubtitleBlockController
        └── SubtitleTriggerController (token span hover/click)
              + reuses WordHighlight for token selection highlight
```

- `WebTextDictionaryController` init ở top-level `content-script.ts` khi `dpSettings.enabled`, **không** chờ `<video>`.
- Subtitle path giữ `contentScriptController` riêng, nhưng **không** tự init `WebTriggerController` ở đó nữa. `content-script.ts` truyền `webTextCtrl` instance vào `initContentScriptController(video, webTextCtrl)`. `SubtitleTriggerController` gọi `webTextCtrl.handleLookup(...)` và `webTextCtrl.showHighlight(tokenSpan)`.
- Như vậy chỉ còn **1 `WebTriggerController` instance** cho web text, và **1 `SubtitleTriggerController` instance** cho subtitle tokens. Không còn 2 `WebTriggerController` song song.

### 2. `WebTextDictionaryController` API (new file)

```typescript
export interface WebTextDictionaryControllerDeps {
  readonly container: HTMLElement; // document.body hoặc subtitle overlay container
  readonly cardCreatorSettings: CardCreatorSettings;
  readonly nativeLanguage?: string;
  readonly hasVideo: boolean;
  readonly video?: HTMLVideoElement;
}

export interface WebTextDictionaryController {
  readonly attach: (mode: TriggerMode) => void;
  readonly detach: () => void;
  readonly updateSettings: (settings: { dictionaryPopup: DictionaryPopupSettings; cardCreator: CardCreatorSettings; subtitleOverlayNativeLanguage?: string }) => void;
  readonly destroy: () => void;
  readonly handleLookup: (request: LookupRequest, requestId: string, anchorRect: DOMRect) => void;
  readonly cancelLookup: (requestId: string) => void;
  /** Highlight a token span (subtitle) or a Range (web text). */
  readonly showHighlight: (target: Range | HTMLElement) => void;
  readonly clearHighlight: () => void;
}

export function createWebTextDictionaryController(
  deps: WebTextDictionaryControllerDeps,
): WebTextDictionaryController;
```

- Controller quản lý `popupDictState`, `popupDictWasPlaying`, và `WordHighlight` instance.
- `handleLookup` gửi `LOOKUP_REQUEST`, pause video nếu `hasVideo`, gọi `showPopup` + `appendCandidate`, tích hợp `WordHighlight`.
- `handlePopupCardCreatorAction` / `handlePopupQuickAdd` được tách thành pure callbacks nhận `container` (document.body cho web text, subtitle overlay cho video) và optional `video`.
- Controller detach/reattach khi settings change (xem Lifecycle).

### 3. `WordHighlight` API (new file)

```typescript
export interface WordHighlight {
  /** Highlight a DOM element (subtitle token span) or a Range (web text). */
  show(target: Range | HTMLElement): void;
  /** Clear active highlight and restore original DOM. */
  clear(): void;
}

export function createWordHighlight(): WordHighlight;
```

- **Primary:** DOM wrap — tạo `<mark class="js-cell-word-highlight">` quanh `Range.extractContents()` rồi `insertNode`. Nếu `Range.surroundContents` được thì dùng; nếu throw `BAD_BOUNDARYPOINTS_ERR` (word split bởi inline tags) thì dùng `extractContents` + `insertNode`.
- **Fallback:** Overlay div — tạo 1+ absolute `<div class="js-cell-word-highlight-overlay">` dựa trên `Range.getClientRects()`, không động DOM text node. Dùng khi:
  - Range spans block-level boundaries (không nên xảy ra vì `extractSentenceContext` giới hạn trong block).
  - DOM wrap bị lỗi không mong muốn.
  - Text node nằm trong Shadow DOM closed (không thể wrap từ isolated world).
- **Element mode:** Với subtitle token span, chỉ thêm CSS class `.js-cell-word-highlight` (không động DOM structure).
- **CSS class:** `.js-cell-word-highlight` / `.js-cell-word-highlight-overlay` dùng token:
  ```css
  background-color: var(--color-primary-subtle);
  color: inherit;
  border-radius: var(--radius-xs, 2px);
  padding: 0 1px;
  transition: background-color var(--duration-100, 100ms);
  ```

### 4. Lifecycle / settings update

- Content script init:
  ```typescript
  let webTextCtrl: WebTextDictionaryController | null = null;

  async function initWebTextDictionary(): Promise<void> {
    const settings = await loadSettings();
    const dp = settings.dictionaryPopup;
    if (!dp?.enabled) {
      webTextCtrl?.destroy();
      webTextCtrl = null;
      return;
    }
    if (webTextCtrl) {
      webTextCtrl.updateSettings({
        dictionaryPopup: dp,
        cardCreator: settings.cardCreator ?? DEFAULT_CARD_CREATOR_SETTINGS,
        subtitleOverlayNativeLanguage: settings.subtitleOverlayNativeLanguage,
      });
    } else {
      webTextCtrl = createWebTextDictionaryController({
        container: document.body,
        cardCreatorSettings: settings.cardCreator ?? DEFAULT_CARD_CREATOR_SETTINGS,
        nativeLanguage: settings.subtitleOverlayNativeLanguage,
        hasVideo: false,
      });
    }
    webTextCtrl.attach(dp.triggerMode);
  }

  // Initial + settings change
  initWebTextDictionary();
  onStorageChanged((changes, area) => {
    if (area === 'local' && changes[STORAGE_KEYS.SETTINGS]) {
      void initWebTextDictionary();
    }
  });
  ```
  (Helpers `onStorageChanged` and `STORAGE_KEYS` từ `@/shared/lib/chrome-apis` and `@/shared/config/config`.)
- `updateSettings` tự động detach trigger cũ, cập nhật settings, attach trigger mới với mode hiện tại. Không cần destroy/recreate controller.
- `WebTriggerController.setTriggerMode` hiện tại bị broken (readonly deps, listeners cũ dùng mode cũ) → **không dùng**. Thay vào đó `WebTextDictionaryController` tạo `WebTriggerController` mới mỗi lần `attach`.

### 5. Subtitle path integration

- `content-script.ts` truyền `webTextCtrl` instance đã tạo ở top-level vào `initContentScriptController(video, webTextCtrl)`.
- `contentScriptController` dùng `webTextCtrl` với `container = overlay container`, `hasVideo = true`, `video = currentVideo`. Nếu `dpSettings.enabled` false thì không truyền controller, subtitle trigger không gọi popup.
- `SubtitleTriggerController` không tự render popup; thay vào đó gọi `webTextCtrl.handleLookup(request, requestId, anchorRect)` và `webTextCtrl.showHighlight(tokenSpan)`.
- Khi `dp.enabled` được bật lên trong khi video overlay đang active, cần re-trigger `initContentScriptController` với controller mới (giải quyết bằng cách gọi lại `findAndInitOverlay` hoặc relax `video === currentVideo` guard trong settings change handler).
- `WebTriggerController` (document-level) skip `.js-cell-token` để không double-trigger với subtitle token click/hover.

### 6. Double-trigger guard

```typescript
// webTriggerController.ts
private onMouseMove(e: MouseEvent): void {
  if (!modifierMatches(this.deps.triggerMode, e)) return;
  const target = e.target as HTMLElement | null;
  if (target?.closest('.js-cell-token')) return;      // subtitle token handled separately
  if (target?.closest('.js-cell-popup-host')) return; // our popup
  // ... caretRangeFromPoint
}
```

## Code Style

- Function component + hooks, named export, TypeScript strict, no `any`.
- BEM cho CSS, token từ `tokens.css` (SSOT — sửa `tokens.json` → `npm run build`).
- Colocate test: `webTriggerController.ts` → `webTriggerController.test.ts`; `wordHighlight.ts` → `wordHighlight.test.ts`.
- Vanilla DOM trong content-script (no React) — same as `subtitleUI.ts`, `popupShell.ts`.
- Ponytail: lazy senior — reuse existing helper/pattern, shortest working diff, no abstraction not requested.

## Testing Strategy

- **Unit test** (`npm run test:unit`):
  - `webTriggerController.test.ts` đã có 24 tests; thêm:
    - Skip `.js-cell-token` hover/click.
    - Modifier key matching (`hover-ctrl`/`shift`/`alt`).
  - `wordHighlight.test.ts` (new):
    - Wrap/clear `<mark>` cho continuous range.
    - Fallback overlay cho range split bởi `<em>`/`<strong>`.
    - Element mode (subtitle token span class).
    - Restore DOM sau `clear()`.
    - No highlight cho punctuation/whitespace.
  - `webTextDictionaryController.test.ts` (new):
    - `handleLookup` gửi message, render popup, pause video khi `hasVideo = true`.
    - Settings change detach/reattach.
- **Manual test** (browser via chrome-devtools MCP):
  - Apple HIG / National Geographic: hover/click 1 từ → highlight xuất hiện + popup đúng target + sentence + < 1s.
  - YouTube subtitle: token click/hover → highlight token + popup + pause video.
  - Settings change: đổi trigger mode trong Options, quay lại tab → behavior thay đổi không cần reload.
- **Latency measurement**:
  - `performance.now()` từ trigger đến `showPopup` winner render.
  - Log: trigger build, message round-trip, IDB query, popup render, highlight render.
  - Budget: cold-start ≤2s (phrase index hydrate), warm ≤1s.

## Boundaries

- **Always:**
  - `tsc --noEmit` clean + `npm run test:unit` pass trước commit.
  - Reuse `WebTriggerController`, `popupShell`, `popupDictionaryController` — không viết lại.
  - Token từ `tokens.css` (SSOT) — không hardcode CSS value.
  - Update `docs/2-architechture-system.md` khi đổi/sửa/xóa file `src/`.
  - Update ADR khi architecture decision thay đổi.
- **Ask first:**
  - Thêm dependency mới (check bundle size).
  - Đổi `manifest.json` (phải test Chrome thật).
  - Đổi schema `DictionaryPopupSettings` (migration).
- **Never:**
  - Commit secret/key.
  - Tự sửa `tokens.css` / `tokens.ts` (generated files).
  - Inline SVG trong component (dùng `ICON_CATALOG`).

## Rollout / Rollback / Monitoring

- **Rollout:** Merge → `npm run build` → install extension via chrome-devtools MCP → manual test Apple HIG + National Geographic + YouTube. No backend change.
- **Rollback:** Revert PR/commit. ADR captures decision, revert restores `contentScriptController` only. Feature flag `dp.enabled` allows instant disable without rollback.
- **Monitoring:**
  - Console `performance.now()` logs for trigger→popup latency.
  - Error logging: `console.error` for highlight wrap failures, lookup errors, invalid ranges.
  - Manual test checklist before merge.

## Success Criteria (testable)

### P0 — Must have (ship trước)

1. **Trang không video có popup:** Mở https://developer.apple.com/design/human-interface-guidelines/design-principles → enable Dictionary Popup trong Settings → hover (mode=hover) hoặc select (mode=click) 1 từ → popup hiện.
2. **Target word + sentence đúng:** Popup header hiển thị đúng từ tại vị trí con trỏ; context sentence là câu chứa từ đó (không phải cả paragraph).
3. **Highlight target word trong trang:** Khi hover/click lookup trigger, word/token được highlight với `.js-cell-word-highlight` (background `var(--color-primary-subtle)`), tự động clear khi popup dismiss hoặc trigger vị trí khác.
4. **5 trigger mode đều hoạt động:** Test `click` + `hover` + `hover-ctrl` trên Apple HIG; `hover-shift` + `hover-alt` smoke test.
5. **Không break subtitle path:** Trên YouTube video, subtitle token click/hover vẫn ra popup như trước, highlight subtitle token đúng.
6. **tsc clean + all unit tests pass (`npm run test:unit` exits 0).**

### P1 — Should have (ship cùng hoặc ngay sau P0)

7. **< 1s warm end-to-end:** Từ mouseup/hover-debounce đến winner entry render < 1000ms trên Apple HIG / National Geographic (cold-start ≤2s do phrase index hydrate).
8. **National Geographic:** Test trên https://www.nationalgeographic.com/animals (DOM phức tạp, nested article) → popup + highlight đúng.

### P2 — Nice to have (làm sau)

9. **Shadow DOM support:** Nếu 2 trang test dùng open Shadow DOM, `extractSentenceContext` và `WordHighlight` xử lý qua `composedPath()`.
10. **`user-select: none`:** Hover vẫn trigger trên text có `user-select: none` hoặc fallback sang selection mode.

### Failure paths (P0)

- **FP1:** Given user hovers over whitespace/punctuation, when trigger fires, then no highlight and no popup.
- **FP2:** Given target word is split across inline tags (`<em>ap</em>ple`), when highlight, then fallback to overlay or skip gracefully (no crash, popup vẫn hiện).
- **FP3:** Given IDB returns no result, when popup renders, then popup shows empty state, highlight vẫn tồn tại đến khi dismiss.
- **FP4:** Given settings `dp.enabled` is toggled off while popup open, when toggle, then controller detach, popup dismiss, highlight clear.
- **FP5:** Given user triggers new lookup at different word, when previous popup still open, then previous request cancel, previous highlight clear, new highlight + popup show.

## Open Questions / Decisions

1. **Latency budget 1s trên 1GB RAM:** Orchestrator comment ghi "≤1s budget on 4GB RAM". Trên 1GB RAM + first-load (phrase index hydrate từ IDB), có thể vượt 1s. **Decision:** Đo thực tế trên 2 trang test. Nếu first-load > 1s nhưng subsequent < 1s → accept (cold-start ≤2s). Nếu warm > 1s → optimize bằng (a) prefetch phrase index on page load, (b) render skeleton popup ngay khi trigger, (c) cache last N lookup results trong content-script memory.

2. **Word highlight implementation:** **Decision:** Chọn primary A (DOM wrap `<mark class="js-cell-word-highlight">`), fallback B (overlay div) khi range bị split bởi inline tags hoặc nằm trong Shadow DOM closed. Loại C (CSS Custom Highlight API) vì cross-browser support kém. Xem chi tiết trong ADR.

3. **Shadow DOM:** Cần inspect Apple HIG / National Geographic. Nếu có open Shadow DOM, dùng `composedPath()` để tìm text node + host. **Owner:** Implement/test phase. **Close condition:** manual test trên 2 trang pass.

4. **`user-select: none`:** Cần verify `caretRangeFromPoint` behavior trên Apple HIG. Nếu trả về null, fallback sang selection mode hoặc ignore. **Owner:** Test phase. **Close condition:** manual test.
