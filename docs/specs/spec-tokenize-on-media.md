# Spec: Tokenize on Media

> PRD chi tiết — "what to build" (Giai đoạn 2 — Spec).
> Input: `docs/intent/tokenize-on-media.md` (confirmed intent) + `docs/adr/047-viewport-lazy-tokenization.md` (architecture decisions) + `docs/ideas/tokenize-on-media.md` (refined idea).

## Assumptions

1. Feature này build trên extension Chrome MV3 hiện tại, dùng TypeScript strict, Vite, React 19 (popup/sidepanel/options), content script vanilla TS.
2. `Popup Dictionary` đã có sẵn (`features/dictionaryPopup`) và sẽ cung cấp message/endpoint để content script mở với từ được chọn + đổi status từ.
3. `WordHighlight` (`features/dictionaryPopup/ui/wordHighlight.ts`) là reference cho DOM wrap/overlay highlight; token spans sẽ dùng pattern tương tự nhưng thêm status underline + frequency bg.
4. `Subtitle` overlay/panel (`features/subtitle/ui/*`) cho phép inject token spans vào cue text mà không vỡ timing/layout.
5. Badge UI dùng design-system tokens (`tokens.json` → `tokens.css`) và `ICON_CATALOG` (`src/shared/icons/index.ts`); không tạo icon mới nếu catalog đã có.
6. Storage schema sẽ được mở rộng để lưu trạng thái tokenize per domain/URL; cần migration nếu schema version thay đổi.
7. Target user: người học tiếng Anh trên desktop/tablet/mobile; ưu tiên mobile UX.
8. Thiết bị 1GB RAM là hard constraint: không được eager tokenize toàn bộ page.

→ Correct me now or I'll proceed with these.

## Objective

Xây dựng tính năng **Tokenize on Media**:

- Khi user đọc trang web tiếng Anh, từ vựng được tokenize và highlight theo status/frequency ngay trong ngữ cảnh.
- Khi user xem video có subtitle, subtitle text cũng được tokenize tương tự.
- User điều khiển bật/tắt tokenize + layer Status/Frequency qua một **float badge** đơn giản.
- User đổi status từ (unknown/tracking/known/ignore) và tra cứu/IPA qua **Popup Dictionary** đã có sẵn.
- Thuật toán **Viewport-Driven Lazy Tokenization (VDLT) — Hybrid** đảm bảo UI mượt trên thiết bị 1GB RAM.

**User story**: Là người học tiếng Anh, khi đọc một bài báo hoặc xem video subtitle tiếng Anh, em muốn nhìn thấy từ vựng được đánh dấu status và độ phổ biến ngay trên trang, để nhận diện nhanh từ cần học mà không phải tra từ điển thủ công.

**Success looks like**:
- User nhấn float badge → mở mini panel → toggle **Tokenize page** → trang tokenize dần dần, không giật.
- Status/Frequency toggles độc lập ẩn/hiện các layer trên token.
- Desktop: hover token + phím `1/2/3/4` đổi status (batch với select nhiều từ rồi nhấn phím `1/2/3/4`).
- Mobile: tap token → mở Popup Dictionary với từ đã chọn.
- known/ignore: mặc định ẩn highlight, hover hiện status underline.
- Scroll/seek nhanh vượt quá vùng tokenize → text vẫn hiển thị plain, không nhảy dòng; tokenize xuất hiện khi dừng/có idle time.
- `npm run test:unit` và `npm run typecheck` pass; browser MCP verify không có console error/lag trên sample page.

## Tech Stack

- Chrome Extension MV3 (manifest v3)
- TypeScript 6 strict mode
- Vite 8 + `@crxjs/vite-plugin`
- React 19 + Zustand 5 (popup/sidepanel/options)
- Jest 30 (unit + integration)
- Playwright (E2E)
- ESLint 9 + Prettier 3
- Design system: `src/shared/styles/tokens.json` → `tokens.css`; `src/shared/ui` components; `src/shared/icons/ICON_CATALOG`

## Commands

```
Generate tokens:  node scripts/generate-tokens.js
Dev:              npm run dev
Build:            npm run build
Typecheck:        npm run typecheck
Test unit:        npm run test:unit
Test integration: npm run test:integration
Lint:             npm run lint
Lint fix:         npm run lint:fix
E2E:              npm run test:e2e
```

## Project Structure

