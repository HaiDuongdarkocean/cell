# Plan — Side Panel Subtitle (Feasibility + Task Breakdown)

> Output của **G1 + G4** — Feasibility & Task Breakdown.
> Input: `docs/specs/spec-side-panel-subtitle.md` (PRD).

## Feasibility Assessment (G1)

### Build vs Buy vs Reuse
| Capability | Build | Buy/Dep | Reuse codebase | Verdict |
|---|---|---|---|---|
| Side Panel HTML + React | ✅ | — | popup React pattern | **Reuse pattern** |
| Cue list render + lazy | ✅ | — | `renderCueListLazy` logic | **Reuse logic, rewrite in React** |
| Message passing content↔SW↔panel | ✅ | — | `MessageBus` + `chrome.runtime` | **Reuse pattern** |
| `sidePanel.open({tabId})` | ✅ | — | — | **Build (Chrome API)** |
| Overlay neo vào `video.parentElement` | ✅ | — | `subtitleUI.ts` | **Reuse + simplify** |
| Iframe support | ✅ | — | — | **Build (manifest config)** |

**Verdict**: Build, reuse codebase tối đa. Không dependency mới. Chrome Side Panel API là native (không cần dep).

### Technical Feasibility
- **Chrome 114+ / Edge 114+**: Side Panel API stable. `sidePanel.open({tabId})` cần Chrome 116+.
- **Message passing latency**: ~5-20ms per hop. Subtitle cue hiển thị > 1s → đủ.
- **Iframe**: `all_frames: true` + `match_origin_as_fallback: true` — Chrome hỗ trợ.
- **SW ephemeral**: port disconnect khi SW restart → content script reconnect + re-send cues.
- **React bundle size**: sidepanel.html là page riêng, không affect content script bundle.

### Risks
| Risk | Impact | Probability | Mitigation |
|---|---|---|---|
| `sidePanel.open` cần user gesture | Toggle button click = user gesture → OK | Low | Toggle click là gesture |
| SW restart disconnect port | Panel không nhận update tạm thời | Medium | Reconnect + re-send cues |
| Iframe sandboxed block content script | Overlay không hoạt động trong iframe đó | Low | Accept (rare case) |
| Firefox/Safari không hỗ trợ Side Panel | Panel không hiển thị | Medium | Fallback overlay-only + toast |
| Cue list render performance (1000+ cues) | Lag khi scroll | Low | Lazy render (IntersectionObserver) |

## Scope

### In scope (V1)
- Side Panel React app: cue list, highlight, seek.
- Message contract: content ↔ background ↔ side panel.
- Content script refactor: bỏ docking/F0, giữ overlay, gửi cues/timeupdate.
- Manifest: sidePanel permission, side_panel key, all_frames.
- Keyboard shortcuts: toggle-panel → mở Side Panel.
- Auto-load: cues → Side Panel.
- Browser verify: themoviebox, lordflix, YouTube, iframe site.

### Out of scope (V1)
- Dictionary, translate, copy/export, playback controls, bookmark — future phase.

## Task Breakdown (G4)

### Task 1: Manifest config
**Files**: `public/manifest.json`
**Acceptance**: 
- `"sidePanel"` trong permissions
- `"side_panel": { "default_path": "src/sidepanel/index.html" }`
- `content_scripts` thêm `"all_frames": true`, `"match_origin_as_fallback": true`
**Verify**: `npm run build` không error, manifest valid

### Task 2: Message types + constants
**Files**: `src/constants/messages.ts`, `src/types/message.ts`
**Acceptance**:
- `MESSAGE_TYPES` thêm: `OPEN_SIDE_PANEL`, `SUBTITLE_CUES_LOADED`, `VIDEO_TIME_UPDATE`, `VIDEO_PLAY_STATE`, `SEEK_TO`
- Types cho payload mỗi message
**Verify**: `npm run typecheck` pass

### Task 3: Side Panel React app
**Files**: `src/sidepanel/index.html`, `src/sidepanel/main.tsx`, `src/sidepanel/App.tsx`, `src/sidepanel/store/sidePanelStore.ts`, `src/sidepanel/components/CueList.tsx`, `src/sidepanel/components/CueList.module.css`
**Acceptance**:
- React app render cue list (timestamp + target + native)
- Zustand store: cues, currentTimeMs, isPlaying
- Highlight + auto-scroll cue hiện tại
- Click cue → gửi `SEEK_TO` message
- Lắng nghe `SUBTITLE_CUES_LOADED`, `VIDEO_TIME_UPDATE`, `VIDEO_PLAY_STATE` từ background
**Verify**: Unit test `sidePanelStore.test.ts` + `CueList.test.tsx` pass

