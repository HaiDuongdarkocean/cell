# Knowledge Base — chrome-devtools MCP

Hướng dẫn sử dụng chrome-devtools-mcp để live debug & test extension trên Chrome và Edge.

## Nguồn chính thức

- README + config flags: https://github.com/ChromeDevTools/chrome-devtools-mcp
- Tool reference đầy đủ: https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/tool-reference.md
- Chrome downloads API (onDeterminingFilename): https://developer.chrome.com/docs/extensions/reference/api/downloads#event-onDeterminingFilename

## Cài đặt MCP server

### Config cho Chrome (default)

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["-y", "chrome-devtools-mcp@latest", "--categoryExtensions"]
    }
  }
}
```

### Config cho Edge

Edge là Chromium-based nên chrome-devtools-mcp hoạt động bằng cách trỏ `--executablePath` tới `msedge.exe`:

```json
{
  "mcpServers": {
    "edge-devtools": {
      "command": "npx",
      "args": [
        "-y",
        "chrome-devtools-mcp@latest",
        "--isolated",
        "--categoryExtensions",
        "--executablePath=C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
      ]
    }
  }
}
```

### Config flags quan trọng

| Flag | Mô tả | Default |
|------|-------|---------|
| `--isolated` | Temp user-data-dir, wipe khi đóng browser | `false` |
| `--categoryExtensions` | Bật 5 tools quản lý extension (install/list/reload/trigger/uninstall) | `false` |
| `--executablePath` | Path tới browser binary (dùng cho Edge) | Chrome stable |
| `--browser-url` | Connect tới browser đang chạy (vd `http://127.0.0.1:9222`) | — |
| `--autoConnect` | Attach vào Chrome 144+ đang chạy (cần `chrome://inspect/#remote-debugging`) | `false` |
| `--headless` | Chạy không UI | `false` |
| `--channel` | Chrome channel: `canary`, `dev`, `beta`, `stable` | `stable` |

> **Lưu ý**: `--categoryExtensions` chỉ hoạt động với pipe connection (default). Không tương thích với `--autoConnect`, `--browserUrl`, `--wsEndpoint` cho đến khi Chrome 149 được release.

## Workflow debug extension trên Edge/Chrome

### Bước 1: Build extension

```bash
npm run build  # output → dist/
```

### Bước 2: Install extension vào browser qua MCP

```
mcp_call_tool(edge-devtools, "install_extension", { path: "D:\\Tool\\learning apply skill\\cell\\dist" })
```

Tool `install_extension` nhận **absolute path** tới unpacked extension folder (chứa `manifest.json`).

### Bước 3: List extensions để lấy ID

```
mcp_call_tool(edge-devtools, "list_extensions", {})
```

Return: `[{ name, id, version, enabled }]`. Lưu lại `id` cho các bước sau.

### Bước 4: Navigate tới trang test

```
mcp_call_tool(edge-devtools, "navigate_page", { type: "url", url: "https://themoviebox.org/..." })
```

> **Lưu ý**: KHÔNG dùng `evaluate_script` với `location.href = ...` để navigate — dùng `navigate_page` tool chính thức. `evaluate_script` chỉ chạy sau khi page đã load.

### Bước 5: Trigger extension action (mở popup)

```
mcp_call_tool(edge-devtools, "trigger_extension_action", { id: "<extension-id>" })
```

This opens the extension popup. Sau đó dùng `take_snapshot` để inspect popup DOM.

### Bước 6: Tương tác popup qua snapshot

```
mcp_call_tool(edge-devtools, "take_snapshot", {})
```

Snapshot trả về tree DOM với `uid` cho mỗi element. Dùng `uid` để `click`, `fill`, v.v.

### Bước 7: Đọc Service Worker console

```
mcp_call_tool(edge-devtools, "list_console_messages", { serviceWorkerId: "<sw-id>" })
```

`serviceWorkerId` filter chỉ trả log của service worker đó. Lấy `sw-id` từ `list_pages` (service worker hiện như page riêng).

### Bước 8: Reload extension sau khi code change

```
mcp_call_tool(edge-devtools, "reload_extension", { id: "<extension-id>" })
```

Sau khi `npm run build` lại, gọi `reload_extension` để load code mới không cần restart browser.

## Tool reference tóm tắt

### Navigation (6 tools)

