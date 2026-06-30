# ADR-011: Side Panel Per-Tab State (Active Tab Tracking + Message Filter)

## Status
Accepted (đã implement + verify bằng Edge DevTools MCP; v2 strict filter fix
highlight flicker regression khi 2 tab cùng play)

## Context

ADR-008 đưa subtitle cues vào Chrome Side Panel. Background relay
`SUBTITLE_CUES_LOADED` / `VIDEO_TIME_UPDATE` / `VIDEO_PLAY_STATE` từ
content-script → side panel qua `chrome.runtime.sendMessage`. ADR-009 +
ADR-010 fix media accumulation trên navigation.

**Bug phát hiện**: khi user mở 2 tab (themoviebox + kisskh), switch giữa
2 tab, side panel không hồi quy subtitle của tab cũ:

1. Mở themoviebox (tab A) → autoload sub → panel hiện sub themoviebox.
2. Mở kisskh (tab B) → autoload sub → panel nhận `SUBTITLE_CUES_LOADED`
   của kisskh → ghi đè store → panel hiện sub kisskh.
3. Switch về tab A → **không có event nào** báo panel đổi active tab →
   panel vẫn hiện sub kisskh (stale).

**Root causes (3 lớp đồng thời)**:

1. **Background relay strip `tabId`** — `handleSubtitleCuesLoaded`,
   `handleVideoTimeUpdate`, `handleVideoPlayState` relay
   `chrome.runtime.sendMessage({ type, payload: { ... } })` **không có
   `tabId`**. Side panel không có cách nào filter theo active tab.
2. **Side panel không lắng nghe `chrome.tabs.onActivated`** — không biết
   khi nào user switch tab → không re-fetch cues cho tab mới.
3. **Side panel không lắng nghe `chrome.tabs.onUpdated` (loading)** — khi
   same-tab navigate, background `lastCuesByTab.delete(tabId)` nhưng panel
   không clear store → stale cues.

**Constraint**: `lastCuesByTab` cache per-tab **đã hoạt động đúng**
(`handleSubtitleCuesLoaded` cache `payload.tabId → cues`, ADR-008 D5).
Chỉ cần panel hỏi lại `REQUEST_SUBTITLE_CUES` cho active tab.

## Decision

### D1: Background relay `tabId` trong payload gửi side panel
3 handlers (`handleSubtitleCuesLoaded`, `handleVideoTimeUpdate`,
`handleVideoPlayState`) thêm `tabId: payload.tabId` vào payload relay.
MessageBus đã inject `sender.tab.id` vào `payload.tabId` cho
content→background (xem `messageBus.ts:104-108`), nên tabId đã có sẵn —
chỉ cần pass-through.

### D2: Side panel track active tab + filter messages
`src/sidepanel/App.tsx`:
- `activeTabIdRef` (useRef) — track active content tab id.
- `syncActiveTab(tabId)` — reset store (cues/time/play) + re-fetch cached
  cues qua `REQUEST_SUBTITLE_CUES`. Guard `activeTabIdRef.current === tabId`
  trước khi `setCues` (race: user switch nhanh giữa 2 fetch).
- `chrome.tabs.onActivated` listener → `syncActiveTab(activeInfo.tabId)`.
- `chrome.tabs.onUpdated` listener (loading) → nếu `tabId ===
  activeTabIdRef.current` → clear store (mirror background
  `lastCuesByTab.delete`).
- Message listener filter: **strict** — drop khi `payload.tabId !==
  activeTabIdRef.current` (kể cả khi `activeTabIdRef.current === undefined`,
  panel vừa mount). `syncActiveTab` re-fetch cues qua `REQUEST_SUBTITLE_CUES`
  sau khi resolve sẽ bù lại. **Không có race fallback** — fallback accept-all
  khi undefined gây regression: 2 tab cùng play → `VIDEO_TIME_UPDATE` từ cả 2
  tab được accept trong race window → `currentTimeMs` nhảy giữa 2 tab →
  highlight nháy + auto-scroll giật (xem "Regression v2" bên dưới).

