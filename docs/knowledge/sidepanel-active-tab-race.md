# Sidepanel active-tab race (sidepanel stuck on "No subtitles loaded")

> **Principle**: [Set active identity synchronously before filtering events](principles.md#set-active-identity-synchronously-before-filtering-events)

## Problem

User đang xem lordflix.org với sidepanel mở (hiển thị subtitle cues). Khi chuyển sang tab themoviebox.org có subtitle tự động load, sidepanel vẫn hiển thị **"No subtitles loaded"**. Chỉ khi đóng và mở lại sidepanel mới thấy subtitle của themoviebox.

## Root causes

Background dùng `activeTabIdForPanel` để lọc message relay sang sidepanel. Khi tab active thay đổi, `onTabActivated` cập nhật `activeTabIdForPanel` **bất đồng bộ** bên trong `getTab()`:

```ts
// src/entrypoints/background/wireEvents.ts (trước fix)
const onTabActivated = (activeInfo: { tabId: number; windowId: number }): void => {
  updateBadgeForTab(ctx, activeInfo.tabId);
  void getTab(activeInfo.tabId).then((tab) => {
    if (!tab.url || (!tab.url.startsWith('chrome-extension://') && !tab.url.startsWith('edge://'))) {
      ctx.activeTabIdForPanel = activeInfo.tabId;
    }
  }).catch(...);
};
```

Trong khoảng window từ khi `onTabActivated` fire đến khi `getTab` resolve, content-script của tab mới đã auto-load subtitle và gửi `SUBTITLE_CUES_LOADED`. Background handler `registerSubtitleHandlers` so sánh `payload.tabId` với `activeTabIdForPanel` cũ (vẫn là lordflix) → drop message, không relay sang sidepanel.

```ts
// src/entrypoints/background/handlers/subtitle.ts
if (payload.tabId !== undefined && payload.tabId !== ctx.activeTabIdForPanel) {
  return { success: true }; // silently dropped
}
```

Cues vẫn được cache vào `lastCuesByTab`, nhưng sidepanel đang mở không nhận được live message nên không tự refresh. Chỉ khi đóng/mở lại sidepanel, `REQUEST_SUBTITLE_CUES` mới lấy được từ cache.

## Fix

1. **`src/entrypoints/background/wireEvents.ts`**: set `activeTabIdForPanel` **đồng bộ ngay lập tức** trong `onTabActivated`, sau đó async verify/revert nếu là chrome-extension/edge tab:

```ts
const onTabActivated = (activeInfo: { tabId: number; windowId: number }): void => {
  updateBadgeForTab(ctx, activeInfo.tabId);
  ctx.activeTabIdForPanel = activeInfo.tabId; // synchronous
  void getTab(activeInfo.tabId).then((tab) => {
    if (tab.url?.startsWith('chrome-extension://') || tab.url?.startsWith('edge://')) {
      ctx.activeTabIdForPanel = undefined;
    }
  }).catch(...);
};
```

2. **`src/entrypoints/sidepanel/App.tsx`**: defense-in-depth — re-sync qua `REQUEST_SUBTITLE_CUES` khi `chrome.tabs.onUpdated` `status === 'complete'` cho active tab, để bắt cached cues nếu live message bị drop vì lý do nào đó.

## Key insight

Khi một event được relay/filter dựa trên "identity đang active" (active tab, focused window, selected item), identity đó phải được cập nhật **đồng bộ** với trigger đổi active. Nếu update bất đồng bộ, event từ scope mới sẽ đến trước khi filter identity kịp đổi → bị lọc nhầm sang scope cũ.

## Verification

- Browser verify:
  - Same-tab navigation lordflix → themoviebox: sidepanel tự động hiển thị 616 cues.
  - New active tab themoviebox: sidepanel tự động hiển thị 616 cues.
- Typecheck + build pass.
- Unit tests: 1296/1297 pass (1 pre-existing flaky `conversionTimer` test).
- Integration tests: 19/19 pass.
