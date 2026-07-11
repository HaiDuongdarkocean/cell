# Card Creator — UI Test Plan (edge-devtools MCP)

> Subagent chạy test bằng MCP server `edge-devtools` trên test page standalone.
> Test page render Card Creator dialog + bottom sheet + settings panel với mock context (no real AnkiConnect).

## Test page URL
`http://127.0.0.1:8765/src/entrypoints/test/cardCreatorTest.html`

## Mock context
- AnkiConnect URL: `http://localhost:8765` (offline — no Anki running → dialog sẽ show error alert, đó là expected)
- Mock cue: target "This is the target sentence." / native "Đây là câu mục tiêu."
- Mock video element: hidden (screenshot/audio capture sẽ fail gracefully)

## MCP tools available (server: `edge-devtools`)
- `new_page` / `navigate_page` — mở page
- `take_snapshot` — lấy accessibility tree + element UIDs
- `click` — click element by uid
- `fill` / `fill_form` — điền input/select
- `take_screenshot` — chụp màn hình
- `evaluate_script` — chạy JS trong page
- `list_console_messages` — check console errors
- `resize_page` — resize viewport (test responsive)
- `press_key` — simulate keyboard

## Test cases

### TC1 — Page load + control buttons render
1. `navigate_page` đến test page URL
2. `take_snapshot` — verify 4 control buttons: "Open Desktop Dialog", "Open Mobile Bottom Sheet", "Open Settings", "Toggle Dark/Light"
3. `list_console_messages` — verify không có error console messages (warnings OK)
- **PASS**: 4 buttons visible, 0 error console messages
- **FAIL**: thiếu button hoặc có error

### TC2 — Desktop dialog open + render all sections
1. `take_snapshot` → tìm uid của "Open Desktop Dialog" button
2. `click` button đó
3. `take_snapshot` — verify dialog mở với:
   - Title "Card Creator"
   - Alert box "Failed to load from AnkiConnect" (expected — Anki offline)
   - Section "Card destination" với Note type + Deck selects
   - Section "Fields" với 10 field rows: Target word, Sentence, Sentence translation, Definitions, Image, Sentence audio, Word audio, Note, More example, Tags
   - Footer: Update mode select + Cancel/Add/Update buttons
   - Update button disabled (no recent note)
4. `take_screenshot` — lưu visual
- **PASS**: tất cả sections + fields render đúng thứ tự
- **FAIL**: thiếu section/field hoặc sai thứ tự

### TC3 — Fill text fields + verify state
1. Với dialog đang mở (từ TC2)
2. `fill` Target word input với "hello"
3. `fill` Sentence textarea với "Hello world."
4. `evaluate_script` — đọc React state: `() => document.querySelector('[data-testid="cc-target-word"] input')?.value` → verify "hello"
5. `evaluate_script` — verify sentence: `() => document.querySelector('[data-testid="cc-sentence"] textarea')?.value` → verify "Hello world."
- **PASS**: values persist trong DOM
- **FAIL**: value không update

### TC4 — Change note type select
1. `take_snapshot` → tìm uid của Note type select (`[data-testid="cc-note-type"]`)
2. `fill` select với giá trị khác (nếu có options — Anki offline nên có thể empty)
3. Nếu select empty (no options) → skip, ghi note "Anki offline — select empty, expected"
- **PASS**: select render, không crash khi empty
- **FAIL**: crash hoặc select không render

### TC5 — Update mode select
1. `take_snapshot` → tìm uid của Update mode select (`[data-testid="cc-update-mode"]`)
2. `fill` với "append"
3. `evaluate_script` — verify: `() => document.querySelector('[data-testid="cc-update-mode"] select')?.value` → "append"
4. `fill` với "skip" → verify "skip"
- **PASS**: select change value
- **FAIL**: value không đổi

### TC6 — Cancel button closes dialog
1. `take_snapshot` → tìm uid của Cancel button
2. `click` Cancel
3. `take_snapshot` — verify dialog đóng (không còn "Card Creator" title)
- **PASS**: dialog đóng
- **FAIL**: dialog vẫn mở

### TC7 — Mobile bottom sheet open + stacked layout
1. `resize_page` thành 375x812 (iPhone X)
2. `take_snapshot` → tìm "Open Mobile Bottom Sheet" button
3. `click` button
4. `take_snapshot` — verify:
   - Bottom sheet mở (title "Card Creator")
   - pairRow stacked vertically (Note type + Deck stacked, không phải side-by-side)
   - Footer stacked: Update mode on top, buttons row below (Cancel/Add/Update flex:1)
5. `take_screenshot` — lưu visual mobile
6. `evaluate_script` — verify CSS: `() => { const el = document.querySelector('[data-testid="card-creator-bottom-sheet"]'); return el ? getComputedStyle(el).display : 'not found'; }`
- **PASS**: bottom sheet render, layout stacked trên mobile
- **FAIL**: layout desktop trên mobile hoặc sheet không mở

### TC8 — Settings panel render (Card Creator section)
1. `resize_page` lại thành 1280x800 (desktop)
2. `click` "Open Settings" button
3. `take_snapshot` — verify Card Creator settings panel render:
   - AnkiConnect URL input (default "http://localhost:8765")
   - Hint text "Default: localhost:8765..."
   - Connection status bar với status-dot + status-label
   - "Test again" button
4. `take_screenshot`
- **PASS**: settings panel render đầy đủ
- **FAIL**: thiếu field hoặc status bar

### TC9 — Settings: change AnkiConnect URL
1. `fill` URL input với "http://192.168.1.100:8765"
2. `evaluate_script` — verify: `() => document.querySelector('input[type="text"]')?.value` (hoặc selector cụ thể hơn)
3. `click` "Test again" button
4. `list_console_messages` — verify không crash
5. `take_snapshot` — verify status bar update (sẽ show offline vì URL không reach)
- **PASS**: URL change + Test again không crash, status update
- **FAIL**: crash hoặc status không update

### TC10 — Theme toggle
1. `click` "Toggle Dark/Light"
2. `evaluate_script` — verify: `() => document.body.getAttribute('data-theme')` → "light"
3. `take_screenshot` — verify visual đổi
4. `click` lại → verify "dark"
- **PASS**: theme toggle hoạt động
- **FAIL**: theme không đổi

### TC11 — Keyboard shortcuts (q/e) — NOT applicable on test page
- Keyboard shortcuts (q → quick update, e → edit) chỉ hoạt động trên trang có subtitle block (content script).
- Test page standalone không có subtitle block → skip.
- Ghi note: "Keyboard shortcuts test cần install extension + test trên trang phim thật."

## Report format
Sau khi chạy tất cả TC, gửi report theo format:

```
## Card Creator UI Test Report

### Summary
- Total: X/11 test cases
- PASS: X
- FAIL: X
- SKIP: X

### Details
| TC | Name | Status | Notes |
|----|------|--------|-------|
| TC1 | Page load | PASS | 4 buttons render, 0 console errors |
| TC2 | Desktop dialog | PASS/FAIL | ... |
...

### Failures (if any)
- TCX: [mô tả lỗi] — [screenshot path] — [console errors if any]

### Screenshots
- TC2 desktop: [path]
- TC7 mobile: [path]
- TC8 settings: [path]

### Console errors (if any)
- [error message]

### Recommendations
- [nếu có issue cần fix]
```