### D3: Reuse pattern từ popup
`useDetectedMedia.ts:51` (`payload.tabId === tabIdRef.current`) đã là
pattern filter per-tab cho popup. Side panel áp dụng cùng pattern +
thêm `onActivated` listener (popup không cần vì popup mở lại mỗi lần
click → luôn resolve active tab mới; side panel persist qua tab switch).

## Ponytail ceiling
- **Background tab navigate while not active**: `onUpdated` loading clear
  chỉ chạy cho active tab. Tab background navigate không clear panel —
  nhưng panel không hiển thị tab đó nên không bug. Upgrade: track mọi tab
  lifecycle nếu panel ever shows non-active tabs.
- **Store global, không per-tab**: chỉ 1 panel active tại một thời điểm,
  panel chỉ cần phản ánh active tab → ref + reset đủ. Refactor per-tab
  store = over-engineering (YAGNI). Upgrade: per-tab store nếu panel cần
  cache state của nhiều tab song song.

## Verification (Edge DevTools MCP, themoviebox ↔ kisskh)
- Cache per-tab: themoviebox=761 cues, kisskh=713 cues (sau autoload). ✓
- Activate kisskh → panel: 713 cues, "♪ low, tense music ♪ / My God. Get
  Carter..." (Dutton Ranch). ✓
- Activate themoviebox → panel: 761 cues, "[Galadriel] Nothing is evil in
  the beginning..." (Rings of Power) — **regression hồi quy đúng**. ✓
- Unit tests: 3 tests mới (VIDEO_TIME_UPDATE relay tabId, VIDEO_PLAY_STATE
  relay tabId, SUBTITLE_CUES_LOADED undefined tabId — panel drops it) +
  1 assertion update — 103/103 pass. ✓
- `npx tsc --noEmit`: 0 errors. ✓
- `npm run build`: OK. ✓

## Regression v2 (highlight flicker khi 2 tab cùng play) + fix
**Symptom**: 2 tab cùng play, reload panel → trong race window (~2s đầu,
trước khi `getActiveContentTabId` resolve), highlight nháy giữa 2 tab
li tục + auto-scroll giật vị trí.

**Root cause**: Race fallback `activeId !== undefined` trong filter —
accept mọi `VIDEO_TIME_UPDATE` khi `activeTabIdRef.current === undefined`
→ `currentTimeMs` nhảy giữa themoviebox (~2676s) và kisskh (~317s) →
`currentCueIndex` thay đổi liên tục → highlight nháy + scrollIntoView giật.

**Fix**: Bỏ race fallback — strict filter `payload.tabId !== activeId`
(kể cả khi `activeId === undefined`). `syncActiveTab` re-fetch cues qua
`REQUEST_SUBTITLE_CUES` sau khi resolve sẽ bù lại; active tab's live
`VIDEO_TIME_UPDATE` sẽ populate sau khi resolve.

**Verify v2** (Edge DevTools MCP, 2 tab cùng play + reload panel):
| i | Before fix (race fallback) | After fix (strict filter) |
|---|---|---|
| 0 | 00:45:22.416 (themoviebox) | 00:00:37.041 (themoviebox) |
| 1 | 00:05:55.666 (kisskh) | 00:00:37.041 (themoviebox) |
| 2 | 00:45:22.416 (themoviebox) | 00:00:37.041 (themoviebox) |
| 3 | 00:05:55.666 (kisskh) | null (gap giữa 2 cue) |
| 5 | 00:05:55.666 (kisskh) | 00:00:42 (themoviebox) |
| 6-11 | nhảy 2 tab liên tục | 00:00:42 (themoviebox) ổn định |

Highlight chỉ phản ánh themoviebox (active tab), không nhảy sang kisskh. ✓
Console clean. ✓

