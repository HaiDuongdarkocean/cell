# Setup Guide — Testing Extension Browser

Chạy file này CHỈ khi guard trong SKILL.md FAIL. Không chạy nếu đã setup.

## Guard — kiểm tra trước

```
npm --version
node scripts/real-chrome-verify.mjs --help
Test-Path "<repo-root>\dist\manifest.json"
Test-Path "C:\cell-browser-sessions\master\Local State"
```

Tất cả PASS → dừng, không cần setup. Chỉ chạy bước nào FAIL.

## Bước 1: Cài Node.js + npm (nếu `npm --version` FAIL)

Tải từ https://nodejs.org/ hoặc dùng winget:

```
winget install OpenJS.NodeJS
```

## Bước 2: Build extension Cell (nếu `dist\manifest.json` FAIL)

```
cd "<repo-root>"
npm run build
```

## Bước 3: Tạo master profile (nếu `master\Local State` FAIL)

Mở Chrome với master profile, login các site cần test (YouTube, Google, streamduck...), rồi Ctrl+C để đóng:

```
npx playwright install chromium
node -e "const { chromium } = require('@playwright/test'); (async () => { const ctx = await chromium.launchPersistentContext('C:\\cell-browser-sessions\\master', { headless: false, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' }); const p = await ctx.newPage(); console.log('Master open. Ctrl+C to close.'); })();"
```

## Bước 4: Chuẩn bị .crx (nếu `cell.crx` FAIL)

```
python .agents/skills/testing-extension-browser/script/setup-cell-profile.py
```

Script sẽ pack `dist/` thành `cell.crx`, clone master, và in `CLONE_PATH`.

## Prerequisites

- Node.js + npm
- Playwright (`npm install` đã cài; `npx playwright install chromium` để tải binary)
- Chrome/Chromium bất kỳ được hỗ trợ (merge gate dùng Playwright bundled Chromium/Chrome-for-Testing)
- Python 3.11+ (chỉ để chạy `setup-cell-profile.py` pack .crx)

## Không cần

- `uv` (workflow mới dùng Node.js + Playwright).
- DevTools MCP chỉ là fallback cho trace/a11y, không phải merge gate.
- Google Chrome registry/policy để cài local .crx trên Windows (bị block từ Chrome 33).
