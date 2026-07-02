# MutationObserver race: clear wipes add (learned while fixing lordflix.org subtitle autoload)

> **Principle**: [Order-dependent side effects → sequence explicitly](principles.md#order-dependent-side-effects--sequence-explicitly)

## Problem

Trên `lordflix.org` (SvelteKit SPA), extension detect 29 subtitle tracks trên initial load (ep7) nhưng **0-1 subtitle** sau khi chuyển episode (ep7→ep8) qua UI — mặc dù DOM ep8 vẫn có 27 `<track>` element và overlay UI re-init đúng.

Side panel query `GET_DETECTED_MEDIA` trả `subCount: 1` (chỉ 1 subtitle `vi` từ `DETECTED_SUBTITLE_URL` bridge), trong khi DOM có 27 tracks. Network log cho thấy 96 subtitle requests được gửi cho ep8.

## Root causes

### Hai MutationObservers trên cùng mutation batch

SvelteKit thay `<video>` + `<track>` trên episode switch → 1 mutation batch fire 2 observers:

1. **PageScanner observer** (`src/entrypoints/content/pageScanner.ts:120`) — registered **trước** trong `content-script.ts` init. Fire trước → gửi `PAGE_SCAN_RESULT` (27 ep8 track URLs) → background `mediaDetection.ts` handler add 27 subtitles vào `networkInterceptor.subtitles` map.

2. **EpisodeChangeWatcher observer** (`src/entrypoints/content/content-script.ts:183`) — registered **sau**. Fire sau → gửi `VIDEO_EPISODE_CHANGED` → background `sidePanelRelay.ts` handler gọi `clearTab(tabId)` → **wipe hết 27 subtitles vừa add**.

### Tại sao race xảy ra

MutationObserver callback fire theo **registration order** trong cùng microtask batch. PageScanner registered trước (line 45) → callback chạy trước → `PAGE_SCAN_RESULT` arrive background trước. EpisodeChangeWatcher registered sau (line 173) → callback chạy sau → `VIDEO_EPISODE_CHANGED` arrive background sau.

Background xử lý 2 message tuần tự:
1. `PAGE_SCAN_RESULT` → add 27 subtitles ✅
2. `VIDEO_EPISODE_CHANGED` → `clearTab` → wipe 27 subtitles ❌

Net effect: 0 subtitles. Chỉ 1 subtitle survive (từ `DETECTED_SUBTITLE_URL` bridge, fetch sau clear).

### Verification snippet (confidence 95%+)

Inject snippet mark video/track identity trên ep7, chuyển ep8, so sánh:
- `videoSameNodeAsEp7: false` → `<video>` replaced (new DOM node)
- `sameNodeAsEp7: false` cho tất cả `<track>` → new track nodes (not in-place src change)

Gửi `PAGE_SCAN_RESULT` thủ công từ sidepanel với 5 ep8 track URLs SAU khi clear đã chạy:
- `beforeCount: 1` → `afterCount: 6` (1 + 5 new) → **re-scan sau clear add thành công**

## Fix

Trong `reportEpisodeChangedIfReplacement` (`src/entrypoints/content/content-script.ts:156-185`):

```ts
void sendMessage({
  type: MESSAGE_TYPES.VIDEO_EPISODE_CHANGED,
  payload,
}).then(() => {
  // Await clear trước, rồi re-scan + re-send PAGE_SCAN_RESULT.
  // Clear được process trước, re-scan add sau → không bị wipe.
  const urls = scanner.scan();
  if (urls.videoUrls.length > 0 || urls.subtitleUrls.length > 0) {
    void sendMessage({
      type: MESSAGE_TYPES.PAGE_SCAN_RESULT,
      payload: { tabId: undefined, videoUrls: urls.videoUrls, subtitleUrls: urls.subtitleUrls },
    });
  }
});
```

Key: `await` (via `.then()`) `VIDEO_EPISODE_CHANGED` response → guarantee clear processed → re-scan + re-send `PAGE_SCAN_RESULT` → add sau clear, không bị wipe.

PageScanner observer vẫn fire trước và gửi `PAGE_SCAN_RESULT` đầu tiên (bị wipe), nhưng re-scan thứ 2 từ episode watcher restore lại sau clear.

## Key insight

Khi 2 observers react cùng DOM mutation và effect của observer B (clear shared state) phải chạy SAU effect của observer A (add vào shared state), không thể dựa vào registration order — browser dispatch theo registration order nhưng message bus xử lý tuần tự, và order A→B đúng cho add-then-clear (sai: clear wipe add). Phải **explicitly sequence**: await B's clear response, rồi re-run A's add. Re-scan idempotent (dedup by URL trong `networkInterceptor.handleRequest`).

## Verification

| State | Trước fix | Sau fix |
|---|---|---|
| Sau ep7→ep8 switch | `subCount: 1` (chỉ vi từ bridge) | `Target · English2 subtitles` + `Native · Vietnamese1 subtitle` |
| Overlay dropdown | 0 options | 2 English options (`English #1SRT`, `English #2SRT`) |
| Unit tests | 14/14 pageScanner pass | 14/14 pageScanner pass |
| Typecheck + build | pass | pass |

Browser check (Edge MCP): reload ep7 → click Episodes → click E8 → wait video ready + 5s → snapshot overlay UI. Trước fix: overlay rỗng/sai. Sau fix: overlay hiển thị 3+ subtitles đúng ep8.
