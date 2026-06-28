# Spec: Side Panel Subtitle

> PRD chi tiết — "what to build" (Giai đoạn 2 — Spec).
> Input: `docs/intent/intent-side-panel-subtitle.md` (confirmed intent).

## Objective

Thay thế subtitle panel inject-DOM hiện tại bằng **Chrome Side Panel API** (Chrome 114+, Edge 114+). Panel nằm trong UI browser, cạnh tab — không che video, không bị fullscreen che, không phụ thuộc DOM trang web. Overlay UI (subtitle text, import, drag-drop, toggle) vẫn neo vào `video.parentElement` — bỏ hoàn toàn F0 algorithm, fullscreen handler, side-by-side docking.

**User story**: Là người học ngôn ngữ (Anh yêu), khi xem video trên bất kỳ trang web nào (kể cả iframe cross-origin, fullscreen), em muốn panel subtitle hiển thị cạnh tab browser, không bị che khi fullscreen, không phá layout trang, để đối chiếu subtitle khi học.

**Success looks like**:
- Vào trang có video → overlay subtitle hiện trên video, toggle button hiện trên video.
- Click toggle button → Side Panel mở cạnh tab, hiển thị cue list song ngữ.
- Video play → cue hiện tại highlight + auto-scroll trong Side Panel.
- Click cue trong Side Panel → video seek đến cue đó.
- Fullscreen video → Side Panel vẫn nhìn thấy, overlay vẫn nhìn thấy.
- Vào trang có video trong iframe (hhpanda, coreflix) → overlay + Side Panel vẫn hoạt động.
- Đóng Side Panel → click toggle lại → mở lại.

## Tech Stack
- Chrome Extension MV3 (manifest v3)
- Chrome Side Panel API (`chrome.sidePanel`, Chrome 114+, Edge 114+)
- React 19 + Zustand 5 + TypeScript 6 (side panel UI)
- Vite 8 + @crxjs/vite-plugin (build)
- Jest 30 (unit), Playwright (E2E)
- Windows (PowerShell)

## Project Structure (files mới + sửa + xóa)

```
src/
├── sidepanel/                        # MỚI — Side Panel React app
│   ├── index.html                    # Entry HTML
│   ├── main.tsx                      # React root
│   ├── App.tsx                       # Cue list + highlight + seek
│   ├── store/
│   │   └── sidePanelStore.ts         # Zustand store: cues, currentTime, isPlaying
│   └── components/
│       ├── CueList.tsx               # Cue list (lazy render, highlight, scroll)
│       └── CueList.module.css        # Styles
├── types/
│   └── message.ts                    # SỬA: + SIDE_PANEL message types
├── constants/
│   └── messages.ts                   # SỬA: + MESSAGE_TYPES cho side panel
├── background/
│   └── index.ts                      # SỬA: relay content ↔ side panel, sidePanel.open handler
├── content/
│   ├── content-script.ts             # SỬA: bỏ docking, giữ overlay, gửi cues/timeupdate qua port
│   ├── subtitlePanel.ts              # GIỮ: createToggleButton (overlay), bỏ createPanel/renderCueList
│   ├── subtitleDocking.ts            # XÓA: không còn docking/F0/fullscreen handler
│   ├── subtitleUI.ts                 # SỬA: overlay neo vào video.parentElement (không cần videoWrapper)
│   ├── subtitleImport.ts             # SỬA: import button neo vào video.parentElement
│   └── subtitleOverlay.ts            # SỬA: init nhận video.parentElement, không cần videoWrapper
├── popup/                            # KHÔNG ĐỔI — popup vẫn dùng cho video download
public/
└── manifest.json                     # SỬA: + sidePanel permission, + side_panel key, + all_frames: true
tests/
└── unit/
    ├── sidePanelStore.test.ts        # MỚI: test Zustand store
    ├── CueList.test.tsx              # MỚI: test cue list render + highlight
    └── subtitleDocking.test.ts       # XÓA hoặc refactor (docking không còn)
docs/
├── adr/008-side-panel-subtitle.md    # MỚI (G3)
├── specs/spec-side-panel-subtitle.md # MỚI (file này)
└── task/task-side-panel-subtitle.md  # MỚI (G4)
```

## Code Style
Functional components + hooks (no class). Named exports (no default). Colocate tests. Pure functions cho logic. TypeScript strict mode — no `any` without justification. Chrome API calls cite official docs: https://developer.chrome.com/docs/extensions/reference/api/sidePanel