## Files changed
- `src/background/index.ts`: 3 handlers thêm `tabId` vào payload relay
- `src/sidepanel/App.tsx`: `activeTabIdRef` + `syncActiveTab` +
  `onActivated`/`onUpdated` listeners + **strict message filter** (no race
  fallback)
- `tests/unit/background/integration.test.ts`: 3 tests mới + 1 assertion
  update

## Regression v3 (highlight vẫn nháy dù strict filter) + fix đúng
**Symptom**: Sau v2 fix (strict filter), 2 tab cùng play → highlight VẪN
nháy giữa themoviebox (00:24:11) và kisskh (00:00:33).

**Root cause THẬT**: `chrome.runtime.sendMessage` từ content-script **broadcast
đến TẤT CẢ extension listeners** — bao gồm background VÀ side panel trực tiếp.
Content-script gửi `VIDEO_TIME_UPDATE` với `tabId: undefined` (line 179
content-script.ts):
1. Background nhận → messageBus inject `sender.tab.id` → handler filter
   đúng → relay chỉ active tab.
2. **Side panel CŨNG nhận trực tiếp** → `tabId: undefined` trong payload gốc
   → bypass background filter hoàn toàn → panel accept (v2 strict filter
   chỉ drop `tabId !== activeId`, nhưng `undefined !== activeId` cũng drop...
   nhưng wait, v2 drop undefined → panel không nhận time update nào → đứng yên).

Thực tế v2 fix đã drop undefined đúng, nhưng bug vẫn nháy vì **background
relay (có tabId) đến SAI tab** — background `activeTabIdForPanel` chưa được
track (không có field nào), nên background relay MỌI tab → panel nhận cả 2
stream (tabId=themoviebox + tabId=kisskh), filter `activeTabIdRef` mong manh
(race giữa 2 syncActiveTab, Edge app-window can thiệp) → flicker.

**Fix v3 (two-layer filter)**:
1. **Background filter (Layer 1)**: thêm `activeTabIdForPanel` field, track
   qua `onActivated` (filter content tabs — accept no URL, reject
   chrome-extension://, edge://) + init qua `chrome.tabs.query` ở init step 8.
   3 relay handlers chỉ relay khi `payload.tabId === activeTabIdForPanel`.
   → Panel không bao giờ nhận message từ background tab.
2. **Side panel filter (Layer 2 — defense-in-depth)**: drop `tabId === undefined`
   (raw content-script broadcast, bypass background) + drop `tabId !== activeTabIdRef`
   (defense-in-depth nếu background's activeTabIdForPanel stale do SW restart).

**Verify v3** (Edge DevTools MCP, 2 tab cùng play):
| Scenario | Before v3 | After v3 |
|---|---|---|
| themoviebox active, both play | nháy 00:24:11 ↔ 00:00:33 | 00:24:11 ổn định (i=0-3), null (i=4-11 gap) ✓ |
| switch → kisskh active | — | 713 cues, 00:00:49 → 00:00:51 (kisskh play, time tăng) ✓ |
| console | — | clean ✓ |

**Lesson**: `chrome.runtime.sendMessage` fan out đến MỌI extension listener
(background + side panel + popup), không chỉ background. Filter ở 1 lớp
(side panel) không đủ nếu `activeTabIdRef` mong manh. Filter ở background
(relay point, ground truth = `sender.tab.id`) + side panel (defense-in-depth)
= two-layer filter, mỗi lớp độc lập, bug chỉ xảy ra khi CẢ HAI fail cùng lúc.

## Files changed (v3)
- `src/background/index.ts`: `activeTabIdForPanel` field + `onActivated`
  tracking (filter content tabs) + init step 8 (`chrome.tabs.query`) + 3
  relay handlers filter `payload.tabId === activeTabIdForPanel`
- `src/sidepanel/App.tsx`: two-layer filter (drop `tabId === undefined` +
  drop `tabId !== activeTabIdRef`)
- `tests/unit/background/integration.test.ts`: 6 tests (3 active relay + 3
  non-active drop) — 106/106 pass
