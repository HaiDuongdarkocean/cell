# Learned Bug Fixes

Level 2 reference — load when debugging similar issues or working on auto-download/tab-scoping.

## Auto-download subtitle catch-up (incremental media detection)

### Problem
Auto-download downloaded the video but NOT subtitles. Root cause: `NetworkInterceptor.onMediaDetected` fires incrementally — the m3u8 is captured first, subtitles arrive later. The first fire (video only) ran `tryAutoDownload`, enqueued the video, and set a per-tab URL guard (`autoDownloadedTabs: Map<tabId, url>`). When subtitles arrived in the second fire, `maybeAutoDownload` saw the guard matched the URL and returned early, so subtitles were never enqueued.

### Fix
- `tryAutoDownload` now takes an optional `alreadyEnqueuedIds: ReadonlySet<string>` and returns `Promise<string[]>` (the media ids it enqueued this call; empty = silent no-op). Selected media whose id is in the set is skipped, so a follow-up call enqueues only newly discovered subtitles without re-downloading the video.
- `BackgroundService.autoDownloadedTabs` changed from `Map<tabId, url>` to `Map<tabId, { url, enqueuedIds: Set<string> }>`.
- `maybeAutoDownload` two branches:
  1. **Same page load** (state.url === tabUrl): call `tryAutoDownload` with `state.enqueuedIds`, add returned ids to the set (subtitle catch-up).
  2. **Fresh page load** (no state or URL changed): call `tryAutoDownload` fresh, store `{ url, enqueuedIds: new Set(newIds) }`.
- Guard is still cleared on `tabs.onUpdated` loading and `tabs.onRemoved`, so navigation to a different episode under the same whitelisted category still auto-downloads fresh.

### Key insight
The URL guard was too coarse — it prevented ALL re-runs for the same page, including the legitimate subtitle catch-up. The fix separates "don't re-download the video" (id-level dedup) from "allow new subtitles to be caught up" (re-run with skip set). `selectBestMedia` is pure and cheap, so re-running it each incremental fire and diffing against enqueued ids is safe.

## Tab-Scoping (learned while fixing popup media leak)

### Problem
Popup opened for tab A showed media from background tab B. Root cause: `handleGetDetectedMedia` and `handleDownloadAll` fell back to all-tab media when the active tab was empty, and `DETECTED_MEDIA_UPDATE` broadcasts were not tab-scoped.

### Fix
- `DetectedMediaUpdatePayload` now carries a required `tabId: number`.
- `handleGetDetectedMedia` returns empty when the requested tab has no media — NO all-tab fallback.
- `handleDownloadAll` returns `{ success: false, error: 'No media found for this tab' }` when the tab is empty — NO all-tab fallback.
- `useDetectedMedia` hook resolves the active content tab on mount via `getActiveContentTab()` (see "Edge app-window leak" below), stores `tabId` in a ref, sends `GET_DETECTED_MEDIA { tabId }`, and filters `DETECTED_MEDIA_UPDATE` broadcasts by `payload.tabId === tabIdRef.current`.
- `NetworkInterceptor` capture stays global (correct — per-tab storage already works). Only the message-passing + popup layer needed scoping.

### Key insight
Chrome MV3 `chrome.runtime.sendMessage` cannot target a specific tab — broadcasts fan out to every listener. Since only one popup is active at a time, the popup filters by `tabId` in the payload rather than the background trying to target a tab.

## Edge app-window leak (popup renders empty on Edge)

### Problem
On Edge, the Media + Downloads sections rendered completely empty (no console error). On Chrome the same extension + same page worked fine. Root cause: Edge ships built-in app-windows (e.g. the dictionary sidebar at `chrome-extension://<id>/pages/app-window/index.html#/app/dictionary`) that are themselves `active: true` and live in their own window. The popup hooks previously used `chrome.tabs.query({ active: true, currentWindow: false })` then `tabs[0]?.id` to grab "the active tab in a browser window, not the popup window". On Edge that query returns the app-window tab (a `chrome-extension://` URL), not the content tab. The background then looked up media/downloads for the extension tab id, found nothing, and the popup rendered empty with no error. The `lastFocusedWindow: true` fallback returned `null` on Edge, so it did not save the case.

### Fix
- New helper `src/popup/utils/getActiveContentTab.ts` exports `getActiveContentTab()` and `getActiveContentTabId()`. It runs 3 `chrome.tabs.query` shapes IN PARALLEL via `Promise.all` (currentWindow:true, lastFocusedWindow:true, `{}` all tabs), merges candidates in priority order, and picks the first one whose URL is NOT a `chrome-extension://` page. A tab with no URL (loading / restricted / mocked) is still accepted — chrome-extension tabs always carry a `chrome-extension://` URL, so a missing URL never masks one.
- `useDetectedMedia`, `useDownloadProgress`, and the auto-download whitelist check in `App.redesigned.tsx` all now use this helper instead of inline `currentWindow: false` + `tabs[0]?.id` logic. The inline `getActiveContentTab` previously duplicated in `App.redesigned.tsx` was removed in favor of the shared helper (DRY).

### Key insight
`chrome.tabs.query({ active: true, currentWindow: false })` is a fragile trick for "active tab in a browser window, not the popup window". It assumes the only other active tab is the content tab. Edge's app-windows break that assumption. The robust pattern is: gather candidates from several query shapes, then filter out `chrome-extension://` URLs explicitly. This works on both Chrome (no app-window interference) and Edge. Tests that flush microtasks need ~2 extra `await Promise.resolve()` because `Promise.all` over 3 queries adds overhead vs the old 2-sequential-await path.

### Pre-existing e2e issues (fixed)
- `redesigned-popup.spec.ts` and `m3u8-local.spec.ts` previously failed with strict mode violation: `[data-testid="empty-media"]` resolved to 2 elements (media-section + downloads-section share the same testid). Fixed by scoping the locator: `[data-testid="media-section"] [data-testid="empty-media"]`.