| Tool | Mô tả | Params chính |
|------|-------|--------------|
| `navigate_page` | Đi tới URL / back / forward / reload | `type`, `url` |
| `new_page` | Mở tab mới + load URL | `url`, `background` |
| `list_pages` | List tất cả tab + page đang mở | — |
| `select_page` | Chọn page active | `pageId` |
| `close_page` | Đóng tab | `pageId` |
| `wait_for` | Chờ điều kiện | — |

### Input automation (10 tools)

| Tool | Mô tả | Params chính |
|------|-------|--------------|
| `click` | Click element | `uid` |
| `fill` | Type vào input/select | `uid`, `value` |
| `fill_form` | Fill nhiều inputs cùng lúc | `elements[]` |
| `hover` | Hover element | `uid` |
| `press_key` | Nhấn phím/shortcut | `key` (vd "Enter", "Control+A") |
| `type_text` | Type text vào focused input | `text`, `submitKey` |
| `drag` | Kéo element | `from_uid`, `to_uid` |
| `upload_file` | Upload file qua input | `filePath`, `uid` |
| `handle_dialog` | Xử lý alert/confirm/prompt | `action`, `promptText` |
| `click_at` | Click theo tọa độ | `x`, `y` |

### Debugging (8 tools)

| Tool | Mô tả | Params chính |
|------|-------|--------------|
| `evaluate_script` | Chạy JS trong page context | `function`, `args`, `filePath` |
| `take_snapshot` | Snapshot DOM tree (trả `uid` cho mỗi element) | — |
| `take_screenshot` | Chụp màn hình | `filePath`, `quality` |
| `list_console_messages` | List console logs | `serviceWorkerId`, `types`, `includePreservedMessages` |
| `get_console_message` | Lấy 1 message theo ID | `msgid` |
| `screencast_start` | Bắt đầu screencast | — |
| `screencast_stop` | Dừng screencast | — |
| `lighthouse_audit` | Chạy Lighthouse audit | — |

### Extensions (5 tools — cần `--categoryExtensions`)

| Tool | Mô tả | Params chính |
|------|-------|--------------|
| `install_extension` | Install unpacked extension | `path` (absolute) |
| `list_extensions` | List extension + ID + version | — |
| `reload_extension` | Reload extension (sau build) | `id` |
| `trigger_extension_action` | Mở popup (click toolbar icon) | `id` |
| `uninstall_extension` | Gỡ extension | `id` |

### Network (2 tools)

| Tool | Mô tả | Params chính |
|------|-------|--------------|
| `list_network_requests` | List network requests | `resourceType` filter |
| `get_network_request` | Chi tiết 1 request | `reqid` |

### Performance (3 tools)

| Tool | Mô tả | Params chính |
|------|-------|--------------|
| `performance_start_trace` | Bắt đầu trace | `config` |
| `performance_stop_trace` | Dừng trace + phân tích | — |
| `performance_analyze_insight` | Phân tích 1 insight | `insight` |

### Memory (9 tools)

Heap snapshot tools: `take_heapsnapshot`, `close_heapsnapshot`, `get_heapsnapshot_class_nodes`, `get_heapsnapshot_details`, `get_heapsnapshot_dominators`, `get_heapsnapshot_edges`, `get_heapsnapshot_retainers`, `get_heapsnapshot_retaining_paths`, `get_heapsnapshot_summary`.

## Gotchas

### [M01] `--isolated` tạo temp profile sạch — không có extension sẵn

`--isolated` tạo user-data-dir mới tinh mỗi lần. Extension phải install qua `install_extension` tool mỗi session. Nếu muốn giữ extension giữa các session, bỏ `--isolated` (dùng default profile `~/.cache/chrome-devtools-mcp/chrome-profile`).

### [M02] `--categoryExtensions` không hoạt động với `--browser-url` / `--autoConnect`

Pipe connection only. Nếu attach vào browser đang chạy (`--browser-url`), extension tools không khả dụng. Phải để MCP launch browser riêng.

### [M03] `evaluate_script` chạy trong PAGE context, không phải extension context

`evaluate_script` không thấy `chrome.*` APIs (chỉ extension context mới có). Để debug extension logic:
- Dùng `list_console_messages` với `serviceWorkerId` để đọc SW log
- Hoặc thêm `console.debug(...)` vào code, build, reload, đọc log

### [M04] Navigate bằng `navigate_page`, KHÔNG dùng `evaluate_script` với `location.href`

