# Spec: Local Offline TTS (Supertonic v3) — fnc_tts

## Assumptions (correct me now)

1. Supertonic v3 (`Supertone/supertonic-3`) sẽ là provider TTS local offline chính, nhưng **MVP chỉ tiếng Anh** (`en`); 30 ngôn ngữ còn lại được mở rộng sau qua cùng một provider abstraction.
2. Model ONNX (~400MB, 4 files) **không bundle**, người dùng tải từ Hugging Face về thiết bị trong phần TTS settings.
3. ONNX Runtime Web sẽ chạy trong **offscreen document** (MV3 service worker không chạy WASM/ONNX), sử dụng WebGPU nếu có, fallback WASM.
4. MV3 chỉ cho phép **một offscreen document** tại một thời điểm, vì vậy TTS runner được nạp thêm vào offscreen document hiện có hoặc một `offscreen.html` thay thế nếu refactor đơn giản hơn.
5. Dữ liệu model được lưu trong **OPFS** (sử dụng pattern `src/shared/lib/storage/opfsStorage.ts`) hoặc **Cache API** (`caches`) — quyết định cuối cùng sau T0 spike.
6. `chrome.tts` + Web Speech API vẫn là fallback khi Supertonic chưa tải, lỗi, hoặc thiết bị không hỗ trợ.
7. `onnxruntime-web` sẽ được thêm với version cụ thể (không `latest`), bundle size phải được kiểm tra trước khi commit.

## Objective

Xây dựng branch `fnc_tts` cung cấp TTS local offline trong Cell MV3 bằng Supertonic v3, phục vụ:

- Phát âm **từ** và **câu** trong popup từ điển (Audio tab).
- Nền tảng **queue / chunking / play / pause / resume / stop** để tương lai kết nối reader sách.
- Người dùng chọn ngôn ngữ và tải voice pack trong mục TTS của Settings.

Success: Người dùng bấm play từ/câu, nghe được âm thanh do Supertonic tạo ra (offline sau khi đã tải), build pass, typecheck 0, tests pass, verify trên browser thật.

## Tech Stack

- **Runtime**: ONNX Runtime Web (pinned version — xác định ở spike T0).
- **Model**: `Supertone/supertonic-3` (99M params, ONNX, OpenRAIL-M license).
- **Storage**: OPFS / Cache API cho model; `chrome.storage.local` cho metadata tải & settings.
- **Architecture**: MV3 offscreen document + background message routing.
- **UI**: React + shared UI (`src/shared/ui/`) + CSS modules + design tokens.
- **State**: Có thể dùng Zustand hoặc local component state tuỳ phạm vi (không dùng `any`).

## Commands

```bash
# Cài dependency sau khi version được duyệt
npm add onnxruntime-web@<pinned>

# Dev
npm run dev

# Build (bắt lỗi Vite/rollup)
npm run build

# Typecheck
npm run typecheck

# Unit tests
npm run test:unit

# Browser verify
npm run mock
# + skill testing-extension-browser
```

## Project Structure

```
src/
├── entrypoints/offscreen/
│   ├── ttsRunner.ts              # OFFSCREEN: load ONNX, inference, queue/playback
│   └── (offscreen.html cập nhật hoặc tts.html)
├── entrypoints/background/handlers/
│   ├── tts.ts                    # mở rộng: TTS_SPEAK dùng Supertonic nếu bật
│   └── ttsDownload.ts            # mới: tải model từ HF, lưu, báo tiến trình
├── features/tts/
│   ├── services/
│   │   ├── supertonicTtsEngine.ts    # TTS engine (implement TtsEngine)
│   │   ├── ttsDownloadManager.ts     # quản lý tải model
│   │   └── ttsQueue.ts               # queue/chunking/play/pause/resume/stop
│   └── ui/
│       └── TtsLanguagePanel.tsx      # mới: chọn ngôn ngữ + tải voice pack
├── features/dictionaryPopup/services/ttsEngineService.ts  # mở rộng factory
├── entities/message/types.ts        # mới: TTS_DOWNLOAD, TTS_DOWNLOAD_PROGRESS, TTS_INFERENCE...
├── shared/config/messages.ts        # mới: message constants
└── entities/settings/types.ts       # mở rộng TtsSettings
```

