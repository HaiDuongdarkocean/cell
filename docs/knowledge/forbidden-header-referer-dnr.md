# Forbidden Referer header → declarativeNetRequest modify at network stack (aniwatch/megaplay)

> **Principle**: [Forbidden headers in extension fetch → DNR modify at network stack](principles.md#forbidden-headers-in-extension-fetch--dnr-modify-at-network-stack)

## Problem

Extension phát hiện subtitle URL trên aniwatch.co.at nhưng tải về bị 403 Forbidden. Subtitle CDN (`1oe.lostproject.club`) yêu cầu `Referer` header từ `megaplay.buzz` (iframe player origin) — không chấp nhận top-level page URL (`aniwatch.co.at`) hay extension origin (`chrome-extension://...`).

Symptoms:
- Download subtitle: "Failed to fetch subtitle: 403"
- Auto-load overlay: subtitle fetch fail → overlay không hiển thị
- `resolveUnknownSubtitleLanguages`: fetch fail → language stays `unknown`

## Root causes

### Cause 1: `fetch()` cannot set `Referer` (forbidden header)

Chrome 72+ marks `Referer` as a **forbidden header** — `fetch()` từ extension SW (hoặc offscreen document) không thể set `Referer` qua `headers` option. Browser tự strip hoặc override thành extension origin (`chrome-extension://...`). Server kiểm tra Referer → 403.

Code cũ trong `downloader.ts:downloadSubtitle`:
```ts
const response = await fetch(subtitle.url, { credentials: 'same-origin' }); // ← no Referer → 403
```

Debug log (SW Console):
```
[downloadSubtitle DEBUG] {
  initiator: 'https://megaplay.buzz',
  headers: {Referer: 'https://megaplay.buzz', Origin: 'https://megaplay.buzz'},
  // headers SET in code, but browser strips Referer before sending
}
[downloadSubtitle DEBUG] response {status: 403, ok: false}
```

### Cause 2: `DetectedSubtitle` lacked `initiator` field

`chrome.webRequest.OnBeforeRequestDetails.initiator` chứa origin của frame phát ra request (iframe `megaplay.buzz`), khác với top-level tab URL (`aniwatch.co.at`). `DetectedSubtitle` không lưu field này → không biết Referer đúng cần set.

### Cause 3: 3 fetch paths all affected

Subtitle fetch xảy ra ở 3 path riêng biệt, tất cả đều cần DNR rule:
1. `downloadSubtitle` (downloader.ts) — user click Download
2. `FETCH_SUBTITLE_CONTENT` handler (subtitle.ts) — auto-load overlay CORS fallback
3. `resolveUnknownSubtitleLanguages` (helpers.ts) — fetch content để detect language khi URL extract = `unknown`

## Fix

### Step 1: Add `initiator` to data model

- `NetworkRequest` + `DetectedSubtitle` (types.ts): thêm `initiator?: string`
- `networkInterceptor.ts`: pass `details.initiator` vào `NetworkRequest`
- `subtitleDetector.ts`: pass `request.initiator` vào `DetectedSubtitle`
- `SubtitleForOverlayResult` + `FetchSubtitleContentPayload` (message types.ts): thêm `initiator?: string`
- `subtitleService.ts`: pass `initiator` qua `SubtitleForOverlayResult` (3 chỗ map)
- `subtitleAutoLoad.ts`: `fetchAndParseSubtitle` nhận `initiator`, truyền vào `fetchViaBackground`
- `contentScriptController.ts`: truyền `sub.initiator` vào `fetchAndParseSubtitle`

### Step 2: DNR helper

Tạo `src/shared/lib/chrome-apis/declarativeNetRequest.ts`:
- `setRefererRule(url, referer)`: register dynamic rule scoped to exact URL + extension origin (`initiatorDomains: [chrome.runtime.id]`) + `xmlhttprequest` resource type. Set `Referer` + `Origin` = referer. Return rule id.
- `removeRefererRule(ruleId)`: remove rule after fetch completes.
- Rule id counter persisted in `chrome.storage.session` (survive SW eviction).

### Step 3: Wire DNR into all 3 fetch paths

```ts
// Pattern dùng ở 3 chỗ (downloader.ts, subtitle.ts, helpers.ts):
let ruleId: number | undefined;
if (refererSource) {
  ruleId = await setRefererRule(url, refererSource);
}
try {
  response = await fetch(url, { credentials: 'same-origin' });
} finally {
  if (ruleId !== undefined) void removeRefererRule(ruleId).catch(() => {});
}
```

### Step 4: Manifest permission

`manifest.json`: thêm `"declarativeNetRequest"` permission.

## Key insight

`fetch()` từ extension context (SW, offscreen) không thể set forbidden headers (`Referer`, `Cookie`) — browser strip trước khi gửi. `declarativeNetRequest` chạy ở **network stack layer**, sau khi browser chuẩn bị headers, nên CAN rewrite forbidden headers. Rule scoped bằng `initiatorDomains: [chrome.runtime.id]` + exact URL → chỉ affect extension's own fetch, không break page requests. Rule phải được remove sau fetch (try/finally) để tránh rule accumulation.

Khác với principle "Extension SW lacks page context → MAIN world fetch": đó là thiếu cookies/origin (page context), fix bằng MAIN world content script. Bug này là: có đủ context nhưng browser cấm set `Referer` qua API → fix bằng DNR (network stack level, không phải page context level).

## Verification

### CLI test (curl.exe — không có forbidden header restriction)
```
megaplay.buzz referer → 200 OK (23KB VTT)
aniwatch.co.at referer → 403 Forbidden
no referer → 403 Forbidden
```

### Node.js test (mô phỏng buildFetchHeaders logic)
```
Test 1 (NEW logic — initiator preferred): 200 OK, WEBVTT ✓
Test 2 (OLD logic — videoTabUrl only): 403 ✗
Test 3 (bare fetch — no headers): 403 ✗
```

### Browser verify (Anh yêu test trên Edge thật)
```
[downloader] saveBlob: filename="Attack_on_Titan_Episode_25_English_Subbed_at_Aniwatch.srt", blobSize=16483
[downloader] saveBlob: download started id=183
→ Download thành công ✓
```

### Quality gates
- `npx tsc --noEmit` → pass
- `npm run test:unit` → 2216 passed, 4 skipped, 0 fail
- `npm run build` → pass
