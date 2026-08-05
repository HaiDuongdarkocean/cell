---
name: testing-extension-browser
description: Launch stealth Chrome with Cell + uBlock loaded via nodriver CDP loadUnpacked, navigate, reload, verify. Auto-clones from master per run — safe for 20+ parallel agents, auto-cleanup on exit. Use when starting any Cell browser test, after rebuild, or when a fresh agent needs the test browser. Not for non-extension pages or performance traces.
---

# Testing Extension Browser

## Setup check (1 dòng — chạy mỗi lần trước khi dùng skill)

```
Test-Path "C:\stealth-mcp-browser-sessions\master\Local State","C:\Users\The0cean\Programming\The0cean ecosystem\cell\dist\manifest.json","C:\Users\The0cean\Programming\The0cean ecosystem\cell\data\extension\uBOLite\manifest.json"
```

- **True, True, True** → đã setup, đi thẳng đến "Run"
- **Có False** → đọc `SETUP.md`, chạy bước tương ứng (1 lần duy nhất)

## Why

Chrome 137+ blocks `--load-extension`. stealth MCP `execute_cdp_command` only supports Runtime CDP — no Extensions domain. nodriver has full CDP access and can call `Extensions.loadUnpacked`. This script is the SSOT for the correct load method + clone-from-master + auto-cleanup.

## Run

```powershell
uv run --python 3.11 --with nodriver python -u .agents\skills\testing-extension-browser\script\test-cell-browser.py
uv run --python 3.11 --with nodriver python -u .agents\skills\testing-extension-browser\script\test-cell-browser.py --url "https://streamduck.site/"
uv run --python 3.11 --with nodriver python -u .agents\skills\testing-extension-browser\script\test-cell-browser.py --headless --url "https://www.youtube.com/watch?v=YQHsXMglC9A"
```

Flags: `--url <url>` `--headless` `--no-ublock` `--no-reload` `--keep-profile` `--exit-after-verify`

**Chế độ hiển thị (default):** cửa sổ Chrome hiện ra. Dùng cho test thông thường.
**`--headless`:** không hiện cửa sổ. Chỉ dùng khi yêu cầu trực tiếp (batch 10+ agent, CI, không cần nhìn UI).

## Lưu ý khi dùng

### DON'T → DO

| DON'T | DO thay thế | Lý do |
|---|---|---|
| **DON'T chạy script mà chưa build** | **DO `npm run build` trước** | Script load từ `dist/`, không phải `src/` — không build = extension cũ hoặc thiếu |
| **DON'T dùng Python 3.14** | **DO `uv run --python 3.11`** | Python 3.14 có bug encoding nodriver — 3.11 là bản duy nhất hoạt động |
| **DON'T bỏ `-u` flag** | **DO `python -u` (unbuffered)** | Không có `-u` thì output treo, không thấy log cho đến khi script exit |
| **DON'T truyền `user_data_dir` vào script** | **DO để script tự quản lý clone** | Script tự tạo clone UUID riêng, tự cleanup. Truyền `user_data_dir` = persistent profile, leak disk |
| **DON'T dùng `--load-extension` flag** | **DO dùng CDP `loadUnpacked` (script đã làm)** | Chrome 137+ blocks `--load-extension` trong branded builds |
| **DON'T dùng stealth MCP `execute_cdp_command` để load extension** | **DO dùng nodriver script** | stealth MCP chỉ hỗ trợ Runtime CDC, không có Extensions domain |
| **DON'T kill Chrome bằng `Stop-Process`** | **DO dùng Ctrl+C hoặc `--exit-after-verify`** | `Stop-Process` không trigger cleanup → clone leak |
| **DON'T chạy 10+ agent headed trên máy <16GB RAM** | **DO dùng `--headless` cho batch lớn** | 10 Chrome headed = 6-10GB RAM → swap. Headless giảm ~40% RAM |
| **DON'T quên `--no-ublock` nếu chỉ test Cell** | **DO thêm `--no-ublock` khi test Cell đơn lẻ** | uBlock chặn quảng cáo — có thể ảnh hưởng test nếu cần verify ads/network |
| **DON'T edit `dist/` trực tiếp** | **DO edit `src/` rồi `npm run build`** | `dist/` là build output — script load `dist/` mỗi run |
| **DON'T chạy 2 script cùng `--keep-profile` cùng clone** | **DO mỗi agent 1 clone riêng (UUID khác nhau)** | Cùng clone = lock profile |
| **DON'T để master mở khi chạy batch** | **DO đóng master trước khi chạy batch** | Master đang mở → clone có thể stale (cookies/login không cập nhật) |
| **DON'T bỏ qua clone leak sau kill hard** | **DO cleanup: `Remove-Item C:\stealth-mcp-browser-sessions\sessions\cell-* -Recurse -Force`** | Clone leak tích lũy disk |

## What the script does

1. Clone master → `sessions/cell-<uuid>` (0.4MB — only cookies/login/preferences, no cache)
2. Spawn nodriver with clone (anti-bot: navigator.webdriver=false)
3. CDP `loadUnpacked(dist)` → Cell loaded
4. CDP `loadUnpacked(uBOLite)` → uBlock loaded
5. Navigate to URL
6. Reload page → trigger content script
7. Verify `#cell-universal-panel-host` → MARKER_FOUND
8. On exit (Ctrl+C/signal/crash) → auto-cleanup clone

## Parallel safety

Each run gets unique clone dir (`cell-<uuid>`). 20 agents = 20 clones, no collision. Clone is 0.4MB (vs master 124MB) — only copies Cookies, Login Data, Web Data, Preferences, Local Storage. Cache/model dirs excluded.

## SSOT paths

| Key | Value |
|---|---|
| Cell ext | `C:\Users\The0cean\Programming\The0cean ecosystem\cell\dist` (run `npm run build` first) |
| uBlock ext | `C:\Users\The0cean\Programming\The0cean ecosystem\cell\data\extension\uBOLite` |
| Master profile | `C:\stealth-mcp-browser-sessions\master` (has logins — clone source) |
| Clones | `C:\stealth-mcp-browser-sessions\sessions\cell-<uuid>` (auto-deleted) |
| Python | 3.11 via `uv run` (3.14 has nodriver encoding bug) |

## Failures

| Symptom | Fix |
|---|---|
| Marker not found | Re-run script (it reloads page) |
| `Extensions.loadUnpacked` error | `dist/` missing — run `npm run build` |
| Clone leak (process killed hard) | `Remove-Item C:\stealth-mcp-browser-sessions\sessions\cell-* -Recurse -Force` |
| Python encoding error | Use `uv run --python 3.11` |

## Verify

- [ ] Script prints `[OK] Cloned master`
- [ ] Script prints `[OK] Cell loaded` + `[OK] uBlock loaded`
- [ ] Script prints `[PASS] Cell extension is running`
- [ ] Clone dir deleted after exit

## Router boomerang

Task changes? Invoke `/using-agent-skills` to re-route.