### Task 4: Background SW — relay + open side panel
**Files**: `src/background/index.ts`
**Acceptance**:
- Handler `OPEN_SIDE_PANEL` → `chrome.sidePanel.open({tabId})`
- Relay `SUBTITLE_CUES_LOADED`, `VIDEO_TIME_UPDATE`, `VIDEO_PLAY_STATE` từ content → side panel
- Relay `SEEK_TO` từ side panel → content script
- Port management: connect side panel, connect content script, relay giữa 2 port
**Verify**: `npm run typecheck` pass, unit test nếu feasible

### Task 5: Content script refactor
**Files**: `src/content/content-script.ts`, `src/content/subtitleUI.ts`, `src/content/subtitleImport.ts`, `src/content/subtitleOverlay.ts`, `src/content/subtitlePanel.ts`
**Acceptance**:
- Bỏ import `subtitleDocking` (setupDocking, showPanelDocked, hidePanelDocked, setupFullscreenHandlers, movePanelToOuterWrapper)
- Overlay neo vào `video.parentElement` (không cần videoWrapper)
- Toggle button click → `chrome.runtime.sendMessage({type: OPEN_SIDE_PANEL})`
- `video.timeupdate` → gửi `VIDEO_TIME_UPDATE` qua port
- Cues loaded → gửi `SUBTITLE_CUES_LOADED` qua port
- Nhận `SEEK_TO` → set `video.currentTime`
- Keyboard `toggle-panel` → gửi `OPEN_SIDE_PANEL`
**Verify**: `npm run typecheck` pass, `npm run test:unit` pass (sau khi update test)

### Task 6: Xóa subtitleDocking.ts + update tests
**Files**: XÓA `src/content/subtitleDocking.ts`, XÓA/SỬA `tests/unit/subtitleOverlay/subtitleDocking.test.ts`
**Acceptance**:
- `subtitleDocking.ts` xóa
- Test docking xóa hoặc refactor
- Không còn import `subtitleDocking` ở đâu
**Verify**: `npm run test:unit` pass, `npm run typecheck` pass

### Task 7: Vite config — sidepanel entry
**Files**: `vite.config.ts` (hoặc tương đương)
**Acceptance**:
- Vite build include `src/sidepanel/index.html` là entry point
- Build output có `sidepanel.html` + assets
**Verify**: `npm run build` thành công, `dist/` có sidepanel.html

### Task 8: Unit tests
**Files**: `tests/unit/sidepanel/sidePanelStore.test.ts`, `tests/unit/sidepanel/CueList.test.tsx`
**Acceptance**:
- Test store: set cues, update currentTime, highlight logic
- Test CueList: render cues, click seek, highlight current
**Verify**: `npm run test:unit` pass

### Task 9: Browser verify
**Sites**: themoviebox, lordflix, YouTube, hhpanda (iframe)
**Acceptance**:
- Overlay hiện trên video
- Toggle click → Side Panel mở
- Cue list hiển thị, highlight, scroll
- Click cue → seek
- Fullscreen → Side Panel vẫn nhìn thấy
- Iframe → overlay + Side Panel hoạt động
- No console error từ extension
**Verify**: MCP browser test, ghi report vào `docs/test-reports/`

### Task 10: Docs update
**Files**: `docs/2-architechture-system.md`, `docs/0-wiki.md`
**Acceptance**:
- Cây thư mục update (sidepanel/, xóa subtitleDocking.ts)
- Bảng phụ thuộc update
- Function index update
- ADR 008 reference
**Verify**: `ls` check file exist, docs consistent

## Task Dependency Order
```
Task 1 (manifest) ─┐
Task 2 (messages) ─┤
                    ├─▶ Task 3 (side panel app) ─┐
                    │                              ├─▶ Task 5 (content refactor) ─▶ Task 6 (xóa docking) ─▶ Task 8 (tests) ─▶ Task 9 (browser) ─▶ Task 10 (docs)
                    └─▶ Task 4 (background) ──────┘
Task 7 (vite) ─────┘
```

Tasks 1, 2, 7 có thể chạy song song. Task 3, 4 cần 1+2. Task 5 cần 3+4. Task 6 cần 5. Task 8 cần 3+5. Task 9 cần tất cả. Task 10 cuối.