```
src/
├── features/
│   └── tokenize/                         # NEW feature domain
│       ├── model/
│       │   ├── tokenizeSettings.ts       # Per-domain/URL enable state + display toggles
│       │   └── tokenizeStatusStore.ts    # In-memory selected-word state (hoặc reuse wordStatusStore)
│       ├── logic/
│       │   ├── textTokenizer.ts          # Pure: split text block → token metadata
│       │   ├── tokenizeBlock.ts          # Block boundary detection
│       │   ├── viewportTracker.ts         # IntersectionObserver sentinel + rootMargin
│       │   ├── tokenizeCache.ts         # LRU cache bounded for 1GB RAM
│       │   ├── tokenizeScheduler.ts      # Idle chunk scheduling (requestIdleCallback/Scheduler.postTask)
│       │   └── tokenSpanRenderer.ts      # Create DOM spans from token metadata
│       ├── ui/
│       │   ├── tokenBadge.ts             # Float badge + mini panel (Shadow DOM isolated)
│       │   ├── tokenBadgeCss.ts          # Host-isolated badge styles using tokens.css
│       │   └── tokenSpanCss.ts           # Token inline-block + status underline styles
│       ├── controller/
│       │   ├── tokenizeController.ts     # Orchestrator: prepare/bind/unbind lifecycle
│       │   ├── webTextTokenizeController.ts  # Attach to text page
│       │   └── subtitleTokenizeController.ts # Attach to subtitle overlay cues
│       ├── types.ts                      # Token, TokenBlock, TokenizeState, v.v.
│       └── index.ts                      # Public API
│   ├── dictionaryPopup/                  # EXISTING — sửa nếu cần message endpoint
│   │   └── controller/webTextDictionaryController.ts
│   │   └── services/wordStatusStore.ts
│   └── subtitle/                       # EXISTING — sửa để expose cue container + time events
│       └── ui/subtitleBlockController.ts
│       └── ui/contentScriptController.ts
├── entrypoints/
│   └── content/
│       ├── content-script.ts             # SỬA: wire tokenizeController khi enabled
│       └── tokenizeHostIntegration.ts    # MỚI: khởi tạo, cleanup, SPA nav re-init
├── entities/
│   └── tokenize/                         # MỚI: types Token, TokenStatus, TokenFrequency
│       └── types.ts
├── shared/
│   ├── styles/
│   │   └── tokens.json                   # SỬA nếu cần token mới (generate-tokens.js chạy sau)
│   ├── icons/
│   │   └── index.ts                      # ICON_CATALOG — query trước khi thêm icon
│   └── ui/                               # Reuse Button, Toggle, Dialog, Drawer, v.v.
└── tests/
    ├── unit/tokenize/                    # NEW unit tests
    │   ├── textTokenizer.test.ts
    │   ├── viewportTracker.test.ts
    │   ├── tokenizeCache.test.ts
    │   └── tokenizeScheduler.test.ts
    ├── integration/tokenize/             # NEW integration tests (nếu cần)
    │   └── tokenizePage.test.ts
    └── e2e/tokenize/                     # NEW Playwright E2E (nếu cần)
        └── tokenize.spec.ts
docs/
├── specs/spec-tokenize-on-media.md     # File này
├── plan/plan-tokenize-on-media.md        # MỚI (Phase 2)
├── task/task-tokenize-on-media.md        # MỚI (Phase 3)
└── test-reports/<date>-tokenize-on-media-mcp.md  # MỚI (browser verify)
```

## Code Style

- **Functional components + hooks**, không class component (ngoại lệ duy nhất React ErrorBoundary).
- **Named exports**, không default export.
- **Colocate tests**: `textTokenizer.ts` → `textTokenizer.test.ts`.
- **Pure functions cho logic**, tách biệt side effect.
- **TypeScript strict** — không dùng `any` nếu không có lý do rõ ràng. dùng chuẩn convention trong knowledge của skill /learning-and-apply
- **Không hardcoded** — dùng design tokens và component từ `src/shared/ui`.
- **Chrome API**: cite docs https://developer.chrome.com/docs/extensions/reference/.
- **BEM-like CSS** trong CSS modules; token variables từ `tokens.css`.

**Ví dụ pure function (tokenizer)**:

```typescript
// src/features/tokenize/logic/textTokenizer.ts
import type { Token, TokenStatus } from '@/entities/tokenize/types';

export interface TokenizeOptions {
  readonly getStatus: (word: string) => TokenStatus;
  readonly getFrequency: (word: string) => number;
}

export function tokenizeTextBlock(text: string, options: TokenizeOptions): Token[] {
  // Split text into words, punctuation, whitespace.
  // Return token metadata: text, start/end index, status, frequency, lemma.
  // No DOM mutation. No side effects. Pure function.
}
```

**Ví dụ controller lifecycle**:

```typescript
// src/features/tokenize/controller/tokenizeController.ts
export interface TokenizeController {
  readonly prepare: (block: TokenBlock) => Promise<Token[]>;
  readonly bind: (block: TokenBlock, tokens: Token[]) => void;
  readonly unbind: (block: TokenBlock) => void;
  readonly destroy: () => void;
}
```

## Testing Strategy

- **Unit tests** (`npm run test:unit`) — ưu tiên logic thuần:
  - `textTokenizer`: đúng số token, giữ whitespace, xử lý punctuation.
  - `viewportTracker`: sentinel crossing, rootMargin, mounted range update.
  - `tokenizeCache`: LRU eviction, WeakMap cleanup, bounded size.
  - `tokenizeScheduler`: chunk yield, idle fallback, priority queue.
  - `tokenSpanRenderer`: DOM span structure, status class, frequency class.