`evaluate_script` trả về trước khi navigation hoàn tất → race condition. `navigate_page` chờ page load xong rồi mới return.

### [M05] `edge://extensions` và `chrome://extensions` là restricted URLs

MCP không inspect được restricted URLs. Dùng `install_extension` / `list_extensions` / `reload_extension` tools thay vì manual UI.

### [M06] Service Worker hiện như page riêng trong `list_pages`

Service worker target có type khác page target. Dùng `serviceWorkerId` param trong `list_console_messages` để filter log của SW cụ thể.

### [M07] Reload extension sau mỗi `npm run build`

```
npm run build  # rebuild dist/
→ mcp_call_tool(edge-devtools, "reload_extension", { id: "<id>" })
```

Không cần restart browser. `reload_extension` load code mới ngay lập tức.

### [M08] `list_console_messages` không đáng tin cho Service Worker log

MV3 service worker có thể bị terminate giữa các MCP call (idle timeout ~30s). Khi SW terminate, console log buffer cũng mất. `list_console_messages({ serviceWorkerId })` thường trả `<no console messages found>` ngay cả khi SW đã `console.log` trước đó.

**Workaround**: Dùng `evaluate_script` với `serviceWorkerId` để query trực tiếp `chrome.*` APIs — nhanh và tin cậy hơn đọc log:

```js
// Ví dụ: verify filename download thực tế
evaluate_script({
  function: "async () => { const items = await new Promise(r => chrome.downloads.search({ limit: 5, orderBy: ['-startTime'] }, r)); return items.map(it => ({ id: it.id, filename: it.filename, state: it.state })); }",
  serviceWorkerId: "sw-1"
})
```

Cách này:
- Không phụ thuộc SW còn sống (evaluate_script sẽ wake SW nếu đã terminate)
- Trả data JSON-serializable trực tiếp, không cần parse log text
- Tin cậy hơn cho verification (data từ API, không phải log string)

**Khi nào dùng `list_console_messages`**: Chỉ khi cần đọc log của PAGE (popup/content script), không phải SW. Hoặc khi cần đọc error stack trace mà không thể query qua API.

### [M09] Edge path trên Windows

```
C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe  (x64 Edge, 32-bit install dir)
C:\Program Files\Microsoft\Edge\Application\msedge.exe        (alternative)
```

Verify path tồn tại trước khi config. Edge Canary/Beta/Dev:
- `msedge-beta` → `C:\Program Files (x86)\Microsoft\Edge Beta\Application\msedge.exe`
- `msedge-dev` → `C:\Program Files (x86)\Microsoft\Edge Dev\Application\msedge.exe`
- `msedge-canary` → `C:\Users\<user>\AppData\Local\Microsoft\Edge SxS\Application\msedge.exe`

## Workflow debug tiêu chuẩn cho extension

```
1. npm run build
2. install_extension({ path: "D:\\...\\dist" })     ← lần đầu
   reload_extension({ id: "<id>" })                  ← từ lần 2
3. list_extensions() → lưu extension ID
4. navigate_page({ url: "https://test-site.com" })
5. wait cho webRequest capture media (2-5s)
6. trigger_extension_action({ id: "<id>" })          ← mở popup
7. take_snapshot() → inspect popup DOM
8. click({ uid: "<download-btn-uid>" })              ← trigger download
9. evaluate_script({ serviceWorkerId: "<sw>", function: ... }) ← query chrome.* API trực tiếp
   (list_console_messages không đáng tin cho SW — xem [M08])
10. Kiểm tra filename/state từ chrome.downloads.search() response
```

## So sánh: Live debug (MCP) vs E2E (Playwright)

| Tiêu chí | Live debug (MCP) | E2E (Playwright) |
|---|---|---|
| Mục đích | Tìm root cause | Prove fix + guard recurrence |
| Tốc độ | Nhanh (browser đang mở) | Chậm (launch + load + assert) |
| Repeatable | Không (interactive) | Có (chạy 1000 lần) |
| CI | Không | Có |
| Inspect DOM/console | Trực tiếp | Gián tiếp (locator + expect) |
| Bảo vệ code | Không | Có (test commit vào repo) |

**Rule of thumb**: Bug chưa rõ nguyên nhân → live debug. Bug đã fix → viết E2E guard test. Không ship fix chỉ với live-debug verification.
