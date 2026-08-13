# Subtitle Search — Browser Test Plan (MCP)

> Test trên Chrome thật via `testing-extension-browser` skill + stealth-chrome-devtools MCP.
> Mỗi test case có AC mapping, steps, expected result, pass/fail criteria.
> **Anh duyệt trước khi em execute.**

## Prerequisites

1. **Build extension:** `npm run build` (production) hoặc `npx vite build --mode development`
2. **Launch Chrome + load extension:** `uv run --python 3.11 --with nodriver python -u .agents/skills/testing-extension-browser/script/test-cell-browser.py --keep-profile`
3. **MCP connect:** `spawn_browser(user_data_dir=<clone path>, headless=false)`
4. **Test URLs:**
   - Movie: `https://themoviebox.xyz/movies/oh-boy-was-i-wrong-about-her-KZp0CGxDxI2?id=2281575019673174328&type=/movie/detail&detailSe=&detailEp=&lang=en`
   - TV: `https://kisskh.co/Drama/Perfect-Crown/Episode-1?id=11923&ep=207851&page=0&pageSize=100`
   - Movie (alt): `https://moviepire.ru/watch/125988?s=1&e=2&me=10`
5. **API keys:** Cần ít nhất 1 SubDL key + 1 OpenSubtitles key (anh cung cấp hoặc nhập thủ công trong test)

---

## Phase A: Settings — ApiKeyManager (AC #4, #5, #9, #10)

### A1: Settings dialog có "Subtitle search keys" section
- **AC:** #4 — Settings dialog có ApiKeyManager section
- **Steps:**
  1. Navigate đến `https://themoviebox.xyz/movies/...`
  2. Mở Cell popup → click Settings icon
  3. Scroll sidebar, tìm "Subtitle search keys"
  4. Click vào section đó
- **Expected:** Section "Subtitle search keys" hiển thị, có 2 provider groups (SubDL / OpenSubtitles), mỗi group có form add key
- **Pass:** Section tồn tại + 2 provider groups visible
- **Fail:** Section không tồn tại hoặc chỉ có 1 provider

### A2: Add SubDL key
- **AC:** #5 — add (provider + key + label)
- **Steps:**
  1. Trong section "Subtitle search keys", tìm SubDL group
  2. Select provider = "SubDL" (nếu form chung)
  3. Input key = <SubDL API key>
  4. Input label = "Test SubDL"
  5. Click "Add"
- **Expected:** Key card mới xuất hiện trong SubDL group, hiển thị:
  - Label "Test SubDL"
  - Masked key `••••<last4>`
  - Status badge "Unverified" (gray)
- **Pass:** Key card hiển thị đúng label + masked key + status unverified
- **Fail:** Key không thêm, hoặc status sai, hoặc key không mask

### A3: Add OpenSubtitles key
- **AC:** #5 — add (provider + key + label)
- **Steps:**
  1. Tương tự A2 nhưng chọn provider = "OpenSubtitles"
  2. Input key = <OS API key>
  3. Input label = "Test OS"
  4. Click "Add"
- **Expected:** Key card mới trong OpenSubtitles group, status "Unverified"
- **Pass:** Key card hiển thị đúng
- **Fail:** Key không thêm

### A4: Edit key label
- **AC:** #5 — edit (label/key)
- **Steps:**
  1. Click "Edit" trên key card "Test SubDL"
  2. Đổi label → "Main SubDL"
  3. Save
- **Expected:** Label cập nhật thành "Main SubDL", key value không đổi
- **Pass:** Label = "Main SubDL", masked key không đổi
- **Fail:** Label không update hoặc key bị xóa

### A5: Delete key với confirm dialog
- **AC:** #5, #10 — delete (confirm), accessibility
- **Steps:**
  1. Click "Delete" trên 1 key card
  2. Confirm dialog hiện
  3. Click "Cancel" → key vẫn còn
  4. Click "Delete" lại → click "Delete" trong confirm → key biến mất
- **Expected:** Confirm dialog hiện trước khi xóa, Cancel giữ key, Delete xóa key
- **Pass:** Dialog confirm + Cancel giữ key + Delete xóa key
- **Fail:** Xóa không confirm, hoặc Cancel vẫn xóa

### A6: Key mask hiển thị đúng
- **AC:** #5 — masked key (last 4 chars only)
- **Steps:**
  1. Add key = "abcdefgh1234"
  2. Quan sát key card
- **Expected:** Hiển thị `••••1234` (chỉ last 4 chars)
- **Pass:** Mask = `••••1234`
- **Fail:** Hiển thị full key hoặc mask sai

