# Tab-Scoping (learned while fixing popup media leak)

> **Principle**: [Broadcasts fan out → scope by identifier](learned-bugfixes.md#broadcasts-fan-out--scope-by-identifier)

## Problem
Popup opened for tab A showed media from background tab B. Root cause: `handleGetDetectedMedia` and `handleDownloadAll` fell back to all-tab media when the active tab was empty, and `DETECTED_MEDIA_UPDATE` broadcasts were not tab-scoped.

## Fix
- `DetectedMediaUpdatePayload` now carries a required `tabId: number`.
- `handleGetDetectedMedia` returns empty when the requested tab has no media — NO all-tab fallback.
- `handleDownloadAll` returns `{ success: false, error: 'No media found for this tab' }` when the tab is empty — NO all-tab fallback.
- `useDetectedMedia` hook resolves the active content tab on mount via `getActiveContentTab()` (see "Edge app-window leak"), stores `tabId` in a ref, sends `GET_DETECTED_MEDIA { tabId }`, and filters `DETECTED_MEDIA_UPDATE` broadcasts by `payload.tabId === tabIdRef.current`.
- `NetworkInterceptor` capture stays global (correct — per-tab storage already works). Only the message-passing + popup layer needed scoping.

## Key insight
Chrome MV3 `chrome.runtime.sendMessage` cannot target a specific tab — broadcasts fan out to every listener. Since only one popup is active at a time, the popup filters by `tabId` in the payload rather than the background trying to target a tab.
