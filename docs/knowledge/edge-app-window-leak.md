# Edge app-window leak (popup renders empty on Edge)

> **Principle**: [Gather candidates + filter by explicit criteria](learned-bugfixes.md#gather-candidates--filter-by-explicit-criteria)

## Problem
On Edge, the Media + Downloads sections rendered completely empty (no console error). On Chrome the same extension + same page worked fine. Root cause: Edge ships built-in app-windows (e.g. the dictionary sidebar at `chrome-extension://<id>/pages/app-window/index.html#/app/dictionary`) that are themselves `active: true` and live in their own window. The popup hooks previously used `chrome.tabs.query({ active: true, currentWindow: false })` then `tabs[0]?.id` to grab "the active tab in a browser window, not the popup window". On Edge that query returns the app-window tab (a `chrome-extension://` URL), not the content tab. The background then looked up media/downloads for the extension tab id, found nothing, and the popup rendered empty with no error. The `lastFocusedWindow: true` fallback returned `null` on Edge, so it did not save the case.

## Fix
- New helper `src/popup/utils/getActiveContentTab.ts` exports `getActiveContentTab()` and `getActiveContentTabId()`. It runs 3 `chrome.tabs.query` shapes IN PARALLEL via `Promise.all` (currentWindow:true, lastFocusedWindow:true, `{}` all tabs), merges candidates in priority order, and picks the first one whose URL is NOT a `chrome-extension://` page. A tab with no URL (loading / restricted / mocked) is still accepted — chrome-extension tabs always carry a `chrome-extension://` URL, so a missing URL never masks one.
- `useDetectedMedia`, `useDownloadProgress`, and the auto-download whitelist check in `App.redesigned.tsx` all now use this helper instead of inline `currentWindow: false` + `tabs[0]?.id` logic. The inline `getActiveContentTab` previously duplicated in `App.redesigned.tsx` was removed in favor of the shared helper (DRY).

## Key insight
`chrome.tabs.query({ active: true, currentWindow: false })` is a fragile trick for "active tab in a browser window, not the popup window". It assumes the only other active tab is the content tab. Edge's app-windows break that assumption. The robust pattern is: gather candidates from several query shapes, then filter out `chrome-extension://` URLs explicitly. This works on both Chrome (no app-window interference) and Edge. Tests that flush microtasks need ~2 extra `await Promise.resolve()` because `Promise.all` over 3 queries adds overhead vs the old 2-sequential-await path.

## Pre-existing e2e issues (fixed)
- `redesigned-popup.spec.ts` and `m3u8-local.spec.ts` previously failed with strict mode violation: `[data-testid="empty-media"]` resolved to 2 elements (media-section + downloads-section share the same testid). Fixed by scoping the locator: `[data-testid="media-section"] [data-testid="empty-media"]`.