### A7: Status badge colors
- **AC:** #5 — status badge: Active (green) / Rate-limited (amber) / Invalid (red) / Unverified (gray)
- **Steps:**
  1. Add 1 key mới → status "Unverified" (gray badge)
  2. Quan sát badge color
- **Expected:** Unverified = gray badge
- **Pass:** Badge gray
- **Fail:** Badge sai color

---

## Phase B: Search UI — No key state (AC #1, #12)

### B1: No key = collapsed search section
- **AC:** #1 — Không có key → collapsed + hint "Add API key in Settings" + link mở Settings
- **Pre:** Xóa tất cả keys trong Settings trước
- **Steps:**
  1. Navigate đến `https://themoviebox.xyz/movies/...`
  2. Mở Cell floating panel (SubtitleManagerPanel)
  3. Quan sát section search ở trên cùng
- **Expected:** Search section collapsed, hiển thị hint "Add API key in Settings to search subtitles" + button/link mở Settings
- **Pass:** Hint text + Settings link visible, không có search input
- **Fail:** Search input hiện nhưng không có key, hoặc không có hint

### B2: Click hint link mở Settings
- **AC:** #1 — link mở Settings
- **Steps:**
  1. Từ B1, click "Open Settings" hoặc hint link
- **Expected:** Settings dialog mở, scroll đến "Subtitle search keys" section
- **Pass:** Settings dialog mở
- **Fail:** Không mở Settings

---

## Phase C: Search UI — Has key state (AC #1, #2, #8, #10)

### C1: Has key = expanded search section
- **AC:** #1 — Có ≥1 key → search section expanded
- **Pre:** Add ít nhất 1 SubDL key (từ Phase A)
- **Steps:**
  1. Navigate đến `https://themoviebox.xyz/movies/...`
  2. Mở SubtitleManagerPanel
  3. Quan sát search section
- **Expected:** Search section expanded: query input + language select + season/episode inputs + Search button
- **Pass:** Tất cả form elements visible
- **Fail:** Section vẫn collapsed dù có key

### C2: Search movie by name
- **AC:** #2 — gõ tên phim + chọn ngôn ngữ → nhận danh sách
- **Steps:**
  1. Query input = "Inception"
  2. Language select = "English" (hoặc target language)
  3. Click Search (hoặc đợi debounce 300ms)
  4. Đợi results
- **Expected:**
  - Loading state: spinner trong Search button + skeleton results
  - After ~1-3s: results list hiển thị, mỗi result có name + language + source (SubDL) + format
  - Results `role="listbox"`, mỗi item `role="option"`
- **Pass:** Results hiển thị ≥1 result từ SubDL
- **Fail:** No results, no loading state, hoặc crash

### C3: Debounce 300ms
- **AC:** #8, #11 — debounce 300ms + AbortController
- **Steps:**
  1. Gõ "In" → đợi 300ms → search trigger
  2. Gõ tiếp "ception" nhanh (trong 300ms) → search trước bị abort
  3. Quan sát loading state
- **Expected:** Chỉ search "Inception" (full query), không search "In" riêng
- **Pass:** 1 search request cho "Inception", không có request cho "In"
- **Fail:** Multiple requests hoặc search "In" riêng

### C4: Abort in-flight khi gõ thêm
- **AC:** #8 — New input abort in-flight
- **Steps:**
  1. Gõ "Inception" → search bắt đầu (loading)
  2. Trong khi loading, gõ thêm " Inception 2010"
  3. Quan sát loading state
- **Expected:** Previous search aborted, new search bắt đầu, không có stale results
- **Pass:** Loading state reset, results từ query mới
- **Fail:** Stale results từ query cũ hiện lên

### C5: Search TV series với season/episode
- **AC:** #2 — TV series trả về episode đúng, không phải season zip
- **Steps:**
  1. Navigate đến `https://kisskh.co/Drama/Perfect-Crown/Episode-1?id=11923&ep=207851`
  2. Mở SubtitleManagerPanel
  3. Query = "Perfect Crown"
  4. Season = 1, Episode = 1
  5. Language = English
  6. Search
- **Expected:** Results chứa subtitle cho S1E1, không phải season pack zip
- **Pass:** Results có episode-specific subtitles
- **Fail:** Chỉ season pack, hoặc không có results

### C6: Empty results
- **AC:** #2 — no results
- **Steps:**
  1. Query = "xyzabc123nonexistent"
  2. Search
- **Expected:** "No results found" message
- **Pass:** Empty state message hiển thị
- **Fail:** Blank, hoặc error, hoặc crash

