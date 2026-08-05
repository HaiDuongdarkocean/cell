# Setup Guide — Testing Extension Browser

Chạy file này CHỈ khi guard trong SKILL.md FAIL. Không chạy nếu đã setup.

## Guard — kiểm tra trước

```
uv --version
Test-Path "C:\Users\The0cean\Programming\The0cean ecosystem\cell\dist\manifest.json"
Test-Path "C:\stealth-mcp-browser-sessions\master\Local State"
Test-Path "C:\Users\The0cean\Programming\The0cean ecosystem\cell\data\extension\uBOLite\manifest.json"
uv run --python 3.11 --with nodriver python -c "import nodriver; print('OK')"
```

Tất cả PASS → dừng, không cần setup. Chỉ chạy bước nào FAIL.

## Bước 1: Cài uv (nếu `uv --version` FAIL)

```
winget install astral-sh.uv
```

## Bước 2: Build extension Cell (nếu `dist\manifest.json` FAIL)

```
cd "C:\Users\The0cean\Programming\The0cean ecosystem\cell"
npm run build
```

## Bước 3: Tạo master profile (nếu `master\Local State` FAIL)

Mở Chrome với master profile, login các site cần test (YouTube, Google, streamduck...), rồi Ctrl+C để đóng:

```
uv run --python 3.11 --with nodriver python -c "import asyncio,nodriver as uc
async def m():
    b=await uc.start(uc.Config(user_data_dir=r'C:\stealth-mcp-browser-sessions\master',browser_executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe'))
    print('Master open. Ctrl+C to close.',flush=True)
    await asyncio.Event().wait()
uc.loop().run_until_complete(m())"
```

## Bước 4: Verify uBOLite (nếu `uBOLite\manifest.json` FAIL)

uBOLite phải có sẵn trong repo tại `data/extension/uBOLite/`. Nếu thiếu, check git hoặc download từ https://github.com/gorhill/uBlock/releases.

## Prerequisites

- Chrome installed tại `C:\Program Files\Google\Chrome\Application\chrome.exe`
- Node.js + npm (để `npm run build`)
- Python 3.11 (uv tự tải nếu thiếu — `uv run --python 3.11` tự download)
- nodriver (uv tự cài — `--with nodriver`)

## Không cần

- stealth-chrome-devtools MCP server (script dùng nodriver trực tiếp, không qua MCP)
- pip install (uv quản lý packages)