## Code Style

- Function components + named export. Không default export.
- Không `any`. Types tường minh qua Zod tại message boundary.
- Provider pattern: `TtsEngine` là interface; `createSupertonicEngine()` implement cùng `TtsEngine`.
- Đọc `ICON_CATALOG` trước khi thêm icon; tái dùng `audioWave`, `download`, `play`, `pause`, `stop` từ catalog.
- UI sử dụng `Button`, `Card`, `Select`, `Progress`, `Alert`, `SettingsRow` từ `src/shared/ui/`.
- CSS dùng token từ `tokens.json`, không hardcode.

## Testing Strategy

- **Unit**: Jest + jsdom.
  - `supertonicTtsEngine.test.ts`: mock ONNX, queue, play/pause/stop.
  - `ttsDownloadManager.test.ts`: mock `fetch` và `chrome.storage`, kiểm tra tiến trình + retry.
  - `ttsQueue.test.ts`: chunking, pause, resume, stop, clear.
- **Integration**: `tests/unit/entrypoints/background/integration.test.ts` mở rộng nếu cần.
- **E2E/Browser**: skill `testing-extension-browser` — verify tải model + phát âm thực.
- **Spike T0**: standalone HTML load ONNX Runtime + Supertonic v3, xác nhận output WAV trước khi sửa codebase.

## Boundaries

### Always do
- Validate mọi message payload bằng Zod tại trust boundary.
- Fallback về `chrome.tts` / Web Speech khi Supertonic không khả dụng.
- Giữ backward compatibility với `TtsEngine` interface hiện có.
- Chạy `npm run build` sau mỗi lần sửa `src/`.
- Cập nhật `docs/2-architechture-system.md` khi thay đổi cấu trúc.

### Ask first
- Thay đổi `manifest.json` (cần test thật trên Chrome).
- Thêm dependency mới (phải kiểm bundle size).
- Sửa `tokens.json` (phải chạy `npm run dev`/`build` để regenerate).
- Refactor offscreen document thành multi-doc hoặc merge runner.

### Never do
- Bundle secret/API key.
- Commit model weights vào repo.
- Sửa security policy / `.npmrc` để bypass bất kỳ giới hạn nào.

## Success Criteria

- [ ] T0 spike: standalone Supertonic v3 tạo được WAV từ text `en` trong browser.
- [ ] `npm run build` pass, `npm run typecheck` 0 error.
- [ ] Unit tests cho `supertonicTtsEngine`, `ttsDownloadManager`, `ttsQueue` pass.
- [ ] Settings UI mới: người dùng chọn `en`, tải voice pack, thấy tiến trình.
- [ ] Popup từ điển: bấm play từ/câu, nghe âm thanh Supertonic khi đã tải model; fallback nếu chưa.
- [ ] Verify trên Chrome thật: tải model, play offline, pause/resume/stop hoạt động.
- [ ] Không phá vỡ `chrome.tts` / Web Speech fallback hiện có.

## Open Questions (resolved for MVP)

1. **Tiếng Anh trước** — confirmed.
2. **Tải trực tiếp từ Hugging Face** — confirmed.
3. **TTS settings nằm trong section TTS của Settings (tab audio)** — confirmed.
4. **Provider cần queue/chunking/play/pause/resume/stop** — confirmed.
5. **Offscreen document cho inference** — quyết định sau T0 (single shared doc hoặc dedicated).
6. **Lưu model bằng OPFS hay Cache API** — quyết định sau T0 dựa trên hiệu quả test.
