# Side Panel Per-Tab State (specific, codebase-coupled)

> **Principle**: [Filter broadcast messages by active tab + re-fetch on tab switch](principles.md#filter-broadcast-messages-by-active-tab)

## Problem

Side panel là 1 panel chung cho cả window. Khi user mở 2 tab (themoviebox
+ kisskh) và switch giữa 2 tab, panel không hồi quy subtitle của tab cũ:

1. Mở themoviebox (tab A) → autoload sub → panel hiện sub themoviebox.
2. Mở kisskh (tab B) → autoload sub → panel nhận `SUBTITLE_CUES_LOADED`
   của kisskh → ghi đè store → panel hiện sub kisskh.
3. Switch về tab A → panel vẫn hiện sub kisskh (stale) — **sai**, phải
   hồi quy sub themoviebox.

Symptom: panel phản ánh tab cuối cùng gửi `SUBTITLE_CUES_LOADED`, không
phản ánh tab user đang xem.

## Root causes (3 lớp đồng thời)

1. **Background relay strip `tabId`** — `handleSubtitleCuesLoaded` /
   `handleVideoTimeUpdate` / `handleVideoPlayState` relay
   `chrome.runtime.sendMessage({ type, payload: { ... } })` không có
   `tabId`. Panel không có cách nào filter theo active tab.
2. **Side panel không lắng nghe `chrome.tabs.onActivated`** — không biết
   user switch tab → không re-fetch cues cho tab mới.
3. **Side panel không lắng nghe `chrome.tabs.onUpdated` (loading)** — khi
   same-tab navigate, background `lastCuesByTab.delete(tabId)` nhưng panel
   không clear store → stale cues.

`lastCuesByTab` cache per-tab **đã hoạt động đúng** (ADR-008 D5) — chỉ
cần panel hỏi lại `REQUEST_SUBTITLE_CUES` cho active tab.

## Fix (ADR-011)

### Background: relay `tabId` trong payload
3 handlers thêm `tabId: payload.tabId` vào payload relay. MessageBus đã
inject `sender.tab.id` vào `payload.tabId` cho content→background, nên
tabId đã có sẵn — chỉ cần pass-through.

### Side panel: track active tab + filter + re-fetch
- `activeTabIdRef` (useRef) — track active content tab id.
- `syncActiveTab(tabId)` — reset store + re-fetch cached cues qua
  `REQUEST_SUBTITLE_CUES`. Guard `activeTabIdRef.current === tabId` trước
  khi `setCues` (race: user switch nhanh).
- `chrome.tabs.onActivated` → `syncActiveTab(activeInfo.tabId)`.
- `chrome.tabs.onUpdated` (loading, active tab only) → clear store.
- Message filter: **two-layer** (ADR-011 v3):
  - Layer 1 (background): `activeTabIdForPanel` field, track qua `onActivated`
    (filter content tabs) + init `chrome.tabs.query`. 3 relay handlers chỉ
    relay khi `payload.tabId === activeTabIdForPanel`. → Panel không bao giờ
    nhận message từ background tab.
  - Layer 2 (side panel, defense-in-depth): drop `tabId === undefined` (raw
    content-script broadcast, bypass background) + drop `tabId !== activeTabIdRef`.
  - **Bắt buộc 2 lớp** vì `chrome.runtime.sendMessage` fan out đến MỌI
    extension listener (background + side panel), không chỉ background. Filter
    1 lớp (side panel) không đủ nếu `activeTabIdRef` mong manh (race, Edge
    app-window). Filter background (ground truth = `sender.tab.id`) + side
    panel (defense-in-depth) = bug chỉ xảy ra khi CẢ HAI fail cùng lúc.

### Reuse pattern từ popup
`useDetectedMedia.ts:51` (`payload.tabId === tabIdRef.current`) đã là
pattern filter per-tab cho popup. Side panel áp dụng cùng pattern + thêm
`onActivated` listener (popup không cần vì popup mở lại mỗi lần click →
luôn resolve active tab mới; side panel persist qua tab switch).

## Key insight

**Cache per-tab đã có sẵn** (ADR-008 D5 `lastCuesByTab`) — bug không phải
cache, mà là panel không hỏi đúng tab. Fix = panel track active tab +
re-fetch trên switch + filter incoming messages.

Pattern: **broadcast + two-layer filter** (background `activeTabIdForPanel`
+ side panel `activeTabIdRef`) + **re-fetch on `onActivated`** (mới cho side
panel, popup không cần vì reopen mỗi click). Background filter = ground truth
(`sender.tab.id`), side panel filter = defense-in-depth.

## Regression v2 (highlight flicker khi 2 tab cùng play) + fix
**Symptom**: 2 tab cùng play, reload panel → trong race window (~2s đầu),
highlight nháy giữa 2 tab + auto-scroll giật vị trí.

**Root cause**: Race fallback `activeId !== undefined` trong filter —
accept mọi `VIDEO_TIME_UPDATE` khi `activeTabIdRef.current === undefined`
→ `currentTimeMs` nhảy giữa 2 tab → `currentCueIndex` thay đổi → highlight
nháy + scrollIntoView giật.

**Fix**: Bỏ race fallback — strict filter. `syncActiveTab` re-fetch bù lại.

**Lesson**: Race fallback "accept all khi chưa resolve" **sai** — nó giải
quyết "drop SUBTITLE_CUES_LOADED đến trước khi resolve" nhưng tạo bug
nghiêm trọng hơn (trộn 2 tab). Strict filter + re-fetch là đúng.

## Regression v3 (highlight vẫn nháy dù strict filter) + fix đúng
**Symptom**: Sau v2 fix (strict filter side panel), 2 tab cùng play →
highlight VẪN nháy giữa themoviebox (00:24:11) và kisskh (00:00:33).

**Root cause THẬT**: `chrome.runtime.sendMessage` từ content-script **broadcast
đến TẤT CẢ extension listeners** — bao gồm background VÀ side panel trực tiếp.
Content-script gửi `tabId: undefined` → side panel nhận trực tiếp (bypass
background). Nhưng v2 strict filter drop undefined → panel đứng yên. Bug thật
là **background relay MỌI tab** (không có `activeTabIdForPanel` field) → panel
nhận 2 stream (tabId=themoviebox + tabId=kisskh), `activeTabIdRef` mong manh
→ flicker.

**Fix v3 (two-layer filter)**:
1. Background: `activeTabIdForPanel` + `onActivated` tracking + 3 relay
   handlers filter `payload.tabId === activeTabIdForPanel`.
2. Side panel: drop `tabId === undefined` (raw broadcast) + drop
   `tabId !== activeTabIdRef` (defense-in-depth).

**Lesson v3**:
1. `chrome.runtime.sendMessage` fan out đến MỌI extension listener (background
   + side panel + popup), không chỉ background. Phải filter ở **mọi listener**.
2. Filter ở background (relay point, ground truth = `sender.tab.id`) an toàn
   hơn filter ở side panel (`activeTabIdRef` mong manh). Background filter =
   primary, side panel filter = defense-in-depth.
3. Khi bug vẫn còn sau fix, **dừng fix vặt và quay về nguyên lý** — trace flow
   thật (grep sender, đọc content-script payload), không đoán.

## Verification (Edge DevTools MCP, themoviebox ↔ kisskh)
- Cache per-tab: themoviebox=761 cues, kisskh=713 cues (sau autoload). ✓
- Activate kisskh → panel: 713 cues, "♪ low, tense music ♪ / My God. Get
  Carter..." (Dutton Ranch). ✓
- Activate themoviebox → panel: 761 cues, "[Galadriel] Nothing is evil in
  the beginning..." (Rings of Power) — **regression hồi quy đúng**. ✓
- Unit tests: 3 tests mới + 1 assertion update — 103/103 pass. ✓
- `npx tsc --noEmit`: 0 errors. ✓
- `npm run build`: OK. ✓