- **Component tests** (testing-library + jsdom) nếu badge là React component:
  - Toggle Tokenize/Status/Frequency gọi đúng callback.
  - Mini panel mở/đóng, focus trap, ESC close.

- **Integration tests** (`npm run test:integration`) nếu cần:
  - Tokenize một sample HTML page trong jsdom/jsdom-browser, verify không throw, spans đúng số lượng.

- **Browser verification** (`browser-testing-with-devtools` skill / MCP):
  - Host CSS isolation ✓
  - Badge hiển thị + toggle hoạt động ✓
  - Token inline-block, status underline 2px, không đẩy dòng ✓
  - Desktop `1/2/3/4` + multi-select ✓
  - Mobile tap → Popup Dictionary ✓
  - Scroll/seek nhanh không lag, plain text fallback ✓
  - known/ignore ẩn mặc định, hover hiện status ✓
  - Memory snapshot không tăng vô hạn khi scroll dài ✓

## Boundaries

- **Always do:**
  - Chạy `npm run test:unit`, `npm run typecheck`, `npm run lint` trước khi commit.
  - Dùng token từ `tokens.json`; không sửa `tokens.css` trực tiếp.
  - Colocate test với file được test.
  - Named exports cho mọi module mới.
  - Validate payload bằng Zod ở trust boundaries (message passing).
  - Cite Chrome API docs khi dùng API mới.

- **Ask first:**
  - Thay đổi `manifest.json` (vì cần test trên Chrome thật).
  - Thêm dependency mới (bundle size risk).
  - Thay đổi storage schema / `settingsStore.ts` schema version.
  - Thay đổi Popup Dictionary public API (`webTextDictionaryController.ts`).
  - Sửa `subtitleBlockController.ts` nếu cần expose cue DOM/time events.
  - Xóa Options/Popup settings UI (không làm trong phase này).

- **Never do:**
  - Commit secrets, API keys, or personal config.
  - Eager tokenize toàn bộ page một lúc (vi phạm 1GB RAM constraint).
  - Inline SVG trong component — luôn dùng `ICON_CATALOG`.
  - Hardcoded px/color trong CSS/TS — dùng token hoặc `var(--token, fallback)`.
  - Skip browser verify nếu task đụng content-script UI.

## Success Criteria

1. **Functional**:
   - Float badge có 3 toggle: Tokenize page, Status, Frequency + nút mở Popup Dictionary.
   - Bật Tokenize page → host page tokenize dần dần theo viewport, highlight status/frequency.
   - Desktop hover token + `1/2/3/4` đổi status; `Ctrl/Cmd+click` multi-select + phím tắt batch.
   - Mobile tap token → mở Popup Dictionary với từ đã chọn.
   - Toggle Status/Frequency thực sự ẩn/hiện layer tương ứng.
   - known/ignore: mặc định ẩn freq bg + status underline; hover hiện status; ignore có `opacity: 0.5` + `line-through`.
   - Subtitle: active cue + N cue trước/sau được tokenize; cue ngoài cửa sổ thời gian unbind.

2. **Performance (1GB RAM)**:
   - Không tokenize toàn bộ page một lúc; chỉ viewport + buffer.
   - Cache LRU có giới hạn rõ ràng; memory snapshot không tăng vô hạn khi scroll/seek.
   - Main thread không bị block > 16.7ms liên tiếp khi bind token spans.
   - Scroll/seek vẫn đạt 60fps trên low-end device emulation.

3. **Quality gates**:
   - `npm run test:unit` pass.
   - `npm run typecheck` pass.
   - `npm run lint` pass (hoặc `npm run lint:fix` nếu auto-fix được).
   - Browser MCP verify pass (no console error/warn, no layout thrashing).

4. **Docs**:
   - `docs/plan/plan-tokenize-on-media.md` được viết sau spec approve.
   - `docs/task/task-tokenize-on-media.md` được cập nhật khi bắt đầu implement.
   - `docs/test-reports/<date>-tokenize-on-media-mcp.md` sau browser verify.

## Open Questions

1. Float badge nên là React component render vào Shadow DOM, hay vanilla TS như `wordHighlight.ts`/`subtitleBlockCss.ts`? (React sẽ đồng bộ với shared UI; vanilla sẽ nhẹ hơn trong content script.)
2. Có nên tạo feature `tokenize` riêng, hay gộp vào `dictionaryPopup` vì liên kết chặt? (FSD khuyến khích tách feature nếu domain rõ ràng.)
3. Buffer size và cache limit cụ thể: 1 viewport, 2 viewport, hay tính động theo device memory?
4. Subtitle tokenization nên hook vào `subtitleBlockController.ts` hiện tại hay tạo `subtitleTokenWrap.ts` riêng?
5. `Popup Dictionary` cần message type gì để content script gửi `openWithWord(word)` và `setStatus(word, status)`?
6. Có nên off-load `prepare` (tokenize metadata) sang Web Worker? (Trade-off: serialize DOM/text + message passing.)
7. Per-domain tokenize state lưu ở `settingsStore.ts` hay tạo store/tokenize state riêng?