### C7: Accessibility — listbox + option roles
- **AC:** #10 — results list `role="listbox"` + items `role="option"`
- **Steps:**
  1. Search "Inception" → có results
  2. Inspect DOM: results container + each result item
- **Expected:** Container có `role="listbox"`, mỗi item có `role="option"`
- **Pass:** ARIA roles đúng
- **Fail:** Thiếu role attributes

---

## Phase D: Download + Load (AC #3, #4, #8)

### D1: Click result → role picker
- **AC:** #4 — Click result → chọn role (Target/Native)
- **Steps:**
  1. Search "Inception" → có results
  2. Click 1 result
- **Expected:** 2 buttons hiện: "Load as Target" + "Load as Native"
- **Pass:** Role picker visible với 2 buttons
- **Fail:** Auto-load không cho chọn role, hoặc không có buttons

### D2: Load as Target
- **AC:** #4 — background resolve download → parse → load vào role → overlay hiển thị cues
- **Steps:**
  1. Từ D1, click "Load as Target"
  2. Đợi download + parse
- **Expected:**
  - Subtitle tải từ SubDL (direct GET)
  - Parse thành cues
  - Overlay hiển thị target subtitle cues
  - Nav cluster update (cue count)
  - Offset reset
  - Item mới trong Target section với `source: 'searched'`, label "Searched"
- **Pass:** Overlay hiển thị cues + item "Searched" trong Target section
- **Fail:** Không load, crash, hoặc load sai role

### D3: Load as Native
- **AC:** #4 — load vào native role
- **Steps:**
  1. Search "Inception" → click result → "Load as Native"
- **Expected:** Subtitle load vào Native section, overlay hiển thị native cues
- **Pass:** Native section có item "Searched" + overlay hiển thị
- **Fail:** Load sai role

### D4: Replace existing subtitle
- **AC:** User story #2 — Load vào role thay thế track hiện tại
- **Pre:** Đã có target subtitle (auto-detected hoặc imported)
- **Steps:**
  1. Search → click result → "Load as Target"
  2. Quan sát Target section
- **Expected:** Target section thay thế track cũ bằng searched track
- **Pass:** Target section có item "Searched" mới, track cũ bị thay thế
- **Fail:** Track cũ vẫn còn hoặc crash

### D5: Persist parsed text (cache)
- **AC:** #4 — Persist parsed text (reload page không re-download)
- **Steps:**
  1. Load subtitle via search (D2)
  2. Click same result again → "Load as Target" lần 2
- **Expected:** Lần 2 không gửi RESOLVE_SUBTITLE_DOWNLOAD (cache hit), load nhanh hơn
- **Pass:** Lần 2 nhanh hơn (cache hit, no network)
- **Fail:** Re-download mỗi lần

---

## Phase E: Fallback chain (AC #3)

### E1: SubDL 0 results → OpenSubtitles fallback
- **AC:** #3 — SubDL 0 results → OpenSubtitles
- **Pre:** Có cả SubDL + OS key
- **Steps:**
  1. Search query mà SubDL không có nhưng OS có (ví dụ rare language)
  2. Quan sát results
- **Expected:** Results từ OpenSubtitles hiển thị (source = "opensubtitles")
- **Pass:** Results có source "opensubtitles"
- **Fail:** No results dù OS có

### E2: All keys exhausted → error message
- **AC:** #3 — All keys exhausted → toast "All keys exhausted"
- **Pre:** Xóa tất cả keys
- **Steps:**
  1. Search "Inception"
- **Expected:** Error message "No API key for subdl" hoặc "All keys exhausted"
- **Pass:** Error message hiển thị rõ ràng
- **Fail:** Silent fail hoặc crash

---

## Phase F: Error handling (AC #7, #8)

### F1: Network error
- **AC:** #7 — Network error → toast + UI error state, không crash
- **Steps:**
  1. Disconnect internet (or block API domain)
  2. Search "Inception"
- **Expected:** Error message "Network error: ..." hiển thị, UI không crash
- **Pass:** Error message + UI vẫn responsive
- **Fail:** Crash hoặc blank

### F2: Invalid key → status update
- **AC:** #7, key rotation — 401/403 → mark invalid
- **Steps:**
  1. Add key sai = "invalidkey123"
  2. Search
- **Expected:** Key status đổi thành "Invalid" (red badge) trong Settings, error message hiển thị
- **Pass:** Key status = "Invalid" sau search
- **Fail:** Key vẫn "Unverified" hoặc crash

