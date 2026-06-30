# Phase 5 — asbplayer-1.18.0: Core domain + entrypoints

> Tóm tắt tiếng Việt sau khi đọc ~60 file core domain + entrypoints của asbplayer-1.18.0.

## Monorepo structure

- **3 packages** via Yarn workspaces (yarn@3.2.0): `client` (web app app.asbplayer.dev), `extension` (Chrome/Firefox MV3/MV2), `common` (domain logic chia sẻ).
- Root `package.json` dùng `yarn workspaces` + `resolutions` để patch `lamejs@1.2.0` và pin `vite@8.0.0` + `@vitejs/plugin-react@^6.0.1`.
- `extension/package.json` phụ thuộc `@project/common` (workspace:^), dùng **WXT** (`wxt@^0.20.19`) + `@wxt-dev/module-react` làm build framework thay CRXJS.
- `verify` script chạy song song: loc-keys-match → loc-codes-in-extension-config → page-file-references → test 3 workspace → eslint → prettier:check.
- `common` là "pure domain" — không phụ thuộc browser API trực tiếp, được import bởi cả `client` và `extension`.

## common/anki

- `Anki` class wrap **AnkiConnect API** (HTTP POST tới `ankiConnectUrl` mặc định `http://127.0.0.1:8765`), các action: `deckNames`, `modelNames`, `findNotes`, `notesInfo`, `addNote`, `canAddNotes`, `guiAddCards`, `updateNoteFields`, `storeMediaFile`.
- `exportCard(card, ankiSettings, exportMode)` là entrypoint chính: build `ExportParams` (text, track1/2/3, definition, audioClip, image, word, source, url, customFieldValues, tags), encode media → base64, gửi tới AnkiConnect.
- 3 chế độ export: `'default'` (addNote mới), `'updateLast'` (update note cuối), `'duplicate'` (cho phép duplicate trong bulk export).
- Field mapping linh hoạt: `sentenceField`, `definitionField`, `audioField`, `imageField`, `wordField`, `sourceField`, `urlField`, `track1/2/3Field` + `customAnkiFields` (dict key→value).
- HTML markup inheritance: `inheritHtmlMarkup` giữ tag HTML từ subtitle gốc khi text được extract; escape query Anki (`"`, `*`, `_`, `\`, `:`); `makeUniqueFileName` thêm 8 random chars để tránh collision trong Anki media collection.

## common/audio-clip

- `AudioClip` là factory + abstract `AudioData` interface: `Base64AudioData` (từ base64 có sẵn) và `FileAudioClipper` (clip từ `<video>` qua `captureStream`/`mozCaptureStream` + `MediaRecorder`).
- `Mp3Encoder.encode(blob, workerFactory)` — decode blob qua `AudioContext.decodeAudioData`, gửi `SerializableAudioBuffer` (channels Float32Array, sampleRate, length) tới worker.
- `mp3-encoder-worker.ts` dùng **lamejs** (`WavHeader` + `Mp3Encoder`): build WAV header thủ công (RIFF/WAVE/fmt/data chunks), encode Int16 samples thành MP3 @ 192kbps, 1152 samples/frame, flush cuối. Patched lamejs qua yarn resolutions.
- Recorder config tự chọn mime type: ưu tiên `audio/ogg;codecs=opus` → `audio/webm;codecs=opus` (Firefox), fallback webm.
- `AudioClip.fromBase64` / `AudioClip.fromFile` — hỗ trợ slice (không sliceable cho base64), play/stop với event callbacks, cache blob.

## common/subtitle-*

- `SubtitleReader` parse đa định dạng: **SRT** (`@qgustavor/srt-parser`), **VTT/nfvtt** (`videojs-vtt.js` + sort cues theo line/position), **ASS** (`ass-compiler`), **YouTube ytsrv3** (XML `fast-xml-parser`), **Netflix ruby** (regex `([\p{Han}\p{Hira}...]+)\((...)\)` → HTML `<ruby>`), **PGS** (image-based, parse qua worker), **DFXP/TTML2**.
- `SubtitleCollection<T>` dùng **`@flatten-js/interval-tree`** — interval tree cho subtitle intervals `[start, end-1]`, hỗ trợ `gapsTree` (khoảng trống giữa subtitle, dùng cho condensed mode / lastShown / nextToShow). `subtitlesAt(timestamp)` trả `SubtitleSlice` (showing, lastShown, nextToShow, startedShowing, willStopShowing) với `showingCheckRadiusMs`.
- `SubtitleAnnotations` (~2000 dòng) — hệ thống annotation phức tạp nhất: `TrackState` per track, `TokenCollection` (EXACT/LEMMA/ANY form match strategy), `Yomitan` integration (lemmatize qua HTTP tới `http://127.0.0.1:19633`), token status từ Anki/WaniKani/local, rich text rendering (`asb-token`, `asb-reading`, `asb-frequency` classes), cache token status với refresh interval (10s default, 1s cho statistics).
- Token match strategy: `ANY_FORM_COLLECTED`, `LEMMA_OR_EXACT_FORM_COLLECTED`, `LEMMA_FORM_COLLECTED`, `EXACT_FORM_COLLECTED` — kèm `dictionaryMatchAcrossScripts` cho Japanese (kana↔kanji).
- `renderRichTextOntoSubtitles` — biến `SubtitleModel[]` thành `RichSubtitleModel[]` với `richText` (HTML có span token + status color/styling).

## common/dictionary-db

- **Dexie** (`dexie`) IndexedDB database `DictionaryDatabase` với 5 tables: `meta` (`[profile+track]`), `tokens` (`[token+source+track+profile]`, multi-entry `*lemmas`, `*cardIds`), `ankiCards` (`[cardId+track+profile]`), `waniKaniSubjects`, `waniKaniAssignments` (v2 upgrade).
- `DictionaryTokenSource` enum: `LOCAL=0`, `ANKI_WORD=1`, `ANKI_SENTENCE=2`, `WANIKANI=3` — priority ordering (LOCAL > ANKI_WORD/WANIKANI > ANKI_SENTENCE).
- `DictionaryProvider` — facade pattern, wrap `DictionaryStorage` interface (getBulk, getAllTokens, getByLemmaBulk, saveRecordLocalBulk, buildAnkiCache, buildWaniKaniCache, statistics snapshot pub/sub).
- `dictionary-db-anki.ts` — `buildAnkiCachePipeline`: request AnkiConnect permission → per-track build (claim buildId, check settings change, clear orphaned cards) → fetch notesInfo batch 100 → Yomitan lemmatize → save tokens. Concurrent build prevention qua buildId + 5min expiration.
- `dictionary-db-wanikani.ts` — `buildWaniKaniCachePipeline`: fetch assignments/subjects/resets qua WaniKani API (incremental `updatedAfter`), map subject→token via Yomitan lemmatize, SRS stage → TokenStatus mapping.

## common/settings

- `AsbplayerSettings` = `AnkiSettings` + `SubtitleSettings` + `MiscSettings` + `DictionarySettings` (per-track `DictionaryTrack[]`) + streaming settings — ~100+ fields, tất cả `readonly`.
- `SettingsProvider` — wrap `SettingsStorage` interface, `get(keysAndDefaults)` / `getAll()` / `getSingle(key)` / `set()` / profiles (add/remove/setActive). Default settings đầy đủ trong `settings-provider.ts` (keybinds, subtitle styles, dictionary track defaults).
- Profile system: `prefixedSettings`/`unprefixedSettings` — mỗi profile có prefix key trong storage (e.g. `profileName.ankiConnectUrl`).
- `TokenStatus` enum: `UNCOLLECTED=0` → `UNKNOWN=1` → `LEARNING=2` → `GRADUATED=3` → `YOUNG=4` → `MATURE=5` (known = >= LEARNING). `TokenStatusConfig` (display, color, alpha) per status.
- Bitset pattern cho track config: `SeekableTracks` / `AutoCopyableTracks` là number bitset (bit nth = track nth enabled).

## common/src + app/services

- `command.ts` — ~15 command interfaces định nghĩa sender string: `asbplayer`, `asbplayerv2`, `asbplayer-extension-to-video`, `asbplayer-video`, `asbplayer-video-tab`, `asbplayer-foreground`, `asbplayer-extension-to-player`, `asbplayer-popup`, `asbplayer-extension-to-offscreen-document`, `asbplayer-offscreen-document`, `asbplayer-mobile-overlay`, `asbplayer-statistics-overlay`, `asbplayer-dictionary`. Mỗi context có sender riêng → routing theo sender.
- `message.ts` (~1100 dòng) — ~80+ message interfaces: heartbeat, tabs, http-post, encode-mp3, settings-updated, record-media-and-forward-subtitle, copy/copy-subtitle, show-anki-ui, card-exported/saved/updated, dictionary-* (get-bulk, save-record, build-anki-cache, statistics), video data sync, mobile overlay, statistics overlay.
- `VideoProtocol` interface (`postMessage`, `close`, `onMessage`) — abstraction cho 2 impl: `ChromeTabVideoProtocol` (qua `ChromeExtension.sendMessageToVideoElement` + subscribe, filter by tabId+src) và `BroadcastChannelVideoProtocol` (qua `BroadcastChannel` API, dùng cho same-page iframe).
- `VideoChannel` (~765 dòng) — high-level wrapper quanh `VideoProtocol`, dispatch message thành callbacks (ready, play, pause, currentTime, offset, playbackRate, copy, audioTrackSelected, subtitlesUpdated, saveTokenLocal, playModes). Giả lập HTMLMediaElement API (duration, readyState, currentTime, playbackRate).
- `AppExtensionSettingsStorage` / `AppExtensionDictionaryStorage` — adapter cho web app (app.asbplayer.dev) gọi extension qua `window.postMessage` (sender `asbplayer-dictionary`), listen `ExtensionToAsbPlayerCommand` events.
- `image-transformer.ts` — `cropAndResize(maxWidth, maxHeight, rect, dataUrl)`: draw image lên canvas theo devicePixelRatio, crop theo rect, resize qua `createImageBitmap` (resizeQuality: 'high'), output JPEG dataURL.

## extension entrypoints

- `background.ts` (~556 dòng) — **service worker** entrypoint: init `SettingsProvider`, `TabRegistry`, `AudioRecorderService` (OffscreenAudioRecorder cho Chrome, CaptureStream cho Firefox), `CardPublisher`, `DictionaryDB`, `DictionaryHandler`. Đăng ký ~40+ handlers qua `CommandHandler` interface. Listen `onInstalled` (prime localization, set mobile defaults, annotation tutorial badge). Bind WebSocket client nếu enabled.
- `video.content/index.ts` — content script cho `<all_urls>` (exclude app.asbplayer.dev), `allFrames: true`, `document_idle`. Quét `<video>` elements mỗi 1s, bind `Binding` per video, hỗ trợ shadow roots (incrementallyFindShadowRoots). Init `VideoSelectController`, `TabAnkiUiController`, `StatisticsOverlayController` (parent doc only). Handle `copy-to-clipboard`, `crop-and-resize`, `toggle-side-panel` messages.
- `asbplayer.content.ts` — content script cho `app.asbplayer.dev` (+ localhost dev), `document_start`. Bridge giữa web app và extension: forward `get-settings`, `set-settings`, `dictionary-*`, `get-global-state` qua `window.postMessage`. Đây là cách web app (không phải extension page) truy cập extension storage/dictionary DB.
- `offscreen-audio-service.ts` — offscreen document cho Chrome MV3: `navigator.mediaDevices.getUserMedia` với `chromeMediaSource: 'tab'` + `chromeMediaSourceId`. Record audio (start/stop/with-timeout), encode MP3 qua worker, send `audio-base64` lại background.
- `popup-ui.ts` / `options.ts` / `sidepanel.ts` — thin entrypoints: render React UI (`renderPopupUi` / `renderSettingsUi` / `renderSidePanelUi`) vào `#root`. Popup fetch shortcuts từ `browser.commands.getAll()`.
- `mp3-encoder-worker.ts` / `pgs-parser-worker.ts` — `defineUnlistedScript` wrapper import `onMessage` từ common, chạy trong worker context.

## extension controllers

- **MVC pattern**: `Binding` (model/service) holds `video`, `subtitleController`, `ankiUiController`, `videoDataSyncController`, `controlsController`, `dragController`, `notificationController`, `mobileVideoOverlayController`, `mobileGestureController`, `bulkExportController`, `keyBindings`. Controllers là view-layer, quản lý UI frames + DOM overlays.
- `SubtitleController` (~823 dòng) — core: `SubtitleAnnotations` instance, `SubtitleCollection` (seekable + full), bottom/top `ElementOverlay` (CachingElementOverlay), render subtitle HTML theo settings (size, color, outline, shadow, background, alignment). Polling interval hiển thị subtitle theo `video.currentTime`. Force hide khi Anki UI mở.
- `AnkiUiController` / `TabAnkiUiController` — quản lý Anki dialog iframe (`UiFrame` + `FrameBridgeClient`), show/hide, handle bridge messages (exported, rerecord, resume, openSettings, copy-to-clipboard, encode-mp3, activeProfile). Khác biệt: TabAnkiUi không có rerecord (canRerecord=false), dùng `TabToExtensionCommand` thay `VideoToExtensionCommand`.
- `VideoDataSyncController` (~708 dòng) — sync subtitle track với video (auto-sync, manual select), giao tiếp với page script qua CustomEvents (`asbplayer-get-synced-data`, `asbplayer-synced-data`), YouTube target translation languages, play blocker khi dialog mở.
- `BulkExportController` — queue subtitle indices, gửi `copy-subtitle` (isBulkExport=true) tuần tự, listen `card-exported` để advance, hỗ trợ cancel. Progress notification `info.exportedCard {result: current/total}`.
- `MobileVideoOverlayController` / `MobileGestureController` — mobile-only: overlay iframe (`mobile-video-overlay-ui.html`), swipe gesture (500ms, 50px min), show khi pause, hide khi play.
- `ControlsController` — ẩn native video controls: sample points 12x12 grid, `elementFromPoint` + walk parent path, add `asbplayer-hide` class.
- `DragController` — drag-and-drop subtitle files vào video: drop zone div (90% video rect), filter extensions (ass/srt/vtt/sup/dfxp/ttml2), `context.loadSubtitles(files)`.
- `NotificationController` / `StatisticsOverlayController` — iframe-based UI overlays cho notification + statistics (open/close/move/resize/fullscreen states).

## extension handlers

- `CommandHandler` interface: `{ sender: string|string[], command: string|null, handle(command, sender, sendResponse) }` — routing theo `sender` + `command`. `command: null` = catch-all cho sender đó.
- **Forwarding handlers**: `AsbplayerToVideoCommandForwardingHandler` (asbplayer→video qua `tabs.sendMessage`), `VideoToAsbplayerCommandForwardingHandler` (video→asbplayer qua `tabRegistry.publishCommandToAsbplayers`), `AsbplayerV2ToVideoCommandForwardingHandler`.
- **Heartbeat/registry**: `AsbplayerHeartbeatHandler` → `tabRegistry.onAsbplayerHeartbeat` (update asbplayer state trong `storage.session`, reply với tabs list).
- **Feature handlers**: `LoadSubtitlesHandler` (→ toggle-video-select), `CopySubtitleHandler` (→ forward tới video element), `PublishCardHandler` (→ CardPublisher.publish), `SettingsUpdatedHandler`/`RefreshSettingsHandler` (→ prime localization, bind/unbind WebSocket, broadcast tới video + asbplayer + options page), `DictionaryHandler` (~242 dòng, switch trên 15 dictionary commands, relay build-cache state tới all contexts), `BulkExportStartedHandler` (→ CardPublisher.bulkExportCancelled=false).
- **Utility handlers**: `CurrentTabHandler` (reply `sender.tab?.id`), `CaptureVisibleTabHandler` (→ `captureVisibleTab(tabId)`), `AudioBase64Handler` (→ `audioRecorder.onAudioBase64`), `StatisticsOverlayForwarderHandler` (→ `tabs.sendMessage` lại cùng tab).

## Architecture Insights for Cell

- **Subtitle overlay pattern**: `CachingElementOverlay` + `OffscreenDomCache` — cache DOM nodes cho subtitle HTML, transfer children giữa fullscreen/non-fullscreen containers, polling 1s cho style updates. Cell có thể dùng pattern này cho subtitle overlay trên streaming video.
- **Anki export pipeline**: `exportCard` → encode audio (MP3 via worker) + image (crop+resize) → base64 → `storeMediaFile` + `addNote` với field mapping linh hoạt. Cell nên borrow: AudioClip abstraction (base64 + file capture), image transformer, field mapping system, duplicate handling.
- **Audio capture**: 2 delegate strategies — `OffscreenAudioRecorder` (Chrome MV3: `tabCapture.getMediaStreamId` → offscreen document `getUserMedia` với `chromeMediaSource: 'tab'`) và `CaptureStreamAudioRecorder` (Firefox: `video.captureStream` trong content script). MP3 encoding qua lamejs worker (patched). Cell đang dùng offscreen cho ffmpeg, có thể thêm audio recording path tương tự.
- **Video protocol abstraction**: `VideoProtocol` interface với 2 impl (ChromeTab qua extension messaging, BroadcastChannel cho same-page). `VideoChannel` dispatch message thành typed callbacks. Pattern này giải quyết cross-frame/cross-tab video control — Cell có thể áp dụng cho video player sync.
- **Dictionary DB**: Dexie IndexedDB với compound indexes (`[token+source+track+profile]`), multi-entry (`*lemmas`, `*cardIds`), build pipeline với concurrent prevention (buildId + expiration), incremental sync (WaniKani `updatedAfter`). Token status từ 3 sources (local/Anki/WaniKani) với priority. Cell's vocabulary tracking có thể dùng schema + pipeline pattern này.
- **Controller pattern**: `Binding` là "god object" model kết nối video element với tất cả controllers + services. Mỗi controller quản lý 1 UI aspect (subtitle, anki dialog, drag, notification, mobile overlay). UI renders trong iframe (`UiFrame` + `FrameBridgeClient`) để isolate CSS/JS. Cell's content script hiện tại đơn giản hơn nhiều — có thể adopt controller pattern khi thêm subtitle overlay + Anki UI.
- **WXT vs CRXJS**: asbplayer dùng **WXT** (`wxt@^0.20.19`) thay CRXJS — WXT cung cấp `defineBackground`, `defineContentScript`, `defineUnlistedScript`, auto manifest generation, `@wxt-dev/module-react`, hooks (`build:publicAssets`, `prepare:publicPaths`), cross-browser (Chrome/Firefox/Firefox-Android MV2/MV3). Cell hiện dùng CRXJS + Vite — WXT đáng cân nhắc nếu cần multi-browser + cleaner entrypoint structure.
- **Message routing**: Sender-string-based routing (~15 sender types) + CommandHandler interface. Mỗi context (asbplayer, video, extension, popup, offscreen, overlay) có sender riêng. `TabRegistry` quản lý state qua `storage.session` (video elements + asbplayer instances). Pattern này scale tốt cho nhiều contexts nhưng cần strict sender discipline — Cell's `messageBus` hiện đang đơn giản hơn.