## Functional Requirements

### F1: Overlay UI (giữ, đơn giản hóa)
**F1.1**: Content script chạy trong mọi frame (`all_frames: true` + `match_origin_as_fallback: true`).
**F1.2**: Tìm `<video>` element trong frame hiện tại.
**F1.3**: Tạo overlay subtitle (2 span target + native) neo vào `video.parentElement` — không cần F0, không cần videoWrapper.
**F1.4**: Tạo import button neo vào `video.parentElement`.
**F1.5**: Tạo drag-drop hint neo vào `video.parentElement`.
**F1.6**: Tạo toggle button neo vào `video.parentElement` — click → mở Side Panel.
**F1.7**: Overlay hiển thị subtitle text runtime-align (giữ logic `findCurrentLine` binary search hiện có).

### F2: Side Panel — mở/đóng
**F2.1**: Toggle button click → content script gửi `OPEN_SIDE_PANEL` message → background gọi `chrome.sidePanel.open({tabId})`.
**F2.2**: Side Panel hiển thị `src/sidepanel/index.html` (React app).
**F2.3**: Đóng Side Panel (user đóng browser UI) → toggle button vẫn trong overlay → click lại → mở lại.
**F2.4**: Side Panel persistent across tab navigation (browser behavior, không cần code thêm).

### F3: Side Panel — cue list
**F3.1**: Khi cues loaded (import/auto-load/drag-drop) → content script gửi `SUBTITLE_CUES_LOADED {cues: BilingualCue[]}` qua port → background relay → Side Panel render cue list.
**F3.2**: Cue list hiển thị: timestamp (clickable) + target text (prominent) + native text (muted).
**F3.3**: Cue list lazy render (IntersectionObserver) nếu > 50 cues, fallback render all nếu < 50 cues (giữ logic hiện có).
**F3.4**: Click cue timestamp → Side Panel gửi `SEEK_TO {timeMs}` → background relay → content script set `video.currentTime`.

### F4: Side Panel — sync video
**F4.1**: Content script lắng nghe `video.timeupdate` → gửi `VIDEO_TIME_UPDATE {currentTimeMs, durationMs}` qua port → background relay → Side Panel cập nhật highlight + auto-scroll.
**F4.2**: Side Panel highlight cue hiện tại (cue có `start <= currentTimeMs && end >= currentTimeMs`).
**F4.3**: Side Panel auto-scroll cue hiện tại vào view (smooth scroll).
**F4.4**: Content script lắng nghe `video.play` / `video.pause` → gửi `VIDEO_PLAY_STATE {isPlaying}` → Side Panel cập nhật UI (optional: play/pause indicator).

### F5: Iframe support
**F5.1**: `manifest.json` content_scripts thêm `"all_frames": true` + `"match_origin_as_fallback": true`.
**F5.2**: Content script trong iframe tìm `<video>` trong iframe → overlay + toggle hoạt động bình thường.
**F5.3**: Side Panel mở cho tab hiện tại — background dùng `sender.tab.id` để relay đúng tab.

### F6: Keyboard shortcuts (giữ)
**F6.1**: Keyboard shortcuts hiện tại (prev-cue, next-cue, replay-cue, toggle-overlay, toggle-panel) vẫn hoạt động.
**F6.2**: `toggle-panel` shortcut → gửi `OPEN_SIDE_PANEL` message (thay vì show/hide panel DOM).

### F7: Auto-load subtitles (giữ)
**F7.1**: Auto-load flow hiện tại (background push `AUTO_LOAD_SUBTITLES` → content-script fetch/parse/merge) vẫn hoạt động.
**F7.2**: Khi cues loaded → content script gửi `SUBTITLE_CUES_LOADED` qua port → Side Panel render.

## Non-Functional Requirements

### NF1: Performance
- Sync latency: `video.timeupdate` → Side Panel highlight < 50ms (message passing ~5-20ms + render ~5-10ms).
- Cue list render: < 100ms cho 1000 cues (lazy render).
- Overlay runtime-align: giữ binary search O(log n) hiện có.

### NF2: Compatibility
- Chrome 114+ / Edge 114+ (Side Panel API).
- Firefox/Safari: Side Panel không hỗ trợ → fallback overlay-only (panel không hiển thị, overlay vẫn hoạt động).
- Iframe cross-origin: `all_frames: true` + `match_origin_as_fallback: true`.

