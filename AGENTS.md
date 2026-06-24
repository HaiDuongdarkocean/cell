# Project Knowledge

## Tab-Scoping (learned while fixing popup media leak)

### Problem
Popup opened for tab A showed media from background tab B. Root cause: `handleGetDetectedMedia` and `handleDownloadAll` fell back to all-tab media when the active tab was empty, and `DETECTED_MEDIA_UPDATE` broadcasts were not tab-scoped.

### Fix
- `DetectedMediaUpdatePayload` now carries a required `tabId: number`.
- `handleGetDetectedMedia` returns empty when the requested tab has no media — NO all-tab fallback.
- `handleDownloadAll` returns `{ success: false, error: 'No media found for this tab' }` when the tab is empty — NO all-tab fallback.
- `useDetectedMedia` hook queries the active tab on mount (`chrome.tabs.query({ active: true, currentWindow: false })` with `lastFocusedWindow` fallback), stores `tabId` in a ref, sends `GET_DETECTED_MEDIA { tabId }`, and filters `DETECTED_MEDIA_UPDATE` broadcasts by `payload.tabId === tabIdRef.current`.
- `NetworkInterceptor` capture stays global (correct — per-tab storage already works). Only the message-passing + popup layer needed scoping.

### Key insight
Chrome MV3 `chrome.runtime.sendMessage` cannot target a specific tab — broadcasts fan out to every listener. Since only one popup is active at a time, the popup filters by `tabId` in the payload rather than the background trying to target a tab.

### Pre-existing e2e issues (NOT regressions)
- `redesigned-popup.spec.ts:24` and `m3u8-local.spec.ts:65` fail with strict mode violation: `[data-testid="empty-media"]` resolves to 2 elements (media-section + downloads-section share the same testid). Fix: scope the locator, e.g. `getByTestId('media-section').getByTestId('empty-media')`.

## Commands
```
Build:      npm run build
Typecheck:  npm run typecheck
Test:       npm test
Test watch: npm run test:watch
Coverage:   npm run test:coverage
Lint:       npm run lint
Lint fix:   npm run lint:fix
E2E:        npm run test:e2e
```

Note: `npm test -- --testPathPattern=` is deprecated in jest 30; use `--testPathPatterns=`.

## PowerShell note
PowerShell does not support bash heredoc (`<<'EOF'`). For multi-line git commit messages, write to a temp file and use `git commit -F <file>`.
