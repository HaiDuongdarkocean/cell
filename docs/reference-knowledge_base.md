# Knowledge Base — E2E Debugging with Chrome DevTools MCP

Tham chiếu cho live debug extension trên Chrome/Edge. Xem thêm: [docs/knowleadge/reference-chrome-devtools-mcp.md](knowleadge/reference-chrome-devtools-mcp.md) cho config MCP server.

## Overview
Chrome DevTools MCP cung cấp real-time browser inspection cho Chrome extensions:
- Inspect popup UI và DOM state
- Check console logs và errors
- Verify extension state (active/inactive, whitelist, settings)
- Test media detection real-time
- Debug auto-download behavior

## Available Tools
- `list_pages` - List all open tabs and extension pages
- `select_page` - Switch to a specific page/tab
- `evaluate_script` - Run JavaScript in the page context
- `get_console_messages` - Retrieve console logs (error/warning/info/debug)
- `navigate_to` - Navigate to URLs (note: not available in chrome-devtools MCP, use `browser_navigate` in mcp-playwright instead)

## Common Debugging Workflows

### 1. Inspect Popup State
```javascript
{
  extensionActive: document.querySelector('[data-testid="toggle-extension-btn"]')?.getAttribute('aria-pressed'),
  autoDownloadActive: document.querySelector('[data-testid="toggle-auto-download-btn"]')?.getAttribute('aria-pressed'),
  videoCards: document.querySelectorAll('[data-testid="video-card"]').length,
  subtitleCards: document.querySelectorAll('[data-testid="subtitle-card"]').length
}
```

### 2. Check Settings
```javascript
{
  totalOptions: document.querySelectorAll('[role="option"]').length,
  selectedOptionsCount: Array.from(document.querySelectorAll('[role="option"]'))
    .filter(opt => opt.getAttribute('aria-selected') === 'true').length,
  selectedText: Array.from(document.querySelectorAll('[role="option"]'))
    .filter(opt => opt.getAttribute('aria-selected') === 'true')
    .map(o => o.textContent?.trim())
}
```

### 3. Reload Extension
```javascript
async () => {
  const extensions = await new Promise((resolve) => {
    chrome.management.getAll(resolve);
  });
  const videoDownloader = extensions.find(ext =>
    ext.name.toLowerCase().includes('video') || ext.name.toLowerCase().includes('downloader')
  );
  if (videoDownloader) {
    await chrome.management.setEnabled(videoDownloader.id, false);
    await new Promise(r => setTimeout(r, 500));
    await chrome.management.setEnabled(videoDownloader.id, true);
    return { reloaded: true };
  }
  return { reloaded: false };
}
```

## MCP Server Comparison

### Chrome DevTools MCP
- **Pros**: Direct access to already-open Chrome instance, real-time inspection
- **Cons**: Cannot navigate to URLs (no `navigate_to` tool), limited to inspecting existing pages
- **Use case**: Quick inspection of running extension, checking console logs, verifying UI state

### Playwright MCP
- **Pros**: Full browser automation, can navigate to URLs, open/close pages, run E2E workflows
- **Cons**: Creates new browser instance (separate from development Chrome), slower for quick checks
- **Use case**: Full E2E testing, navigating to test pages, automated workflows

## Debugging Process

### Step 1: List Available Pages
```
mcp_call_tool("chrome-devtools", "list_pages", {})
```

### Step 2: Select Target Page
```
mcp_call_tool("chrome-devtools", "select_page", { pageId: 5 })
```

### Step 3: Inspect State
```
mcp_call_tool("chrome-devtools", "evaluate_script", {
  function: "() => { ... }"
})
```

### Step 4: Check Console
```
mcp_call_tool("chrome-devtools", "get_console_messages", {
  level: "error"
})
```

## Known Limitations
1. **No navigate_to in chrome-devtools MCP**: Use mcp-playwright for navigation, or manually navigate in Chrome before inspecting
2. **Extension reload requires chrome://extensions**: Cannot reload directly from chrome-devtools MCP, need to use chrome.management API via evaluate_script
3. **Service worker inspection**: Limited access to service worker console; use chrome://serviceworker-internals for detailed debugging
4. **Background script logs**: Console logs from background service worker may not appear in page console; check service worker console separately

## Best Practices
1. **Use Playwright MCP for full workflows**: When you need to navigate to pages and perform multi-step operations
2. **Use Chrome DevTools MCP for quick inspection**: When you already have Chrome open and want to check state quickly
3. **Add debug logging**: Add console.debug statements in code for better visibility during MCP debugging
4. **Check both page and service worker consoles**: Some logs appear in different contexts
5. **Verify extension is reloaded**: After code changes, always reload the extension before testing
6. **Wait for media detection**: Media detection is asynchronous; add delays (10-15s) after navigation before checking results

## Example: Debug Subtitle Auto-Download
```javascript
// 1. Navigate to content page
// 2. Wait 15s for media detection
await new Promise(resolve => setTimeout(resolve, 15000));

// 3. Check popup
{
  videoCards: document.querySelectorAll('[data-testid="video-card"]').length,
  subtitleCards: document.querySelectorAll('[data-testid="subtitle-card"]').length
}

// 4. Check settings (open settings dialog first)
{
  selectedSubtitleLanguages: Array.from(document.querySelectorAll('[role="option"]'))
    .filter(opt => opt.getAttribute('aria-selected') === 'true')
    .map(o => o.textContent?.trim())
}

// 5. Check console for debug logs
// Look for [NetworkInterceptor] Detected media messages
```