### F3: 3s timeout
- **AC:** #7 — 3s timeout per request
- **Steps:**
  1. Block API domain (slow response)
  2. Search + đợi 3s
- **Expected:** Sau 3s, error "Network error: timeout" hoặc tương tự
- **Pass:** Timeout error sau ~3s
- **Fail:** Hang vô thời gian

---

## Phase G: Responsive (AC #9)

### G1: Mobile 320px — search section
- **AC:** #9 — Search section hoạt động trên mobile (320px)
- **Steps:**
  1. Set viewport = 320px (MCP `set_viewport`)
  2. Mở SubtitleManagerPanel
  3. Quan sát search section
- **Expected:**
  - Search input full-width
  - Lang/S/E wrap below input
  - Search button full-width
  - Results 1 column, max-height 40vh, scroll
- **Pass:** Layout responsive, không tràn
- **Fail:** Layout broken, tràn, hoặc elements chồng chéo

### G2: Mobile 320px — ApiKeyManager
- **AC:** #9 — ApiKeyManager hoạt động trên mobile
- **Steps:**
  1. Set viewport = 320px
  2. Mở Settings → "Subtitle search keys"
  3. Quan sát
- **Expected:** Key cards stack vertically (1 column), form inputs full-width
- **Pass:** 1 column layout, inputs full-width
- **Fail:** Multi-column hoặc overflow

---

## Phase H: Key rotation + quota (AC #6)

### H1: Key status → Active sau first 200
- **AC:** #6, #18 — unverified → active lúc first 200
- **Steps:**
  1. Add SubDL key (status = "Unverified")
  2. Search "Inception" → success
  3. Mở Settings → check key status
- **Expected:** Key status đổi từ "Unverified" → "Active" (green badge)
- **Pass:** Status = "Active" sau successful search
- **Fail:** Status vẫn "Unverified"

### H2: Quota display
- **AC:** #5, #6 — remaining downloads hiển thị
- **Steps:**
  1. Add OS key
  2. Search + download 1 subtitle
  3. Mở Settings → check quota
- **Expected:** Key card hiển thị "X/100 left" (OS) hoặc "X/N left" (SubDL)
- **Pass:** Quota number hiển thị + giảm sau download
- **Fail:** Không hiển thị quota hoặc không giảm

### H3: Rate-limited key → skip + retry
- **AC:** #3, #6 — 429 → rotate key → retry
- **Pre:** Cần 2+ keys cho 1 provider (hard to test without real 429)
- **Steps:**
  1. Add 2 SubDL keys
  2. Search nhiều lần đến khi 1 key bị 429
  3. Quan sát
- **Expected:** Key bị 429 → status "Rate-limited" (amber) + `rateLimitedUntil` set. Search tiếp dùng key #2.
- **Pass:** Key #1 = rate-limited, key #2 dùng tiếp
- **Fail:** Search fail hoàn toàn khi 1 key rate-limited

---

## Phase I: Build verification (AC #12)

### I1: Build pass
- **AC:** #12 — npm run build + typecheck + test pass
- **Steps:**
  1. `npm run typecheck` → 0 errors
  2. `npm run build` → success
  3. `npm run test:unit` → subtitle search tests pass
- **Expected:** All pass
- **Pass:** 3 commands pass
- **Fail:** Any fail

---

## Summary checklist

| Phase | AC | Test cases | Status |
|-------|-----|-----------|--------|
| A | #4,5,9,10 | A1-A7 | ☐ |
| B | #1,12 | B1-B2 | ☐ |
| C | #1,2,8,10 | C1-C7 | ☐ |
| D | #3,4,8 | D1-D5 | ☐ |
| E | #3 | E1-E2 | ☐ |
| F | #7,8 | F1-F3 | ☐ |
| G | #9 | G1-G2 | ☐ |
| H | #6 | H1-H3 | ☐ |
| I | #12 | I1 | ☐ |

**Total: 30 test cases across 9 phases**

---

## Notes

- **API keys:** Anh cần cung cấp SubDL + OpenSubtitles API keys để test full flow. Không có key = chỉ test được Phase B (no key state) + Phase I (build).
- **Phase H3** (rate-limited) khó test tự động — cần real 429. Có thể skip hoặc mock.
- **Phase F1/F3** (network error/timeout) cần block domain — có thể dùng Chrome DevTools Network throttling.
- **MCP tools:** Dùng `stealth-chrome-devtools` (primary) hoặc `chrome-devtools` (fallback).
- **Test data:** "Inception" cho movie, "Perfect Crown" cho TV (kisskh.co).