### NF3: Resilience
- Side Panel đóng → content script vẫn chạy, overlay vẫn hoạt động.
- Tab navigate → Side Panel persistent, content script re-inject, re-send cues.
- Background SW restart → port reconnect, re-send cues.

### NF4: Security
- Side Panel là extension page (origin `chrome-extension://`) — không bị CORS, CSP page.
- Message passing qua `chrome.runtime` — không expose data ra trang web.
- Không modify DOM trang web ngoài overlay UI (không phá layout).

## Acceptance Criteria

### AC1: Normal mode — overlay + Side Panel
- [ ] Vào trang có video → overlay hiện, toggle button hiện.
- [ ] Click toggle → Side Panel mở, hiển thị cue list (nếu đã load subtitle).
- [ ] Video play → cue hiện tại highlight + auto-scroll trong Side Panel.
- [ ] Click cue → video seek.
- [ ] Đóng Side Panel → overlay vẫn hiện. Click toggle lại → mở lại.

### AC2: Fullscreen mode
- [ ] Fullscreen video → Side Panel vẫn nhìn thấy (không bị che).
- [ ] Overlay vẫn hiện trên video.
- [ ] Cue highlight + auto-scroll vẫn hoạt động.

### AC3: Iframe (hhpanda, coreflix)
- [ ] Video trong iframe → overlay + toggle hiện trong iframe.
- [ ] Click toggle → Side Panel mở.
- [ ] Sync video hoạt động.

### AC4: Multi-site (themoviebox, lordflix, YouTube)
- [ ] Overlay + Side Panel hoạt động trên mọi trang đã test.
- [ ] Không phá layout trang.
- [ ] Không console error từ extension.

### AC5: Auto-load
- [ ] Auto-load subtitles → cues hiện trong Side Panel.
- [ ] Overlay hiển thị 2 dòng (target + native).

### AC6: Keyboard shortcuts
- [ ] prev-cue, next-cue, replay-cue hoạt động (seek video).
- [ ] toggle-overlay hoạt động (show/hide overlay).
- [ ] toggle-panel → mở/đóng Side Panel.

## Error Cases

- **Side Panel API không hỗ trợ** (Firefox/Safari): fallback overlay-only, toggle button click → toast "Side Panel không hỗ trợ trên browser này".
- **Video không tìm thấy**: content script không init overlay, không gửi message.
- **Cues rỗng**: Side Panel hiển thị "No subtitles loaded".
- **Port disconnect** (SW restart): content script reconnect, re-send cues.
- **Irame sandboxed** (`match_origin_as_fallback` fail): overlay không hoạt động trong iframe đó — chấp nhận (rare case).

## Data Flow

```
Content script (page/iframe)
  ├─ video.timeupdate ──▶ port.postMessage(VIDEO_TIME_UPDATE)
  ├─ cues loaded ──▶ port.postMessage(SUBTITLE_CUES_LOADED)
  ├─ video.play/pause ──▶ port.postMessage(VIDEO_PLAY_STATE)
  └─ toggle click ──▶ chrome.runtime.sendMessage(OPEN_SIDE_PANEL)

Background SW
  ├─ OPEN_SIDE_PANEL ──▶ chrome.sidePanel.open({tabId})
  ├─ VIDEO_TIME_UPDATE ──▶ relay to Side Panel (port)
  ├─ SUBTITLE_CUES_LOADED ──▶ relay to Side Panel (port)
  └─ SEEK_TO (from Side Panel) ──▶ relay to Content script

Side Panel (extension page)
  ├─ receive VIDEO_TIME_UPDATE ──▶ highlight + scroll cue
  ├─ receive SUBTITLE_CUES_LOADED ──▶ render cue list
  └─ click cue ──▶ port.postMessage(SEEK_TO)
```

## Out of Scope (V1)

- Dictionary lookup (Yomitan-style) — future phase.
- Translate (Google/DeepL/AI) — future phase.
- Copy/export subtitle — future phase.
- Playback control từ panel (play/pause/seek buttons) — future phase (seek via cue click đã có).
- Bookmark/note-taking — future phase.
- Panel resize handle (browser native resize đã có).
- Panel position switch (left/right) — browser native đã có.

## References

- [Chrome Side Panel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)
- [Create a side panel](https://developer.chrome.com/docs/extensions/develop/ui/create-a-side-panel)
- [Edge Sidebar API](https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/sidebar)
- [Content scripts all_frames](https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts)
- [sidePanel.open (Chrome 116+)](https://developer.chrome.com/docs/extensions/reference/api/sidePanel#method-open)
